"""Seed the database with realistic sample data for an IT acquisition lifecycle system.

Call via: flask seed
"""
from app.extensions import db
from app.models.user import User
from app.models.funding import FundingSource
from app.models.request import AcquisitionRequest
from app.models.approval import ApprovalTemplate, ApprovalTemplateStep, ApprovalStep
from app.models.document import PackageDocument
from app.models.lifecycle import LifecycleEvent
from app.models.activity import ActivityLog, Comment
from app.models.prior import PriorAcquisition
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta
import json


def seed():
    """Seed the database with sample data."""
    db.create_all()

    # Clear existing data
    Comment.query.delete()
    ActivityLog.query.delete()
    PackageDocument.query.delete()
    ApprovalStep.query.delete()
    ApprovalTemplateStep.query.delete()
    ApprovalTemplate.query.delete()
    LifecycleEvent.query.delete()
    AcquisitionRequest.query.delete()
    PriorAcquisition.query.delete()
    FundingSource.query.delete()
    User.query.delete()
    db.session.commit()

    # ── Users (6) ──
    users_data = [
        {'email': 'admin@acq.local', 'name': 'Alex Admin', 'role': 'admin', 'team': 'IT Management'},
        {'email': 'requestor@acq.local', 'name': 'Jane Smith', 'role': 'requestor', 'team': 'IT Operations'},
        {'email': 'chief@acq.local', 'name': 'Mark Johnson', 'role': 'branch_chief', 'team': 'IT Management'},
        {'email': 'cto@acq.local', 'name': 'Sarah Chen', 'role': 'cto', 'team': 'CIO/CTO Office'},
        {'email': 'scrm@acq.local', 'name': 'Robert Williams', 'role': 'scrm', 'team': 'Supply Chain Risk'},
        {'email': 'budget@acq.local', 'name': 'Lisa Martinez', 'role': 'budget', 'team': 'Budget Office'},
    ]
    for ud in users_data:
        u = User(email=ud['email'], name=ud['name'], role=ud['role'], team=ud['team'])
        u.set_password('demo123')
        db.session.add(u)
    db.session.flush()

    # ── Approval Templates (3) ──
    t1 = ApprovalTemplate(
        name='Standard IT Purchase (< $25K)',
        description='3-step approval for purchases under $25,000',
        applies_to=json.dumps({'max_cost': 25000}),
        is_default=True
    )
    t2 = ApprovalTemplate(
        name='Major Acquisition (> $25K)',
        description='5-step approval for purchases over $25,000',
        applies_to=json.dumps({'min_cost': 25000})
    )
    t3 = ApprovalTemplate(
        name='Service Contract Re-compete',
        description='6-step approval for contract re-competitions',
        applies_to=json.dumps({'category': 'service_contract', 'sub_category': 'recompete'})
    )
    db.session.add_all([t1, t2, t3])
    db.session.flush()

    # Template steps for t1 (3 steps)
    for i, (name, role, desc, sla) in enumerate([
        ('Branch Chief Approval', 'branch_chief', 'Review and approve the acquisition request', 3),
        ('Technical Review', 'cto', 'Verify technical requirements and standards compliance', 3),
        ('Budget Approval', 'budget', 'Confirm funding availability and approve expenditure', 5),
    ], 1):
        db.session.add(ApprovalTemplateStep(
            template_id=t1.id, step_number=i, step_name=name,
            approver_role=role, description=desc, sla_days=sla
        ))

    # Template steps for t2 (5 steps)
    for i, (name, role, desc, sla) in enumerate([
        ('Branch Chief Approval', 'branch_chief', 'Review and approve the acquisition request', 3),
        ('Technical Review', 'cto', 'Verify technical requirements and standards compliance', 5),
        ('Supply Chain Risk Review', 'scrm', 'Evaluate vendor supply chain risks and foreign ownership', 5),
        ('Budget Approval', 'budget', 'Confirm funding availability and approve expenditure', 5),
        ('CIO Final Approval', 'admin', 'Final executive sign-off for major acquisitions', 3),
    ], 1):
        db.session.add(ApprovalTemplateStep(
            template_id=t2.id, step_number=i, step_name=name,
            approver_role=role, description=desc, sla_days=sla
        ))

    # Template steps for t3 (6 steps)
    for i, (name, role, desc, sla) in enumerate([
        ('Branch Chief Approval', 'branch_chief', 'Review re-compete justification and requirements', 3),
        ('Technical Review', 'cto', 'Verify updated technical requirements', 5),
        ('Supply Chain Risk Review', 'scrm', 'Evaluate incumbent and potential vendors', 7),
        ('Budget Approval', 'budget', 'Confirm multi-year funding availability', 5),
        ('Legal Review', 'admin', 'Review contract terms and legal requirements', 7),
        ('CIO Final Approval', 'admin', 'Final executive sign-off', 3),
    ], 1):
        db.session.add(ApprovalTemplateStep(
            template_id=t3.id, step_number=i, step_name=name,
            approver_role=role, description=desc, sla_days=sla
        ))

    # ── Funding Sources (3) ──
    f1 = FundingSource(
        name='OCIO FY26 IT Modernization', fiscal_year='FY26',
        total_budget=600000, committed=187000, spent=95000,
        funding_type='appropriation', owner='Lisa Martinez'
    )
    f2 = FundingSource(
        name='CISO FY26 Cybersecurity', fiscal_year='FY26',
        total_budget=200000, committed=45000, spent=45000,
        funding_type='appropriation', owner='Lisa Martinez'
    )
    f3 = FundingSource(
        name='DHS Program Office IT Support', fiscal_year='FY26',
        total_budget=150000, committed=0, spent=0,
        funding_type='reimbursable', owner='Lisa Martinez'
    )
    db.session.add_all([f1, f2, f3])
    db.session.flush()

    # ── Prior Acquisitions (5) ──
    priors = [
        PriorAcquisition(
            description='Dell Latitude 5540 Laptops', vendor='Dell Technologies',
            product_category='hardware', unit_cost=1150, total_cost=9200,
            quantity=8, award_date='2025-03-15',
            contract_number='GS-35F-0511T', contract_vehicle='GSA Schedule'
        ),
        PriorAcquisition(
            description='CrowdStrike Falcon Endpoint Protection', vendor='CrowdStrike',
            product_category='software', unit_cost=1800, total_cost=45000,
            quantity=25, award_date='2025-01-10',
            contract_number='CS-FY25-001', contract_vehicle='GSA Schedule'
        ),
        PriorAcquisition(
            description='Help Desk Support Services', vendor='Acme IT Services',
            product_category='service', unit_cost=None, total_cost=1100000,
            quantity=1, award_date='2024-04-01',
            contract_number='HHSN316201400001W', contract_vehicle='Full & Open'
        ),
        PriorAcquisition(
            description='Nessus Professional Scanner', vendor='Tenable',
            product_category='software', unit_cost=5400, total_cost=5400,
            quantity=1, award_date='2025-02-20',
            contract_number='GS-35F-0118Y', contract_vehicle='GSA Advantage'
        ),
        PriorAcquisition(
            description='Cisco SmartNet Support', vendor='Cisco Systems',
            product_category='maintenance', unit_cost=640, total_cost=3200,
            quantity=5, award_date='2025-06-15',
            contract_number='CISCO-SN-FY25', contract_vehicle='Direct'
        ),
    ]
    db.session.add_all(priors)

    now = datetime.now()

    # ── Acquisition Requests (8) ──

    # Request 1: COMPLETED - CrowdStrike renewal
    r1 = AcquisitionRequest(
        request_number='ACQ-FY26-0012', title='CrowdStrike Falcon License Renewal',
        description='Annual renewal of CrowdStrike Falcon endpoint protection for 250 seats across the enterprise.',
        category='software_license', sub_category='renewal',
        justification='Mandatory cybersecurity tool required by agency security policy. CrowdStrike provides essential EDR capabilities.',
        trigger_type='lifecycle', estimated_total=45000,
        cost_breakdown=json.dumps({'seats': 250, 'cost_per_seat': 180, 'period': '12 months'}),
        funding_source_id=f2.id, fiscal_year='FY26', priority='high',
        need_by_date='2026-03-01', requestor_id=2, requestor_name='Jane Smith',
        requestor_org='IT Operations', status='closed', current_approval_step=5,
        vendor_name='CrowdStrike', product_name='Falcon Endpoint Protection',
        contract_vehicle='GSA Schedule',
        awarded_date='2026-01-15', awarded_vendor='CrowdStrike', awarded_amount=45000,
        po_number='PO-2026-0045', delivery_date='2026-01-20', received_date='2026-01-20',
        created_at=now - timedelta(days=45), updated_at=now - timedelta(days=5)
    )

    # Request 2: COMPLETED - 8 replacement laptops
    r2 = AcquisitionRequest(
        request_number='ACQ-FY26-0018', title='Replace 8 End-of-Warranty Laptops',
        description='Lifecycle replacement for 8 Dell Latitude 5540 laptops that are past warranty and experiencing hardware failures.',
        category='hardware_purchase', sub_category='replacement',
        justification='Current devices are 4+ years old, out of warranty, with increasing failure rates. 3 incidents filed in past 2 months.',
        trigger_type='lifecycle', estimated_total=10000,
        cost_breakdown=json.dumps({'quantity': 8, 'unit_cost': 1250}),
        funding_source_id=f1.id, fiscal_year='FY26', priority='medium',
        need_by_date='2026-02-28', requestor_id=2, requestor_name='Jane Smith',
        requestor_org='IT Operations', status='delivered', current_approval_step=3,
        vendor_name='Dell Technologies', product_name='Latitude 5550',
        quantity=8, contract_vehicle='GSA Schedule',
        awarded_date='2026-01-05', awarded_vendor='Dell Technologies', awarded_amount=9800,
        po_number='PO-2026-0023', delivery_date='2026-01-25', received_date='2026-01-28',
        created_at=now - timedelta(days=60), updated_at=now - timedelta(days=10)
    )

    # Request 3: IN PROGRESS - 50 Dell Laptops (at SCRM review step 3 of 5)
    r3 = AcquisitionRequest(
        request_number='ACQ-FY26-0031', title='Lifecycle Replacement: 50 Dell Laptops',
        description='Fleet replacement for 50 Dell Latitude laptops reaching end of 4-year lifecycle. Models include Latitude 5540 and 5530 across IT Operations and Program divisions.',
        category='hardware_purchase', sub_category='replacement',
        justification='Current fleet average age is 4.2 years. 23% have had warranty claims. Agency lifecycle policy requires replacement at 4 years for mobile devices.',
        trigger_type='lifecycle', estimated_total=62500,
        cost_breakdown=json.dumps({'quantity': 50, 'unit_cost': 1250, 'docking_stations': 50, 'dock_cost': 0}),
        funding_source_id=f1.id, fiscal_year='FY26', priority='high',
        need_by_date='2026-06-30', requestor_id=2, requestor_name='Jane Smith',
        requestor_org='IT Operations', status='in_review', current_approval_step=3,
        vendor_name='Dell Technologies', product_name='Latitude 5560',
        quantity=50, contract_vehicle='GSA Schedule',
        created_at=now - timedelta(days=20), updated_at=now - timedelta(days=1)
    )

    # Request 4: IN PROGRESS - Help Desk re-compete (at CIO approval step 5 of 6)
    r4 = AcquisitionRequest(
        request_number='ACQ-FY26-0035', title='Help Desk Support Contract Re-compete',
        description='Re-compete of the enterprise IT help desk support contract currently held by Acme IT Services. Contract includes Tier 1-3 support, on-site technicians, and after-hours coverage.',
        category='service_contract', sub_category='recompete',
        justification='Current contract (HHSN316201400001W) expires Sep 30, 2026. Must begin re-compete process to ensure continuity of service desk operations supporting 2,500+ users.',
        trigger_type='lifecycle', estimated_total=1200000,
        cost_breakdown=json.dumps({'base_year': 1200000, 'option_years': 4, 'annual_escalation': 0.03}),
        funding_source_id=f1.id, fiscal_year='FY26', priority='critical',
        need_by_date='2026-07-01', contract_end_date='2026-09-30',
        requestor_id=2, requestor_name='Jane Smith',
        requestor_org='IT Operations', status='in_review', current_approval_step=5,
        existing_contract_number='HHSN316201400001W', existing_contract_value=1100000,
        existing_vendor='Acme IT Services', contract_vehicle='Full & Open',
        created_at=now - timedelta(days=30), updated_at=now - timedelta(days=2)
    )

    # Request 5: DRAFT - Nessus renewal
    r5 = AcquisitionRequest(
        request_number='ACQ-FY26-0038', title='Nessus Vulnerability Scanner Renewal',
        description='Annual license renewal for Tenable Nessus Professional vulnerability scanner.',
        category='software_license', sub_category='renewal',
        justification='Required vulnerability scanning tool per agency security policy. License expires in 75 days.',
        trigger_type='lifecycle', estimated_total=18000,
        cost_breakdown=json.dumps({'licenses': 3, 'cost_per_license': 6000}),
        funding_source_id=f2.id, fiscal_year='FY26', priority='high',
        need_by_date='2026-04-15',
        requestor_id=2, requestor_name='Jane Smith',
        requestor_org='IT Security', status='draft', current_approval_step=0,
        vendor_name='Tenable', product_name='Nessus Professional',
        quantity=3, contract_vehicle='GSA Advantage',
        created_at=now - timedelta(days=5), updated_at=now - timedelta(days=1)
    )

    # Request 6: EMERGENCY - Failed NAS
    r6 = AcquisitionRequest(
        request_number='ACQ-FY26-0039', title='Emergency Replacement: Failed NAS Storage',
        description='Emergency procurement to replace failed Synology NAS unit serving the engineering team file share.',
        category='hardware_purchase', sub_category='emergency',
        justification='Synology DS1821+ NAS failed catastrophically on Feb 1. Engineering team of 25 users without shared storage. Incident INC-2026-0001 filed. Backup available but need replacement hardware.',
        trigger_type='emergency', estimated_total=8000,
        cost_breakdown=json.dumps({'nas_unit': 5500, 'drives_8x': 2500}),
        funding_source_id=f1.id, fiscal_year='FY26', priority='critical',
        need_by_date='2026-02-20',
        requestor_id=2, requestor_name='Jane Smith',
        requestor_org='IT Infrastructure', status='submitted', current_approval_step=0,
        vendor_name='Synology', product_name='DS1821+',
        quantity=1,
        created_at=now - timedelta(days=3), updated_at=now - timedelta(days=2)
    )

    # Request 7: SUBMITTED - Azure AD Premium upgrade
    r7 = AcquisitionRequest(
        request_number='ACQ-FY26-0040', title='Azure AD Premium P2 Upgrade',
        description='Upgrade from Azure AD Premium P1 to P2 for advanced identity protection and PIM capabilities.',
        category='cloud_service', sub_category='upgrade',
        justification='Need Privileged Identity Management (PIM) and advanced threat detection capabilities required by latest CISA directive.',
        trigger_type='manual', estimated_total=36000,
        cost_breakdown=json.dumps({'users': 300, 'monthly_per_user': 10, 'months': 12}),
        funding_source_id=f2.id, fiscal_year='FY26', priority='high',
        need_by_date='2026-04-01',
        requestor_id=2, requestor_name='Jane Smith',
        requestor_org='IT Security', status='submitted', current_approval_step=0,
        vendor_name='Microsoft', product_name='Azure AD Premium P2',
        quantity=300,
        created_at=now - timedelta(days=7), updated_at=now - timedelta(days=6)
    )

    # Request 8: CANCELLED
    r8 = AcquisitionRequest(
        request_number='ACQ-FY26-0025', title='Zoom Gov Pro License Expansion',
        description='Expand Zoom Gov Pro licenses from 50 to 100 seats.',
        category='software_license', sub_category='upgrade',
        justification='Increasing demand for video conferencing across remote workforce.',
        trigger_type='manual', estimated_total=15000,
        cost_breakdown=json.dumps({'additional_seats': 50, 'cost_per_seat': 300}),
        funding_source_id=f1.id, fiscal_year='FY26', priority='low',
        requestor_id=2, requestor_name='Jane Smith',
        requestor_org='IT Operations', status='cancelled', current_approval_step=0,
        notes='Cancelled - Microsoft Teams adopted as primary conferencing platform.',
        created_at=now - timedelta(days=40), updated_at=now - timedelta(days=25)
    )

    db.session.add_all([r1, r2, r3, r4, r5, r6, r7, r8])
    db.session.flush()

    # ── Approval Steps for completed/in-progress requests ──

    # R1 (CrowdStrike) - completed, used 5-step template
    steps_r1 = [
        ApprovalStep(
            request_id=r1.id, step_number=1, step_name='Branch Chief Approval',
            approver_role='branch_chief', approver_name='Mark Johnson',
            status='approved', acted_on_date=now - timedelta(days=42),
            action_by='Mark Johnson', comments='Approved - essential security tool.',
            activated_at=now - timedelta(days=44), due_date=now - timedelta(days=41)
        ),
        ApprovalStep(
            request_id=r1.id, step_number=2, step_name='Technical Review',
            approver_role='cto', approver_name='Sarah Chen',
            status='approved', acted_on_date=now - timedelta(days=39),
            action_by='Sarah Chen', comments='CrowdStrike meets all technical requirements. Approved.',
            activated_at=now - timedelta(days=42), due_date=now - timedelta(days=37)
        ),
        ApprovalStep(
            request_id=r1.id, step_number=3, step_name='Supply Chain Risk Review',
            approver_role='scrm', approver_name='Robert Williams',
            status='approved', acted_on_date=now - timedelta(days=35),
            action_by='Robert Williams', comments='CrowdStrike - US-based company, no supply chain concerns.',
            activated_at=now - timedelta(days=39), due_date=now - timedelta(days=32)
        ),
        ApprovalStep(
            request_id=r1.id, step_number=4, step_name='Budget Approval',
            approver_role='budget', approver_name='Lisa Martinez',
            status='approved', acted_on_date=now - timedelta(days=33),
            action_by='Lisa Martinez', comments='Funding confirmed from CISO Cybersecurity budget.',
            activated_at=now - timedelta(days=35), due_date=now - timedelta(days=28)
        ),
        ApprovalStep(
            request_id=r1.id, step_number=5, step_name='CIO Final Approval',
            approver_role='admin', approver_name='Alex Admin',
            status='approved', acted_on_date=now - timedelta(days=32),
            action_by='Alex Admin', comments='Approved. Proceed with renewal.',
            activated_at=now - timedelta(days=33), due_date=now - timedelta(days=28)
        ),
    ]

    # R2 (8 laptops) - completed, used 3-step template (under $25K)
    steps_r2 = [
        ApprovalStep(
            request_id=r2.id, step_number=1, step_name='Branch Chief Approval',
            approver_role='branch_chief', approver_name='Mark Johnson',
            status='approved', acted_on_date=now - timedelta(days=55),
            action_by='Mark Johnson', comments='Approved - replacement justified by warranty status.',
            activated_at=now - timedelta(days=58), due_date=now - timedelta(days=55)
        ),
        ApprovalStep(
            request_id=r2.id, step_number=2, step_name='Technical Review',
            approver_role='cto', approver_name='Sarah Chen',
            status='approved', acted_on_date=now - timedelta(days=52),
            action_by='Sarah Chen', comments='Latitude 5550 model approved per standard config.',
            activated_at=now - timedelta(days=55), due_date=now - timedelta(days=50)
        ),
        ApprovalStep(
            request_id=r2.id, step_number=3, step_name='Budget Approval',
            approver_role='budget', approver_name='Lisa Martinez',
            status='approved', acted_on_date=now - timedelta(days=50),
            action_by='Lisa Martinez', comments='Funded from IT Modernization budget.',
            activated_at=now - timedelta(days=52), due_date=now - timedelta(days=45)
        ),
    ]

    # R3 (50 laptops) - in_review, at step 3 (SCRM)
    steps_r3 = [
        ApprovalStep(
            request_id=r3.id, step_number=1, step_name='Branch Chief Approval',
            approver_role='branch_chief', approver_name='Mark Johnson',
            status='approved', acted_on_date=now - timedelta(days=15),
            action_by='Mark Johnson', comments='Approved - fleet replacement overdue.',
            activated_at=now - timedelta(days=18), due_date=now - timedelta(days=15)
        ),
        ApprovalStep(
            request_id=r3.id, step_number=2, step_name='Technical Review',
            approver_role='cto', approver_name='Sarah Chen',
            status='approved', acted_on_date=now - timedelta(days=10),
            action_by='Sarah Chen', comments='Latitude 5560 meets standards. Recommend including docking stations.',
            activated_at=now - timedelta(days=15), due_date=now - timedelta(days=8)
        ),
        ApprovalStep(
            request_id=r3.id, step_number=3, step_name='Supply Chain Risk Review',
            approver_role='scrm', status='active',
            activated_at=now - timedelta(days=10), due_date=now - timedelta(days=-3)
        ),
        ApprovalStep(
            request_id=r3.id, step_number=4, step_name='Budget Approval',
            approver_role='budget', status='pending'
        ),
        ApprovalStep(
            request_id=r3.id, step_number=5, step_name='CIO Final Approval',
            approver_role='admin', status='pending'
        ),
    ]

    # R4 (Help desk re-compete) - in_review, at step 5 (Legal/CIO)
    steps_r4 = [
        ApprovalStep(
            request_id=r4.id, step_number=1, step_name='Branch Chief Approval',
            approver_role='branch_chief', approver_name='Mark Johnson',
            status='approved', acted_on_date=now - timedelta(days=26),
            action_by='Mark Johnson',
            activated_at=now - timedelta(days=28), due_date=now - timedelta(days=25)
        ),
        ApprovalStep(
            request_id=r4.id, step_number=2, step_name='Technical Review',
            approver_role='cto', approver_name='Sarah Chen',
            status='approved', acted_on_date=now - timedelta(days=20),
            action_by='Sarah Chen',
            comments='Updated requirements reviewed. SLA metrics increased per new ITSM standards.',
            activated_at=now - timedelta(days=26), due_date=now - timedelta(days=19)
        ),
        ApprovalStep(
            request_id=r4.id, step_number=3, step_name='Supply Chain Risk Review',
            approver_role='scrm', approver_name='Robert Williams',
            status='approved', acted_on_date=now - timedelta(days=12),
            action_by='Robert Williams',
            comments='Incumbent and likely competitors evaluated. No concerns.',
            activated_at=now - timedelta(days=20), due_date=now - timedelta(days=11)
        ),
        ApprovalStep(
            request_id=r4.id, step_number=4, step_name='Budget Approval',
            approver_role='budget', approver_name='Lisa Martinez',
            status='approved', acted_on_date=now - timedelta(days=7),
            action_by='Lisa Martinez',
            comments='Multi-year funding confirmed. FY26 base + 4 option years.',
            activated_at=now - timedelta(days=12), due_date=now - timedelta(days=5)
        ),
        ApprovalStep(
            request_id=r4.id, step_number=5, step_name='Legal Review',
            approver_role='admin', status='active',
            activated_at=now - timedelta(days=7), due_date=now - timedelta(days=2)
        ),
        ApprovalStep(
            request_id=r4.id, step_number=6, step_name='CIO Final Approval',
            approver_role='admin', status='pending'
        ),
    ]

    db.session.add_all(steps_r1 + steps_r2 + steps_r3 + steps_r4)

    # ── Package Documents ──
    docs = [
        # R1 - Complete package
        PackageDocument(
            request_id=r1.id, document_type='strategy',
            title='Acquisition Strategy - CrowdStrike Renewal',
            status='complete',
            content='# Acquisition Strategy\n\n## Requirement\nRenewal of CrowdStrike Falcon endpoint protection for 250 seats.\n\n## Recommended Approach\nSole source renewal via GSA Schedule. CrowdStrike is the incumbent with established deployment across all endpoints.\n\n## Timeline\n- Award target: January 2026\n- License activation: Upon award',
            completed_date='2026-01-10'
        ),
        PackageDocument(
            request_id=r1.id, document_type='igce',
            title='IGCE - CrowdStrike Falcon Renewal',
            status='complete',
            content='# Independent Government Cost Estimate\n\n| Item | Qty | Unit Cost | Total |\n|------|-----|-----------|-------|\n| Falcon Endpoint Protection (per seat/year) | 250 | $180 | $45,000 |\n\n## Historical Pricing\n- FY25: 25 seats at $1,800/seat ($45,000 total)\n- Pricing consistent with GSA Schedule rates',
            completed_date='2026-01-08'
        ),
        PackageDocument(
            request_id=r1.id, document_type='market_research',
            title='Market Research - EDR Solutions',
            status='complete',
            content='# Market Research Report\n\n## Sources Consulted\n- GSA Advantage pricing\n- CrowdStrike direct quote\n\n## Findings\nCrowdStrike is the incumbent EDR solution deployed across 250 endpoints. Migration costs to alternative would exceed renewal costs. Sole source justified.',
            completed_date='2026-01-09'
        ),

        # R3 - Partially complete
        PackageDocument(
            request_id=r3.id, document_type='strategy',
            title='Acquisition Strategy - Dell Laptop Fleet Replacement',
            status='complete',
            content='# Acquisition Strategy\n\n## Requirement\nReplace 50 Dell Latitude laptops that have reached end of 4-year lifecycle.\n\n## Recommended Approach\nCompetitive procurement via GSA Schedule IT 70.\n\n## Small Business Consideration\nDell Technologies qualifies under SDVOSB partnerships.',
            ai_generated=True,
            completed_date=(now - timedelta(days=12)).strftime('%Y-%m-%d')
        ),
        PackageDocument(
            request_id=r3.id, document_type='igce',
            title='IGCE - Dell Laptop Fleet Replacement',
            status='drafting',
            content='# Independent Government Cost Estimate\n\n| Item | Qty | Unit Cost | Total |\n|------|-----|-----------|-------|\n| Dell Latitude 5560 | 50 | $1,250 | $62,500 |\n\n## Historical Pricing\n- FY25 purchase: 8 x Latitude 5540 at $1,150/unit\n- 3% escalation factor applied for FY26',
            ai_generated=True
        ),
        PackageDocument(
            request_id=r3.id, document_type='market_research',
            title='Market Research - Enterprise Laptops',
            status='not_started'
        ),
        PackageDocument(
            request_id=r3.id, document_type='scrm_assessment',
            title='SCRM Assessment - Dell Technologies',
            status='not_started'
        ),

        # R4 - Near complete
        PackageDocument(
            request_id=r4.id, document_type='strategy',
            title='Acquisition Strategy - Help Desk Re-compete',
            status='complete',
            content='# Acquisition Strategy\n\n## Requirement\nRe-compete enterprise IT help desk support contract.\n\n## Current Contract\n- Incumbent: Acme IT Services\n- Contract #: HHSN316201400001W\n- Current value: $1.1M/year\n\n## Recommended Approach\nFull and open competition with best value evaluation criteria.',
            completed_date=(now - timedelta(days=18)).strftime('%Y-%m-%d')
        ),
        PackageDocument(
            request_id=r4.id, document_type='igce',
            title='IGCE - Help Desk Support',
            status='complete',
            content='# IGCE\n\n| Year | Amount |\n|------|--------|\n| Base Year | $1,200,000 |\n| Option Year 1 | $1,236,000 |\n| Option Year 2 | $1,273,080 |\n| Option Year 3 | $1,311,272 |\n| Option Year 4 | $1,350,610 |\n| **Total** | **$6,370,962** |',
            completed_date=(now - timedelta(days=15)).strftime('%Y-%m-%d')
        ),
        PackageDocument(
            request_id=r4.id, document_type='scrm_assessment',
            title='SCRM Assessment - Help Desk Vendors',
            status='review',
            content='# SCRM Assessment\n\n## Vendors Evaluated\n- Acme IT Services (incumbent)\n- TechStar Solutions\n- Federal IT Partners\n\n## Risk Level: LOW\nAll potential vendors are US-based with no foreign ownership concerns.'
        ),
    ]
    db.session.add_all(docs)

    # ── Lifecycle Events (18) ──
    events = [
        LifecycleEvent(
            asset_name='Dell Latitude 5540 - Batch A (8 units)',
            event_type='warranty_expiry', event_date='2026-03-15',
            lead_time_days=120, action_needed='replace', estimated_cost=10000,
            status='acquisition_created', acquisition_request_id=r2.id,
            fiscal_year_impact='FY26'
        ),
        LifecycleEvent(
            asset_name='Dell Latitude 5540 - Batch B (15 units)',
            event_type='warranty_expiry', event_date='2026-05-01',
            lead_time_days=120, action_needed='replace', estimated_cost=18750,
            status='upcoming', fiscal_year_impact='FY26'
        ),
        LifecycleEvent(
            asset_name='Dell Latitude 5530 - Batch C (20 units)',
            event_type='warranty_expiry', event_date='2026-08-15',
            lead_time_days=120, action_needed='replace', estimated_cost=25000,
            status='upcoming', fiscal_year_impact='FY26'
        ),
        LifecycleEvent(
            asset_name='Dell Latitude 5540 - Batch D (7 units)',
            event_type='warranty_expiry', event_date='2027-01-10',
            lead_time_days=120, action_needed='replace', estimated_cost=8750,
            status='upcoming', fiscal_year_impact='FY27'
        ),
        LifecycleEvent(
            asset_name='CrowdStrike Falcon (250 seats)',
            event_type='license_renewal', event_date='2027-01-15',
            lead_time_days=90, action_needed='renew', estimated_cost=45000,
            status='upcoming', fiscal_year_impact='FY27'
        ),
        LifecycleEvent(
            asset_name='Microsoft 365 GCC (2500 users)',
            event_type='license_renewal', event_date='2026-07-31',
            lead_time_days=120, action_needed='renew', estimated_cost=375000,
            status='upcoming', fiscal_year_impact='FY26'
        ),
        LifecycleEvent(
            asset_name='Help Desk Support Contract',
            event_type='contract_end', event_date='2026-09-30',
            lead_time_days=365, action_needed='recompete', estimated_cost=1200000,
            status='acquisition_created', acquisition_request_id=r4.id,
            fiscal_year_impact='FY26'
        ),
        LifecycleEvent(
            asset_name='Cisco ASA 5525-X Firewall',
            event_type='support_end', event_date='2026-11-30',
            lead_time_days=180, action_needed='replace', estimated_cost=12000,
            status='action_needed', fiscal_year_impact='FY27'
        ),
        LifecycleEvent(
            asset_name='Nessus Professional (3 licenses)',
            event_type='license_renewal', event_date='2026-04-28',
            lead_time_days=75, action_needed='renew', estimated_cost=18000,
            status='acquisition_created', acquisition_request_id=r5.id,
            fiscal_year_impact='FY26'
        ),
        LifecycleEvent(
            asset_name='Dell PowerEdge R740 - Server 1',
            event_type='warranty_expiry', event_date='2027-04-15',
            lead_time_days=180, action_needed='replace', estimated_cost=8000,
            status='upcoming', fiscal_year_impact='FY27'
        ),
        LifecycleEvent(
            asset_name='Dell PowerEdge R740 - Server 2',
            event_type='warranty_expiry', event_date='2027-06-20',
            lead_time_days=180, action_needed='replace', estimated_cost=8000,
            status='upcoming', fiscal_year_impact='FY27'
        ),
        LifecycleEvent(
            asset_name='Cisco Catalyst 9300 Switch (2 units)',
            event_type='support_end', event_date='2027-03-01',
            lead_time_days=180, action_needed='renew', estimated_cost=4800,
            status='upcoming', fiscal_year_impact='FY27'
        ),
        LifecycleEvent(
            asset_name='SolarWinds NPM License',
            event_type='license_renewal', event_date='2026-06-15',
            lead_time_days=90, action_needed='renew', estimated_cost=8500,
            status='upcoming', fiscal_year_impact='FY26'
        ),
        LifecycleEvent(
            asset_name='Adobe Acrobat Pro (25 seats)',
            event_type='license_renewal', event_date='2026-08-01',
            lead_time_days=60, action_needed='renew', estimated_cost=4500,
            status='upcoming', fiscal_year_impact='FY26'
        ),
        LifecycleEvent(
            asset_name='Zoom Gov Pro (50 seats)',
            event_type='license_renewal', event_date='2026-05-15',
            lead_time_days=60, action_needed='renew', estimated_cost=7500,
            status='upcoming', fiscal_year_impact='FY26'
        ),
        LifecycleEvent(
            asset_name='Cisco AnyConnect VPN (500 users)',
            event_type='license_renewal', event_date='2026-09-01',
            lead_time_days=90, action_needed='renew', estimated_cost=12000,
            status='upcoming', fiscal_year_impact='FY26'
        ),
        LifecycleEvent(
            asset_name='HP LaserJet MFP M477 (5 units)',
            event_type='warranty_expiry', event_date='2026-12-15',
            lead_time_days=60, action_needed='replace', estimated_cost=5000,
            status='upcoming', fiscal_year_impact='FY27'
        ),
        LifecycleEvent(
            asset_name='Synology DS1821+ NAS',
            event_type='warranty_expiry', event_date='2027-02-01',
            lead_time_days=90, action_needed='replace', estimated_cost=8000,
            status='upcoming', fiscal_year_impact='FY27'
        ),
    ]
    db.session.add_all(events)

    # ── Activity Log entries ──
    activities = [
        ActivityLog(
            request_id=r1.id, activity_type='created',
            description='Request created', actor='Jane Smith',
            created_at=now - timedelta(days=45)
        ),
        ActivityLog(
            request_id=r1.id, activity_type='submitted',
            description='Request submitted for approval', actor='Jane Smith',
            created_at=now - timedelta(days=44)
        ),
        ActivityLog(
            request_id=r1.id, activity_type='approved',
            description='Branch Chief approved', actor='Mark Johnson',
            created_at=now - timedelta(days=42)
        ),
        ActivityLog(
            request_id=r1.id, activity_type='approved',
            description='CTO approved', actor='Sarah Chen',
            created_at=now - timedelta(days=39)
        ),
        ActivityLog(
            request_id=r1.id, activity_type='approved',
            description='SCRM approved', actor='Robert Williams',
            created_at=now - timedelta(days=35)
        ),
        ActivityLog(
            request_id=r1.id, activity_type='approved',
            description='Budget approved', actor='Lisa Martinez',
            created_at=now - timedelta(days=33)
        ),
        ActivityLog(
            request_id=r1.id, activity_type='approved',
            description='CIO approved - all approvals complete', actor='Alex Admin',
            created_at=now - timedelta(days=32)
        ),
        ActivityLog(
            request_id=r1.id, activity_type='status_change',
            description='Status changed to awarded', actor='System',
            old_value='approved', new_value='awarded',
            created_at=now - timedelta(days=20)
        ),
        ActivityLog(
            request_id=r1.id, activity_type='status_change',
            description='Delivery received and verified', actor='Jane Smith',
            old_value='awarded', new_value='closed',
            created_at=now - timedelta(days=5)
        ),
        ActivityLog(
            request_id=r3.id, activity_type='created',
            description='Request created from lifecycle trigger', actor='System',
            created_at=now - timedelta(days=20)
        ),
        ActivityLog(
            request_id=r3.id, activity_type='submitted',
            description='Request submitted for approval', actor='Jane Smith',
            created_at=now - timedelta(days=18)
        ),
        ActivityLog(
            request_id=r3.id, activity_type='approved',
            description='Branch Chief approved', actor='Mark Johnson',
            created_at=now - timedelta(days=15)
        ),
        ActivityLog(
            request_id=r3.id, activity_type='approved',
            description='CTO approved with recommendation', actor='Sarah Chen',
            created_at=now - timedelta(days=10)
        ),
        ActivityLog(
            request_id=r3.id, activity_type='document_added',
            description='Strategy document auto-drafted', actor='System',
            created_at=now - timedelta(days=12)
        ),
    ]
    db.session.add_all(activities)

    # ── Comments ──
    comments = [
        Comment(
            request_id=r3.id, author='Sarah Chen',
            content='I recommend including docking stations in this order. The Latitude 5560 supports USB-C docking which would standardize our desk setup.',
            created_at=now - timedelta(days=10)
        ),
        Comment(
            request_id=r3.id, author='Jane Smith',
            content='Good idea. I\'ll update the specs to include Dell WD19S docking stations. The per-unit cost stays within budget.',
            created_at=now - timedelta(days=9)
        ),
        Comment(
            request_id=r4.id, author='Robert Williams',
            content='SCRM review complete. All potential vendors are US-based. No FOCI concerns identified.',
            created_at=now - timedelta(days=12)
        ),
        Comment(
            request_id=r4.id, author='Lisa Martinez',
            content='Multi-year funding confirmed. Base year + 4 option years budgeted at 3% annual escalation.',
            created_at=now - timedelta(days=7)
        ),
        Comment(
            request_id=r6.id, author='Jane Smith',
            content='This is urgent - engineering team has been without shared storage for 2 days. Requesting expedited processing.',
            is_internal=False, created_at=now - timedelta(days=2)
        ),
    ]
    db.session.add_all(comments)

    db.session.commit()
