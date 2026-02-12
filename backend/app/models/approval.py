import json
from app.extensions import db


class ApprovalTemplate(db.Model):
    __tablename__ = 'approval_templates'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    applies_to = db.Column(db.Text)  # JSON conditions
    is_default = db.Column(db.Boolean, default=False)
    session_id = db.Column(db.String(100), default='__sample_data__')

    steps = db.relationship('ApprovalTemplateStep', backref='template',
                            order_by='ApprovalTemplateStep.step_number')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'applies_to': json.loads(self.applies_to or '{}'),
            'is_default': self.is_default,
            'session_id': self.session_id,
            'steps': [s.to_dict() for s in self.steps],
        }


class ApprovalTemplateStep(db.Model):
    __tablename__ = 'approval_template_steps'

    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('approval_templates.id'), nullable=False)
    step_number = db.Column(db.Integer, nullable=False)
    step_name = db.Column(db.String(200), nullable=False)
    approver_role = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text)
    sla_days = db.Column(db.Integer, default=5)
    is_conditional = db.Column(db.Boolean, default=False)
    condition_rule = db.Column(db.Text)  # JSON
    session_id = db.Column(db.String(100), default='__sample_data__')

    def to_dict(self):
        return {
            'id': self.id,
            'template_id': self.template_id,
            'step_number': self.step_number,
            'step_name': self.step_name,
            'approver_role': self.approver_role,
            'description': self.description,
            'sla_days': self.sla_days,
            'is_conditional': self.is_conditional,
            'condition_rule': json.loads(self.condition_rule or '{}') if self.condition_rule else {},
            'session_id': self.session_id,
        }


class ApprovalStep(db.Model):
    __tablename__ = 'approval_steps'

    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('acquisition_requests.id'), nullable=False)
    step_number = db.Column(db.Integer, nullable=False)
    step_name = db.Column(db.String(200), nullable=False)
    approver_role = db.Column(db.String(50), nullable=False)
    approver_name = db.Column(db.String(200))
    status = db.Column(db.String(20), default='pending')  # pending, active, approved, rejected, returned, skipped
    acted_on_date = db.Column(db.DateTime)
    action_by = db.Column(db.String(200))
    comments = db.Column(db.Text)
    conditions = db.Column(db.Text)
    activated_at = db.Column(db.DateTime)
    due_date = db.Column(db.DateTime)
    session_id = db.Column(db.String(100), default='__sample_data__')

    request = db.relationship('AcquisitionRequest', backref='approval_steps')

    def to_dict(self):
        return {
            'id': self.id,
            'request_id': self.request_id,
            'step_number': self.step_number,
            'step_name': self.step_name,
            'approver_role': self.approver_role,
            'approver_name': self.approver_name,
            'status': self.status,
            'acted_on_date': self.acted_on_date.isoformat() if self.acted_on_date else None,
            'action_by': self.action_by,
            'comments': self.comments,
            'conditions': self.conditions,
            'activated_at': self.activated_at.isoformat() if self.activated_at else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'session_id': self.session_id,
        }
