from app.extensions import db


class PriorAcquisition(db.Model):
    __tablename__ = 'prior_acquisitions'

    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.Text)
    vendor = db.Column(db.String(200))
    product_category = db.Column(db.String(50))  # hardware, software, service, maintenance
    unit_cost = db.Column(db.Float)
    total_cost = db.Column(db.Float)
    quantity = db.Column(db.Integer)
    award_date = db.Column(db.String(20))
    contract_number = db.Column(db.String(100))
    contract_vehicle = db.Column(db.String(100))
    notes = db.Column(db.Text)
    session_id = db.Column(db.String(100), default='__sample_data__')

    def to_dict(self):
        return {
            'id': self.id,
            'description': self.description,
            'vendor': self.vendor,
            'product_category': self.product_category,
            'unit_cost': self.unit_cost,
            'total_cost': self.total_cost,
            'quantity': self.quantity,
            'award_date': self.award_date,
            'contract_number': self.contract_number,
            'contract_vehicle': self.contract_vehicle,
            'notes': self.notes,
            'session_id': self.session_id,
        }
