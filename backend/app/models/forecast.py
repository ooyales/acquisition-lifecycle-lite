from datetime import datetime
from app.extensions import db


class DemandForecast(db.Model):
    __tablename__ = 'demand_forecasts'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(300), nullable=False)
    source = db.Column(db.String(30))
    # contract_expiration, option_year_due, planned_refresh, technology_sunset, manual
    source_contract_id = db.Column(db.Integer, db.ForeignKey('acquisition_requests.id'))
    estimated_value = db.Column(db.Float)
    estimated_value_basis = db.Column(db.Text)
    need_by_date = db.Column(db.String(10))
    acquisition_lead_time = db.Column(db.Integer)  # months
    submit_by_date = db.Column(db.String(10))
    fiscal_year = db.Column(db.String(4))
    suggested_loa_id = db.Column(db.Integer, db.ForeignKey('lines_of_accounting.id'))
    buy_category = db.Column(db.String(30))
    likely_acquisition_type = db.Column(db.String(30))
    status = db.Column(db.String(30), default='forecasted')
    # forecasted, acknowledged, funded, acquisition_created, cancelled, deferred
    acquisition_request_id = db.Column(db.Integer, db.ForeignKey('acquisition_requests.id'))
    assigned_to_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_date = db.Column(db.DateTime, default=datetime.utcnow)
    contract_number = db.Column(db.String(50))
    clin_number = db.Column(db.String(50))
    color_of_money = db.Column(db.String(30))  # om, rdte, procurement, milcon, working_capital
    notes = db.Column(db.Text)

    source_contract = db.relationship('AcquisitionRequest', foreign_keys=[source_contract_id])
    acquisition_request = db.relationship('AcquisitionRequest', foreign_keys=[acquisition_request_id])
    suggested_loa = db.relationship('LineOfAccounting', foreign_keys=[suggested_loa_id])
    assigned_to = db.relationship('User', foreign_keys=[assigned_to_id])

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'source': self.source,
            'source_contract_id': self.source_contract_id,
            'estimated_value': self.estimated_value,
            'estimated_value_basis': self.estimated_value_basis,
            'need_by_date': self.need_by_date,
            'acquisition_lead_time': self.acquisition_lead_time,
            'submit_by_date': self.submit_by_date,
            'fiscal_year': self.fiscal_year,
            'suggested_loa_id': self.suggested_loa_id,
            'suggested_loa_name': self.suggested_loa.display_name if self.suggested_loa else None,
            'buy_category': self.buy_category,
            'likely_acquisition_type': self.likely_acquisition_type,
            'status': self.status,
            'acquisition_request_id': self.acquisition_request_id,
            'assigned_to_id': self.assigned_to_id,
            'assigned_to_name': self.assigned_to.name if self.assigned_to else None,
            'contract_number': self.contract_number,
            'clin_number': self.clin_number,
            'color_of_money': self.color_of_money,
            'created_date': self.created_date.isoformat() if self.created_date else None,
            'notes': self.notes,
        }
