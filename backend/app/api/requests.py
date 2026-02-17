from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.extensions import db
from app.models.request import AcquisitionRequest
from app.models.activity import ActivityLog
from app.services.workflow import submit_request as workflow_submit

requests_bp = Blueprint('requests', __name__)


def _generate_request_number():
    """Generate a unique request number like ACQ-2026-0001."""
    year = datetime.utcnow().strftime('%Y')
    last = AcquisitionRequest.query.filter(
        AcquisitionRequest.request_number.like(f'ACQ-{year}-%')
    ).order_by(AcquisitionRequest.id.desc()).first()

    if last:
        try:
            seq = int(last.request_number.split('-')[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    else:
        seq = 1

    return f'ACQ-{year}-{seq:04d}'


@requests_bp.route('', methods=['GET'])
@jwt_required()
def list_requests():
    query = AcquisitionRequest.query

    # Filters
    status = request.args.get('status')
    if status:
        query = query.filter(AcquisitionRequest.status == status)

    acq_type = request.args.get('type')
    if acq_type:
        query = query.filter(AcquisitionRequest.derived_acquisition_type == acq_type)

    tier = request.args.get('tier')
    if tier:
        query = query.filter(AcquisitionRequest.derived_tier == tier)

    search = request.args.get('search')
    if search:
        query = query.filter(
            db.or_(
                AcquisitionRequest.title.ilike(f'%{search}%'),
                AcquisitionRequest.request_number.ilike(f'%{search}%'),
                AcquisitionRequest.description.ilike(f'%{search}%'),
            )
        )

    pipeline = request.args.get('pipeline')
    if pipeline:
        query = query.filter(AcquisitionRequest.derived_pipeline == pipeline)

    fiscal_year = request.args.get('fiscal_year')
    if fiscal_year:
        query = query.filter(AcquisitionRequest.fiscal_year == fiscal_year)

    # Sort
    sort = request.args.get('sort', 'created_desc')
    if sort == 'created_asc':
        query = query.order_by(AcquisitionRequest.created_at.asc())
    elif sort == 'value_desc':
        query = query.order_by(AcquisitionRequest.estimated_value.desc())
    elif sort == 'value_asc':
        query = query.order_by(AcquisitionRequest.estimated_value.asc())
    else:
        query = query.order_by(AcquisitionRequest.created_at.desc())

    # Pagination
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    per_page = min(per_page, 100)

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'requests': [r.to_dict() for r in paginated.items],
        'total': paginated.total,
        'page': paginated.page,
        'pages': paginated.pages,
        'per_page': per_page,
    })


@requests_bp.route('/<int:request_id>', methods=['GET'])
@jwt_required()
def get_request(request_id):
    acq = AcquisitionRequest.query.get_or_404(request_id)
    include = request.args.get('include_relations', 'false').lower() == 'true'
    return jsonify(acq.to_dict(include_relations=include))


@requests_bp.route('', methods=['POST'])
@jwt_required()
def create_request():
    user_id = get_jwt_identity()
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Title is required'}), 400

    # Map need_sub_type to the correct backend column based on need_type
    need_type = data.get('need_type')
    need_sub_type = data.get('need_sub_type')
    q2_situation = need_sub_type if need_type == 'continue_extend' else None
    q5_change_type = need_sub_type if need_type == 'change_existing' else None

    acq = AcquisitionRequest(
        request_number=_generate_request_number(),
        title=title,
        description=data.get('description'),
        estimated_value=data.get('estimated_value', 0),
        fiscal_year=data.get('fiscal_year', datetime.utcnow().strftime('%Y')),
        priority=data.get('priority', 'medium'),
        need_by_date=data.get('need_by_date'),
        status='draft',
        requestor_id=int(user_id),
        requestor_name=data.get('requestor_name'),
        requestor_org=data.get('requestor_org'),
        notes=data.get('notes'),
        # Intake answers from guided wizard
        intake_q1_need_type=need_type,
        intake_q2_situation=q2_situation,
        intake_q3_specific_vendor=data.get('vendor_known'),
        intake_q4_existing_vehicle=data.get('existing_vehicle'),
        intake_q5_change_type=q5_change_type,
        intake_q_buy_category=data.get('buy_category'),
        intake_q_mixed_predominant=data.get('predominant_element'),
        existing_contract_number=data.get('existing_contract_number'),
        existing_contract_vendor=data.get('existing_contractor_name'),
        existing_contract_end_date=data.get('existing_contract_end'),
    )
    db.session.add(acq)

    log = ActivityLog(
        request_id=None,  # will be set after flush
        activity_type='created',
        description=f'Request "{title}" created',
        actor=data.get('requestor_name', 'Unknown'),
    )
    db.session.flush()
    log.request_id = acq.id
    db.session.add(log)
    db.session.commit()

    return jsonify(acq.to_dict()), 201


@requests_bp.route('/<int:request_id>', methods=['PUT'])
@jwt_required()
def update_request(request_id):
    acq = AcquisitionRequest.query.get_or_404(request_id)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    # Updatable fields
    updatable = [
        'title', 'description', 'estimated_value', 'fiscal_year', 'priority',
        'need_by_date', 'notes', 'requestor_name', 'requestor_org',
        'existing_contract_number', 'existing_contract_vendor', 'existing_contract_value',
        'existing_contract_end_date', 'existing_contract_vehicle',
        'options_remaining', 'current_option_year', 'cpars_rating',
        'awarded_date', 'awarded_vendor', 'awarded_amount', 'po_number',
    ]

    for field in updatable:
        if field in data:
            setattr(acq, field, data[field])

    acq.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify(acq.to_dict())


@requests_bp.route('/<int:request_id>', methods=['DELETE'])
@jwt_required()
def delete_request(request_id):
    """Delete a request. Admins can delete any; requestors can delete own drafts."""
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    role = claims.get('role', '')

    acq = AcquisitionRequest.query.get_or_404(request_id)

    # Admins can delete any request
    if role == 'admin':
        pass
    # Requestors can delete their own drafts
    elif acq.requestor_id == user_id and acq.status == 'draft':
        pass
    else:
        return jsonify({'error': 'Only admins can delete requests, or requestors can delete their own drafts'}), 403

    title = acq.title
    req_num = acq.request_number

    # Cascade deletes handle related records (CLINs, docs, approvals, advisories, activity logs)
    db.session.delete(acq)
    db.session.commit()

    return jsonify({'success': True, 'message': f'Request {req_num} "{title}" deleted'})


@requests_bp.route('/<int:request_id>/submit', methods=['POST'])
@jwt_required()
def submit(request_id):
    result = workflow_submit(request_id)
    if 'error' in result:
        return jsonify(result), 400
    return jsonify(result)
