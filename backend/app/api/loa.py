from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.extensions import db
from app.models.loa import LineOfAccounting
from app.services.funding import update_loa_committed

loa_bp = Blueprint('loa', __name__)


@loa_bp.route('', methods=['GET'])
@jwt_required()
def list_loas():
    """List all lines of accounting."""
    query = LineOfAccounting.query

    status = request.args.get('status')
    if status:
        query = query.filter(LineOfAccounting.status == status)

    fund_type = request.args.get('fund_type')
    if fund_type:
        query = query.filter(LineOfAccounting.fund_type == fund_type)

    fiscal_year = request.args.get('fiscal_year')
    if fiscal_year:
        query = query.filter(LineOfAccounting.fiscal_year == fiscal_year)

    loas = query.order_by(LineOfAccounting.display_name).all()
    return jsonify({
        'loas': [l.to_dict() for l in loas],
        'count': len(loas),
    })


@loa_bp.route('/<int:loa_id>', methods=['GET'])
@jwt_required()
def get_loa(loa_id):
    """Get LOA detail."""
    loa = LineOfAccounting.query.get_or_404(loa_id)
    data = loa.to_dict()

    # Include assigned CLINs
    clins = [c.to_dict() for c in loa.clins]
    data['clins'] = clins
    data['clin_count'] = len(clins)

    return jsonify(data)


@loa_bp.route('', methods=['POST'])
@jwt_required()
def create_loa():
    """Create a new LOA."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    loa = LineOfAccounting(
        display_name=data.get('display_name', ''),
        appropriation=data.get('appropriation'),
        fund_code=data.get('fund_code'),
        budget_activity_code=data.get('budget_activity_code'),
        cost_center=data.get('cost_center'),
        object_class=data.get('object_class'),
        program_element=data.get('program_element'),
        fiscal_year=data.get('fiscal_year', '2026'),
        total_allocation=data.get('total_allocation', 0),
        projected_amount=data.get('projected_amount', 0),
        committed_amount=data.get('committed_amount', 0),
        obligated_amount=data.get('obligated_amount', 0),
        fund_type=data.get('fund_type'),
        restrictions=data.get('restrictions'),
        expiration_date=data.get('expiration_date'),
        status=data.get('status', 'active'),
        notes=data.get('notes'),
    )
    db.session.add(loa)
    db.session.commit()

    return jsonify(loa.to_dict()), 201


@loa_bp.route('/<int:loa_id>', methods=['PUT'])
@jwt_required()
def update_loa(loa_id):
    """Update an LOA."""
    loa = LineOfAccounting.query.get_or_404(loa_id)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    updatable = [
        'display_name', 'appropriation', 'fund_code', 'budget_activity_code',
        'cost_center', 'object_class', 'program_element', 'project', 'task',
        'fiscal_year', 'total_allocation', 'projected_amount', 'committed_amount',
        'obligated_amount', 'fund_type', 'restrictions', 'expiration_date', 'status', 'notes',
    ]

    for field in updatable:
        if field in data:
            setattr(loa, field, data[field])

    # Recalculate committed from CLINs if requested
    if data.get('recalculate_committed'):
        update_loa_committed(loa_id)

    db.session.commit()
    return jsonify(loa.to_dict())


@loa_bp.route('/<int:loa_id>', methods=['DELETE'])
@jwt_required()
def delete_loa(loa_id):
    """Delete an LOA. Blocked if CLINs are assigned."""
    loa = LineOfAccounting.query.get_or_404(loa_id)

    clin_count = loa.clins.count()
    if clin_count > 0:
        return jsonify({
            'error': f'Cannot delete LOA with {clin_count} assigned CLIN(s). Remove CLIN assignments first.',
        }), 400

    db.session.delete(loa)
    db.session.commit()
    return jsonify({'success': True, 'message': 'LOA deleted'})
