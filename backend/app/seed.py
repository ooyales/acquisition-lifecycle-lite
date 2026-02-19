"""
Comprehensive seed data for Acquisition Dual-Track Lite.

Rules configuration (thresholds, intake paths, document rules, approval templates,
advisory triggers) is imported from the Excel workbook acquisition-rules-config.xlsx.
Sample/demo data (users, requests, CLINs, etc.) is still seeded programmatically.
"""

import json
import os
from datetime import datetime, timedelta
from app.extensions import db
from app.models import (
    User, ThresholdConfig, PSCCode, PerDiemRate,
    AcquisitionRequest, LineOfAccounting,
    DocumentTemplate, DocumentRule, PackageDocument,
    ApprovalTemplate, ApprovalTemplateStep, ApprovalStep,
    AdvisoryInput, AcquisitionCLIN, DemandForecast,
    CLINExecutionRequest, ActivityLog, Notification,
    IntakePath, AdvisoryTriggerRule, AdvisoryPipelineConfig,
)


def seed():
    """Main seed function — populates all reference and sample data."""
    print('Seeding users...')
    users = _seed_users()

    # Import rules from Excel workbook (replaces hard-coded thresholds,
    # document templates/rules, approval templates, intake paths, advisory triggers)
    print('Importing rules from Excel workbook...')
    _import_rules_from_excel()

    print('Seeding advisory pipeline config...')
    _seed_advisory_pipeline_config()

    print('Seeding PSC codes...')
    _seed_psc_codes()

    print('Seeding per diem rates...')
    _seed_per_diem_rates()

    print('Seeding LOAs...')
    loas = _seed_loas(users)

    print('Seeding sample requests...')
    requests = _seed_requests(users)

    print('Seeding CLINs...')
    _seed_clins(requests, loas)

    print('Seeding package documents...')
    templates = {t.doc_type_key: t for t in DocumentTemplate.query.all()}
    _seed_package_documents(requests, templates)

    print('Seeding advisory inputs...')
    _seed_advisory_inputs(requests, users)

    print('Seeding demand forecasts...')
    _seed_forecasts(requests, loas, users)

    print('Seeding execution requests...')
    _seed_execution_requests(requests, users)

    print('Seeding activity logs...')
    _seed_activity_logs(requests)

    print('Seeding notifications...')
    _seed_notifications(users, requests)

    db.session.commit()
    print('Seed complete.')


def _import_rules_from_excel():
    """Import all rule tables from the Excel workbook."""
    from app.services.excel_importer import import_all

    # Look for the Excel file in several locations
    candidates = [
        'acquisition-rules-config.xlsx',
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'acquisition-rules-config.xlsx'),
        '/app/acquisition-rules-config.xlsx',
    ]
    for path in candidates:
        if os.path.exists(path):
            result = import_all(path)
            if 'error' not in result:
                return
            print(f'  WARNING: Import failed from {path}: {result}')

    print('  WARNING: Excel workbook not found — falling back to minimal hard-coded rules')
    _seed_thresholds_fallback()
    _seed_approval_templates_fallback()


def _seed_thresholds_fallback():
    """Minimal threshold seeding when Excel workbook is not available."""
    thresholds = [
        ('micro_purchase', 15000, 'FAR 2.101', 'Micro-Purchase Threshold'),
        ('simplified_acquisition', 350000, 'FAR 2.101', 'Simplified Acquisition Threshold'),
        ('above_sat', 9000000, 'FAR 2.101', 'Above Simplified Acquisition Threshold'),
        ('ja_threshold', 900000, 'FAR 6.304', 'J&A Certification Threshold'),
    ]
    for name, limit, far, desc in thresholds:
        t = ThresholdConfig(
            name=name, dollar_limit=limit, effective_date='2025-10-01',
            far_reference=far, description=desc,
        )
        db.session.add(t)
    db.session.flush()


def _seed_approval_templates_fallback():
    """Minimal approval template seeding when Excel workbook is not available."""
    full = ApprovalTemplate(template_key='APPR-FULL', name='Full Pipeline',
                            pipeline_type='full', is_default=True)
    db.session.add(full)
    db.session.flush()
    for num, name, role, sla in [(1, 'ISS', 'branch_chief', 5), (2, 'ASR', 'branch_chief', 7),
                                  (3, 'Finance', 'budget', 5), (4, 'KO Review', 'ko', 7)]:
        db.session.add(ApprovalTemplateStep(
            template_id=full.id, step_number=num, step_name=name,
            approver_role=role, sla_days=sla,
        ))
    abbrev = ApprovalTemplate(template_key='APPR-OPTION', name='Abbreviated Pipeline',
                              pipeline_type='abbreviated')
    db.session.add(abbrev)
    db.session.flush()
    for num, name, role, sla in [(1, 'COR Confirmation', 'branch_chief', 3),
                                  (2, 'Finance', 'budget', 5), (3, 'KO Execution', 'ko', 5)]:
        db.session.add(ApprovalTemplateStep(
            template_id=abbrev.id, step_number=num, step_name=name,
            approver_role=role, sla_days=sla,
        ))
    ko_only = ApprovalTemplate(template_key='APPR-KO-ONLY', name='KO-Only Pipeline',
                               pipeline_type='ko_only')
    db.session.add(ko_only)
    db.session.flush()
    db.session.add(ApprovalTemplateStep(
        template_id=ko_only.id, step_number=1, step_name='KO Action',
        approver_role='ko', sla_days=5,
    ))
    micro = ApprovalTemplate(template_key='APPR-MICRO', name='Micro-Purchase Pipeline',
                             pipeline_type='micro')
    db.session.add(micro)
    db.session.flush()
    for num, name, role, sla in [(1, 'Supervisor', 'branch_chief', 2),
                                  (2, 'GPC Holder', 'budget', 2)]:
        db.session.add(ApprovalTemplateStep(
            template_id=micro.id, step_number=num, step_name=name,
            approver_role=role, sla_days=sla,
        ))
    db.session.flush()


# ---------------------------------------------------------------------------
# Advisory Pipeline Config (matrix of pipeline x team)
# ---------------------------------------------------------------------------

ALL_PIPELINES = [
    'full', 'abbreviated', 'ko_only', 'ko_abbreviated', 'micro',
    'clin_execution', 'modification', 'clin_exec_funding', 'depends_on_value',
]

ALL_ADVISORY_TEAMS = ['scrm', 'sbo', 'cio', 'section508', 'fm']

# Map advisory trigger codes from Excel/IntakePath to DB team keys
_CODE_TO_TEAM = {
    'SCRM': 'scrm', 'SBO': 'sbo', 'CIO': 'cio',
    '508': 'section508', 'FM': 'fm', 'FEDRAMP': 'fedramp',
}

# Default blocks_gate per team
_DEFAULT_GATE = {
    'scrm': 'iss', 'sbo': 'asr', 'cio': 'iss',
    'section508': 'asr', 'fm': 'finance',
}


def _seed_advisory_pipeline_config():
    """Create the advisory pipeline config matrix from IntakePath data."""
    # Derive which teams are enabled per pipeline from IntakePath.advisory_triggers
    paths = IntakePath.query.all()
    pipeline_teams = {}  # { pipeline_type: set(team_keys) }
    for p in paths:
        pipeline = p.derived_pipeline
        if not pipeline:
            continue
        if pipeline not in pipeline_teams:
            pipeline_teams[pipeline] = set()
        triggers = p.advisory_triggers or ''
        if triggers.strip().lower() in ('', 'none'):
            continue
        for code in triggers.split(','):
            code = code.strip().upper()
            team = _CODE_TO_TEAM.get(code)
            if team and team in ALL_ADVISORY_TEAMS:
                pipeline_teams[pipeline].add(team)

    # Create rows for every pipeline x team combination
    for pipeline in ALL_PIPELINES:
        enabled_teams = pipeline_teams.get(pipeline, set())
        for team in ALL_ADVISORY_TEAMS:
            config = AdvisoryPipelineConfig(
                pipeline_type=pipeline,
                team=team,
                is_enabled=team in enabled_teams,
                sla_days=5,
                blocks_gate=_DEFAULT_GATE.get(team, ''),
                threshold_min=0,
            )
            db.session.add(config)
    db.session.flush()


# ---------------------------------------------------------------------------
# 1. Users
# ---------------------------------------------------------------------------
def _seed_users():
    users_data = [
        ('admin@acq.local', 'System Administrator', 'demo123', 'admin', None),
        ('requestor@acq.local', 'Jane Smith', 'demo123', 'requestor', 'operations'),
        ('chief@acq.local', 'Michael Chen', 'demo123', 'branch_chief', 'management'),
        ('cto@acq.local', 'Sarah Williams', 'demo123', 'cto', 'management'),
        ('scrm@acq.local', 'Robert Johnson', 'demo123', 'scrm', 'scrm'),
        ('budget@acq.local', 'Lisa Anderson', 'demo123', 'budget', 'finance'),
        ('ko@acq.local', 'David Martinez', 'demo123', 'ko', 'contracting'),
        ('legal@acq.local', 'Emily Brown', 'demo123', 'legal', 'legal'),
        ('sb@acq.local', 'James Wilson', 'demo123', 'sb', 'small_business'),
        ('cio@acq.local', 'Patricia Davis', 'demo123', 'cio', 'management'),
    ]
    users = {}
    for email, name, pwd, role, team in users_data:
        u = User(email=email, name=name, role=role, team=team)
        u.set_password(pwd)
        db.session.add(u)
        users[role] = u
    db.session.flush()
    return users


# ---------------------------------------------------------------------------
# 6. PSC Codes (~80)
# ---------------------------------------------------------------------------
def _seed_psc_codes():
    psc_data = [
        # IT Services (D-series)
        ('D301', 'IT Facility Operation & Maintenance', 'services', 'service', 'IT Services', True, 'high', True),
        ('D302', 'IT Systems Development Services', 'services', 'service', 'IT Services', True, 'high', False),
        ('D303', 'ADP Systems Programming Services', 'services', 'service', 'IT Services', True, 'high', False),
        ('D304', 'ADP Telecommunications & Transmission', 'services', 'service', 'IT Services', True, 'medium', False),
        ('D305', 'ADP Teleprocessing & Timesharing', 'services', 'service', 'IT Services', True, 'medium', False),
        ('D306', 'IT Systems Analysis Services', 'services', 'service', 'IT Services', True, 'high', False),
        ('D307', 'Automated Info System Design/Integration', 'services', 'service', 'IT Services', True, 'high', False),
        ('D308', 'Programming Services', 'services', 'service', 'IT Services', True, 'high', True),
        ('D309', 'ADP Data Entry Services', 'services', 'service', 'IT Services', True, 'high', True),
        ('D310', 'IT Backup & Recovery Services', 'services', 'service', 'IT Services', True, 'medium', False),
        ('D311', 'IT Data Conversion Services', 'services', 'service', 'IT Services', True, 'high', True),
        ('D312', 'Optical Scanning Services', 'services', 'service', 'IT Services', True, 'high', True),
        ('D313', 'Computer Aided Design/Manufacturing', 'services', 'service', 'IT Services', True, 'medium', False),
        ('D314', 'IT Network Support Services', 'services', 'service', 'IT Services', True, 'high', True),
        ('D316', 'IT Telecommunications & Transmission', 'services', 'service', 'IT Services', True, 'medium', False),
        ('D317', 'Web-Based Subscription Services', 'services', 'service', 'IT Services', True, 'medium', False),
        ('D318', 'IT Cloud Computing Services', 'services', 'service', 'IT Services', True, 'high', False),
        ('D319', 'IT Hosting Services', 'services', 'service', 'IT Services', True, 'medium', False),
        ('D320', 'IT Cybersecurity Services', 'services', 'service', 'IT Services', True, 'high', False),
        ('D321', 'Help Desk / Tier 1-3 Support', 'services', 'service', 'IT Services', True, 'high', True),
        ('D322', 'IT Project Management Services', 'services', 'service', 'IT Services', True, 'high', False),
        ('D399', 'Other IT & Telecom Services', 'services', 'service', 'IT Services', True, 'high', True),
        # IT Equipment (7000-series)
        ('7010', 'IT Equipment', 'supplies_equipment', 'product', 'IT Equipment', True, 'medium', False),
        ('7020', 'IT Peripheral Equipment', 'supplies_equipment', 'product', 'IT Equipment', True, 'medium', False),
        ('7025', 'IT Input/Output & Storage Devices', 'supplies_equipment', 'product', 'IT Equipment', True, 'medium', False),
        ('7030', 'IT Networking Equipment', 'supplies_equipment', 'product', 'IT Equipment', True, 'medium', False),
        ('7035', 'IT Display Devices', 'supplies_equipment', 'product', 'IT Equipment', True, 'high', False),
        ('7040', 'IT Accessories & Supplies', 'supplies_equipment', 'product', 'IT Equipment', True, 'high', False),
        ('7042', 'Mini & Micro Computer Software', 'supplies_equipment', 'product', 'IT Software', True, 'medium', False),
        ('7045', 'IT Cybersecurity Equipment', 'supplies_equipment', 'product', 'IT Equipment', True, 'low', False),
        ('7050', 'IT Components & Accessories', 'supplies_equipment', 'product', 'IT Equipment', True, 'high', False),
        # R&D Services
        ('R408', 'Program Management / Support', 'services', 'service', 'Professional Services', True, 'high', False),
        ('R410', 'Support - Professional: Technology Sharing/Utilization', 'services', 'service', 'Professional Services', True, 'medium', False),
        ('R413', 'Support - Professional: Specifications Development', 'services', 'service', 'Professional Services', False, 'medium', False),
        ('R421', 'Technical Assistance', 'services', 'service', 'Professional Services', True, 'high', False),
        ('R423', 'Intelligence Services', 'services', 'service', 'Professional Services', False, 'low', False),
        ('R425', 'Engineering & Technical Services', 'services', 'service', 'Professional Services', True, 'high', False),
        ('R430', 'Research and Development Support', 'rnd', 'service', 'R&D Services', True, 'medium', False),
        ('R431', 'Concept Formulation Studies', 'rnd', 'service', 'R&D Services', False, 'medium', False),
        ('R497', 'Personal Services Contracts', 'services', 'service', 'Professional Services', False, 'low', False),
        ('R499', 'Other Professional Services', 'services', 'service', 'Professional Services', True, 'high', True),
        ('R706', 'IT Management Support', 'services', 'service', 'Professional Services', True, 'high', False),
        ('R707', 'IT Program Support Services', 'services', 'service', 'Professional Services', True, 'high', False),
        ('R710', 'Automated Data Processing Management', 'services', 'service', 'Professional Services', True, 'medium', False),
        ('R799', 'Other Management & Support Services', 'services', 'service', 'Professional Services', False, 'high', True),
        # Training
        ('U001', 'Training - Lecturer/Instructor', 'services', 'service', 'Training', False, 'high', True),
        ('U004', 'Training - IT Related', 'services', 'service', 'Training', True, 'high', True),
        ('U008', 'Training - Management', 'services', 'service', 'Training', False, 'high', True),
        ('U009', 'Training - General', 'services', 'service', 'Training', False, 'high', True),
        ('U012', 'Curriculum Development', 'services', 'service', 'Training', False, 'high', True),
        ('U099', 'Other Education & Training', 'services', 'service', 'Training', False, 'high', True),
        # Consulting
        ('B503', 'Project Management Consulting', 'services', 'service', 'Consulting', True, 'high', False),
        ('B504', 'Change Management Consulting', 'services', 'service', 'Consulting', False, 'high', False),
        ('B505', 'Business Process Reengineering', 'services', 'service', 'Consulting', False, 'high', False),
        ('B506', 'IT Strategy Consulting', 'services', 'service', 'Consulting', True, 'high', False),
        ('B516', 'Management: Acquisition Support', 'services', 'service', 'Consulting', False, 'high', False),
        ('B599', 'Other Special Studies & Analysis', 'services', 'service', 'Consulting', False, 'high', False),
        # Telecom Equipment
        ('5805', 'Telephone & Telegraph Equipment', 'supplies_equipment', 'product', 'Telecom Equipment', True, 'medium', False),
        ('5810', 'Communication Security Equipment', 'supplies_equipment', 'product', 'Telecom Equipment', True, 'low', False),
        ('5811', 'Other Cryptologic Equipment', 'supplies_equipment', 'product', 'Telecom Equipment', True, 'low', False),
        ('5820', 'Radio & TV Communication Equipment', 'supplies_equipment', 'product', 'Telecom Equipment', False, 'medium', False),
        ('5821', 'Radio Equipment (Airborne)', 'supplies_equipment', 'product', 'Telecom Equipment', False, 'low', False),
        ('5895', 'Miscellaneous Communication Equipment', 'supplies_equipment', 'product', 'Telecom Equipment', True, 'medium', False),
        # Miscellaneous Services
        ('J070', 'Maintenance/Repair of IT Equipment', 'services', 'service', 'Maintenance', True, 'high', False),
        ('J058', 'Maintenance of Communication Equipment', 'services', 'service', 'Maintenance', True, 'medium', False),
        ('J099', 'Other Maintenance & Repair Services', 'services', 'service', 'Maintenance', False, 'high', True),
        ('W070', 'Lease of IT Equipment', 'services', 'service', 'Leasing', True, 'medium', False),
        ('W058', 'Lease of Communication Equipment', 'services', 'service', 'Leasing', True, 'medium', False),
        # Construction/Facilities (non-IT)
        ('Y1AA', 'Construction of Office Buildings', 'services', 'service', 'Construction', False, 'medium', False),
        ('Y1PZ', 'Construction of Misc Buildings', 'services', 'service', 'Construction', False, 'medium', False),
        # Utilities
        ('S201', 'Custodial Janitorial Services', 'services', 'service', 'Utilities & Housekeeping', False, 'high', True),
        ('S216', 'Facilities Maintenance', 'services', 'service', 'Utilities & Housekeeping', False, 'high', True),
        # Office Supplies
        ('7510', 'Office Supplies', 'supplies_equipment', 'product', 'Office Supplies', False, 'high', False),
        ('7520', 'Office Devices & Accessories', 'supplies_equipment', 'product', 'Office Supplies', False, 'high', False),
        # Electronics
        ('5998', 'Electrical Components', 'supplies_equipment', 'product', 'Electronics', True, 'medium', False),
        ('5999', 'Miscellaneous Electrical Components', 'supplies_equipment', 'product', 'Electronics', True, 'medium', False),
        ('6625', 'Electrical Measuring Instruments', 'supplies_equipment', 'product', 'Electronics', False, 'medium', False),
        ('6640', 'Laboratory Equipment', 'supplies_equipment', 'product', 'Electronics', False, 'medium', False),
        # Transportation
        ('V119', 'Motor Vehicle Maintenance', 'services', 'service', 'Transportation', False, 'high', True),
        ('V999', 'Other Transportation Services', 'services', 'service', 'Transportation', False, 'high', True),
    ]

    for row in psc_data:
        code, title, category, sop, group, is_it, sb, scls = row
        p = PSCCode(
            code=code, title=title, category=category,
            service_or_product=sop, group_name=group,
            is_it_related=is_it, sb_availability=sb,
            typical_scls_applicable=scls, status='active',
        )
        db.session.add(p)
    db.session.flush()


# ---------------------------------------------------------------------------
# 7. LOAs (5)
# ---------------------------------------------------------------------------
def _seed_loas(users):
    budget_user = users.get('budget')
    loa_data = [
        # (name, approp, fund, bac, cc, oc, pe, fy, total, proj, comm, oblig, ftype, exp, project, task)
        ('FY26 O&M IT Operations', '21-1234', 'OM-IT', '3600', 'CC-100', '25.3', 'PE-01', '2026',
         4200000, 620000, 950000, 1800000, 'om', '2026-09-30', 'IT-OPS-2026', 'Help Desk Support'),
        ('FY26 O&M Cybersecurity', '21-1235', 'OM-CY', '3610', 'CC-110', '25.3', 'PE-02', '2026',
         1800000, 200000, 400000, 800000, 'om', '2026-09-30', 'CYBER-2026', 'SOC Operations'),
        ('FY26 RDT&E IT Modernization', '21-5678', 'RD-IT', '3700', 'CC-200', '25.3', 'PE-03', '2026',
         3500000, 500000, 800000, 1200000, 'rdte', '2027-09-30', 'IMOD-2026', 'Cloud Migration'),
        ('FY26 Procurement IT Equipment', '21-9012', 'PR-IT', '3400', 'CC-300', '31.0', 'PE-04', '2026',
         2000000, 300000, 500000, 700000, 'procurement', '2028-09-30', 'EQUIP-2026', 'Endpoint Refresh'),
        ('FY26 Working Capital IT Shared Services', '21-3456', 'WC-IT', '4000', 'CC-400', '25.3', 'PE-05', '2026',
         1500000, 150000, 300000, 600000, 'working_capital', '2026-09-30', 'SHARED-2026', 'Data Center Ops'),
        ('FY26 Cyber O&M', '21-1236', 'OM-CYBER', '3611', 'CC-115', '25.3', 'PE-06', '2026',
         2500000, 350000, 500000, 900000, 'om', '2026-09-30', 'CYBER-2026', 'Threat Management'),
        ('FY26 Cyber PDW', '21-1237', 'PDW-CYBER', '3612', 'CC-116', '25.3', 'PE-07', '2026',
         1200000, 100000, 200000, 350000, 'procurement', '2028-09-30', 'CYBER-PDW-26', 'Security Tools'),
    ]
    loas = {}
    for i, (name, approp, fund, bac, cc, oc, pe, fy, total, proj_amt, comm, oblig, ftype, exp, project, task) in enumerate(loa_data):
        loa = LineOfAccounting(
            display_name=name, appropriation=approp, fund_code=fund,
            budget_activity_code=bac, cost_center=cc, object_class=oc,
            program_element=pe, fiscal_year=fy, total_allocation=total,
            projected_amount=proj_amt, committed_amount=comm, obligated_amount=oblig,
            fund_type=ftype, expiration_date=exp, status='active',
            managed_by_id=budget_user.id if budget_user else None,
            project=project, task=task,
        )
        db.session.add(loa)
        loas[i] = loa
    db.session.flush()
    return loas


# ---------------------------------------------------------------------------
# 8. Sample Requests (14)
# ---------------------------------------------------------------------------
def _seed_requests(users):
    requestor = users.get('requestor')
    rid = requestor.id if requestor else 1
    rname = requestor.name if requestor else 'Jane Smith'

    now = datetime.utcnow()
    requests = {}

    data = [
        # 1. New competitive IT services — $1.2M, above_sat, full pipeline, in ASR review
        {
            'request_number': 'ACQ-2026-0001',
            'title': 'Cloud Migration Professional Services',
            'description': 'Enterprise cloud migration services to AWS GovCloud for 47 on-premise applications over 18 months.',
            'estimated_value': 1200000,
            'fiscal_year': '2026',
            'priority': 'high',
            'need_by_date': '2026-06-15',
            'status': 'asr_review',
            'intake_q1_need_type': 'new',
            'intake_q3_specific_vendor': 'no',
            'intake_q_buy_category': 'service',
            'derived_acquisition_type': 'new_competitive',
            'derived_tier': 'above_sat',
            'derived_pipeline': 'full',
            'derived_contract_character': 'service',
            'derived_requirements_doc_type': 'pws',
            'derived_scls_applicable': True,
            'derived_qasp_required': True,
            'derived_eval_approach': 'best_value',
            'intake_completed': True,
            'intake_completed_date': now - timedelta(days=15),
            'scrm_status': 'not_required',
            'sbo_status': 'in_review',
            'cio_status': 'complete_no_issues',
        },
        # 2. CrowdStrike follow-on sole source — $800K, above_sat, full pipeline, in KO review
        {
            'request_number': 'ACQ-2026-0002',
            'title': 'CrowdStrike Falcon EDR Platform Renewal',
            'description': 'Follow-on sole source renewal for CrowdStrike Falcon endpoint detection and response. 3,500 endpoint licenses.',
            'estimated_value': 800000,
            'fiscal_year': '2026',
            'priority': 'high',
            'need_by_date': '2026-04-01',
            'status': 'ko_review',
            'intake_q1_need_type': 'continue_extend',
            'intake_q2_situation': 'expiring_same_vendor',
            'intake_q_buy_category': 'software_license',
            'derived_acquisition_type': 'follow_on_sole_source',
            'derived_tier': 'above_sat',
            'derived_pipeline': 'full',
            'derived_contract_character': 'product',
            'derived_requirements_doc_type': 'description',
            'derived_scls_applicable': False,
            'derived_qasp_required': False,
            'derived_eval_approach': 'lpta',
            'intake_completed': True,
            'intake_completed_date': now - timedelta(days=30),
            'existing_contract_number': 'GS-35F-1234X/TO-001',
            'existing_contract_vendor': 'CrowdStrike, Inc.',
            'existing_contract_value': 750000,
            'existing_contract_end_date': '2026-03-31',
            'existing_contract_vehicle': 'GSA IT Schedule 70',
            'cpars_rating': 'very_good',
            'scrm_status': 'complete_no_issues',
            'sbo_status': 'complete_issues_found',
            'cio_status': 'complete_no_issues',
            'section508_status': 'complete_no_issues',
        },
        # 3. Network switch replacement — $450K, above_sat, full pipeline, in ISS review
        {
            'request_number': 'ACQ-2026-0003',
            'title': 'Network Switch Replacement - Cisco Catalyst 9300',
            'description': 'Replace end-of-support Cisco Catalyst 3850 switches across 12 locations. 120 access + 24 distribution switches.',
            'estimated_value': 450000,
            'fiscal_year': '2026',
            'priority': 'medium',
            'need_by_date': '2026-08-30',
            'status': 'iss_review',
            'intake_q1_need_type': 'new',
            'intake_q3_specific_vendor': 'not_sure',
            'intake_q_buy_category': 'product',
            'derived_acquisition_type': 'new_competitive',
            'derived_tier': 'above_sat',
            'derived_pipeline': 'full',
            'derived_contract_character': 'product',
            'derived_requirements_doc_type': 'specification',
            'derived_scls_applicable': False,
            'derived_qasp_required': False,
            'derived_eval_approach': 'lpta',
            'intake_completed': True,
            'intake_completed_date': now - timedelta(days=5),
            'scrm_status': 'requested',
            'sbo_status': 'requested',
            'cio_status': 'requested',
        },
        # 4. Help desk option exercise — $420K, above_sat, abbreviated
        {
            'request_number': 'ACQ-2026-0004',
            'title': 'IT Help Desk Services - Option Year 3',
            'description': 'Exercise Option Year 3 of the IT Help Desk services contract. Tier 1-3 support for 5,000 users.',
            'estimated_value': 420000,
            'fiscal_year': '2026',
            'priority': 'high',
            'need_by_date': '2026-05-01',
            'status': 'finance_review',
            'intake_q1_need_type': 'continue_extend',
            'intake_q2_situation': 'options_remaining',
            'intake_q_buy_category': 'service',
            'derived_acquisition_type': 'option_exercise',
            'derived_tier': 'above_sat',
            'derived_pipeline': 'abbreviated',
            'derived_contract_character': 'service',
            'derived_requirements_doc_type': 'pws',
            'derived_scls_applicable': True,
            'derived_qasp_required': True,
            'derived_eval_approach': 'best_value',
            'intake_completed': True,
            'intake_completed_date': now - timedelta(days=20),
            'existing_contract_number': 'FA8773-23-D-0045',
            'existing_contract_vendor': 'Acme IT Solutions',
            'existing_contract_value': 400000,
            'existing_contract_end_date': '2026-04-30',
            'options_remaining': 2,
            'current_option_year': 3,
            'cpars_rating': 'satisfactory',
            'scrm_status': 'not_required',
            'sbo_status': 'complete_no_issues',
            'cio_status': 'complete_no_issues',
        },
        # 5. Cloud hosting bridge extension — $2.1M, above_sat, abbreviated
        {
            'request_number': 'ACQ-2026-0005',
            'title': 'Cloud Hosting Services Bridge Extension',
            'description': '6-month bridge extension for enterprise cloud hosting while recompete RFP is pending. AWS GovCloud IaaS/PaaS.',
            'estimated_value': 2100000,
            'fiscal_year': '2026',
            'priority': 'critical',
            'need_by_date': '2026-03-15',
            'status': 'approved',
            'intake_q1_need_type': 'continue_extend',
            'intake_q2_situation': 'need_bridge',
            'intake_q_buy_category': 'service',
            'derived_acquisition_type': 'bridge_extension',
            'derived_tier': 'above_sat',
            'derived_pipeline': 'abbreviated',
            'derived_contract_character': 'service',
            'derived_requirements_doc_type': 'pws',
            'derived_scls_applicable': True,
            'derived_qasp_required': True,
            'derived_eval_approach': 'best_value',
            'intake_completed': True,
            'intake_completed_date': now - timedelta(days=40),
            'existing_contract_number': 'GS-35F-5678Y/TO-010',
            'existing_contract_vendor': 'Amazon Web Services Inc.',
            'existing_contract_value': 4000000,
            'existing_contract_end_date': '2026-03-14',
            'existing_contract_vehicle': 'GSA IT Schedule',
            'cpars_rating': 'very_good',
            'scrm_status': 'not_required',
            'sbo_status': 'complete_issues_found',
            'cio_status': 'complete_no_issues',
        },
        # 6. Bilateral mod add scope — $180K, sat, abbreviated
        {
            'request_number': 'ACQ-2026-0006',
            'title': 'Bilateral Mod - Add Cybersecurity Dashboard',
            'description': 'Add cybersecurity analytics dashboard scope to existing SIEM monitoring contract.',
            'estimated_value': 180000,
            'fiscal_year': '2026',
            'priority': 'medium',
            'need_by_date': '2026-07-01',
            'status': 'draft',
            'intake_q1_need_type': 'change_existing',
            'intake_q5_change_type': 'add_scope',
            'intake_q_buy_category': 'service',
            'derived_acquisition_type': 'bilateral_mod',
            'derived_tier': 'sat',
            'derived_pipeline': 'abbreviated',
            'derived_contract_character': 'service',
            'derived_requirements_doc_type': 'pws',
            'derived_scls_applicable': True,
            'derived_qasp_required': True,
            'derived_eval_approach': 'best_value',
            'intake_completed': True,
            'intake_completed_date': now - timedelta(days=2),
            'existing_contract_number': 'W9133L-24-C-0012',
            'existing_contract_vendor': 'SecOps LLC',
            'existing_contract_value': 550000,
            'existing_contract_end_date': '2027-03-31',
        },
        # 7. Unilateral mod admin correction — $0, ko_only
        {
            'request_number': 'ACQ-2026-0007',
            'title': 'Unilateral Mod - Correct Period of Performance',
            'description': 'Administrative correction to align period of performance end date with fiscal year.',
            'estimated_value': 0,
            'fiscal_year': '2026',
            'priority': 'low',
            'need_by_date': '2026-03-30',
            'status': 'approved',
            'intake_q1_need_type': 'change_existing',
            'intake_q5_change_type': 'admin_correction',
            'intake_q_buy_category': 'service',
            'derived_acquisition_type': 'unilateral_mod',
            'derived_tier': 'micro',
            'derived_pipeline': 'ko_only',
            'derived_contract_character': 'service',
            'derived_requirements_doc_type': 'pws',
            'derived_scls_applicable': True,
            'derived_qasp_required': False,
            'derived_eval_approach': 'best_value',
            'intake_completed': True,
            'intake_completed_date': now - timedelta(days=10),
            'existing_contract_number': 'FA8773-23-D-0045',
            'existing_contract_vendor': 'Acme IT Solutions',
        },
        # 8. Micro purchase — $12K, micro pipeline
        {
            'request_number': 'ACQ-2026-0008',
            'title': 'USB-C Docking Stations (50 units)',
            'description': 'Purchase 50 Thunderbolt 4 docking stations for the new hybrid workspace deployment.',
            'estimated_value': 12000,
            'fiscal_year': '2026',
            'priority': 'medium',
            'need_by_date': '2026-04-15',
            'status': 'approved',
            'intake_q1_need_type': 'new',
            'intake_q3_specific_vendor': 'no',
            'intake_q_buy_category': 'product',
            'derived_acquisition_type': 'new_competitive',
            'derived_tier': 'micro',
            'derived_pipeline': 'micro',
            'derived_contract_character': 'product',
            'derived_requirements_doc_type': 'specification',
            'derived_scls_applicable': False,
            'derived_qasp_required': False,
            'derived_eval_approach': 'lpta',
            'intake_completed': True,
            'intake_completed_date': now - timedelta(days=8),
        },
        # 9. Brand name Palo Alto firewalls — $380K, above_sat
        {
            'request_number': 'ACQ-2026-0009',
            'title': 'Palo Alto Networks PA-5400 Firewalls',
            'description': 'Brand name procurement of 6 Palo Alto PA-5400 series firewalls to replace end-of-life PA-3200 units.',
            'estimated_value': 380000,
            'fiscal_year': '2026',
            'priority': 'high',
            'need_by_date': '2026-06-01',
            'status': 'asr_review',
            'intake_q1_need_type': 'new',
            'intake_q3_specific_vendor': 'yes',
            'intake_q_buy_category': 'product',
            'derived_acquisition_type': 'brand_name_sole_source',
            'derived_tier': 'above_sat',
            'derived_pipeline': 'full',
            'derived_contract_character': 'product',
            'derived_requirements_doc_type': 'specification',
            'derived_scls_applicable': False,
            'derived_qasp_required': False,
            'derived_eval_approach': 'lpta',
            'intake_completed': True,
            'intake_completed_date': now - timedelta(days=12),
            'scrm_status': 'in_review',
            'sbo_status': 'requested',
            'cio_status': 'complete_no_issues',
        },
        # 10. Recompete — SIEM monitoring services — $650K, above_sat
        {
            'request_number': 'ACQ-2026-0010',
            'title': 'SIEM Monitoring Services Recompete',
            'description': 'Full and open competition recompete for 24x7 SIEM monitoring and incident response services.',
            'estimated_value': 650000,
            'fiscal_year': '2026',
            'priority': 'high',
            'need_by_date': '2026-09-01',
            'status': 'draft',
            'intake_q1_need_type': 'continue_extend',
            'intake_q2_situation': 'expiring_compete',
            'intake_q_buy_category': 'service',
            'derived_acquisition_type': 'recompete',
            'derived_tier': 'above_sat',
            'derived_pipeline': 'full',
            'derived_contract_character': 'service',
            'derived_requirements_doc_type': 'pws',
            'derived_scls_applicable': True,
            'derived_qasp_required': True,
            'derived_eval_approach': 'best_value',
            'intake_completed': True,
            'intake_completed_date': now - timedelta(days=1),
            'existing_contract_number': 'W9133L-24-C-0012',
            'existing_contract_vendor': 'SecOps LLC',
            'existing_contract_value': 550000,
            'existing_contract_end_date': '2026-08-31',
            'cpars_rating': 'satisfactory',
        },
        # 11. CLIN reallocation — $0, ko_only
        {
            'request_number': 'ACQ-2026-0011',
            'title': 'CLIN Reallocation - Help Desk to Cybersecurity',
            'description': 'Reallocate $50K from Help Desk CLIN 0002 to Cybersecurity CLIN 0003 within existing contract ceiling.',
            'estimated_value': 0,
            'fiscal_year': '2026',
            'priority': 'low',
            'need_by_date': '2026-04-30',
            'status': 'submitted',
            'intake_q1_need_type': 'change_existing',
            'intake_q5_change_type': 'clin_reallocation',
            'intake_q_buy_category': 'service',
            'derived_acquisition_type': 'clin_reallocation',
            'derived_tier': 'micro',
            'derived_pipeline': 'ko_only',
            'derived_contract_character': 'service',
            'derived_requirements_doc_type': 'pws',
            'derived_scls_applicable': True,
            'derived_qasp_required': False,
            'derived_eval_approach': 'best_value',
            'intake_completed': True,
            'intake_completed_date': now - timedelta(days=3),
        },
        # 12. Mixed product/service — managed print — $95K, sat
        {
            'request_number': 'ACQ-2026-0012',
            'title': 'Managed Print Services',
            'description': 'Managed print services including 45 multifunction printers, supplies, and maintenance for 3 years.',
            'estimated_value': 95000,
            'fiscal_year': '2026',
            'priority': 'low',
            'need_by_date': '2026-10-01',
            'status': 'draft',
            'intake_q1_need_type': 'new',
            'intake_q3_specific_vendor': 'no',
            'intake_q_buy_category': 'mixed',
            'intake_q_mixed_predominant': 'predominantly_service',
            'derived_acquisition_type': 'new_competitive',
            'derived_tier': 'sat',
            'derived_pipeline': 'abbreviated',
            'derived_contract_character': 'mixed_service',
            'derived_requirements_doc_type': 'pws',
            'derived_scls_applicable': True,
            'derived_qasp_required': True,
            'derived_eval_approach': 'best_value',
            'intake_completed': True,
            'intake_completed_date': now - timedelta(days=1),
        },
        # 13. Software license SAT — ServiceNow — $320K
        {
            'request_number': 'ACQ-2026-0013',
            'title': 'ServiceNow ITSM Platform Licenses',
            'description': 'Annual subscription renewal for ServiceNow IT Service Management platform. 500 user licenses.',
            'estimated_value': 320000,
            'fiscal_year': '2026',
            'priority': 'high',
            'need_by_date': '2026-05-15',
            'status': 'submitted',
            'intake_q1_need_type': 'continue_extend',
            'intake_q2_situation': 'expiring_same_vendor',
            'intake_q_buy_category': 'software_license',
            'derived_acquisition_type': 'follow_on_sole_source',
            'derived_tier': 'sat',
            'derived_pipeline': 'abbreviated',
            'derived_contract_character': 'product',
            'derived_requirements_doc_type': 'description',
            'derived_scls_applicable': False,
            'derived_qasp_required': False,
            'derived_eval_approach': 'lpta',
            'intake_completed': True,
            'intake_completed_date': now - timedelta(days=7),
            'existing_contract_number': 'GS-35F-9999Z/BPA-007',
            'existing_contract_vendor': 'ServiceNow Inc.',
            'existing_contract_value': 300000,
            'existing_contract_end_date': '2026-05-14',
            'existing_contract_vehicle': 'GSA IT Schedule',
            'scrm_status': 'complete_no_issues',
            'sbo_status': 'complete_issues_found',
            'cio_status': 'complete_no_issues',
            'section508_status': 'complete_no_issues',
        },
        # 14. Major IT modernization — $12M
        {
            'request_number': 'ACQ-2026-0014',
            'title': 'Enterprise IT Modernization Program',
            'description': 'Major multi-year IT modernization program including legacy system migration, cloud transformation, and zero-trust architecture implementation.',
            'estimated_value': 12000000,
            'fiscal_year': '2026',
            'priority': 'critical',
            'need_by_date': '2026-12-31',
            'status': 'draft',
            'intake_q1_need_type': 'new',
            'intake_q3_specific_vendor': 'no',
            'intake_q_buy_category': 'mixed',
            'intake_q_mixed_predominant': 'predominantly_service',
            'derived_acquisition_type': 'new_competitive',
            'derived_tier': 'major',
            'derived_pipeline': 'full',
            'derived_contract_character': 'mixed_service',
            'derived_requirements_doc_type': 'pws',
            'derived_scls_applicable': True,
            'derived_qasp_required': True,
            'derived_eval_approach': 'best_value',
            'intake_completed': True,
            'intake_completed_date': now - timedelta(days=1),
        },
    ]

    for i, d in enumerate(data):
        r = AcquisitionRequest(
            requestor_id=rid,
            requestor_name=rname,
            requestor_org='IT Operations Division',
            created_at=now - timedelta(days=50 - i * 3),
            **d,
        )
        db.session.add(r)
        requests[i] = r

    db.session.flush()
    return requests


# ---------------------------------------------------------------------------
# 9. CLINs
# ---------------------------------------------------------------------------
def _seed_clins(requests, loas):
    # Get PSC IDs
    psc_d302 = PSCCode.query.filter_by(code='D302').first()
    psc_d318 = PSCCode.query.filter_by(code='D318').first()
    psc_d320 = PSCCode.query.filter_by(code='D320').first()
    psc_d321 = PSCCode.query.filter_by(code='D321').first()
    psc_7030 = PSCCode.query.filter_by(code='7030').first()
    psc_7042 = PSCCode.query.filter_by(code='7042').first()
    psc_7045 = PSCCode.query.filter_by(code='7045').first()
    psc_d314 = PSCCode.query.filter_by(code='D314').first()
    psc_d301 = PSCCode.query.filter_by(code='D301').first()
    psc_7040 = PSCCode.query.filter_by(code='7040').first()

    loa_om = loas.get(0)
    loa_cy = loas.get(1)
    loa_rdte = loas.get(2)
    loa_proc = loas.get(3)

    clins_data = [
        # Request 0: Cloud Migration ($1.2M)
        (0, '0001', 'Cloud Assessment & Architecture Design', 'service', psc_d302, loa_rdte, 350000, 1, 'lot', '6 months', 'ffp', True, 'severable', 0),
        (0, '0002', 'Migration Execution Services', 'service', psc_d302, loa_rdte, 600000, 12, 'month', '12 months', 't_and_m', True, 'severable', 1),
        (0, '0003', 'Post-Migration Support', 'service', psc_d301, loa_rdte, 250000, 6, 'month', '6 months', 'ffp', True, 'severable', 2),

        # Request 1: CrowdStrike ($800K)
        (1, '0001', 'CrowdStrike Falcon Pro Licenses (3,500)', 'software_license', psc_7042, loa_cy, 650000, 3500, 'license', '12 months', 'ffp', False, 'severable', 0),
        (1, '0002', 'CrowdStrike Premium Support', 'service', psc_d320, loa_cy, 150000, 12, 'month', '12 months', 'ffp', False, 'severable', 1),

        # Request 2: Network Switches ($450K)
        (2, '0001', 'Cisco Catalyst 9300-48T Access Switches (120)', 'product', psc_7030, loa_proc, 312000, 120, 'each', 'One-time', 'ffp', False, 'non_severable', 0),
        (2, '0002', 'Cisco Catalyst 9500-24Y Distribution Switches (24)', 'product', psc_7030, loa_proc, 108000, 24, 'each', 'One-time', 'ffp', False, 'non_severable', 1),
        (2, '0003', 'Installation & Configuration Services', 'service', psc_d314, loa_proc, 30000, 1, 'lot', '3 months', 'ffp', True, 'severable', 2),

        # Request 3: Help Desk Option Year ($420K)
        (3, '0001', 'Tier 1 Help Desk Support', 'service', psc_d321, loa_om, 180000, 12, 'month', '12 months', 'ffp', True, 'severable', 0),
        (3, '0002', 'Tier 2/3 Technical Support', 'service', psc_d321, loa_om, 200000, 12, 'month', '12 months', 't_and_m', True, 'severable', 1),
        (3, '0003', 'Knowledge Base Maintenance', 'service', psc_d302, loa_om, 40000, 12, 'month', '12 months', 'ffp', True, 'severable', 2),

        # Request 4: Cloud Hosting Bridge ($2.1M)
        (4, '0001', 'AWS GovCloud IaaS (6 month bridge)', 'service', psc_d318, loa_om, 1500000, 6, 'month', '6 months', 'ffp', False, 'severable', 0),
        (4, '0002', 'Cloud Operations Support (6 month bridge)', 'service', psc_d318, loa_om, 600000, 6, 'month', '6 months', 't_and_m', True, 'severable', 1),

        # Request 8: Micro docking stations ($12K)
        (7, '0001', 'Thunderbolt 4 Docking Stations', 'product', psc_7040, loa_proc, 12000, 50, 'each', 'One-time', 'ffp', False, 'non_severable', 0),

        # Request 9: Palo Alto Firewalls ($380K)
        (8, '0001', 'Palo Alto PA-5430 Firewalls (6)', 'product', psc_7045, loa_cy, 300000, 6, 'each', 'One-time', 'ffp', False, 'non_severable', 0),
        (8, '0002', 'Panorama Management Licenses', 'software_license', psc_7042, loa_cy, 50000, 6, 'license', '3 years', 'ffp', False, 'severable', 1),
        (8, '0003', 'Installation & Integration', 'service', psc_d314, loa_cy, 30000, 1, 'lot', '2 months', 'ffp', False, 'severable', 2),
    ]

    for req_idx, clin_num, desc, ctype, psc, loa, value, qty, uom, pop, contype, scls, sev, sort in clins_data:
        r = requests.get(req_idx)
        if not r:
            continue
        clin = AcquisitionCLIN(
            request_id=r.id,
            clin_number=clin_num,
            description=desc,
            clin_type=ctype,
            psc_code_id=psc.id if psc else None,
            loa_id=loa.id if loa else None,
            estimated_value=value,
            quantity=qty,
            unit_of_measure=uom,
            period_of_performance=pop,
            contract_type=contype,
            scls_applicable=scls,
            severability=sev,
            sort_order=sort,
            clin_ceiling=value,
            clin_obligated=value if r.status in ('approved', 'awarded') else 0,
            clin_invoiced=value * 0.3 if r.status == 'awarded' else 0,
        )
        db.session.add(clin)

    db.session.flush()


# ---------------------------------------------------------------------------
# 10. Package Documents (simplified checklist for key requests)
# ---------------------------------------------------------------------------
def _seed_package_documents(requests, templates):
    # For requests that have gone through intake, create document records
    for idx, req in requests.items():
        if not req.intake_completed:
            continue

        # Create a subset of relevant documents based on type
        doc_configs = _get_doc_configs_for_request(req, templates)
        for tmpl_key, status, is_required in doc_configs:
            tmpl = templates.get(tmpl_key)
            if not tmpl:
                continue
            doc = PackageDocument(
                request_id=req.id,
                document_template_id=tmpl.id,
                document_type=tmpl_key,
                title=tmpl.name,
                status=status,
                required_before_gate=tmpl.required_before_gate,
                is_required=is_required,
            )
            db.session.add(doc)

    db.session.flush()


def _get_doc_configs_for_request(req, templates):
    """Return list of (template_key, status, is_required) tuples for a request."""
    configs = []

    acq_type = req.derived_acquisition_type
    tier = req.derived_tier
    buy_cat = req.intake_q_buy_category
    char = req.derived_contract_character
    val = req.estimated_value or 0
    status = req.status

    # Determine how far along (for status assignment)
    far_along = status in ('ko_review', 'legal_review', 'cio_approval', 'senior_review', 'approved', 'awarded')
    mid_along = status in ('asr_review', 'finance_review') or far_along

    # Requirements Description
    if val > 15000:
        s = 'complete' if mid_along else 'in_progress'
        configs.append(('requirements_description', s, True))

    # IGCE
    if val > 15000:
        s = 'complete' if mid_along else 'in_progress'
        configs.append(('igce', s, True))

    # MRR
    if acq_type in ('new_competitive', 'recompete', 'follow_on_sole_source', 'brand_name_sole_source') and val > 15000:
        s = 'complete' if mid_along else 'in_progress'
        configs.append(('market_research', s, True))

    # Acquisition Strategy
    if tier in ('above_sat', 'major'):
        s = 'complete' if mid_along else 'not_started'
        configs.append(('acquisition_strategy', s, True))

    # J&A
    if acq_type in ('brand_name_sole_source', 'follow_on_sole_source') and val > 15000:
        s = 'complete' if far_along else 'in_progress'
        configs.append(('ja_brand_name', s, True))

    # SCRM
    if buy_cat in ('product', 'software_license', 'mixed'):
        s = 'complete' if mid_along else 'not_started'
        configs.append(('scrm_assessment', s, True))

    # SB Coordination
    if val > 15000:
        s = 'complete' if mid_along else 'not_started'
        configs.append(('sb_coordination', s, True))

    # Funding Cert
    if val > 0:
        s = 'complete' if far_along else 'not_started'
        configs.append(('funding_certification', s, True))

    # QASP
    if char in ('service', 'mixed_service') and tier in ('sat', 'above_sat', 'major'):
        s = 'complete' if far_along else 'not_started'
        configs.append(('qasp', s, True))

    # SCLS
    if req.derived_scls_applicable and tier in ('sat', 'above_sat', 'major'):
        configs.append(('scls_wage', 'not_started', True))

    # Section 508
    if buy_cat in ('software_license', 'mixed'):
        s = 'complete' if mid_along else 'not_started'
        configs.append(('section_508', s, True))

    # CIO Approval
    if val > 0:
        s = 'complete' if mid_along else 'not_started'
        configs.append(('cio_approval', s, True))

    # BOM
    if buy_cat in ('product', 'mixed'):
        configs.append(('bom', 'not_started' if not mid_along else 'complete', True))

    # FedRAMP
    if buy_cat == 'software_license':
        configs.append(('fedramp', 'not_started' if not mid_along else 'complete', True))

    # Option Exercise Letter
    if acq_type == 'option_exercise':
        s = 'complete' if far_along else 'in_progress'
        configs.append(('option_exercise_letter', s, True))

    # SF-30
    if acq_type in ('bilateral_mod', 'unilateral_mod'):
        s = 'complete' if status == 'approved' else 'not_started'
        configs.append(('modification_sf30', s, True))

    # Bridge Justification
    if acq_type == 'bridge_extension':
        s = 'complete' if far_along else 'in_progress'
        configs.append(('bridge_justification', s, True))

    # CPARS
    if acq_type in ('recompete', 'follow_on_sole_source'):
        s = 'complete' if mid_along else 'not_started'
        configs.append(('cpars', s, True))

    # Security Requirements
    if val > 15000:
        configs.append(('security_requirements', 'not_started' if not mid_along else 'complete', True))

    # Source Selection
    if acq_type in ('new_competitive', 'recompete') and tier in ('above_sat', 'major'):
        configs.append(('source_selection', 'not_started', True))

    # Past Performance
    if acq_type in ('new_competitive', 'recompete') and tier in ('above_sat', 'major'):
        configs.append(('past_performance', 'not_started', True))

    # Labor Matrix
    if char in ('service', 'mixed_service'):
        configs.append(('labor_matrix', 'not_started' if not mid_along else 'complete', True))

    # D&F
    if acq_type in ('brand_name_sole_source', 'follow_on_sole_source', 'bridge_extension') and tier in ('above_sat', 'major'):
        configs.append(('determination_findings', 'not_started' if not mid_along else 'in_progress', True))

    return configs


# ---------------------------------------------------------------------------
# 11. Advisory Inputs
# ---------------------------------------------------------------------------
def _seed_advisory_inputs(requests, users):
    scrm_user = users.get('scrm')
    sb_user = users.get('sb')
    cto_user = users.get('cto')

    now = datetime.utcnow()

    adv_data = [
        # Request 0: Cloud Migration
        (0, 'sbo', 'in_review', None, None, None, 'asr'),
        (0, 'cio', 'complete_no_issues', 'No issues. Aligns with IT modernization roadmap.', 'Proceed', cto_user, 'iss'),

        # Request 1: CrowdStrike
        (1, 'scrm', 'complete_no_issues', 'CrowdStrike assessed — FedRAMP authorized, US-based.', 'Low risk', scrm_user, 'iss'),
        (1, 'sbo', 'complete_issues_found', 'CrowdStrike is a large business. J&A required for sole source.', 'Requires J&A', sb_user, 'asr'),
        (1, 'cio', 'complete_no_issues', 'EDR is critical cyber defense. Renewal approved.', 'Proceed', cto_user, 'iss'),
        (1, 'section508', 'complete_no_issues', 'Dashboard meets WCAG 2.1 AA.', None, None, 'asr'),

        # Request 2: Network Switches
        (2, 'scrm', 'requested', None, None, None, 'iss'),
        (2, 'sbo', 'requested', None, None, None, 'asr'),
        (2, 'cio', 'requested', None, None, None, 'iss'),

        # Request 3: Help Desk Option
        (3, 'sbo', 'complete_no_issues', 'Incumbent is SB. No issues.', 'Proceed', sb_user, 'asr'),
        (3, 'cio', 'complete_no_issues', 'Option exercise within scope.', 'Proceed', cto_user, 'iss'),

        # Request 4: Bridge Extension
        (4, 'sbo', 'complete_issues_found', 'Bridge limits SB participation. Document in J&A.', None, sb_user, 'asr'),
        (4, 'cio', 'complete_no_issues', 'Bridge necessary to maintain operations.', 'Proceed', cto_user, 'iss'),

        # Request 8: Palo Alto
        (8, 'scrm', 'in_review', None, None, None, 'iss'),
        (8, 'sbo', 'requested', None, None, None, 'asr'),
        (8, 'cio', 'complete_no_issues', 'Consistent with perimeter security architecture.', 'Proceed', cto_user, 'iss'),

        # Request 12: ServiceNow
        (12, 'scrm', 'complete_no_issues', 'ServiceNow FedRAMP High authorized.', 'Low risk', scrm_user, 'iss'),
        (12, 'sbo', 'complete_issues_found', 'ServiceNow is large business. Sole source J&A needed.', 'J&A required', sb_user, 'asr'),
        (12, 'cio', 'complete_no_issues', 'Critical ITSM platform.', 'Proceed', cto_user, 'iss'),
        (12, 'section508', 'complete_no_issues', 'ServiceNow VPAT reviewed.', None, None, 'asr'),
    ]

    for req_idx, team, status, findings, rec, reviewer, blocks in adv_data:
        r = requests.get(req_idx)
        if not r:
            continue
        adv = AdvisoryInput(
            request_id=r.id,
            team=team,
            status=status,
            findings=findings,
            recommendation=rec,
            reviewer_id=reviewer.id if reviewer else None,
            requested_date=now - timedelta(days=20),
            completed_date=now - timedelta(days=5) if 'complete' in status else None,
            blocks_gate=blocks,
        )
        db.session.add(adv)

    db.session.flush()


# ---------------------------------------------------------------------------
# 12. Demand Forecasts (8)
# ---------------------------------------------------------------------------
def _seed_forecasts(requests, loas, users):
    requestor = users.get('requestor')
    ko = users.get('ko')

    # Each tuple: (title, source, src_idx, val, basis, need, lead, submit, fy, loa_idx, buy, acq_type, status, assigned, contract_num, clin_num, color)
    forecasts_data = [
        ('Help Desk Contract Expiration — FY27 Recompete', 'contract_expiration', 3, 450000,
         'Based on current option year pricing + 3% escalation', '2027-04-30', 9, '2026-07-31',
         '2027', 0, 'service', 'recompete', 'forecasted', requestor,
         'GS-35F-0119Y', '0001', 'om'),
        ('CrowdStrike EDR — FY27 Renewal', 'contract_expiration', 1, 840000,
         'Current year + 5% price increase', '2027-03-31', 6, '2026-09-30',
         '2027', 1, 'software_license', 'follow_on_sole_source', 'acknowledged', ko,
         '47QTCA-22-D-0041', '0003', 'om'),
        ('Network Switch Refresh Phase 2', 'planned_refresh', None, 380000,
         'Remaining 8 locations at avg $47.5K each', '2027-01-15', 6, '2026-07-15',
         '2027', 3, 'product', 'new_competitive', 'forecasted', None,
         None, None, 'procurement'),
        ('Cloud Hosting Recompete', 'contract_expiration', 4, 4200000,
         'Current bridge x2 annual + growth', '2026-09-14', 12, '2025-09-14',
         '2026', 0, 'service', 'recompete', 'acquisition_created', ko,
         'GS-35F-0220Z', '0001', 'om'),
        ('Vulnerability Scanner License', 'option_year_due', None, 165000,
         'Tenable.io subscription', '2026-11-01', 4, '2026-07-01',
         '2026', 1, 'software_license', 'option_exercise', 'funded', ko,
         '47QTCA-22-D-0055', '0005', 'om'),
        ('Zero Trust Architecture Design Services', 'manual', None, 950000,
         'Strategic initiative per CIO roadmap', '2027-03-01', 9, '2026-06-01',
         '2027', 2, 'service', 'new_competitive', 'forecasted', None,
         None, None, 'rdte'),
        ('Server Lifecycle Replacement', 'technology_sunset', None, 520000,
         'Dell PowerEdge R760 replacements for datacenter', '2026-09-30', 6, '2026-03-30',
         '2026', 3, 'product', 'new_competitive', 'acknowledged', requestor,
         None, None, 'procurement'),
        ('SIEM Platform Renewal', 'contract_expiration', 9, 700000,
         'Current value + additional log sources', '2026-08-31', 6, '2026-02-28',
         '2026', 1, 'service', 'recompete', 'forecasted', None,
         'GS-35F-0318A', '0001', 'om'),
    ]

    for title, source, src_idx, val, basis, need, lead, submit, fy, loa_idx, buy, acq_type, status, assigned, contract_num, clin_num, color in forecasts_data:
        src_req = requests.get(src_idx) if src_idx is not None else None
        loa = loas.get(loa_idx)
        f = DemandForecast(
            title=title,
            source=source,
            source_contract_id=src_req.id if src_req else None,
            estimated_value=val,
            estimated_value_basis=basis,
            need_by_date=need,
            acquisition_lead_time=lead,
            submit_by_date=submit,
            fiscal_year=fy,
            suggested_loa_id=loa.id if loa else None,
            buy_category=buy,
            likely_acquisition_type=acq_type,
            status=status,
            assigned_to_id=assigned.id if assigned else None,
            contract_number=contract_num,
            clin_number=clin_num,
            color_of_money=color,
        )
        db.session.add(f)

    db.session.flush()


# ---------------------------------------------------------------------------
# 13. CLIN Execution Requests (6)
# ---------------------------------------------------------------------------
def _seed_execution_requests(requests, users):
    requestor = users.get('requestor')
    chief = users.get('branch_chief')
    cto = users.get('cto')

    now = datetime.utcnow()

    # Get some CLINs for reference
    r4 = requests.get(3)  # Help Desk
    r5 = requests.get(4)  # Cloud Hosting Bridge

    r4_clins = AcquisitionCLIN.query.filter_by(request_id=r4.id).all() if r4 else []
    r5_clins = AcquisitionCLIN.query.filter_by(request_id=r5.id).all() if r5 else []

    exec_data = [
        # ODC 1: Gigamon renewal
        {
            'request_number': 'ODC-2026-0001',
            'execution_type': 'odc',
            'contract_id': r4.id if r4 else None,
            'clin_id': r4_clins[2].id if len(r4_clins) > 2 else None,
            'title': 'Gigamon Network Visibility License Renewal',
            'description': 'Annual renewal of Gigamon visibility appliance licenses for 6 network taps.',
            'estimated_cost': 28500,
            'need_by_date': '2026-04-15',
            'status': 'authorized',
            'odc_product_name': 'Gigamon GigaVUE HC3 License',
            'odc_vendor': 'Gigamon Inc.',
            'odc_quote_number': 'GIG-Q-2026-0445',
            'odc_renewal_period': 'Apr 2026 - Mar 2027',
            'odc_prior_year_cost': 27000,
            'pm_approval': 'approved',
            'cto_approval': 'approved',
            'funding_status': 'sufficient',
        },
        # ODC 2: CrowdStrike add-on
        {
            'request_number': 'ODC-2026-0002',
            'execution_type': 'odc',
            'contract_id': requests.get(1).id if requests.get(1) else None,
            'clin_id': None,
            'title': 'CrowdStrike Threat Intelligence Module Add-on',
            'description': 'Add Falcon X Recon threat intelligence module to existing CrowdStrike subscription.',
            'estimated_cost': 45000,
            'need_by_date': '2026-05-01',
            'status': 'pm_approved',
            'odc_product_name': 'CrowdStrike Falcon X Recon',
            'odc_vendor': 'CrowdStrike, Inc.',
            'odc_quote_number': 'CS-Q-2026-1122',
            'odc_renewal_period': 'May 2026 - Mar 2027 (prorated)',
            'odc_prior_year_cost': None,
            'pm_approval': 'approved',
            'cto_approval': 'pending',
            'funding_status': 'sufficient',
        },
        # ODC 3: Server purchase
        {
            'request_number': 'ODC-2026-0003',
            'execution_type': 'odc',
            'contract_id': None,
            'clin_id': None,
            'title': 'Dell PowerEdge R760 Servers (4 units)',
            'description': 'Replace failing database servers in primary datacenter. Authorized under existing BPA.',
            'estimated_cost': 62000,
            'need_by_date': '2026-04-30',
            'status': 'submitted',
            'odc_product_name': 'Dell PowerEdge R760 Server',
            'odc_vendor': 'Dell Technologies',
            'odc_quote_number': 'DELL-Q-2026-7891',
            'odc_renewal_period': None,
            'odc_prior_year_cost': None,
            'pm_approval': 'pending',
            'cto_approval': None,
            'funding_status': 'sufficient',
        },
        # Travel 1: Conference
        {
            'request_number': 'TRV-2026-0001',
            'execution_type': 'travel',
            'contract_id': None,
            'clin_id': None,
            'title': 'RSA Conference 2026 - San Francisco',
            'description': 'Attendance at RSA Conference for 2 cybersecurity analysts.',
            'estimated_cost': 7800,
            'need_by_date': '2026-05-06',
            'status': 'authorized',
            'travel_traveler_name': 'Robert Johnson, Maria Garcia',
            'travel_traveler_org': 'government',
            'travel_destination': 'San Francisco, CA',
            'travel_purpose': 'Attend RSA Conference 2026 for cybersecurity training and vendor evaluation.',
            'travel_departure_date': '2026-05-05',
            'travel_return_date': '2026-05-09',
            'travel_airfare': 2400,
            'travel_lodging': 3200,
            'travel_per_diem': 1400,
            'travel_rental_car': 500,
            'travel_other_costs': 300,
            'travel_conference_event': 'RSA Conference 2026',
            'pm_approval': 'approved',
            'cto_approval': 'approved',
            'funding_status': 'sufficient',
        },
        # Travel 2: Site visit
        {
            'request_number': 'TRV-2026-0002',
            'execution_type': 'travel',
            'contract_id': None,
            'clin_id': None,
            'title': 'AWS GovCloud Site Visit - Ashburn',
            'description': 'Site visit to AWS GovCloud region datacenter in Ashburn, VA for cloud migration pre-assessment.',
            'estimated_cost': 1200,
            'need_by_date': '2026-03-20',
            'status': 'complete',
            'travel_traveler_name': 'Jane Smith',
            'travel_traveler_org': 'government',
            'travel_destination': 'Ashburn, VA',
            'travel_purpose': 'On-site assessment of AWS GovCloud infrastructure for migration planning.',
            'travel_departure_date': '2026-03-18',
            'travel_return_date': '2026-03-20',
            'travel_airfare': 0,
            'travel_lodging': 600,
            'travel_per_diem': 380,
            'travel_rental_car': 180,
            'travel_other_costs': 40,
            'travel_actual_airfare': 0,
            'travel_actual_lodging': 580,
            'travel_actual_per_diem': 364,
            'travel_actual_rental_car': 165,
            'travel_actual_other': 22,
            'travel_actual_total': 1131,
            'pm_approval': 'approved',
            'cto_approval': 'approved',
            'funding_status': 'sufficient',
        },
        # Travel 3: Training
        {
            'request_number': 'TRV-2026-0003',
            'execution_type': 'travel',
            'contract_id': None,
            'clin_id': None,
            'title': 'SANS SEC504 Training - San Antonio',
            'description': 'SANS SEC504 Hacker Tools, Techniques, and Incident Handling training for SOC analyst.',
            'estimated_cost': 4500,
            'need_by_date': '2026-06-12',
            'status': 'submitted',
            'travel_traveler_name': 'Robert Johnson',
            'travel_traveler_org': 'government',
            'travel_destination': 'San Antonio, TX',
            'travel_purpose': 'SANS SEC504 training for incident response capability enhancement.',
            'travel_departure_date': '2026-06-08',
            'travel_return_date': '2026-06-14',
            'travel_airfare': 680,
            'travel_lodging': 1800,
            'travel_per_diem': 1120,
            'travel_rental_car': 420,
            'travel_other_costs': 480,
            'travel_conference_event': 'SANS SEC504',
            'pm_approval': 'pending',
            'cto_approval': None,
            'funding_status': None,
        },
    ]

    for d in exec_data:
        exe = CLINExecutionRequest(
            requested_by_id=requestor.id if requestor else 1,
            requested_date=now - timedelta(days=10),
        )
        for key, val in d.items():
            if hasattr(exe, key):
                setattr(exe, key, val)

        # Set approval dates for approved items
        if d.get('pm_approval') == 'approved':
            exe.pm_approved_by_id = chief.id if chief else None
            exe.pm_approved_date = now - timedelta(days=7)
        if d.get('cto_approval') == 'approved':
            exe.cto_approved_by_id = cto.id if cto else None
            exe.cto_approved_date = now - timedelta(days=5)
        if d.get('status') == 'complete':
            exe.actual_cost = d.get('travel_actual_total') or d.get('estimated_cost')
            exe.cor_validated_date = now - timedelta(days=2)
            exe.cor_validated_by_id = chief.id if chief else None

        db.session.add(exe)

    db.session.flush()


# ---------------------------------------------------------------------------
# 14. Per Diem Rates (12)
# ---------------------------------------------------------------------------
def _seed_per_diem_rates():
    rates = [
        ('Washington DC', 'DC', '2026', 258, 79, '2025-10-01'),
        ('Arlington', 'VA', '2026', 258, 79, '2025-10-01'),
        ('San Antonio', 'TX', '2026', 153, 69, '2025-10-01'),
        ('Colorado Springs', 'CO', '2026', 161, 69, '2025-10-01'),
        ('San Diego', 'CA', '2026', 214, 74, '2025-10-01'),
        ('Las Vegas', 'NV', '2026', 190, 74, '2025-10-01'),
        ('Huntsville', 'AL', '2026', 136, 64, '2025-10-01'),
        ('Tampa', 'FL', '2026', 169, 69, '2025-10-01'),
        ('Dayton', 'OH', '2026', 120, 64, '2025-10-01'),
        ('Ft Meade', 'MD', '2026', 206, 74, '2025-10-01'),
        ('Norfolk', 'VA', '2026', 152, 69, '2025-10-01'),
        ('Honolulu', 'HI', '2026', 282, 99, '2025-10-01'),
    ]
    for loc, state, fy, lodging, mie, eff in rates:
        r = PerDiemRate(
            location=loc, state=state, fiscal_year=fy,
            lodging_rate=lodging, mie_rate=mie, effective_date=eff,
        )
        db.session.add(r)
    db.session.flush()


# ---------------------------------------------------------------------------
# 15. Activity Logs
# ---------------------------------------------------------------------------
def _seed_activity_logs(requests):
    now = datetime.utcnow()

    logs_data = [
        # Request 0: Cloud Migration
        (0, 'created', 'Request created', 'Jane Smith', now - timedelta(days=50)),
        (0, 'intake_completed', 'Intake completed: new_competitive / above_sat / full', 'Jane Smith', now - timedelta(days=48)),
        (0, 'submitted', 'Request submitted into Full Pipeline', 'Jane Smith', now - timedelta(days=45)),
        (0, 'approved', 'ISS Review approved by Michael Chen', 'Michael Chen', now - timedelta(days=40)),
        (0, 'advisory_completed', 'CIO advisory completed: No issues', 'Sarah Williams', now - timedelta(days=38)),

        # Request 1: CrowdStrike
        (1, 'created', 'Request created', 'Jane Smith', now - timedelta(days=45)),
        (1, 'intake_completed', 'Intake completed: follow_on_sole_source / above_sat / full', 'Jane Smith', now - timedelta(days=43)),
        (1, 'submitted', 'Request submitted into Full Pipeline', 'Jane Smith', now - timedelta(days=42)),
        (1, 'approved', 'ISS Review approved', 'Michael Chen', now - timedelta(days=38)),
        (1, 'advisory_completed', 'SCRM advisory completed: No issues', 'Robert Johnson', now - timedelta(days=37)),
        (1, 'approved', 'ASR Review approved', 'Michael Chen', now - timedelta(days=33)),
        (1, 'advisory_completed', 'SBO advisory completed: Issues found (large business)', 'James Wilson', now - timedelta(days=32)),
        (1, 'approved', 'Finance Review approved', 'Lisa Anderson', now - timedelta(days=28)),

        # Request 2: Network Switches
        (2, 'created', 'Request created', 'Jane Smith', now - timedelta(days=10)),
        (2, 'intake_completed', 'Intake completed: new_competitive / above_sat / full', 'Jane Smith', now - timedelta(days=8)),
        (2, 'submitted', 'Request submitted into Full Pipeline', 'Jane Smith', now - timedelta(days=7)),

        # Request 3: Help Desk Option
        (3, 'created', 'Request created', 'Jane Smith', now - timedelta(days=30)),
        (3, 'intake_completed', 'Intake completed: option_exercise / above_sat / abbreviated', 'Jane Smith', now - timedelta(days=28)),
        (3, 'submitted', 'Request submitted into Abbreviated Pipeline', 'Jane Smith', now - timedelta(days=27)),
        (3, 'approved', 'COR Review approved', 'Michael Chen', now - timedelta(days=22)),

        # Request 4: Bridge Extension
        (4, 'created', 'Request created', 'Jane Smith', now - timedelta(days=60)),
        (4, 'intake_completed', 'Intake completed: bridge_extension / above_sat / abbreviated', 'Jane Smith', now - timedelta(days=58)),
        (4, 'submitted', 'Request submitted into Abbreviated Pipeline', 'Jane Smith', now - timedelta(days=57)),
        (4, 'approved', 'COR Review approved', 'Michael Chen', now - timedelta(days=50)),
        (4, 'approved', 'Finance Review approved', 'Lisa Anderson', now - timedelta(days=47)),
        (4, 'approved', 'KO Review approved', 'David Martinez', now - timedelta(days=42)),
        (4, 'fully_approved', 'All approval steps completed', 'System', now - timedelta(days=42)),

        # Request 7: Unilateral Mod
        (6, 'created', 'Request created', 'Jane Smith', now - timedelta(days=15)),
        (6, 'submitted', 'Request submitted into KO-Only Pipeline', 'Jane Smith', now - timedelta(days=14)),
        (6, 'approved', 'KO Review approved', 'David Martinez', now - timedelta(days=11)),
        (6, 'fully_approved', 'All approval steps completed', 'System', now - timedelta(days=11)),

        # Request 8: Micro purchase
        (7, 'created', 'Request created', 'Jane Smith', now - timedelta(days=12)),
        (7, 'submitted', 'Request submitted into Micro-Purchase Pipeline', 'Jane Smith', now - timedelta(days=11)),
        (7, 'approved', 'Supervisor Approval approved', 'Michael Chen', now - timedelta(days=9)),
        (7, 'approved', 'GPC Purchase approved', 'Lisa Anderson', now - timedelta(days=7)),
        (7, 'fully_approved', 'All approval steps completed', 'System', now - timedelta(days=7)),
    ]

    for req_idx, atype, desc, actor, ts in logs_data:
        r = requests.get(req_idx)
        if not r:
            continue
        log = ActivityLog(
            request_id=r.id,
            activity_type=atype,
            description=desc,
            actor=actor,
            created_at=ts,
        )
        db.session.add(log)

    db.session.flush()


# ---------------------------------------------------------------------------
# 16. Notifications (demo)
# ---------------------------------------------------------------------------
def _seed_notifications(users, requests):
    """Seed demo notifications so every role sees items in the bell on first login."""
    now = datetime.utcnow()

    chief = users.get('branch_chief')
    ko = users.get('ko')
    budget = users.get('budget')
    requestor = users.get('requestor')
    scrm = users.get('scrm')
    sb = users.get('sb')
    cto = users.get('cto')
    cio = users.get('cio')
    legal = users.get('legal')
    admin = users.get('admin')

    r0 = requests.get(0)  # Cloud Migration - asr_review
    r1 = requests.get(1)  # CrowdStrike - ko_review
    r2 = requests.get(2)  # Network Switches - iss_review
    r3 = requests.get(3)  # Help Desk - finance_review
    r4 = requests.get(4)  # Bridge Extension - approved
    r8 = requests.get(8)  # Palo Alto - asr_review

    notifs = []

    # branch_chief: ISS review pending for Network Switches
    if chief and r2:
        notifs.append((chief.id, r2.id, 'step_activated',
                        'Action required: ISS Review',
                        f'Request "{r2.title}" ({r2.request_number}) needs your ISS Review.',
                        now - timedelta(hours=6)))

    # branch_chief: ASR review for Cloud Migration
    if chief and r0:
        notifs.append((chief.id, r0.id, 'step_activated',
                        'Action required: ASR Review',
                        f'Request "{r0.title}" ({r0.request_number}) needs your ASR Review.',
                        now - timedelta(days=2)))

    # ko: KO review for CrowdStrike
    if ko and r1:
        notifs.append((ko.id, r1.id, 'step_activated',
                        'Action required: KO Review',
                        f'Request "{r1.title}" ({r1.request_number}) needs your KO Review.',
                        now - timedelta(days=1)))

    # budget: Finance review for Help Desk Option
    if budget and r3:
        notifs.append((budget.id, r3.id, 'step_activated',
                        'Action required: Finance Review',
                        f'Request "{r3.title}" ({r3.request_number}) needs your Finance Review.',
                        now - timedelta(hours=12)))

    # scrm: Advisory requested for Network Switches
    if scrm and r2:
        notifs.append((scrm.id, r2.id, 'advisory_requested',
                        'Advisory review requested: SCRM',
                        f'Request "{r2.title}" ({r2.request_number}) needs SCRM advisory review.',
                        now - timedelta(days=4)))

    # scrm: Advisory requested for Palo Alto
    if scrm and r8:
        notifs.append((scrm.id, r8.id, 'advisory_requested',
                        'Advisory review requested: SCRM',
                        f'Request "{r8.title}" ({r8.request_number}) needs SCRM advisory review.',
                        now - timedelta(days=10)))

    # sb: Advisory requested for Network Switches
    if sb and r2:
        notifs.append((sb.id, r2.id, 'advisory_requested',
                        'Advisory review requested: SBO',
                        f'Request "{r2.title}" ({r2.request_number}) needs Small Business advisory review.',
                        now - timedelta(days=4)))

    # sb: Advisory requested for Palo Alto
    if sb and r8:
        notifs.append((sb.id, r8.id, 'advisory_requested',
                        'Advisory review requested: SBO',
                        f'Request "{r8.title}" ({r8.request_number}) needs Small Business advisory review.',
                        now - timedelta(days=10)))

    # cto: Advisory requested for Network Switches (CIO team)
    if cto and r2:
        notifs.append((cto.id, r2.id, 'advisory_requested',
                        'Advisory review requested: CIO',
                        f'Request "{r2.title}" ({r2.request_number}) needs CIO advisory review.',
                        now - timedelta(days=4)))

    # cio: Advisory requested for Network Switches
    if cio and r2:
        notifs.append((cio.id, r2.id, 'advisory_requested',
                        'Advisory review requested: CIO',
                        f'Request "{r2.title}" ({r2.request_number}) needs CIO advisory review.',
                        now - timedelta(days=4)))

    # requestor: Several completed step notifications
    if requestor and r4:
        notifs.append((requestor.id, r4.id, 'request_fully_approved',
                        f'Request approved: {r4.title}',
                        f'Your request "{r4.title}" ({r4.request_number}) has been fully approved.',
                        now - timedelta(days=15)))

    if requestor and r1:
        notifs.append((requestor.id, r1.id, 'advisory_completed',
                        'SCRM advisory completed',
                        'The SCRM advisory review for CrowdStrike Falcon EDR is complete. Status: Complete No Issues.',
                        now - timedelta(days=8)))
        notifs.append((requestor.id, r1.id, 'advisory_completed',
                        'SBO advisory completed',
                        'The SBO advisory review for CrowdStrike Falcon EDR is complete. Status: Complete Issues Found.',
                        now - timedelta(days=7)))

    if requestor and r0:
        notifs.append((requestor.id, r0.id, 'advisory_completed',
                        'CIO advisory completed',
                        'The CIO advisory review for Cloud Migration is complete. Status: Complete No Issues.',
                        now - timedelta(days=10)))

    # legal: notification (will have items when pipeline reaches legal review)
    if legal and r1:
        notifs.append((legal.id, r1.id, 'advisory_requested',
                        'Advisory review requested: LEGAL',
                        f'Request "{r1.title}" ({r1.request_number}) may require legal advisory review.',
                        now - timedelta(days=20)))

    # admin: sees a general notification
    if admin and r2:
        notifs.append((admin.id, r2.id, 'step_activated',
                        'New request in pipeline',
                        f'Request "{r2.title}" ({r2.request_number}) has been submitted into the Full Pipeline.',
                        now - timedelta(days=5)))

    for user_id, req_id, ntype, title, msg, ts in notifs:
        n = Notification(
            user_id=user_id,
            request_id=req_id,
            notification_type=ntype,
            title=title,
            message=msg,
            is_read=False,
            created_at=ts,
        )
        db.session.add(n)

    db.session.flush()
