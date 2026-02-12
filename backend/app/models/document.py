from app.extensions import db


class PackageDocument(db.Model):
    __tablename__ = 'package_documents'

    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('acquisition_requests.id'), nullable=False)
    document_type = db.Column(db.String(50), nullable=False)  # strategy, igce, market_research, scrm_assessment, sow, justification
    title = db.Column(db.String(500))
    status = db.Column(db.String(20), default='not_started')  # not_started, drafting, review, complete
    content = db.Column(db.Text)
    ai_generated = db.Column(db.Boolean, default=False)
    ai_prompt_used = db.Column(db.Text)
    assigned_to = db.Column(db.String(200))
    due_date = db.Column(db.String(20))
    completed_date = db.Column(db.String(20))
    reviewed_by = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())
    session_id = db.Column(db.String(100), default='__sample_data__')

    request = db.relationship('AcquisitionRequest', backref='documents')

    def to_dict(self):
        return {
            'id': self.id,
            'request_id': self.request_id,
            'document_type': self.document_type,
            'title': self.title,
            'status': self.status,
            'content': self.content,
            'ai_generated': self.ai_generated,
            'ai_prompt_used': self.ai_prompt_used,
            'assigned_to': self.assigned_to,
            'due_date': self.due_date,
            'completed_date': self.completed_date,
            'reviewed_by': self.reviewed_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'session_id': self.session_id,
        }
