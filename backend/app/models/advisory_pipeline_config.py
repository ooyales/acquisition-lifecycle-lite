from app.extensions import db


class AdvisoryPipelineConfig(db.Model):
    """Controls which advisory teams fire for each pipeline type.

    Each row represents one cell in the pipeline x team matrix.
    Admins toggle is_enabled to control whether that team fires for that pipeline.
    """
    __tablename__ = 'advisory_pipeline_configs'

    id = db.Column(db.Integer, primary_key=True)
    pipeline_type = db.Column(db.String(30), nullable=False)
    team = db.Column(db.String(30), nullable=False)
    is_enabled = db.Column(db.Boolean, default=True, nullable=False)
    sla_days = db.Column(db.Integer, default=5)
    blocks_gate = db.Column(db.String(30))
    threshold_min = db.Column(db.Float, default=0)

    __table_args__ = (
        db.UniqueConstraint('pipeline_type', 'team', name='uix_pipeline_team'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'pipeline_type': self.pipeline_type,
            'team': self.team,
            'is_enabled': self.is_enabled,
            'sla_days': self.sla_days,
            'blocks_gate': self.blocks_gate or '',
            'threshold_min': self.threshold_min or 0,
        }
