from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from app.extensions import db
from app.models.request import AcquisitionRequest
from app.models.approval import ApprovalStep
from app.models.advisory import AdvisoryInput
from app.models.loa import LineOfAccounting
from app.models.execution import CLINExecutionRequest
from app.models.forecast import DemandForecast
from app.models.clin import AcquisitionCLIN

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('', methods=['GET'])
@jwt_required()
def main_dashboard():
    """Main dashboard metrics."""
    # Request counts by status
    total = AcquisitionRequest.query.count()
    by_status = {}
    for status in ['draft', 'submitted', 'iss_review', 'asr_review', 'finance_review',
                    'ko_review', 'legal_review', 'cio_approval', 'senior_review',
                    'approved', 'awarded', 'closed', 'cancelled', 'returned']:
        count = AcquisitionRequest.query.filter_by(status=status).count()
        if count > 0:
            by_status[status] = count

    # Requests by type
    by_type = {}
    types = db.session.query(
        AcquisitionRequest.derived_acquisition_type,
        db.func.count(AcquisitionRequest.id)
    ).filter(
        AcquisitionRequest.derived_acquisition_type.isnot(None)
    ).group_by(AcquisitionRequest.derived_acquisition_type).all()
    for acq_type, count in types:
        by_type[acq_type] = count

    # Requests by tier
    by_tier = {}
    tiers = db.session.query(
        AcquisitionRequest.derived_tier,
        db.func.count(AcquisitionRequest.id)
    ).filter(
        AcquisitionRequest.derived_tier.isnot(None)
    ).group_by(AcquisitionRequest.derived_tier).all()
    for tier, count in tiers:
        by_tier[tier] = count

    # Total value
    total_value = db.session.query(
        db.func.coalesce(db.func.sum(AcquisitionRequest.estimated_value), 0)
    ).scalar()

    # Active approvals
    active_approvals = ApprovalStep.query.filter_by(status='active').count()
    overdue_approvals = sum(
        1 for s in ApprovalStep.query.filter_by(status='active').all()
        if s.is_overdue
    )

    # Pending advisories
    pending_advisories = AdvisoryInput.query.filter(
        AdvisoryInput.status.in_(['requested', 'in_review'])
    ).count()

    # Execution requests
    active_executions = CLINExecutionRequest.query.filter(
        CLINExecutionRequest.status.notin_(['complete', 'cancelled', 'rejected', 'draft'])
    ).count()

    # Forecasts
    open_forecasts = DemandForecast.query.filter(
        DemandForecast.status.in_(['forecasted', 'acknowledged', 'funded'])
    ).count()

    return jsonify({
        'requests': {
            'total': total,
            'by_status': by_status,
            'by_type': by_type,
            'by_tier': by_tier,
            'total_value': float(total_value),
        },
        'approvals': {
            'active': active_approvals,
            'overdue': overdue_approvals,
        },
        'advisories': {
            'pending': pending_advisories,
        },
        'executions': {
            'active': active_executions,
        },
        'forecasts': {
            'open': open_forecasts,
        },
    })


@dashboard_bp.route('/pipeline', methods=['GET'])
@jwt_required()
def pipeline_dashboard():
    """Gate flow pipeline data."""
    # Requests grouped by pipeline status
    pipeline_data = []

    # Define pipeline gates
    gates = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('iss_review', 'ISS Review'),
        ('asr_review', 'ASR Review'),
        ('finance_review', 'Finance'),
        ('ko_review', 'KO Review'),
        ('legal_review', 'Legal'),
        ('cio_approval', 'CIO'),
        ('senior_review', 'Senior'),
        ('approved', 'Approved'),
        ('awarded', 'Awarded'),
    ]

    for status_key, label in gates:
        requests_at_gate = AcquisitionRequest.query.filter_by(status=status_key).all()
        gate_data = {
            'gate': status_key,
            'label': label,
            'count': len(requests_at_gate),
            'total_value': sum(r.estimated_value or 0 for r in requests_at_gate),
            'requests': [{
                'id': r.id,
                'request_number': r.request_number,
                'title': r.title,
                'estimated_value': r.estimated_value,
                'derived_tier': r.derived_tier,
                'derived_pipeline': r.derived_pipeline,
            } for r in requests_at_gate],
        }
        pipeline_data.append(gate_data)

    return jsonify({
        'pipeline': pipeline_data,
    })


@dashboard_bp.route('/cycle-time', methods=['GET'])
@jwt_required()
def cycle_time():
    """Cycle time analytics by pipeline type."""
    from sqlalchemy import func
    pipelines = db.session.query(
        AcquisitionRequest.derived_pipeline,
        func.count(AcquisitionRequest.id),
    ).filter(
        AcquisitionRequest.derived_pipeline.isnot(None)
    ).group_by(AcquisitionRequest.derived_pipeline).all()

    result = []
    for pipeline_type, count in pipelines:
        # Calculate average days in pipeline (created_at to updated_at)
        reqs = AcquisitionRequest.query.filter_by(derived_pipeline=pipeline_type).all()
        total_days = 0
        measured = 0
        for r in reqs:
            if r.created_at and r.updated_at and r.status not in ('draft',):
                delta = (r.updated_at - r.created_at).days
                total_days += delta
                measured += 1
        avg_days = round(total_days / measured) if measured > 0 else 0
        result.append({
            'pipeline': pipeline_type,
            'avg_days': avg_days,
            'total_requests': count,
        })

    return jsonify({
        'pipelines': result,
    })


@dashboard_bp.route('/funding', methods=['GET'])
@jwt_required()
def funding_dashboard():
    """LOA overview and funding status."""
    loas = LineOfAccounting.query.all()

    loa_data = []
    total_allocation = 0
    total_committed = 0
    total_obligated = 0
    total_available = 0

    for loa in loas:
        total_allocation += loa.total_allocation or 0
        total_committed += loa.committed_amount or 0
        total_obligated += loa.obligated_amount or 0
        total_available += loa.available_balance

        loa_data.append({
            'id': loa.id,
            'display_name': loa.display_name,
            'fund_type': loa.fund_type,
            'total_allocation': loa.total_allocation,
            'projected': loa.projected_amount,
            'committed': loa.committed_amount,
            'obligated': loa.obligated_amount,
            'available': loa.available_balance,
            'utilization_pct': round(
                ((loa.committed_amount + loa.obligated_amount) / loa.total_allocation * 100)
                if loa.total_allocation else 0, 1
            ),
            'status': loa.status,
        })

    return jsonify({
        'loas': loa_data,
        'totals': {
            'allocation': total_allocation,
            'committed': total_committed,
            'obligated': total_obligated,
            'available': total_available,
            'utilization_pct': round(
                ((total_committed + total_obligated) / total_allocation * 100)
                if total_allocation else 0, 1
            ),
        },
    })


def _request_summary(r):
    """Compact request dict for drill-down tables."""
    return {
        'id': r.id,
        'request_number': r.request_number,
        'title': r.title,
        'estimated_value': r.estimated_value,
        'status': r.status,
        'acquisition_type': r.derived_acquisition_type,
        'tier': r.derived_tier,
        'requestor': r.requestor.name if r.requestor else None,
    }


@dashboard_bp.route('/drilldown/approvals', methods=['GET'])
@jwt_required()
def drilldown_approvals():
    """Requests with active (optionally overdue) approval steps."""
    overdue_only = request.args.get('overdue_only', 'false').lower() == 'true'
    steps = ApprovalStep.query.filter_by(status='active').all()
    if overdue_only:
        steps = [s for s in steps if s.is_overdue]

    seen = set()
    items = []
    for s in steps:
        if s.request_id in seen:
            continue
        seen.add(s.request_id)
        r = AcquisitionRequest.query.get(s.request_id)
        if r:
            item = _request_summary(r)
            item['gate_name'] = s.step_name
            item['approver_role'] = s.approver_role
            item['is_overdue'] = s.is_overdue
            items.append(item)
    return jsonify(items)


@dashboard_bp.route('/drilldown/advisories', methods=['GET'])
@jwt_required()
def drilldown_advisories():
    """Requests with pending advisory inputs."""
    advs = AdvisoryInput.query.filter(
        AdvisoryInput.status.in_(['requested', 'in_review'])
    ).all()

    seen = set()
    items = []
    for a in advs:
        if a.request_id in seen:
            continue
        seen.add(a.request_id)
        r = AcquisitionRequest.query.get(a.request_id)
        if r:
            item = _request_summary(r)
            item['team'] = a.team
            item['advisory_status'] = a.status
            items.append(item)
    return jsonify(items)


@dashboard_bp.route('/drilldown/executions', methods=['GET'])
@jwt_required()
def drilldown_executions():
    """Active CLIN execution requests."""
    execs = CLINExecutionRequest.query.filter(
        CLINExecutionRequest.status.notin_(['complete', 'cancelled', 'rejected', 'draft'])
    ).all()
    return jsonify([{
        'id': e.id,
        'request_number': e.request_number,
        'title': e.title,
        'execution_type': e.execution_type,
        'estimated_cost': e.estimated_cost,
        'status': e.status,
        'requested_by': e.requested_by.name if e.requested_by else None,
    } for e in execs])


@dashboard_bp.route('/drilldown/funding/<int:loa_id>', methods=['GET'])
@jwt_required()
def drilldown_funding(loa_id):
    """Requests whose CLINs are linked to a specific LOA."""
    clins = AcquisitionCLIN.query.filter_by(loa_id=loa_id).all()
    seen = set()
    items = []
    for c in clins:
        if c.request_id in seen:
            continue
        seen.add(c.request_id)
        r = AcquisitionRequest.query.get(c.request_id)
        if r:
            item = _request_summary(r)
            item['clin_number'] = c.clin_number
            items.append(item)
    return jsonify(items)
