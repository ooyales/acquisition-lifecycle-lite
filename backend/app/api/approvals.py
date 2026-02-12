"""Approvals API blueprint for managing approval workflow."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app.extensions import db
from app.models.request import AcquisitionRequest
from app.models.approval import ApprovalTemplate, ApprovalStep
from app.services.workflow_engine import process_approval, get_approval_status
from app.errors import BadRequestError, NotFoundError

approvals_bp = Blueprint('approvals', __name__, url_prefix='/api/approvals')


@approvals_bp.route('/queue', methods=['GET'])
@jwt_required()
def approval_queue():
    """Return active approval steps for the current user's role.

    JWT claims provide: role, name, email.
    Filters ApprovalStep where status='active' and approver_role matches the
    current user's role. Includes related request info.
    """
    claims = get_jwt()
    user_role = claims.get('role', '')

    # Find all active steps matching this user's role
    steps = ApprovalStep.query.filter_by(
        status='active',
        approver_role=user_role
    ).order_by(ApprovalStep.activated_at.desc()).all()

    queue_items = []
    for step in steps:
        req = AcquisitionRequest.query.get(step.request_id)
        if not req:
            continue

        step_dict = step.to_dict()
        # Add overdue flag
        from datetime import datetime
        now = datetime.now()
        step_dict['is_overdue'] = (
            step.due_date is not None and step.due_date < now
        )
        # Add request info
        step_dict['request'] = {
            'id': req.id,
            'title': req.title,
            'request_number': req.request_number,
            'estimated_total': req.estimated_total,
            'category': req.category,
            'sub_category': req.sub_category,
            'priority': req.priority,
            'requestor_name': req.requestor_name,
            'requestor_org': req.requestor_org,
            'need_by_date': req.need_by_date,
        }
        queue_items.append(step_dict)

    return jsonify({
        'queue': queue_items,
        'count': len(queue_items),
        'role': user_role,
    })


@approvals_bp.route('/<int:step_id>/process', methods=['POST'])
@jwt_required()
def process_approval_action(step_id):
    """Process an approval action on a step.

    Body: {"action": "approve"|"reject"|"return"|"skip", "comments": "..."}
    """
    data = request.get_json()
    if not data:
        raise BadRequestError('Request body is required')

    action = data.get('action')
    if not action:
        raise BadRequestError('Action is required')

    valid_actions = ('approve', 'reject', 'return', 'skip')
    if action not in valid_actions:
        raise BadRequestError(f'Invalid action: {action}. Must be one of: {", ".join(valid_actions)}')

    comments = data.get('comments', '')
    claims = get_jwt()
    actor = claims.get('name', claims.get('email', 'Unknown'))

    req = process_approval(step_id, action, actor, comments)

    # Return the updated request with approval steps
    result = req.to_dict()
    steps = ApprovalStep.query.filter_by(
        request_id=req.id
    ).order_by(ApprovalStep.step_number).all()
    result['approval_steps'] = [s.to_dict() for s in steps]

    return jsonify(result)


@approvals_bp.route('/request/<int:request_id>', methods=['GET'])
@jwt_required()
def request_approval_status(request_id):
    """Return all approval steps for a request with status info."""
    status = get_approval_status(request_id)
    return jsonify(status)


@approvals_bp.route('/templates', methods=['GET'])
@jwt_required()
def list_templates():
    """List all approval templates with their steps."""
    templates = ApprovalTemplate.query.all()
    return jsonify({
        'templates': [t.to_dict() for t in templates],
        'count': len(templates),
    })
