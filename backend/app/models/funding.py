from app.extensions import db


class FundingSource(db.Model):
    __tablename__ = 'funding_sources'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    fiscal_year = db.Column(db.String(10))
    total_budget = db.Column(db.Float)
    committed = db.Column(db.Float, default=0)
    spent = db.Column(db.Float, default=0)
    funding_type = db.Column(db.String(50))  # appropriation, reimbursable, working_capital
    owner = db.Column(db.String(200))
    notes = db.Column(db.Text)
    session_id = db.Column(db.String(100), default='__sample_data__')

    @property
    def available(self):
        return (self.total_budget or 0) - (self.committed or 0) - (self.spent or 0)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'fiscal_year': self.fiscal_year,
            'total_budget': self.total_budget,
            'committed': self.committed,
            'spent': self.spent,
            'available': self.available,
            'funding_type': self.funding_type,
            'owner': self.owner,
            'notes': self.notes,
            'session_id': self.session_id,
        }
