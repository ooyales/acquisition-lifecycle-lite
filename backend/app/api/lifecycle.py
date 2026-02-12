import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app.extensions import db
from app.models.lifecycle import LifecycleEvent
from app.models.request import AcquisitionRequest
from app.models.activity import ActivityLog
from app.errors import BadRequestError, NotFoundError

lifecycle_bp = Blueprint('lifecycle', __name__, url_prefix='/api/lifecycle')

# Map lifecycle event_type to acquisition category
EVENT_TYPE_TO_CATEGORY = {
    'warranty_expiry': 'hardware_purchase',
    'license_renewal': 'software_license',
    'contract_end': 'service_contract',
    'support_end': 'maintenance_support',
    'lease_end': 'hardware_purchase',
}

# Map lifecycle action_needed to acquisition sub_category
ACTION_TO_SUBCATEGORY = {
    'replace': 'replacement',
    'renew': 'renewal',
    'recompete': 'recompete',
    'decommission': 'other',
}


@lifecycle_bp.route('', methods=['GET'])
@jwt_required()
def list_events():
    """List all lifecycle events, ordered by event_date. Optional filters."""
    query = LifecycleEvent.query

    status = request.args.get('status')
    if status:
        query = query.filter_by(status=status)

    event_type = request.args.get('event_type')
    if event_type:
        query = query.filter_by(event_type=event_type)

    fiscal_year_impact = request.args.get('fiscal_year_impact')
    if fiscal_year_impact:
        query = query.filter_by(fiscal_year_impact=fiscal_year_impact)

    events = query.order_by(LifecycleEvent.event_date).all()
    return jsonify({'events': [e.to_dict() for e in events]})


@lifecycle_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
def get_event(id):
    """Get a single lifecycle event by ID."""
    event = LifecycleEvent.query.get(id)
    if not event:
        raise NotFoundError(f'Lifecycle event {id} not found')
    return jsonify(event.to_dict())


@lifecycle_bp.route('', methods=['POST'])
@jwt_required()
def create_event():
    """Create a new lifecycle event."""
    data = request.get_json()
    if not data:
        raise BadRequestError('Request body is required')

    if not data.get('asset_name'):
        raise BadRequestError('Asset name is required')
    if not data.get('event_type'):
        raise BadRequestError('Event type is required')

    event = LifecycleEvent(
        asset_tracker_id=data.get('asset_tracker_id'),
        asset_name=data['asset_name'],
        event_type=data['event_type'],
        event_date=data.get('event_date'),
        lead_time_days=data.get('lead_time_days', 180),
        action_needed=data.get('action_needed'),
        estimated_cost=data.get('estimated_cost'),
        status=data.get('status', 'upcoming'),
        fiscal_year_impact=data.get('fiscal_year_impact'),
        notes=data.get('notes'),
    )
    db.session.add(event)
    db.session.commit()
    return jsonify(event.to_dict()), 201


@lifecycle_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_event(id):
    """Update an existing lifecycle event."""
    event = LifecycleEvent.query.get(id)
    if not event:
        raise NotFoundError(f'Lifecycle event {id} not found')

    data = request.get_json()
    if not data:
        raise BadRequestError('Request body is required')

    updatable = [
        'asset_tracker_id', 'asset_name', 'event_type', 'event_date',
        'lead_time_days', 'action_needed', 'estimated_cost', 'status',
        'acquisition_request_id', 'fiscal_year_impact', 'notes',
    ]
    for field in updatable:
        if field in data:
            setattr(event, field, data[field])

    db.session.commit()
    return jsonify(event.to_dict())


@lifecycle_bp.route('/<int:id>/create-request', methods=['POST'])
@jwt_required()
def create_request_from_event(id):
    """Create an acquisition request from a lifecycle event."""
    event = LifecycleEvent.query.get(id)
    if not event:
        raise NotFoundError(f'Lifecycle event {id} not found')

    if event.acquisition_request_id:
        raise BadRequestError(
            f'This lifecycle event already has an associated request (ID: {event.acquisition_request_id})'
        )

    claims = get_jwt()

    # Determine category from event type
    category = EVENT_TYPE_TO_CATEGORY.get(event.event_type, 'other')
    sub_category = ACTION_TO_SUBCATEGORY.get(event.action_needed, 'other')

    # Generate request number
    count = AcquisitionRequest.query.count() + 1
    request_number = f"ACQ-FY26-{count:04d}"
    while AcquisitionRequest.query.filter_by(request_number=request_number).first():
        count += 1
        request_number = f"ACQ-FY26-{count:04d}"

    title = f"Lifecycle: {event.asset_name} - {event.event_type.replace('_', ' ').title()}"

    req = AcquisitionRequest(
        request_number=request_number,
        title=title,
        description=f"Auto-created from lifecycle event: {event.asset_name} ({event.event_type})",
        category=category,
        sub_category=sub_category,
        justification=f"Lifecycle event requires action: {event.action_needed or 'TBD'}. "
                      f"Event date: {event.event_date or 'TBD'}.",
        trigger_type='lifecycle',
        trigger_asset_id=event.asset_tracker_id,
        estimated_total=event.estimated_cost,
        cost_breakdown=json.dumps({}),
        fiscal_year=event.fiscal_year_impact or 'FY26',
        priority='medium',
        need_by_date=event.event_date,
        requestor_name=claims.get('name', ''),
        requestor_org=claims.get('team', ''),
        status='draft',
        tags=json.dumps([]),
    )

    db.session.add(req)
    db.session.flush()

    # Link event to request
    event.acquisition_request_id = req.id
    event.status = 'acquisition_created'

    # Log activity
    log = ActivityLog(
        request_id=req.id,
        activity_type='created',
        description=f'Request {request_number} created from lifecycle event: {event.asset_name}',
        actor=claims.get('name', 'System'),
    )
    db.session.add(log)

    db.session.commit()
    return jsonify(req.to_dict()), 201


@lifecycle_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_event(id):
    """Delete a lifecycle event."""
    event = LifecycleEvent.query.get(id)
    if not event:
        raise NotFoundError(f'Lifecycle event {id} not found')

    db.session.delete(event)
    db.session.commit()
    return jsonify({'message': f'Lifecycle event {id} deleted'})
