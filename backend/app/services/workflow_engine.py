"""Workflow engine for acquisition request approval state machine.

State machine:
    draft -> submitted -> in_review -> approved -> package_building ->
    submitted_to_contracting -> awarded -> delivered -> closed
                                                        -> cancelled
                                  returned <-----------/
"""
import json
from datetime import datetime, timedelta
from app.extensions import db
from app.models.request import AcquisitionRequest
from app.models.approval import ApprovalTemplate, ApprovalTemplateStep, ApprovalStep
from app.models.activity import ActivityLog
from app.errors import BadRequestError, NotFoundError


def select_template(request_obj):
    """Select the appropriate approval template based on request attributes.

    Logic:
      1. If sub_category is 'recompete', use the re-compete template.
      2. Else if estimated_total >= 25000, use the major acquisition template.
      3. Else use the default (standard) template.

    Returns:
        ApprovalTemplate instance.
    Raises:
        NotFoundError if no matching template is found.
    """
    # Check for recompete first
    if request_obj.sub_category and request_obj.sub_category.lower() == 'recompete':
        template = ApprovalTemplate.query.filter(
            ApprovalTemplate.applies_to.isnot(None)
        ).all()
        for t in template:
            conditions = json.loads(t.applies_to or '{}')
            if conditions.get('sub_category') == 'recompete' or conditions.get('category') == 'service_contract':
                return t

    # Check cost threshold
    cost = request_obj.estimated_total or 0
    if cost >= 25000:
        template = ApprovalTemplate.query.filter(
            ApprovalTemplate.applies_to.isnot(None)
        ).all()
        for t in template:
            conditions = json.loads(t.applies_to or '{}')
            if conditions.get('min_cost') is not None and cost >= conditions['min_cost']:
                # Make sure this isn't the recompete template
                if conditions.get('sub_category') != 'recompete' and conditions.get('category') != 'service_contract':
                    return t

    # Fall back to default template (standard review, max_cost <= 25000)
    default = ApprovalTemplate.query.filter_by(is_default=True).first()
    if default:
        return default

    # Last resort: pick the first template with max_cost condition
    template = ApprovalTemplate.query.filter(
        ApprovalTemplate.applies_to.isnot(None)
    ).all()
    for t in template:
        conditions = json.loads(t.applies_to or '{}')
        if conditions.get('max_cost') is not None:
            return t

    raise NotFoundError('No matching approval template found')


def submit_request(request_id, actor=None):
    """Submit a draft/returned request into the approval workflow.

    1. Validates required fields (title, category, estimated_total).
    2. Selects the appropriate approval template.
    3. Clears any old approval steps from a previous submission.
    4. Creates ApprovalStep instances from the template steps.
    5. Activates step 1 (status='active', activated_at=now, due_date=now+sla_days).
    6. Sets request status to 'in_review'.
    7. Logs activity.

    Args:
        request_id: ID of the AcquisitionRequest to submit.
        actor: Name of the person submitting (for activity logging).

    Returns:
        The updated AcquisitionRequest instance.
    """
    req = AcquisitionRequest.query.get(request_id)
    if not req:
        raise NotFoundError(f'Request {request_id} not found')

    if req.status not in ('draft', 'returned'):
        raise BadRequestError(f'Cannot submit request in {req.status} status')

    # Validate required fields
    if not req.title:
        raise BadRequestError('Title is required to submit')
    if not req.category:
        raise BadRequestError('Category is required to submit')
    if not req.estimated_total:
        raise BadRequestError('Estimated total is required to submit')

    # Select approval template
    template = select_template(req)

    # Clear any old approval steps from a previous submission (for returned requests)
    ApprovalStep.query.filter_by(request_id=req.id).delete()

    now = datetime.now()

    # Create approval steps from template
    for tmpl_step in template.steps:
        step = ApprovalStep(
            request_id=req.id,
            step_number=tmpl_step.step_number,
            step_name=tmpl_step.step_name,
            approver_role=tmpl_step.approver_role,
            status='pending',
            session_id=req.session_id,
        )
        # Activate the first step
        if tmpl_step.step_number == 1:
            step.status = 'active'
            step.activated_at = now
            step.due_date = now + timedelta(days=tmpl_step.sla_days)

        db.session.add(step)

    # Update request status
    old_status = req.status
    req.status = 'in_review'
    req.current_approval_step = 1
    req.updated_at = now

    # Log activity
    actor_name = actor or req.requestor_name or 'System'
    log = ActivityLog(
        request_id=req.id,
        activity_type='submitted',
        description=f'Request submitted for approval using template: {template.name}',
        actor=actor_name,
        old_value=old_status,
        new_value='in_review',
        session_id=req.session_id,
    )
    db.session.add(log)
    db.session.commit()

    return req


def process_approval(step_id, action, actor, comments=None):
    """Process an approval action on an active step.

    Actions:
      - approve: Mark step approved; advance to next step or mark request approved.
      - reject: Mark step rejected; cancel remaining steps; set request cancelled.
      - return: Mark step returned; set request status to 'returned'.
      - skip: Mark step skipped; advance to next step.

    Args:
        step_id: ID of the ApprovalStep.
        action: One of 'approve', 'reject', 'return', 'skip'.
        actor: Name of the person performing the action.
        comments: Optional comments.

    Returns:
        The updated AcquisitionRequest instance.
    """
    valid_actions = ('approve', 'reject', 'return', 'skip')
    if action not in valid_actions:
        raise BadRequestError(f'Invalid action: {action}. Must be one of: {", ".join(valid_actions)}')

    step = ApprovalStep.query.get(step_id)
    if not step:
        raise NotFoundError(f'Approval step {step_id} not found')

    if step.status != 'active':
        raise BadRequestError(f'Cannot process step in {step.status} status. Step must be active.')

    req = AcquisitionRequest.query.get(step.request_id)
    if not req:
        raise NotFoundError(f'Request for step {step_id} not found')

    now = datetime.now()

    # Update the step
    step.action_by = actor
    step.comments = comments
    step.acted_on_date = now

    if action == 'approve':
        step.status = 'approved'
        _advance_or_complete(req, step, actor, now)

    elif action == 'reject':
        step.status = 'rejected'
        # Cancel all remaining pending steps
        remaining = ApprovalStep.query.filter(
            ApprovalStep.request_id == req.id,
            ApprovalStep.status == 'pending'
        ).all()
        for s in remaining:
            s.status = 'cancelled'

        old_status = req.status
        req.status = 'cancelled'
        req.updated_at = now

        log = ActivityLog(
            request_id=req.id,
            activity_type='rejected',
            description=f'Step {step.step_number} ({step.step_name}) rejected by {actor}. Request cancelled.',
            actor=actor,
            old_value=old_status,
            new_value='cancelled',
            session_id=req.session_id,
        )
        db.session.add(log)

    elif action == 'return':
        step.status = 'returned'
        # Cancel all remaining pending steps
        remaining = ApprovalStep.query.filter(
            ApprovalStep.request_id == req.id,
            ApprovalStep.status == 'pending'
        ).all()
        for s in remaining:
            s.status = 'cancelled'

        old_status = req.status
        req.status = 'returned'
        req.current_approval_step = 0
        req.updated_at = now

        log = ActivityLog(
            request_id=req.id,
            activity_type='returned',
            description=f'Step {step.step_number} ({step.step_name}) returned by {actor}. Requestor can edit and resubmit.',
            actor=actor,
            old_value=old_status,
            new_value='returned',
            session_id=req.session_id,
        )
        db.session.add(log)

    elif action == 'skip':
        step.status = 'skipped'
        _advance_or_complete(req, step, actor, now)

    db.session.commit()
    return req


def _advance_or_complete(req, current_step, actor, now):
    """After approving/skipping a step, advance to the next step or complete approval.

    Args:
        req: AcquisitionRequest instance.
        current_step: The ApprovalStep that was just approved/skipped.
        actor: Name of the actor.
        now: Current datetime.
    """
    action_label = 'approved' if current_step.status == 'approved' else 'skipped'

    # Find the next pending step
    next_step = ApprovalStep.query.filter(
        ApprovalStep.request_id == req.id,
        ApprovalStep.step_number > current_step.step_number,
        ApprovalStep.status == 'pending'
    ).order_by(ApprovalStep.step_number).first()

    if next_step:
        # Activate the next step
        next_step.status = 'active'
        next_step.activated_at = now

        # Look up the SLA from the template step for due_date calculation
        sla_days = _get_sla_days(req, next_step.step_number)
        next_step.due_date = now + timedelta(days=sla_days)

        req.current_approval_step = next_step.step_number
        req.updated_at = now

        log = ActivityLog(
            request_id=req.id,
            activity_type=action_label,
            description=f'Step {current_step.step_number} ({current_step.step_name}) {action_label} by {actor}. '
                        f'Next: Step {next_step.step_number} ({next_step.step_name})',
            actor=actor,
            session_id=req.session_id,
        )
        db.session.add(log)
    else:
        # All steps complete - mark request as approved
        old_status = req.status
        req.status = 'approved'
        req.updated_at = now

        log = ActivityLog(
            request_id=req.id,
            activity_type='approved',
            description=f'All approval steps complete. Request approved.',
            actor=actor,
            old_value=old_status,
            new_value='approved',
            session_id=req.session_id,
        )
        db.session.add(log)


def _get_sla_days(req, step_number):
    """Look up SLA days for a step from the template that matches this request.

    Falls back to a default of 5 days if template lookup fails.
    """
    try:
        template = select_template(req)
        for ts in template.steps:
            if ts.step_number == step_number:
                return ts.sla_days
    except Exception:
        pass
    return 5  # default SLA


def get_approval_status(request_id):
    """Get the approval status for all steps of a request.

    Returns a dict with:
      - request_id
      - request_status
      - steps: list of step dicts with an 'is_overdue' field added

    Args:
        request_id: ID of the AcquisitionRequest.

    Returns:
        Dict with approval status info.
    """
    req = AcquisitionRequest.query.get(request_id)
    if not req:
        raise NotFoundError(f'Request {request_id} not found')

    steps = ApprovalStep.query.filter_by(
        request_id=request_id
    ).order_by(ApprovalStep.step_number).all()

    now = datetime.now()
    steps_data = []
    for step in steps:
        step_dict = step.to_dict()
        # Add overdue flag for active steps
        step_dict['is_overdue'] = (
            step.status == 'active'
            and step.due_date is not None
            and step.due_date < now
        )
        steps_data.append(step_dict)

    return {
        'request_id': request_id,
        'request_status': req.status,
        'current_step': req.current_approval_step,
        'total_steps': len(steps),
        'steps': steps_data,
    }
