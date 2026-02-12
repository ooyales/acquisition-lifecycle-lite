import json
from app.extensions import db


class AcquisitionRequest(db.Model):
    __tablename__ = 'acquisition_requests'

    id = db.Column(db.Integer, primary_key=True)
    request_number = db.Column(db.String(50), unique=True)  # ACQ-FY26-XXXX

    # What
    title = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(50), nullable=False)  # hardware_purchase, software_license, service_contract, cloud_service, maintenance_support, other
    sub_category = db.Column(db.String(50))  # new, replacement, renewal, recompete, upgrade, emergency, bridge, modification

    # Why
    justification = db.Column(db.Text)
    trigger_type = db.Column(db.String(50))  # manual, lifecycle, service_portal, emergency
    trigger_asset_id = db.Column(db.String(100))

    # Cost
    estimated_total = db.Column(db.Float)
    cost_breakdown = db.Column(db.Text, default='{}')  # JSON

    # Funding
    funding_source_id = db.Column(db.Integer, db.ForeignKey('funding_sources.id'))
    fiscal_year = db.Column(db.String(10))

    # Priority & timing
    priority = db.Column(db.String(20), default='medium')
    need_by_date = db.Column(db.String(20))
    contract_end_date = db.Column(db.String(20))

    # People
    requestor_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    requestor_name = db.Column(db.String(200))
    requestor_org = db.Column(db.String(200))
    cor_id = db.Column(db.Integer)

    # Status
    status = db.Column(db.String(50), default='draft')
    current_approval_step = db.Column(db.Integer, default=0)

    # Vendor/product
    vendor_name = db.Column(db.String(200))
    product_name = db.Column(db.String(200))
    product_specs = db.Column(db.Text)  # JSON
    quantity = db.Column(db.Integer)

    # Contract details (renewals/recompetes)
    existing_contract_number = db.Column(db.String(100))
    existing_contract_value = db.Column(db.Float)
    existing_vendor = db.Column(db.String(200))
    contract_vehicle = db.Column(db.String(100))  # GSA Schedule, BPA, GWAC, Open Market

    # Post-award
    awarded_date = db.Column(db.String(20))
    awarded_vendor = db.Column(db.String(200))
    awarded_amount = db.Column(db.Float)
    po_number = db.Column(db.String(100))
    delivery_date = db.Column(db.String(20))
    received_date = db.Column(db.String(20))

    # Metadata
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())
    tags = db.Column(db.Text, default='[]')
    notes = db.Column(db.Text)
    session_id = db.Column(db.String(100), default='__sample_data__')

    # Relationships
    funding_source = db.relationship('FundingSource', backref='requests')
    requestor = db.relationship('User', backref='requests', foreign_keys=[requestor_id])

    def to_dict(self):
        return {
            'id': self.id,
            'request_number': self.request_number,
            'title': self.title,
            'description': self.description,
            'category': self.category,
            'sub_category': self.sub_category,
            'justification': self.justification,
            'trigger_type': self.trigger_type,
            'trigger_asset_id': self.trigger_asset_id,
            'estimated_total': self.estimated_total,
            'cost_breakdown': json.loads(self.cost_breakdown or '{}'),
            'funding_source_id': self.funding_source_id,
            'fiscal_year': self.fiscal_year,
            'priority': self.priority,
            'need_by_date': self.need_by_date,
            'contract_end_date': self.contract_end_date,
            'requestor_id': self.requestor_id,
            'requestor_name': self.requestor_name,
            'requestor_org': self.requestor_org,
            'cor_id': self.cor_id,
            'status': self.status,
            'current_approval_step': self.current_approval_step,
            'vendor_name': self.vendor_name,
            'product_name': self.product_name,
            'product_specs': json.loads(self.product_specs or '{}') if self.product_specs else {},
            'quantity': self.quantity,
            'existing_contract_number': self.existing_contract_number,
            'existing_contract_value': self.existing_contract_value,
            'existing_vendor': self.existing_vendor,
            'contract_vehicle': self.contract_vehicle,
            'awarded_date': self.awarded_date,
            'awarded_vendor': self.awarded_vendor,
            'awarded_amount': self.awarded_amount,
            'po_number': self.po_number,
            'delivery_date': self.delivery_date,
            'received_date': self.received_date,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'tags': json.loads(self.tags or '[]'),
            'notes': self.notes,
            'session_id': self.session_id,
        }
