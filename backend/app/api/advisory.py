from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.extensions import db
from app.models.advisory import AdvisoryInput
from app.models.request import AcquisitionRequest
from app.models.activity import ActivityLog
from app.services.notifications import notify_requestor

advisory_bp = Blueprint('advisory', __name__)


@advisory_bp.route('/queue', methods=['GET'])
@jwt_required()
def advisory_queue():
    """Get pending advisory items for the user's team."""
    claims = get_jwt()
    user_team = claims.get('team', '')
    user_role = claims.get('role', '')

    # Map roles to teams for advisory routing
    role_team_map = {
        'scrm': 'scrm',
        'sb': 'sbo',
        'cto': 'cio',
        'cio': 'cio',
        'legal': 'legal',
        'budget': 'fm',
    }

    team = user_team or role_team_map.get(user_role, '')

    query = AdvisoryInput.query.filter(
        AdvisoryInput.status.in_(['requested', 'in_review'])
    )

    if team and user_role != 'admin':
        query = query.filter(AdvisoryInput.team == team)

    advisories = query.all()

    items = []
    for adv in advisories:
        req = AcquisitionRequest.query.get(adv.request_id)
        items.append({
            'advisory': adv.to_dict(),
            'request': {
                'id': req.id,
                'request_number': req.request_number,
                'title': req.title,
                'estimated_value': req.estimated_value,
                'derived_acquisition_type': req.derived_acquisition_type,
                'derived_tier': req.derived_tier,
                'intake_q_buy_category': req.intake_q_buy_category,
            } if req else None,
        })

    return jsonify({
        'queue': items,
        'count': len(items),
        'team': team,
    })


@advisory_bp.route('/request/<int:request_id>', methods=['GET'])
@jwt_required()
def request_advisories(request_id):
    """Get all advisory inputs for a specific request."""
    advisories = AdvisoryInput.query.filter_by(request_id=request_id).all()
    return jsonify({
        'advisories': [a.to_dict() for a in advisories],
        'count': len(advisories),
    })


@advisory_bp.route('/<int:advisory_id>', methods=['POST'])
@jwt_required()
def submit_advisory(advisory_id):
    """Submit advisory findings."""
    user_id = get_jwt_identity()
    claims = get_jwt()
    adv = AdvisoryInput.query.get_or_404(advisory_id)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    adv.status = data.get('status', 'complete_no_issues')
    adv.findings = data.get('findings')
    adv.recommendation = data.get('recommendation')
    adv.impacts_strategy = data.get('impacts_strategy', False)
    adv.reviewer_id = int(user_id)
    adv.completed_date = datetime.utcnow()

    # Update denormalized status on request
    req = AcquisitionRequest.query.get(adv.request_id)
    if req:
        status_field = {
            'scrm': 'scrm_status',
            'sbo': 'sbo_status',
            'cio': 'cio_status',
            'section508': 'section508_status',
        }.get(adv.team)

        if status_field:
            setattr(req, status_field, adv.status)

        notes_field = {
            'scrm': 'scrm_notes',
            'sbo': 'sbo_notes',
            'cio': 'cio_notes',
        }.get(adv.team)

        if notes_field and adv.findings:
            setattr(req, notes_field, adv.findings)

    log = ActivityLog(
        request_id=adv.request_id,
        activity_type='advisory_completed',
        description=f'{adv.team.upper()} advisory completed: {adv.status}',
        actor=claims.get('name', 'Unknown'),
    )
    db.session.add(log)

    # Notify requestor that advisory is complete
    notify_requestor(
        adv.request_id, 'advisory_completed',
        f'{adv.team.upper()} advisory completed',
        f'The {adv.team.upper()} advisory review for your request is complete. Status: {adv.status.replace("_", " ").title()}.'
    )

    db.session.commit()

    return jsonify(adv.to_dict())


@advisory_bp.route('/<int:advisory_id>', methods=['PUT'])
@jwt_required()
def update_advisory(advisory_id):
    """Update an existing advisory."""
    adv = AdvisoryInput.query.get_or_404(advisory_id)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    updatable = ['status', 'findings', 'recommendation', 'impacts_strategy', 'blocks_gate']
    for field in updatable:
        if field in data:
            setattr(adv, field, data[field])

    if data.get('status') in ('complete_no_issues', 'complete_issues_found', 'waived'):
        adv.completed_date = datetime.utcnow()

    db.session.commit()
    return jsonify(adv.to_dict())
