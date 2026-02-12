from datetime import datetime, timezone
from app.extensions import db


class WizardSession(db.Model):
    """Tracks wizard sessions."""
    __tablename__ = 'wizard_sessions'

    id = db.Column(db.String(100), primary_key=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))
    status = db.Column(db.String(20), default='active')


class WizardImport(db.Model):
    """Staging table for wizard data imports.

    Each row stores a single imported record as JSON, isolated by session_id.
    Data stays here until the user finalizes, at which point it can be
    promoted to the real entity tables.
    """
    __tablename__ = 'wizard_imports'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(100), nullable=False, index=True)
    entity_type = db.Column(db.String(50), nullable=False)
    row_data = db.Column(db.Text, nullable=False)  # JSON
    row_index = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
