from app.extensions import db


class LifecycleEvent(db.Model):
    __tablename__ = 'lifecycle_events'

    id = db.Column(db.Integer, primary_key=True)
    asset_tracker_id = db.Column(db.String(100))
    asset_name = db.Column(db.String(300))
    event_type = db.Column(db.String(50))  # warranty_expiry, license_renewal, contract_end, support_end, lease_end
    event_date = db.Column(db.String(20))
    lead_time_days = db.Column(db.Integer, default=180)
    action_needed = db.Column(db.String(50))  # replace, renew, recompete, decommission
    estimated_cost = db.Column(db.Float)
    status = db.Column(db.String(50), default='upcoming')  # upcoming, action_needed, acquisition_created, resolved
    acquisition_request_id = db.Column(db.Integer, db.ForeignKey('acquisition_requests.id'))
    fiscal_year_impact = db.Column(db.String(10))
    notes = db.Column(db.Text)
    session_id = db.Column(db.String(100), default='__sample_data__')

    acquisition_request = db.relationship('AcquisitionRequest', backref='lifecycle_events')

    def to_dict(self):
        return {
            'id': self.id,
            'asset_tracker_id': self.asset_tracker_id,
            'asset_name': self.asset_name,
            'event_type': self.event_type,
            'event_date': self.event_date,
            'lead_time_days': self.lead_time_days,
            'action_needed': self.action_needed,
            'estimated_cost': self.estimated_cost,
            'status': self.status,
            'acquisition_request_id': self.acquisition_request_id,
            'fiscal_year_impact': self.fiscal_year_impact,
            'notes': self.notes,
            'session_id': self.session_id,
        }
