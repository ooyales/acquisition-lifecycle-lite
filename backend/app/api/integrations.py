import os
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from app.errors import NotFoundError

integrations_bp = Blueprint('integrations', __name__, url_prefix='/api/integrations')

ASSET_TRACKER_URL = os.getenv('ASSET_TRACKER_URL')


def mock_asset(asset_id):
    """Return realistic mock asset data."""
    return {
        'id': asset_id,
        'name': 'Dell Latitude 5540',
        'type': 'Laptop',
        'status': 'active',
        'assigned_to': 'IT Operations',
        'warranty_end': '2026-06-15',
        'purchase_date': '2022-06-15',
        'cost': 1250.00,
    }


def mock_expiring_assets():
    """Return a realistic list of expiring assets."""
    return [
        {
            'id': 'ASSET-1001',
            'name': 'Dell Latitude 5540 - Unit 12',
            'type': 'Laptop',
            'status': 'active',
            'assigned_to': 'IT Operations',
            'warranty_end': '2026-03-15',
            'purchase_date': '2022-03-15',
            'cost': 1150.00,
            'days_until_expiry': 31,
        },
        {
            'id': 'ASSET-1002',
            'name': 'Dell Latitude 5540 - Unit 18',
            'type': 'Laptop',
            'status': 'active',
            'assigned_to': 'Engineering',
            'warranty_end': '2026-04-01',
            'purchase_date': '2022-04-01',
            'cost': 1150.00,
            'days_until_expiry': 48,
        },
        {
            'id': 'ASSET-1003',
            'name': 'Cisco ASA 5525-X',
            'type': 'Firewall',
            'status': 'active',
            'assigned_to': 'Network Team',
            'warranty_end': '2026-05-30',
            'purchase_date': '2022-05-30',
            'cost': 6500.00,
            'days_until_expiry': 107,
        },
        {
            'id': 'ASSET-1004',
            'name': 'HP LaserJet MFP M477 - 3rd Floor',
            'type': 'Printer',
            'status': 'active',
            'assigned_to': 'Facilities',
            'warranty_end': '2026-06-15',
            'purchase_date': '2023-06-15',
            'cost': 850.00,
            'days_until_expiry': 123,
        },
        {
            'id': 'ASSET-1005',
            'name': 'Synology DS1821+ NAS',
            'type': 'Storage',
            'status': 'failed',
            'assigned_to': 'Engineering',
            'warranty_end': '2027-02-01',
            'purchase_date': '2024-02-01',
            'cost': 5500.00,
            'days_until_expiry': 354,
        },
    ]


def mock_incident(incident_id):
    """Return realistic mock incident data."""
    return {
        'id': incident_id,
        'title': 'NAS Storage Unit Failure - Engineering File Share',
        'status': 'open',
        'priority': 'critical',
        'category': 'hardware_failure',
        'assigned_to': 'IT Infrastructure',
        'reported_by': 'Jane Smith',
        'reported_date': '2026-02-01',
        'description': 'Synology DS1821+ NAS serving engineering team file share '
                       'experienced catastrophic drive controller failure. '
                       'All 8 bays unresponsive. Team of 25 users affected.',
        'impact': '25 users without shared storage',
        'workaround': 'Temporary access via backup server',
        'related_asset_id': 'ASSET-1005',
    }


@integrations_bp.route('/asset/<asset_id>', methods=['GET'])
@jwt_required()
def get_asset(asset_id):
    """Return asset data. If ASSET_TRACKER_URL is set, proxy to real API."""
    if ASSET_TRACKER_URL:
        try:
            import requests as http_requests
            resp = http_requests.get(
                f'{ASSET_TRACKER_URL}/api/assets/{asset_id}',
                timeout=5,
            )
            if resp.status_code == 200:
                return jsonify(resp.json())
            elif resp.status_code == 404:
                raise NotFoundError(f'Asset {asset_id} not found in Asset Tracker')
            else:
                # Fall back to mock on non-200 responses
                return jsonify(mock_asset(asset_id))
        except Exception:
            # Fall back to mock on connection failure
            return jsonify(mock_asset(asset_id))

    return jsonify(mock_asset(asset_id))


@integrations_bp.route('/assets/expiring', methods=['GET'])
@jwt_required()
def get_expiring_assets():
    """Return list of expiring assets. Uses mock data unless ASSET_TRACKER_URL is set."""
    if ASSET_TRACKER_URL:
        try:
            import requests as http_requests
            resp = http_requests.get(
                f'{ASSET_TRACKER_URL}/api/assets/expiring',
                timeout=5,
            )
            if resp.status_code == 200:
                return jsonify(resp.json())
        except Exception:
            pass  # Fall through to mock

    assets = mock_expiring_assets()
    return jsonify({'assets': assets, 'count': len(assets)})


@integrations_bp.route('/incident/<incident_id>', methods=['GET'])
@jwt_required()
def get_incident(incident_id):
    """Return mock incident data."""
    return jsonify(mock_incident(incident_id))
