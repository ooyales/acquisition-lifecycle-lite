from app.extensions import db


class ActivityLog(db.Model):
    __tablename__ = 'acquisition_activity_log'

    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('acquisition_requests.id'), nullable=False)
    activity_type = db.Column(db.String(50))  # created, submitted, approved, rejected, returned, status_change, document_added, comment
    description = db.Column(db.Text)
    actor = db.Column(db.String(200))
    old_value = db.Column(db.Text)
    new_value = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=db.func.now())
    session_id = db.Column(db.String(100), default='__sample_data__')

    request = db.relationship('AcquisitionRequest', backref='activity_log')

    def to_dict(self):
        return {
            'id': self.id,
            'request_id': self.request_id,
            'activity_type': self.activity_type,
            'description': self.description,
            'actor': self.actor,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'session_id': self.session_id,
        }


class Comment(db.Model):
    __tablename__ = 'acquisition_comments'

    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('acquisition_requests.id'), nullable=False)
    author = db.Column(db.String(200))
    content = db.Column(db.Text)
    is_internal = db.Column(db.Boolean, default=False)
    approval_step_id = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=db.func.now())
    session_id = db.Column(db.String(100), default='__sample_data__')

    request = db.relationship('AcquisitionRequest', backref='comments')

    def to_dict(self):
        return {
            'id': self.id,
            'request_id': self.request_id,
            'author': self.author,
            'content': self.content,
            'is_internal': self.is_internal,
            'approval_step_id': self.approval_step_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'session_id': self.session_id,
        }
