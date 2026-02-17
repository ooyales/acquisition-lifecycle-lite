"""
Approval State Machine — manages the approval workflow lifecycle.

Handles template selection, request submission, step advancement,
and approve/reject/return actions.

Now supports template_key-based selection (from IntakePath derivation)
in addition to pipeline_type fallback.
"""

import json
from datetime import datetime, timedelta
from app.extensions import db
from app.models.approval import ApprovalTemplate, ApprovalTemplateStep, ApprovalStep
from app.models.request import AcquisitionRequest
from app.models.activity import ActivityLog
from app.services.notifications import notify_users_by_role, notify_requestor


def select_template(request, template_key=None):
    """
    Find the appropriate ApprovalTemplate.

    Priority:
    1. By template_key (from IntakePath derivation result, e.g. "APPR-FULL-LEGAL")
    2. By pipeline_type (from request's derived_pipeline, e.g. "full")

    Args:
        request: AcquisitionRequest instance
        template_key: Optional specific template key from derivation

    Returns:
        ApprovalTemplate or None
    """
    # Try template_key first (most specific)
    if template_key:
        template = ApprovalTemplate.query.filter_by(template_key=template_key).first()
        if template:
            return template

    # Fall back to pipeline_type matching
    pipeline = request.derived_pipeline
    if not pipeline:
        return None

    template = ApprovalTemplate.query.filter_by(pipeline_type=pipeline).first()
    return template


def submit_request(request_id, template_key=None):
    """
    Submit a request into the approval workflow.
    Creates ApprovalStep instances from the template and activates step 1.

    Args:
        request_id: int
        template_key: Optional template key override

    Returns:
        dict with status info
    """
    request = AcquisitionRequest.query.get(request_id)
    if not request:
        return {'error': 'Request not found'}

    if request.status not in ('draft', 'returned'):
        return {'error': f'Cannot submit request in status: {request.status}'}

    # Find template
    template = select_template(request, template_key=template_key)
    if not template:
        return {'error': f'No approval template found for pipeline: {request.derived_pipeline}'}

    # Clear any existing steps (for resubmission after return)
    existing_steps = ApprovalStep.query.filter_by(request_id=request_id).all()
    for step in existing_steps:
        db.session.delete(step)
    db.session.flush()

    # Create steps from template, evaluating conditional steps
    template_steps = ApprovalTemplateStep.query.filter_by(
        template_id=template.id
    ).order_by(ApprovalTemplateStep.step_number).all()

    active_step_number = 0
    created_steps = []

    for ts in template_steps:
        # Evaluate conditional steps
        if ts.is_conditional and ts.condition_rule:
            if not _evaluate_step_condition(ts.condition_rule, request):
                # Create as skipped
                step = ApprovalStep(
                    request_id=request_id,
                    step_number=ts.step_number,
                    step_name=ts.step_name,
                    approver_role=ts.approver_role,
                    status='skipped',
                )
                db.session.add(step)
                created_steps.append(step)
                continue

        step = ApprovalStep(
            request_id=request_id,
            step_number=ts.step_number,
            step_name=ts.step_name,
            approver_role=ts.approver_role,
            status='pending',
        )
        db.session.add(step)
        created_steps.append(step)

    db.session.flush()

    # Activate the first non-skipped step
    for step in created_steps:
        if step.status == 'pending':
            step.status = 'active'
            step.activated_at = datetime.utcnow()
            step.due_date = datetime.utcnow() + timedelta(days=_get_sla_days(template, step.step_number))
            request.status = _step_to_status(step.step_name)
            break

    request.status = request.status if request.status != 'draft' else 'submitted'

    # Log activity
    log = ActivityLog(
        request_id=request_id,
        activity_type='submitted',
        description=f'Request submitted into {template.name} pipeline',
        actor=request.requestor_name or 'System',
    )
    db.session.add(log)

    # Notify the first approver
    for step in created_steps:
        if step.status == 'active':
            notify_users_by_role(
                step.approver_role, request_id, 'step_activated',
                f'Action required: {step.step_name}',
                f'Request "{request.title}" ({request.request_number}) needs your {step.step_name} review.'
            )
            break

    db.session.commit()

    return {
        'success': True,
        'template': template.name,
        'template_key': template.template_key,
        'pipeline': template.pipeline_type,
        'steps_created': len(created_steps),
        'current_status': request.status,
    }


def process_approval(step_id, action, actor_name, actor_id=None, comments=None):
    """
    Process an approval action on a step.

    Args:
        step_id: int
        action: 'approve' | 'reject' | 'return'
        actor_name: str
        actor_id: int (optional)
        comments: str (optional)

    Returns:
        dict with result info
    """
    step = ApprovalStep.query.get(step_id)
    if not step:
        return {'error': 'Approval step not found'}

    if step.status != 'active':
        return {'error': f'Step is not active (current status: {step.status})'}

    request = AcquisitionRequest.query.get(step.request_id)
    if not request:
        return {'error': 'Associated request not found'}

    now = datetime.utcnow()

    if action == 'approve':
        step.status = 'approved'
        step.acted_on_date = now
        step.action_by = actor_name
        step.action_by_id = actor_id
        step.comments = comments

        # Log
        log = ActivityLog(
            request_id=request.id,
            activity_type='approved',
            description=f'{step.step_name} approved by {actor_name}',
            actor=actor_name,
            old_value=request.status,
        )

        # Try to advance to next step
        next_step = _find_next_step(request.id, step.step_number)
        if next_step:
            next_step.status = 'active'
            next_step.activated_at = now
            template = select_template(request)
            sla = _get_sla_days(template, next_step.step_number) if template else 5
            next_step.due_date = now + timedelta(days=sla)
            request.status = _step_to_status(next_step.step_name)
            log.new_value = request.status

            # Notify next approver
            notify_users_by_role(
                next_step.approver_role, request.id, 'step_activated',
                f'Action required: {next_step.step_name}',
                f'Request "{request.title}" ({request.request_number}) is ready for your {next_step.step_name} review.'
            )
        else:
            # All steps complete — approved!
            request.status = 'approved'
            log.new_value = 'approved'
            log_final = ActivityLog(
                request_id=request.id,
                activity_type='fully_approved',
                description='All approval steps completed — request fully approved',
                actor='System',
            )
            db.session.add(log_final)

            # Notify requestor of full approval
            notify_requestor(
                request.id, 'request_fully_approved',
                f'Request approved: {request.title}',
                f'Your request "{request.title}" ({request.request_number}) has been fully approved.'
            )

        db.session.add(log)

    elif action == 'reject':
        step.status = 'rejected'
        step.acted_on_date = now
        step.action_by = actor_name
        step.action_by_id = actor_id
        step.comments = comments
        request.status = 'cancelled'

        log = ActivityLog(
            request_id=request.id,
            activity_type='rejected',
            description=f'{step.step_name} rejected by {actor_name}: {comments or "No reason given"}',
            actor=actor_name,
            new_value='cancelled',
        )
        db.session.add(log)

        # Notify requestor of rejection
        notify_requestor(
            request.id, 'request_rejected',
            f'Request rejected: {request.title}',
            f'Your request "{request.title}" ({request.request_number}) was rejected at {step.step_name}. Reason: {comments or "No reason given"}'
        )

    elif action == 'return':
        step.status = 'returned'
        step.acted_on_date = now
        step.action_by = actor_name
        step.action_by_id = actor_id
        step.comments = comments
        request.status = 'returned'

        log = ActivityLog(
            request_id=request.id,
            activity_type='returned',
            description=f'{step.step_name} returned by {actor_name}: {comments or "No reason given"}',
            actor=actor_name,
            new_value='returned',
        )
        db.session.add(log)

        # Notify requestor of return
        notify_requestor(
            request.id, 'request_returned',
            f'Request returned: {request.title}',
            f'Your request "{request.title}" ({request.request_number}) was returned at {step.step_name} for revisions. Reason: {comments or "No reason given"}'
        )

    else:
        return {'error': f'Unknown action: {action}'}

    db.session.commit()

    return {
        'success': True,
        'action': action,
        'step_name': step.step_name,
        'request_status': request.status,
    }


def get_approval_status(request_id):
    """
    Get the current approval status for a request.

    Returns:
        dict with steps, current_step, progress info
    """
    steps = ApprovalStep.query.filter_by(request_id=request_id).order_by(
        ApprovalStep.step_number
    ).all()

    if not steps:
        return {
            'steps': [],
            'current_step': None,
            'progress': 0,
            'total_steps': 0,
        }

    current = None
    completed = 0
    non_skipped = 0

    for s in steps:
        if s.status != 'skipped':
            non_skipped += 1
        if s.status == 'active':
            current = s.to_dict()
        if s.status == 'approved':
            completed += 1

    progress = (completed / non_skipped * 100) if non_skipped > 0 else 0

    return {
        'steps': [s.to_dict() for s in steps],
        'current_step': current,
        'completed': completed,
        'total_steps': non_skipped,
        'progress': round(progress, 1),
    }


def _find_next_step(request_id, current_step_number):
    """Find the next pending (non-skipped) step after the current one."""
    return ApprovalStep.query.filter(
        ApprovalStep.request_id == request_id,
        ApprovalStep.step_number > current_step_number,
        ApprovalStep.status == 'pending',
    ).order_by(ApprovalStep.step_number).first()


def _step_to_status(step_name):
    """Convert step name to request status.

    Expanded to handle step names from all 9 approval templates.
    """
    name_map = {
        # Full Pipeline
        'ISS': 'iss_review',
        'ISS Review': 'iss_review',
        'ASR': 'asr_review',
        'ASR Review': 'asr_review',
        'Finance': 'finance_review',
        'Finance Review': 'finance_review',
        'KO Review': 'ko_review',
        'KO Action': 'ko_review',
        'KO Execution': 'ko_review',
        'KO Determination': 'ko_review',
        'KO Contract Mod': 'ko_review',
        'Legal Review': 'legal_review',
        'CIO Approval': 'cio_approval',
        'Senior Leadership': 'senior_review',
        # Abbreviated / Option
        'COR Review': 'iss_review',
        'COR Confirmation': 'iss_review',
        'COR Authorization': 'ko_review',
        'COR + PM Justification': 'iss_review',
        'COR Justification': 'iss_review',
        # CLIN Execution
        'PM Approval': 'iss_review',
        'CTO Approval': 'cio_approval',
        # CLIN Exec + Funding
        'FM Funding Identification': 'finance_review',
        'BM LOA Confirmation': 'finance_review',
        # Micro
        'Supervisor': 'iss_review',
        'Supervisor Approval': 'iss_review',
        'GPC Purchase': 'finance_review',
        'GPC Holder': 'finance_review',
    }
    return name_map.get(step_name, 'submitted')


def _get_sla_days(template, step_number):
    """Get SLA days for a specific step from the template."""
    if not template:
        return 5
    ts = ApprovalTemplateStep.query.filter_by(
        template_id=template.id,
        step_number=step_number,
    ).first()
    return ts.sla_days if ts else 5


def _evaluate_step_condition(condition_json, request):
    """Evaluate whether a conditional step applies to this request."""
    try:
        conditions = json.loads(condition_json) if isinstance(condition_json, str) else condition_json
    except (json.JSONDecodeError, TypeError):
        return True  # If we can't parse, include the step

    if 'allOf' in conditions:
        return all(_eval_single(c, request) for c in conditions['allOf'])
    if 'anyOf' in conditions:
        return any(_eval_single(c, request) for c in conditions['anyOf'])
    return _eval_single(conditions, request)


def _eval_single(condition, request):
    """Evaluate a single condition."""
    field = condition.get('field')
    operator = condition.get('operator')
    if not field or not operator:
        return True

    value = getattr(request, field, None)

    if operator == 'in':
        return value in condition.get('values', [])
    if operator == 'not_in':
        return value not in condition.get('values', [])
    if operator == '==':
        return value == condition.get('value')
    if operator == '!=':
        return value != condition.get('value')
    if operator == 'exists':
        return value is not None

    return True
