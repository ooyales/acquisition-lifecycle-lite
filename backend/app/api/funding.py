from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app.extensions import db
from app.models.funding import FundingSource
from app.models.request import AcquisitionRequest
from app.models.activity import ActivityLog
from app.errors import BadRequestError, NotFoundError

funding_bp = Blueprint('funding', __name__, url_prefix='/api/funding')


@funding_bp.route('', methods=['GET'])
@jwt_required()
def list_funding_sources():
    """List all funding sources with computed available field."""
    sources = FundingSource.query.all()
    return jsonify({'funding_sources': [s.to_dict() for s in sources]})


@funding_bp.route('/summary', methods=['GET'])
@jwt_required()
def funding_summary():
    """Budget summary: for each source, return budget details plus commitments."""
    sources = FundingSource.query.all()
    summary = []
    for src in sources:
        # Find all requests committed against this funding source
        requests = AcquisitionRequest.query.filter_by(funding_source_id=src.id).all()
        commitments = []
        for req in requests:
            commitments.append({
                'request_id': req.id,
                'request_number': req.request_number,
                'title': req.title,
                'estimated_total': req.estimated_total,
                'status': req.status,
            })

        summary.append({
            'id': src.id,
            'name': src.name,
            'fiscal_year': src.fiscal_year,
            'total_budget': src.total_budget,
            'committed': src.committed,
            'spent': src.spent,
            'available': src.available,
            'funding_type': src.funding_type,
            'owner': src.owner,
            'commitments': commitments,
        })

    return jsonify({'summary': summary})


@funding_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
def get_funding_source(id):
    """Get a single funding source by ID."""
    src = FundingSource.query.get(id)
    if not src:
        raise NotFoundError(f'Funding source {id} not found')
    return jsonify(src.to_dict())


@funding_bp.route('', methods=['POST'])
@jwt_required()
def create_funding_source():
    """Create a new funding source."""
    data = request.get_json()
    if not data:
        raise BadRequestError('Request body is required')

    if not data.get('name'):
        raise BadRequestError('Name is required')

    src = FundingSource(
        name=data['name'],
        fiscal_year=data.get('fiscal_year', 'FY26'),
        total_budget=data.get('total_budget', 0),
        committed=data.get('committed', 0),
        spent=data.get('spent', 0),
        funding_type=data.get('funding_type', 'appropriation'),
        owner=data.get('owner', ''),
        notes=data.get('notes'),
    )
    db.session.add(src)
    db.session.commit()
    return jsonify(src.to_dict()), 201


@funding_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_funding_source(id):
    """Update an existing funding source."""
    src = FundingSource.query.get(id)
    if not src:
        raise NotFoundError(f'Funding source {id} not found')

    data = request.get_json()
    if not data:
        raise BadRequestError('Request body is required')

    updatable = [
        'name', 'fiscal_year', 'total_budget', 'committed', 'spent',
        'funding_type', 'owner', 'notes',
    ]
    for field in updatable:
        if field in data:
            setattr(src, field, data[field])

    db.session.commit()
    return jsonify(src.to_dict())


@funding_bp.route('/<int:id>/commit', methods=['POST'])
@jwt_required()
def commit_funds(id):
    """Commit funds from a funding source. Body: {"amount": 5000, "request_id": 123}."""
    src = FundingSource.query.get(id)
    if not src:
        raise NotFoundError(f'Funding source {id} not found')

    data = request.get_json()
    if not data:
        raise BadRequestError('Request body is required')

    amount = data.get('amount')
    request_id = data.get('request_id')

    if not amount or amount <= 0:
        raise BadRequestError('A positive amount is required')

    if amount > src.available:
        raise BadRequestError(
            f'Insufficient funds. Available: ${src.available:,.2f}, Requested: ${amount:,.2f}'
        )

    src.committed = (src.committed or 0) + amount
    db.session.flush()

    # Log activity on the request if provided
    if request_id:
        claims = get_jwt()
        log = ActivityLog(
            request_id=request_id,
            activity_type='funding_committed',
            description=f'${amount:,.2f} committed from {src.name}',
            actor=claims.get('name', 'Unknown'),
            new_value=str(amount),
        )
        db.session.add(log)

    db.session.commit()
    return jsonify(src.to_dict())


@funding_bp.route('/<int:id>/release', methods=['POST'])
@jwt_required()
def release_funds(id):
    """Release committed funds back to a funding source. Body: {"amount": 5000, "request_id": 123}."""
    src = FundingSource.query.get(id)
    if not src:
        raise NotFoundError(f'Funding source {id} not found')

    data = request.get_json()
    if not data:
        raise BadRequestError('Request body is required')

    amount = data.get('amount')
    request_id = data.get('request_id')

    if not amount or amount <= 0:
        raise BadRequestError('A positive amount is required')

    if amount > (src.committed or 0):
        raise BadRequestError(
            f'Cannot release more than committed. Committed: ${src.committed:,.2f}, Requested: ${amount:,.2f}'
        )

    src.committed = (src.committed or 0) - amount
    db.session.flush()

    # Log activity on the request if provided
    if request_id:
        claims = get_jwt()
        log = ActivityLog(
            request_id=request_id,
            activity_type='funding_released',
            description=f'${amount:,.2f} released from {src.name}',
            actor=claims.get('name', 'Unknown'),
            new_value=str(amount),
        )
        db.session.add(log)

    db.session.commit()
    return jsonify(src.to_dict())
