from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.extensions import db
from app.models.request import AcquisitionRequest
from app.models.advisory import AdvisoryInput
from app.models.activity import ActivityLog
from app.models.intake_path import IntakePath
from app.models.advisory_trigger import AdvisoryTriggerRule
from app.services.derivation import derive_classification
from app.services.checklist import generate_checklist, recalculate_checklist
from app.services.workflow import select_template
from app.services.notifications import notify_users_by_team

intake_bp = Blueprint('intake', __name__)


@intake_bp.route('/derive', methods=['POST'])
@jwt_required()
def preview_derivation():
    """Preview derivation without saving — used during intake wizard."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    result = derive_classification(data)
    return jsonify(result)


@intake_bp.route('/options', methods=['GET'])
@jwt_required()
def get_intake_options():
    """Return the question tree derived from the IntakePath table.

    The frontend wizard uses this to dynamically build the intake form
    based on the rules configuration workbook.
    """
    try:
        paths = IntakePath.query.order_by(IntakePath.path_id).all()
    except Exception:
        paths = []

    if not paths:
        # Return default options if no paths configured
        return jsonify(_default_options())

    # Build Q1 options (distinct need types)
    q1_values = sorted(set(p.q1_need_type for p in paths if p.q1_need_type))
    q1_labels = {
        'new': 'New Requirement',
        'continue_extend': 'Continue / Renew / Extend',
        'change_existing': 'Modify Existing Contract',
    }
    q1_descs = {
        'new': 'Brand new product, service, or software',
        'continue_extend': 'Exercise option, renew subscription, follow-on, recompete, CLIN execution',
        'change_existing': 'Add/remove scope, admin changes, CLIN reallocation',
    }
    q1_options = [
        {'value': v, 'label': q1_labels.get(v, v), 'description': q1_descs.get(v, '')}
        for v in q1_values
    ]

    # Build Q2 options grouped by Q1 (distinct situations per need type)
    q2_options = {}
    q2_labels = {
        'No specific vendor': {'value': 'no_specific_vendor', 'label': 'No Specific Vendor', 'description': 'Open competition — best value through full and open competition'},
        'Specific vendor required': {'value': 'specific_vendor', 'label': 'Specific Vendor Required', 'description': 'Only one vendor can meet the requirement (justification needed)'},
        'Option years remaining': {'value': 'options_remaining', 'label': 'Renew / Exercise Option', 'description': 'Renew a subscription, maintenance, or exercise an option year'},
        'Expiring, want same contractor': {'value': 'expiring_same_vendor', 'label': 'New Contract, Same Vendor', 'description': 'Contract expiring with no options — stay with same vendor (sole source justification required)'},
        'Expiring, should compete': {'value': 'expiring_compete', 'label': 'Recompete with New Vendors', 'description': 'Contract expiring — open the requirement to competition'},
        'Need bridge for re-compete': {'value': 'need_bridge', 'label': 'Bridge / Emergency Extension', 'description': 'Need temporary coverage while longer-term solution is in progress'},
        'Contract expired (gap)': {'value': 'expired_gap', 'label': 'Expired Contract (Gap)', 'description': 'Contract has expired — urgency justification needed'},
        'ODC CLIN execution': {'value': 'odc_clin', 'label': 'ODC CLIN Execution', 'description': 'Execute an Other Direct Cost CLIN on existing contract'},
        'Travel CLIN execution': {'value': 'travel_clin', 'label': 'Travel CLIN Execution', 'description': 'Execute a travel CLIN on existing contract'},
        'ODC CLIN — insufficient funds': {'value': 'odc_clin_insufficient', 'label': 'ODC CLIN — Insufficient Funds', 'description': 'ODC CLIN needs additional funding before execution'},
        'Add scope / increase funding': {'value': 'add_scope', 'label': 'Add Scope / New Work', 'description': 'Add requirements or increase funding to existing contract'},
        'Admin correction': {'value': 'admin_correction', 'label': 'Admin Change', 'description': 'Correct administrative items (name, address, etc.)'},
        'Move $ between CLINs': {'value': 'clin_reallocation', 'label': 'CLIN Reallocation', 'description': 'Move funding between CLINs'},
    }

    for p in paths:
        q1 = p.q1_need_type
        q2_raw = p.q2_situation
        if not q1 or not q2_raw:
            continue
        if q1 not in q2_options:
            q2_options[q1] = []

        label_data = q2_labels.get(q2_raw)
        if label_data:
            # Avoid duplicates
            existing_values = [o['value'] for o in q2_options[q1]]
            if label_data['value'] not in existing_values:
                q2_options[q1].append(label_data)

    # Build buy category options (distinct across all paths)
    buy_cats_raw = set()
    for p in paths:
        if p.buy_category and p.buy_category.strip() not in ('-', '', None):
            buy_cats_raw.add(p.buy_category)

    buy_cat_labels = {
        'product': {'value': 'product', 'label': 'Product', 'description': 'Hardware, equipment'},
        'service': {'value': 'service', 'label': 'Service', 'description': 'Professional services'},
        'software_license': {'value': 'software_license', 'label': 'Software / License', 'description': 'Licenses, SaaS, subscriptions'},
        'mixed': {'value': 'mixed', 'label': 'Mixed', 'description': 'Multiple categories'},
    }
    buy_category_options = [
        buy_cat_labels.get(bc, {'value': bc, 'label': bc, 'description': ''})
        for bc in sorted(buy_cats_raw)
    ]
    # Always include the 4 standard categories even if not all paths use them
    for key in ['product', 'service', 'software_license', 'mixed']:
        existing_values = [o['value'] for o in buy_category_options]
        if key not in existing_values:
            buy_category_options.append(buy_cat_labels[key])

    # Q3 vendor options
    vendor_options = [
        {'value': 'no', 'label': 'No — Open competition', 'description': 'Best value through full and open competition'},
        {'value': 'yes_sole', 'label': 'Yes — Sole source', 'description': 'Only one vendor can meet the requirement (J&A needed)'},
    ]

    return jsonify({
        'q1_options': q1_options,
        'q2_options': q2_options,
        'buy_category_options': buy_category_options,
        'vendor_options': vendor_options,
        'paths_count': len(paths),
    })


def _default_options():
    """Fallback options when no IntakePath data is loaded."""
    return {
        'q1_options': [
            {'value': 'new', 'label': 'New Requirement', 'description': 'Brand new product, service, or software'},
            {'value': 'continue_extend', 'label': 'Continue / Renew / Extend', 'description': 'Exercise option, renew, follow-on, recompete'},
            {'value': 'change_existing', 'label': 'Modify Existing Contract', 'description': 'Add/remove scope, admin changes'},
        ],
        'q2_options': {},
        'buy_category_options': [
            {'value': 'product', 'label': 'Product', 'description': 'Hardware, equipment'},
            {'value': 'service', 'label': 'Service', 'description': 'Professional services'},
            {'value': 'software_license', 'label': 'Software / License', 'description': 'Licenses, SaaS'},
            {'value': 'mixed', 'label': 'Mixed', 'description': 'Multiple categories'},
        ],
        'vendor_options': [
            {'value': 'no', 'label': 'No — Open competition', 'description': 'Full and open competition'},
            {'value': 'yes_sole', 'label': 'Yes — Sole source', 'description': 'Only one vendor'},
        ],
        'paths_count': 0,
    }


@intake_bp.route('/complete/<int:request_id>', methods=['POST'])
@jwt_required()
def complete_intake(request_id):
    """
    Save intake answers, derive classification, generate document checklist,
    determine pipeline, and trigger advisory requests.
    """
    acq = AcquisitionRequest.query.get_or_404(request_id)
    data = request.get_json() or {}

    # Save intake answers (if provided — may already be saved from create)
    intake_fields = [
        'intake_q1_need_type', 'intake_q2_situation', 'intake_q3_specific_vendor',
        'intake_q4_existing_vehicle', 'intake_q5_change_type',
        'intake_q_buy_category', 'intake_q_mixed_predominant',
    ]
    for field in intake_fields:
        if field in data:
            setattr(acq, field, data[field])

    # Save other fields that may come with intake
    if 'estimated_value' in data:
        acq.estimated_value = data['estimated_value']
    if 'title' in data:
        acq.title = data['title']
    if 'description' in data:
        acq.description = data['description']
    if 'existing_contract_number' in data:
        acq.existing_contract_number = data['existing_contract_number']
    if 'existing_contract_vendor' in data:
        acq.existing_contract_vendor = data['existing_contract_vendor']
    if 'existing_contract_value' in data:
        acq.existing_contract_value = data['existing_contract_value']
    if 'existing_contract_end_date' in data:
        acq.existing_contract_end_date = data['existing_contract_end_date']

    # Derive classification (now data-driven via IntakePath table)
    derive_data = {
        'intake_q1_need_type': acq.intake_q1_need_type,
        'intake_q2_situation': acq.intake_q2_situation,
        'intake_q3_specific_vendor': acq.intake_q3_specific_vendor,
        'intake_q5_change_type': acq.intake_q5_change_type,
        'intake_q_buy_category': acq.intake_q_buy_category,
        'intake_q_mixed_predominant': acq.intake_q_mixed_predominant,
        'estimated_value': acq.estimated_value,
    }
    derived = derive_classification(derive_data)

    # Apply derived fields
    acq.derived_acquisition_type = derived['derived_acquisition_type']
    acq.derived_tier = derived['derived_tier']
    acq.derived_pipeline = derived['derived_pipeline']
    acq.derived_contract_character = derived['derived_contract_character']
    acq.derived_requirements_doc_type = derived['derived_requirements_doc_type']
    acq.derived_scls_applicable = derived['derived_scls_applicable']
    acq.derived_qasp_required = derived['derived_qasp_required']
    acq.derived_eval_approach = derived['derived_eval_approach']

    # Mark intake as completed
    acq.intake_completed = True
    acq.intake_completed_date = datetime.utcnow()
    acq.intake_last_modified = datetime.utcnow()

    db.session.flush()

    # Generate document checklist
    checklist = generate_checklist(acq)

    # Determine pipeline template (now uses template_key from derivation)
    template = select_template(acq, template_key=derived.get('approval_template_key'))
    pipeline_info = template.to_dict() if template else None

    # Trigger advisory requests (now data-driven via IntakePath + AdvisoryTriggerRule)
    advisories = _trigger_advisories(acq, derived.get('advisory_triggers'))

    # Log activity
    log = ActivityLog(
        request_id=acq.id,
        activity_type='intake_completed',
        description=f'Intake completed: {derived["derived_acquisition_type"]} / {derived["derived_tier"]} / {derived["derived_pipeline"]}',
        actor=acq.requestor_name or 'System',
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({
        'success': True,
        'derived': derived,
        'checklist_items': len(checklist),
        'checklist': checklist,
        'pipeline': pipeline_info,
        'advisories_triggered': advisories,
        'request': acq.to_dict(),
    })


@intake_bp.route('/recalculate/<int:request_id>', methods=['POST'])
@jwt_required()
def recalculate(request_id):
    """
    Oops recalculation — re-derive and re-evaluate checklist after changes.
    """
    acq = AcquisitionRequest.query.get_or_404(request_id)
    data = request.get_json() or {}

    # Update any changed intake fields
    intake_fields = [
        'intake_q1_need_type', 'intake_q2_situation', 'intake_q3_specific_vendor',
        'intake_q4_existing_vehicle', 'intake_q5_change_type',
        'intake_q_buy_category', 'intake_q_mixed_predominant', 'estimated_value',
    ]
    for field in intake_fields:
        if field in data:
            setattr(acq, field, data[field])

    # Re-derive
    derive_data = {
        'intake_q1_need_type': acq.intake_q1_need_type,
        'intake_q2_situation': acq.intake_q2_situation,
        'intake_q3_specific_vendor': acq.intake_q3_specific_vendor,
        'intake_q5_change_type': acq.intake_q5_change_type,
        'intake_q_buy_category': acq.intake_q_buy_category,
        'intake_q_mixed_predominant': acq.intake_q_mixed_predominant,
        'estimated_value': acq.estimated_value,
    }
    derived = derive_classification(derive_data)

    old_type = acq.derived_acquisition_type
    old_tier = acq.derived_tier

    acq.derived_acquisition_type = derived['derived_acquisition_type']
    acq.derived_tier = derived['derived_tier']
    acq.derived_pipeline = derived['derived_pipeline']
    acq.derived_contract_character = derived['derived_contract_character']
    acq.derived_requirements_doc_type = derived['derived_requirements_doc_type']
    acq.derived_scls_applicable = derived['derived_scls_applicable']
    acq.derived_qasp_required = derived['derived_qasp_required']
    acq.derived_eval_approach = derived['derived_eval_approach']
    acq.intake_last_modified = datetime.utcnow()

    db.session.flush()

    # Recalculate checklist (oops design)
    diff = recalculate_checklist(acq)

    # Log
    log = ActivityLog(
        request_id=acq.id,
        activity_type='recalculated',
        description=f'Intake recalculated: {old_type} -> {derived["derived_acquisition_type"]}, {old_tier} -> {derived["derived_tier"]}',
        actor=acq.requestor_name or 'System',
        old_value=f'{old_type}/{old_tier}',
        new_value=f'{derived["derived_acquisition_type"]}/{derived["derived_tier"]}',
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({
        'success': True,
        'derived': derived,
        'checklist_diff': diff,
        'request': acq.to_dict(),
    })


# ---------------------------------------------------------------------------
# Advisory trigger logic — now data-driven
# ---------------------------------------------------------------------------

# Maps advisory trigger codes from the Excel to DB team keys + gate info
ADVISORY_CODE_MAP = {
    'SCRM': {'team': 'scrm', 'status_field': 'scrm_status', 'default_gate': 'iss'},
    'SBO': {'team': 'sbo', 'status_field': 'sbo_status', 'default_gate': 'asr'},
    'CIO': {'team': 'cio', 'status_field': 'cio_status', 'default_gate': 'iss'},
    '508': {'team': 'section508', 'status_field': 'section508_status', 'default_gate': 'asr'},
    'FEDRAMP': {'team': 'fedramp', 'status_field': None, 'default_gate': 'iss'},
    'FM': {'team': 'fm', 'status_field': None, 'default_gate': 'finance'},
}


def _trigger_advisories(request_obj, advisory_triggers_str=None):
    """Create advisory input requests based on the matched IntakePath's advisory_triggers.

    If advisory_triggers_str is provided (from the derivation result), parse it
    and create AdvisoryInput records. Also checks the AdvisoryTriggerRule table
    for any additional condition-based triggers.

    Args:
        request_obj: AcquisitionRequest instance
        advisory_triggers_str: Comma-separated trigger codes (e.g. "SCRM,SBO,CIO,508")

    Returns:
        list of triggered advisory team names
    """
    advisories = []
    triggered_teams = set()

    # 1. Triggers from the matched IntakePath
    if advisory_triggers_str and advisory_triggers_str.strip().lower() != 'none':
        codes = [c.strip() for c in advisory_triggers_str.split(',') if c.strip()]
        for code in codes:
            info = ADVISORY_CODE_MAP.get(code.upper())
            if not info:
                continue
            team = info['team']
            if team in triggered_teams:
                continue

            # Look up the AdvisoryTriggerRule for SLA and gate info
            rule = _find_trigger_rule(team)
            blocks_gate = info['default_gate']
            is_blocking = False
            if rule:
                blocks_gate = _normalize_gate(rule.feeds_into_gate) or info['default_gate']
                is_blocking = rule.blocks_gate

            adv = AdvisoryInput(
                request_id=request_obj.id,
                team=team,
                status='requested',
                blocks_gate=blocks_gate if is_blocking else blocks_gate,
            )
            db.session.add(adv)

            # Notify advisory team members
            notify_users_by_team(
                team, request_obj.id, 'advisory_requested',
                f'Advisory review requested: {team.upper()}',
                f'Request "{request_obj.title}" ({request_obj.request_number}) needs {team.upper()} advisory review.'
            )

            # Update denormalized status on request
            status_field = info.get('status_field')
            if status_field and hasattr(request_obj, status_field):
                setattr(request_obj, status_field, 'requested')

            advisories.append(team)
            triggered_teams.add(team)

    # 2. Additional condition-based triggers from AdvisoryTriggerRule table
    # (e.g., FM trigger fires for all requests above micro)
    try:
        all_rules = AdvisoryTriggerRule.query.all()
        for rule in all_rules:
            team = _normalize_team(rule.team)
            if team in triggered_teams:
                continue
            if _evaluate_trigger_condition(rule, request_obj):
                blocks_gate = _normalize_gate(rule.feeds_into_gate) or 'asr'

                adv = AdvisoryInput(
                    request_id=request_obj.id,
                    team=team,
                    status='requested',
                    blocks_gate=blocks_gate,
                )
                db.session.add(adv)

                # Notify advisory team members
                notify_users_by_team(
                    team, request_obj.id, 'advisory_requested',
                    f'Advisory review requested: {team.upper()}',
                    f'Request "{request_obj.title}" ({request_obj.request_number}) needs {team.upper()} advisory review.'
                )

                advisories.append(team)
                triggered_teams.add(team)
    except Exception:
        pass  # Table may not exist yet during initial setup

    return advisories


def _find_trigger_rule(team):
    """Find the AdvisoryTriggerRule for a given team."""
    try:
        team_map = {
            'scrm': 'SCRM',
            'sbo': 'Small Business Office',
            'cio': 'CIO / IT Governance',
            'section508': 'Section 508',
            'fm': 'Business Manager (FM)',
            'fedramp': 'FedRAMP PMO',
        }
        search_name = team_map.get(team, team)
        return AdvisoryTriggerRule.query.filter(
            AdvisoryTriggerRule.team.ilike(f'%{search_name}%')
        ).first()
    except Exception:
        return None


def _normalize_team(team_name):
    """Normalize advisory team name to DB key."""
    if not team_name:
        return None
    name_lower = team_name.lower()
    if 'scrm' in name_lower:
        return 'scrm'
    if 'small business' in name_lower or 'sbo' in name_lower:
        return 'sbo'
    if 'cio' in name_lower or 'it governance' in name_lower:
        return 'cio'
    if '508' in name_lower:
        return 'section508'
    if 'fedramp' in name_lower:
        return 'fedramp'
    if 'business manager' in name_lower or 'fm' in name_lower or 'financial' in name_lower:
        return 'fm'
    return name_lower.replace(' ', '_')


def _normalize_gate(gate_text):
    """Normalize gate name text to DB key."""
    if not gate_text:
        return None
    gate_lower = gate_text.lower().strip()
    if 'iss' in gate_lower:
        return 'iss'
    if 'asr' in gate_lower:
        return 'asr'
    if 'ko' in gate_lower:
        return 'ko_review'
    if 'finance' in gate_lower:
        return 'finance'
    if 'pm' in gate_lower:
        return 'iss'
    if 'cor' in gate_lower:
        return 'ko_review'
    return gate_lower.replace(' ', '_')


def _evaluate_trigger_condition(rule, request_obj):
    """Evaluate whether an AdvisoryTriggerRule applies to this request.

    Uses simple keyword matching against the trigger_condition text.
    """
    if not rule.trigger_condition:
        return False

    cond = rule.trigger_condition.lower()
    team = _normalize_team(rule.team)

    # FM trigger: "New request above micro-purchase"
    if team == 'fm' and 'above micro' in cond:
        return (request_obj.derived_tier and
                request_obj.derived_tier not in ('micro', None))

    # SCRM CLIN exec: "CLIN Execution — ODC"
    if 'clin execution' in cond and 'odc' in cond:
        return request_obj.derived_acquisition_type in ('clin_execution_odc',)

    # CIO CLIN exec: "CLIN Execution — ODC for new product type"
    if 'clin execution' in cond and 'new product' in cond:
        return False  # Only if product not already on ATO — skip for now

    return False
