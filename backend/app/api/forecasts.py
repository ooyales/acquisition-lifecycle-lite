from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.forecast import DemandForecast
from app.models.request import AcquisitionRequest

forecasts_bp = Blueprint('forecasts', __name__)


@forecasts_bp.route('', methods=['GET'])
@jwt_required()
def list_forecasts():
    """List demand forecasts."""
    query = DemandForecast.query

    status = request.args.get('status')
    if status:
        query = query.filter(DemandForecast.status == status)

    fiscal_year = request.args.get('fiscal_year')
    if fiscal_year:
        query = query.filter(DemandForecast.fiscal_year == fiscal_year)

    source = request.args.get('source')
    if source:
        query = query.filter(DemandForecast.source == source)

    forecasts = query.order_by(DemandForecast.need_by_date).all()
    return jsonify({
        'forecasts': [f.to_dict() for f in forecasts],
        'count': len(forecasts),
    })


@forecasts_bp.route('', methods=['POST'])
@jwt_required()
def create_forecast():
    """Create a new demand forecast."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    forecast = DemandForecast(
        title=data.get('title', ''),
        source=data.get('source', 'manual'),
        source_contract_id=data.get('source_contract_id'),
        estimated_value=data.get('estimated_value'),
        estimated_value_basis=data.get('estimated_value_basis'),
        need_by_date=data.get('need_by_date'),
        acquisition_lead_time=data.get('acquisition_lead_time'),
        submit_by_date=data.get('submit_by_date'),
        fiscal_year=data.get('fiscal_year', '2026'),
        suggested_loa_id=data.get('suggested_loa_id'),
        buy_category=data.get('buy_category'),
        likely_acquisition_type=data.get('likely_acquisition_type'),
        status=data.get('status', 'forecasted'),
        assigned_to_id=data.get('assigned_to_id'),
        contract_number=data.get('contract_number'),
        clin_number=data.get('clin_number'),
        color_of_money=data.get('color_of_money'),
        notes=data.get('notes'),
    )
    db.session.add(forecast)
    db.session.commit()

    return jsonify(forecast.to_dict()), 201


@forecasts_bp.route('/<int:forecast_id>', methods=['PUT'])
@jwt_required()
def update_forecast(forecast_id):
    """Update a forecast."""
    forecast = DemandForecast.query.get_or_404(forecast_id)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    updatable = [
        'title', 'source', 'source_contract_id', 'estimated_value',
        'estimated_value_basis', 'need_by_date', 'acquisition_lead_time',
        'submit_by_date', 'fiscal_year', 'suggested_loa_id', 'buy_category',
        'likely_acquisition_type', 'status', 'assigned_to_id',
        'contract_number', 'clin_number', 'color_of_money', 'notes',
    ]

    for field in updatable:
        if field in data:
            setattr(forecast, field, data[field])

    db.session.commit()
    return jsonify(forecast.to_dict())


@forecasts_bp.route('/<int:forecast_id>/create-request', methods=['POST'])
@jwt_required()
def create_request_from_forecast(forecast_id):
    """Convert a forecast into an acquisition request."""
    user_id = get_jwt_identity()
    forecast = DemandForecast.query.get_or_404(forecast_id)

    if forecast.acquisition_request_id:
        return jsonify({'error': 'Forecast already has an associated acquisition request'}), 400

    # Generate request number
    year = datetime.utcnow().strftime('%Y')
    last = AcquisitionRequest.query.filter(
        AcquisitionRequest.request_number.like(f'ACQ-{year}-%')
    ).order_by(AcquisitionRequest.id.desc()).first()

    if last:
        try:
            seq = int(last.request_number.split('-')[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    else:
        seq = 1

    acq = AcquisitionRequest(
        request_number=f'ACQ-{year}-{seq:04d}',
        title=forecast.title,
        description=f'Created from demand forecast. {forecast.notes or ""}',
        estimated_value=forecast.estimated_value or 0,
        fiscal_year=forecast.fiscal_year,
        priority='medium',
        need_by_date=forecast.need_by_date,
        status='draft',
        requestor_id=int(user_id),
        intake_q_buy_category=forecast.buy_category,
    )
    db.session.add(acq)
    db.session.flush()

    forecast.acquisition_request_id = acq.id
    forecast.status = 'acquisition_created'

    db.session.commit()

    return jsonify({
        'success': True,
        'request': acq.to_dict(),
        'forecast': forecast.to_dict(),
    }), 201


@forecasts_bp.route('/<int:forecast_id>', methods=['DELETE'])
@jwt_required()
def delete_forecast(forecast_id):
    """Delete a forecast. Blocked if it has a linked acquisition request."""
    forecast = DemandForecast.query.get_or_404(forecast_id)

    if forecast.acquisition_request_id:
        return jsonify({
            'error': 'Cannot delete forecast that has an associated acquisition request.',
        }), 400

    db.session.delete(forecast)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Forecast deleted'})
