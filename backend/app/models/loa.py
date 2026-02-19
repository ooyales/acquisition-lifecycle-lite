from datetime import datetime
from app.extensions import db


class LineOfAccounting(db.Model):
    __tablename__ = 'lines_of_accounting'

    id = db.Column(db.Integer, primary_key=True)
    display_name = db.Column(db.String(200), nullable=False)
    appropriation = db.Column(db.String(50))
    fund_code = db.Column(db.String(20))
    budget_activity_code = db.Column(db.String(20))
    cost_center = db.Column(db.String(50))
    object_class = db.Column(db.String(20))
    program_element = db.Column(db.String(50))
    project = db.Column(db.String(100))
    task = db.Column(db.String(100))
    fiscal_year = db.Column(db.String(4))
    total_allocation = db.Column(db.Float, default=0)
    projected_amount = db.Column(db.Float, default=0)
    committed_amount = db.Column(db.Float, default=0)
    obligated_amount = db.Column(db.Float, default=0)
    fund_type = db.Column(db.String(30))  # om, rdte, procurement, milcon, working_capital
    restrictions = db.Column(db.Text)
    expiration_date = db.Column(db.String(10))
    status = db.Column(db.String(20), default='active')  # active, low_balance, exhausted, expired, pending
    managed_by_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    last_verified_date = db.Column(db.DateTime)
    notes = db.Column(db.Text)

    managed_by = db.relationship('User', foreign_keys=[managed_by_id])
    clins = db.relationship('AcquisitionCLIN', backref='loa', lazy='dynamic')

    @property
    def available_balance(self):
        return self.total_allocation - self.projected_amount - self.committed_amount - self.obligated_amount

    @property
    def uncommitted_balance(self):
        return self.total_allocation - self.committed_amount - self.obligated_amount

    def to_dict(self):
        return {
            'id': self.id,
            'fund_code': self.fund_code,
            'appropriation': self.appropriation,
            'fiscal_year': self.fiscal_year,
            'description': self.display_name,
            'display_name': self.display_name,
            'total_amount': self.total_allocation,
            'total_allocation': self.total_allocation,
            'projected_amount': self.projected_amount,
            'committed_amount': self.committed_amount,
            'obligated_amount': self.obligated_amount,
            'available_balance': self.available_balance,
            'uncommitted_balance': self.uncommitted_balance,
            'fund_type': self.fund_type,
            'project': self.project,
            'task': self.task,
            'budget_activity_code': self.budget_activity_code,
            'cost_center': self.cost_center,
            'object_class': self.object_class,
            'program_element': self.program_element,
            'expiration_date': self.expiration_date,
            'notes': self.notes,
            'status': self.status,
        }
