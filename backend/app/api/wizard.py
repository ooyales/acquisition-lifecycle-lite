import csv
import io
import json
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.extensions import db
from app.models.wizard_import import WizardSession, WizardImport
from app.models.request import AcquisitionRequest
from app.models.funding import FundingSource
from app.models.lifecycle import LifecycleEvent
from app.models.prior import PriorAcquisition
from app.errors import BadRequestError, NotFoundError

wizard_bp = Blueprint('wizard', __name__, url_prefix='/api/wizard')

# Entity type definitions with their importable columns
ENTITY_TYPES = {
    'requests': {
        'label': 'Acquisition Requests',
        'columns': ['title', 'category', 'estimated_total', 'priority', 'justification', 'vendor_name'],
        'model': AcquisitionRequest,
    },
    'funding_sources': {
        'label': 'Funding Sources',
        'columns': ['name', 'fiscal_year', 'total_budget', 'committed', 'spent', 'funding_type', 'owner'],
        'model': FundingSource,
    },
    'lifecycle_events': {
        'label': 'Lifecycle Events',
        'columns': ['asset_name', 'event_type', 'event_date', 'lead_time_days', 'action_needed', 'estimated_cost', 'status'],
        'model': LifecycleEvent,
    },
    'prior_acquisitions': {
        'label': 'Prior Acquisitions',
        'columns': ['description', 'vendor', 'product_category', 'unit_cost', 'total_cost', 'quantity', 'award_date', 'contract_number'],
        'model': PriorAcquisition,
    },
}

# Sample data for each entity type
SAMPLE_DATA = {
    'requests': [
        ['title', 'category', 'estimated_total', 'priority', 'justification', 'vendor_name'],
        ['Replace 10 Aging Workstations', 'hardware_purchase', '12500', 'high', 'Devices past 4-year lifecycle policy', 'Dell Technologies'],
        ['ServiceNow ITSM License', 'software_license', '85000', 'medium', 'Upgrade help desk platform', 'ServiceNow'],
        ['Cloud Migration Assessment', 'service_contract', '45000', 'low', 'Assess on-prem workloads for cloud migration', 'Deloitte'],
    ],
    'funding_sources': [
        ['name', 'fiscal_year', 'total_budget', 'committed', 'spent', 'funding_type', 'owner'],
        ['IT Infrastructure FY26', 'FY26', '500000', '125000', '50000', 'appropriation', 'Budget Office'],
        ['Cybersecurity Enhancement', 'FY26', '300000', '0', '0', 'appropriation', 'CISO'],
        ['Program Office Reimbursable', 'FY26', '200000', '75000', '25000', 'reimbursable', 'Program Office'],
    ],
    'lifecycle_events': [
        ['asset_name', 'event_type', 'event_date', 'lead_time_days', 'action_needed', 'estimated_cost', 'status'],
        ['Cisco ASA 5545-X Firewall', 'support_end', '2026-09-30', '180', 'replace', '15000', 'upcoming'],
        ['VMware vSphere (50 licenses)', 'license_renewal', '2026-07-15', '90', 'renew', '62000', 'upcoming'],
        ['Dell PowerEdge R750 Server', 'warranty_expiry', '2026-11-01', '120', 'replace', '12000', 'upcoming'],
    ],
    'prior_acquisitions': [
        ['description', 'vendor', 'product_category', 'unit_cost', 'total_cost', 'quantity', 'award_date', 'contract_number'],
        ['Dell Latitude 7440 Laptops', 'Dell Technologies', 'hardware', '1350', '13500', '10', '2025-09-15', 'GS-35F-0511T'],
        ['Splunk Enterprise License', 'Splunk Inc.', 'software', '25000', '25000', '1', '2025-06-01', 'SPL-FY25-001'],
        ['Network Cabling Services', 'ComTech Solutions', 'service', '', '18000', '1', '2025-03-20', 'CT-2025-0044'],
    ],
}

# Float columns per entity type
FLOAT_COLUMNS = {
    'requests': ['estimated_total'],
    'funding_sources': ['total_budget', 'committed', 'spent'],
    'lifecycle_events': ['estimated_cost'],
    'prior_acquisitions': ['unit_cost', 'total_cost'],
}

# Integer columns per entity type
INT_COLUMNS = {
    'requests': [],
    'funding_sources': [],
    'lifecycle_events': ['lead_time_days'],
    'prior_acquisitions': ['quantity'],
}


@wizard_bp.route('/session', methods=['POST'])
@jwt_required()
def create_session():
    """Create a new import session."""
    session_id = str(uuid.uuid4())
    session = WizardSession(
        id=session_id,
        status='active',
    )
    db.session.add(session)
    db.session.commit()
    return jsonify({
        'session_id': session_id,
        'status': 'active',
        'created_at': session.created_at.isoformat() if session.created_at else None,
    }), 201


@wizard_bp.route('/entity-types', methods=['GET'])
@jwt_required()
def get_entity_types():
    """Return importable entity types with their columns."""
    types = []
    for key, info in ENTITY_TYPES.items():
        types.append({
            'key': key,
            'label': info['label'],
            'columns': info['columns'],
        })
    return jsonify({'entity_types': types})


@wizard_bp.route('/sample/<entity_type>', methods=['GET'])
@jwt_required()
def get_sample_data(entity_type):
    """Return sample CSV data for a given entity type."""
    if entity_type not in SAMPLE_DATA:
        raise NotFoundError(f'Unknown entity type: {entity_type}')

    rows = SAMPLE_DATA[entity_type]
    output = io.StringIO()
    writer = csv.writer(output, delimiter='\t')
    for row in rows:
        writer.writerow(row)

    return jsonify({
        'entity_type': entity_type,
        'sample_tsv': output.getvalue(),
        'columns': ENTITY_TYPES[entity_type]['columns'],
    })


@wizard_bp.route('/import/<entity_type>', methods=['POST'])
@jwt_required()
def import_data(entity_type):
    """Import tab-separated or CSV data. Parse rows and create records."""
    if entity_type not in ENTITY_TYPES:
        raise BadRequestError(f'Unknown entity type: {entity_type}')

    data = request.get_json()
    if not data:
        raise BadRequestError('Request body is required')

    raw_data = data.get('data', '').strip()
    session_id = data.get('session_id', '__import__')

    if not raw_data:
        raise BadRequestError('No data provided')

    # Auto-detect delimiter: if tabs present use TSV, otherwise CSV
    if '\t' in raw_data:
        delimiter = '\t'
    else:
        delimiter = ','

    reader = csv.DictReader(io.StringIO(raw_data), delimiter=delimiter)

    expected_columns = ENTITY_TYPES[entity_type]['columns']
    float_cols = FLOAT_COLUMNS.get(entity_type, [])
    int_cols = INT_COLUMNS.get(entity_type, [])

    imported = 0
    errors = []
    total = 0

    for row_idx, row in enumerate(reader, start=1):
        total += 1
        try:
            record = {}
            for col in expected_columns:
                value = row.get(col, '').strip() if row.get(col) else ''
                if col in float_cols and value:
                    try:
                        value = float(value)
                    except ValueError:
                        errors.append(f'Row {row_idx}: Invalid number for {col}: {row.get(col)}')
                        continue
                elif col in int_cols and value:
                    try:
                        value = int(value)
                    except ValueError:
                        errors.append(f'Row {row_idx}: Invalid integer for {col}: {row.get(col)}')
                        continue
                record[col] = value if value != '' else None

            # Create the actual entity record
            if entity_type == 'requests':
                obj = _create_request(record, session_id)
            elif entity_type == 'funding_sources':
                obj = _create_funding_source(record, session_id)
            elif entity_type == 'lifecycle_events':
                obj = _create_lifecycle_event(record, session_id)
            elif entity_type == 'prior_acquisitions':
                obj = _create_prior_acquisition(record, session_id)
            else:
                continue

            db.session.add(obj)

            # Also store in wizard_imports for tracking
            wi = WizardImport(
                session_id=session_id,
                entity_type=entity_type,
                row_data=json.dumps(record, default=str),
                row_index=row_idx,
            )
            db.session.add(wi)
            imported += 1

        except Exception as e:
            errors.append(f'Row {row_idx}: {str(e)}')

    db.session.commit()

    return jsonify({
        'imported': imported,
        'errors': errors,
        'total': total,
        'entity_type': entity_type,
        'session_id': session_id,
    })


@wizard_bp.route('/status', methods=['GET'])
@jwt_required()
def get_status():
    """Return overall import status with entity counts."""
    counts = {}
    for key, info in ENTITY_TYPES.items():
        model = info['model']
        counts[key] = model.query.count()

    return jsonify({
        'entity_counts': counts,
        'entity_types': list(ENTITY_TYPES.keys()),
    })


# -- Helper functions to create entity records --

def _create_request(record, session_id):
    """Create an AcquisitionRequest from import data."""
    count = AcquisitionRequest.query.count() + 1
    request_number = f"ACQ-FY26-{count:04d}"
    while AcquisitionRequest.query.filter_by(request_number=request_number).first():
        count += 1
        request_number = f"ACQ-FY26-{count:04d}"

    return AcquisitionRequest(
        request_number=request_number,
        title=record.get('title', 'Imported Request'),
        category=record.get('category', 'other'),
        estimated_total=record.get('estimated_total'),
        priority=record.get('priority', 'medium'),
        justification=record.get('justification', ''),
        vendor_name=record.get('vendor_name'),
        status='draft',
        trigger_type='manual',
        fiscal_year='FY26',
        cost_breakdown='{}',
        tags='[]',
        session_id=session_id,
    )


def _create_funding_source(record, session_id):
    """Create a FundingSource from import data."""
    return FundingSource(
        name=record.get('name', 'Imported Source'),
        fiscal_year=record.get('fiscal_year', 'FY26'),
        total_budget=record.get('total_budget', 0),
        committed=record.get('committed', 0),
        spent=record.get('spent', 0),
        funding_type=record.get('funding_type', 'appropriation'),
        owner=record.get('owner', ''),
        session_id=session_id,
    )


def _create_lifecycle_event(record, session_id):
    """Create a LifecycleEvent from import data."""
    return LifecycleEvent(
        asset_name=record.get('asset_name', 'Imported Asset'),
        event_type=record.get('event_type', 'warranty_expiry'),
        event_date=record.get('event_date'),
        lead_time_days=record.get('lead_time_days', 180),
        action_needed=record.get('action_needed'),
        estimated_cost=record.get('estimated_cost'),
        status=record.get('status', 'upcoming'),
        session_id=session_id,
    )


def _create_prior_acquisition(record, session_id):
    """Create a PriorAcquisition from import data."""
    return PriorAcquisition(
        description=record.get('description', 'Imported Acquisition'),
        vendor=record.get('vendor'),
        product_category=record.get('product_category'),
        unit_cost=record.get('unit_cost'),
        total_cost=record.get('total_cost'),
        quantity=record.get('quantity'),
        award_date=record.get('award_date'),
        contract_number=record.get('contract_number'),
        session_id=session_id,
    )
