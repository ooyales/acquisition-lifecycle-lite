from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app.extensions import db
from app.models.request import AcquisitionRequest
from app.models.approval import ApprovalStep
from app.models.funding import FundingSource
from app.models.lifecycle import LifecycleEvent
from datetime import datetime

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')


@dashboard_bp.route('', methods=['GET'])
@jwt_required()
def get_dashboard():
    """Get dashboard summary data."""
    claims = get_jwt()
    role = claims.get('role', '')

    # Active requests (not closed, cancelled, delivered)
    active_statuses = [
        'draft', 'submitted', 'in_review', 'approved',
        'package_building', 'submitted_to_contracting', 'awarded',
    ]
    active_requests = AcquisitionRequest.query.filter(
        AcquisitionRequest.status.in_(active_statuses)
    ).count()

    # Pending approvals for current user's role
    if role == 'admin':
        pending_approvals = ApprovalStep.query.filter_by(status='active').count()
    else:
        pending_approvals = ApprovalStep.query.filter_by(
            status='active', approver_role=role
        ).count()

    # Total committed across all funding sources
    sources = FundingSource.query.all()
    total_committed = sum(s.committed or 0 for s in sources)

    # Overdue approval steps
    now = datetime.now()
    overdue_steps = ApprovalStep.query.filter(
        ApprovalStep.status == 'active',
        ApprovalStep.due_date < now
    ).count()

    # Pipeline by status
    pipeline = db.session.query(
        AcquisitionRequest.status,
        db.func.count(AcquisitionRequest.id)
    ).group_by(AcquisitionRequest.status).all()
    pipeline_data = [{'status': s, 'count': c} for s, c in pipeline]

    # Approval queue (active steps)
    if role == 'admin':
        active_steps = ApprovalStep.query.filter_by(status='active').all()
    else:
        active_steps = ApprovalStep.query.filter_by(
            status='active', approver_role=role
        ).all()

    approval_queue = []
    for step in active_steps:
        req = AcquisitionRequest.query.get(step.request_id)
        if req:
            approval_queue.append({
                'id': step.id,
                'request_id': req.id,
                'request_number': req.request_number,
                'title': req.title,
                'step_name': step.step_name,
                'due_date': step.due_date.isoformat() if step.due_date else None,
                'activated_at': step.activated_at.isoformat() if step.activated_at else None,
                'priority': req.priority,
                'estimated_total': req.estimated_total,
            })

    # Budget summary
    budget_summary = [s.to_dict() for s in sources]

    # Lifecycle alerts (upcoming/action_needed)
    upcoming = LifecycleEvent.query.filter(
        LifecycleEvent.status.in_(['upcoming', 'action_needed']),
    ).order_by(LifecycleEvent.event_date).limit(10).all()
    lifecycle_alerts = [e.to_dict() for e in upcoming]

    # Recent activity
    from app.models.activity import ActivityLog
    recent = ActivityLog.query.order_by(
        ActivityLog.created_at.desc()
    ).limit(10).all()
    recent_activity = [a.to_dict() for a in recent]

    return jsonify({
        'active_requests': active_requests,
        'pending_approvals': pending_approvals,
        'total_committed': total_committed,
        'overdue_steps': overdue_steps,
        'pipeline': pipeline_data,
        'approval_queue': approval_queue,
        'budget_summary': budget_summary,
        'lifecycle_alerts': lifecycle_alerts,
        'recent_activity': recent_activity,
    })
