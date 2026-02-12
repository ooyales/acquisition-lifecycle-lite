from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app.extensions import db
from app.models.request import AcquisitionRequest
from app.models.funding import FundingSource
from app.errors import BadRequestError, NotFoundError
import json
from datetime import datetime

requests_bp = Blueprint('requests', __name__, url_prefix='/api/requests')


@requests_bp.route('', methods=['GET'])
@jwt_required()
def list_requests():
    """List all acquisition requests with optional filters."""
    query = AcquisitionRequest.query

    status = request.args.get('status')
    if status:
        query = query.filter_by(status=status)

    category = request.args.get('category')
    if category:
        query = query.filter_by(category=category)

    priority = request.args.get('priority')
    if priority:
        query = query.filter_by(priority=priority)

    fiscal_year = request.args.get('fiscal_year')
    if fiscal_year:
        query = query.filter_by(fiscal_year=fiscal_year)

    search = request.args.get('search')
    if search:
        like = f'%{search}%'
        query = query.filter(
            db.or_(
                AcquisitionRequest.title.ilike(like),
                AcquisitionRequest.request_number.ilike(like),
                AcquisitionRequest.vendor_name.ilike(like),
            )
        )

    # Sort by updated_at desc
    requests_list = query.order_by(AcquisitionRequest.updated_at.desc()).all()
    return jsonify({'requests': [r.to_dict() for r in requests_list]})


@requests_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
def get_request(id):
    """Get a single acquisition request by ID."""
    req = AcquisitionRequest.query.get_or_404(id)
    data = req.to_dict()

    # Include approval steps
    from app.models.approval import ApprovalStep
    steps = ApprovalStep.query.filter_by(request_id=id).order_by(ApprovalStep.step_number).all()
    data['approval_steps'] = [s.to_dict() for s in steps]

    # Include documents
    from app.models.document import PackageDocument
    docs = PackageDocument.query.filter_by(request_id=id).all()
    data['documents'] = [d.to_dict() for d in docs]

    # Include comments
    from app.models.activity import Comment
    comments = Comment.query.filter_by(request_id=id).order_by(Comment.created_at.desc()).all()
    data['comments'] = [c.to_dict() for c in comments]

    # Include activity log
    from app.models.activity import ActivityLog
    activities = ActivityLog.query.filter_by(request_id=id).order_by(ActivityLog.created_at.desc()).all()
    data['activities'] = [a.to_dict() for a in activities]

    # Include funding source name
    if req.funding_source_id:
        fs = FundingSource.query.get(req.funding_source_id)
        if fs:
            data['funding_source_name'] = fs.name
            data['funding_source_available'] = fs.available

    return jsonify(data)


@requests_bp.route('', methods=['POST'])
@jwt_required()
def create_request():
    """Create a new acquisition request."""
    data = request.get_json()
    if not data:
        raise BadRequestError('Request body is required')

    if not data.get('title'):
        raise BadRequestError('Title is required')
    if not data.get('category'):
        raise BadRequestError('Category is required')

    claims = get_jwt()

    # Generate request number
    count = AcquisitionRequest.query.count() + 1
    request_number = f"ACQ-FY26-{count:04d}"
    # Ensure unique
    while AcquisitionRequest.query.filter_by(request_number=request_number).first():
        count += 1
        request_number = f"ACQ-FY26-{count:04d}"

    req = AcquisitionRequest(
        request_number=request_number,
        title=data['title'],
        description=data.get('description', ''),
        category=data['category'],
        sub_category=data.get('sub_category', ''),
        justification=data.get('justification', ''),
        trigger_type=data.get('trigger_type', 'manual'),
        trigger_asset_id=data.get('trigger_asset_id'),
        estimated_total=data.get('estimated_total'),
        cost_breakdown=json.dumps(data.get('cost_breakdown', {})),
        funding_source_id=data.get('funding_source_id'),
        fiscal_year=data.get('fiscal_year', 'FY26'),
        priority=data.get('priority', 'medium'),
        need_by_date=data.get('need_by_date'),
        contract_end_date=data.get('contract_end_date'),
        requestor_id=data.get('requestor_id'),
        requestor_name=data.get('requestor_name', claims.get('name', '')),
        requestor_org=data.get('requestor_org', ''),
        vendor_name=data.get('vendor_name'),
        product_name=data.get('product_name'),
        product_specs=json.dumps(data.get('product_specs', {})),
        quantity=data.get('quantity'),
        existing_contract_number=data.get('existing_contract_number'),
        existing_contract_value=data.get('existing_contract_value'),
        existing_vendor=data.get('existing_vendor'),
        contract_vehicle=data.get('contract_vehicle'),
        notes=data.get('notes'),
        tags=json.dumps(data.get('tags', [])),
        status='draft',
    )

    db.session.add(req)
    db.session.flush()  # Flush to get the request ID

    # Log activity
    from app.models.activity import ActivityLog
    log = ActivityLog(
        request_id=req.id,
        activity_type='created',
        description=f'Request {request_number} created',
        actor=claims.get('name', 'Unknown'),
    )
    db.session.add(log)

    db.session.commit()
    return jsonify(req.to_dict()), 201


@requests_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_request(id):
    """Update an existing acquisition request."""
    req = AcquisitionRequest.query.get_or_404(id)
    data = request.get_json()
    if not data:
        raise BadRequestError('Request body is required')

    # Only allow editing in draft or returned status
    if req.status not in ('draft', 'returned'):
        raise BadRequestError(f'Cannot edit request in {req.status} status')

    # Update allowed fields
    updatable = [
        'title', 'description', 'category', 'sub_category', 'justification',
        'trigger_type', 'trigger_asset_id', 'estimated_total', 'funding_source_id',
        'fiscal_year', 'priority', 'need_by_date', 'contract_end_date',
        'requestor_name', 'requestor_org', 'vendor_name', 'product_name',
        'quantity', 'existing_contract_number', 'existing_contract_value',
        'existing_vendor', 'contract_vehicle', 'notes',
    ]
    for field in updatable:
        if field in data:
            setattr(req, field, data[field])

    # Handle JSON fields
    if 'cost_breakdown' in data:
        req.cost_breakdown = json.dumps(data['cost_breakdown'])
    if 'product_specs' in data:
        req.product_specs = json.dumps(data['product_specs'])
    if 'tags' in data:
        req.tags = json.dumps(data['tags'])

    # If status was 'returned', reset to 'draft'
    if req.status == 'returned':
        req.status = 'draft'

    db.session.commit()
    return jsonify(req.to_dict())


@requests_bp.route('/<int:id>/submit', methods=['POST'])
@jwt_required()
def submit_request(id):
    """Submit a draft request for approval via the workflow engine."""
    from app.services.workflow_engine import submit_request as wf_submit
    from app.models.approval import ApprovalStep

    # Verify the request exists
    req = AcquisitionRequest.query.get_or_404(id)

    claims = get_jwt()
    actor = claims.get('name', 'Unknown')

    # Delegate to workflow engine (handles validation, template selection,
    # step creation, status update, and activity logging)
    req = wf_submit(req.id, actor=actor)

    # Return updated request with approval steps
    result = req.to_dict()
    steps = ApprovalStep.query.filter_by(
        request_id=req.id
    ).order_by(ApprovalStep.step_number).all()
    result['approval_steps'] = [s.to_dict() for s in steps]

    return jsonify(result)


@requests_bp.route('/<int:id>/status', methods=['PATCH'])
@jwt_required()
def update_status(id):
    """Update request status (for post-approval transitions)."""
    req = AcquisitionRequest.query.get_or_404(id)
    data = request.get_json()
    new_status = data.get('status')

    valid_transitions = {
        'approved': ['package_building'],
        'package_building': ['submitted_to_contracting'],
        'submitted_to_contracting': ['awarded'],
        'awarded': ['delivered'],
        'delivered': ['closed'],
    }

    allowed = valid_transitions.get(req.status, [])
    # Also allow cancel from most states
    if new_status == 'cancelled' and req.status not in ('closed', 'cancelled', 'delivered'):
        pass  # Allow cancellation
    elif new_status not in allowed:
        raise BadRequestError(f'Cannot transition from {req.status} to {new_status}')

    old_status = req.status
    req.status = new_status
    req.updated_at = datetime.now()

    # Set post-award fields if provided
    if new_status == 'awarded':
        req.awarded_date = data.get('awarded_date', datetime.now().strftime('%Y-%m-%d'))
        req.awarded_vendor = data.get('awarded_vendor', req.vendor_name)
        req.awarded_amount = data.get('awarded_amount', req.estimated_total)
        req.po_number = data.get('po_number')
    elif new_status == 'delivered':
        req.delivery_date = data.get('delivery_date', datetime.now().strftime('%Y-%m-%d'))
        req.received_date = data.get('received_date', datetime.now().strftime('%Y-%m-%d'))

    claims = get_jwt()
    from app.models.activity import ActivityLog
    log = ActivityLog(
        request_id=req.id,
        activity_type='status_change',
        description=f'Status changed from {old_status} to {new_status}',
        actor=claims.get('name', 'Unknown'),
        old_value=old_status,
        new_value=new_status,
    )
    db.session.add(log)
    db.session.commit()

    return jsonify(req.to_dict())


@requests_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_request(id):
    """Delete a draft request."""
    req = AcquisitionRequest.query.get_or_404(id)
    if req.status != 'draft':
        raise BadRequestError('Can only delete draft requests')

    # Delete related records that have NOT NULL foreign keys
    from app.models.activity import ActivityLog, Comment
    from app.models.approval import ApprovalStep
    from app.models.document import PackageDocument
    ActivityLog.query.filter_by(request_id=id).delete()
    Comment.query.filter_by(request_id=id).delete()
    ApprovalStep.query.filter_by(request_id=id).delete()
    PackageDocument.query.filter_by(request_id=id).delete()

    db.session.delete(req)
    db.session.commit()
    return jsonify({'message': 'Request deleted'})


@requests_bp.route('/funding-sources', methods=['GET'])
@jwt_required()
def list_funding_sources():
    """List all funding sources (for the create form picker)."""
    sources = FundingSource.query.all()
    return jsonify({'funding_sources': [s.to_dict() for s in sources]})


@requests_bp.route('/prior-acquisitions', methods=['GET'])
@jwt_required()
def search_prior_acquisitions():
    """Search prior acquisitions for IGCE reference."""
    from app.models.prior import PriorAcquisition
    search = request.args.get('search', '')
    query = PriorAcquisition.query
    if search:
        like = f'%{search}%'
        query = query.filter(
            db.or_(
                PriorAcquisition.description.ilike(like),
                PriorAcquisition.vendor.ilike(like),
                PriorAcquisition.product_category.ilike(like),
            )
        )
    priors = query.all()
    return jsonify({'prior_acquisitions': [p.to_dict() for p in priors]})
