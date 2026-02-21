import os
from flask import Flask
from sqlalchemy import BigInteger
from sqlalchemy.ext.compiler import compiles
from flasgger import Swagger
from app.config import config
from app.extensions import db, jwt, cors
from app.errors import register_error_handlers


@compiles(BigInteger, 'sqlite')
def _render_bigint_as_int(type_, compiler, **kw):
    return 'INTEGER'


SWAGGER_TEMPLATE = {
    "info": {
        "title": "Acquisition Lifecycle Lite API",
        "description": (
            "API for federal IT acquisition lifecycle management — "
            "guided intake wizard, dual-track routing (IT Services vs IT Products), "
            "CLIN builder, multi-gate approval pipeline, advisory panel, "
            "document checklist, LOA/funding management, execution tracking, "
            "demand forecasting, and Claude AI assistant."
        ),
        "version": "1.0.0",
    },
    "securityDefinitions": {
        "Bearer": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "JWT token. Enter: **Bearer {your-jwt-token}**"
        }
    },
    "security": [{"Bearer": []}],
    "basePath": "/",
    "schemes": ["http", "https"],
    "definitions": {
        "Error": {
            "type": "object",
            "properties": {
                "error": {"type": "string"}
            }
        },
        "User": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "email": {"type": "string"},
                "name": {"type": "string"},
                "role": {"type": "string", "enum": [
                    "admin", "requestor", "branch_chief", "cto", "cio",
                    "ko", "budget", "legal", "scrm", "sb"
                ]},
                "team": {"type": "string"},
                "is_active": {"type": "boolean"},
                "created_at": {"type": "string", "format": "date-time"}
            }
        },
        "AcquisitionRequest": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "request_number": {"type": "string", "description": "Auto-generated (ACQ-2026-0001)"},
                "title": {"type": "string"},
                "description": {"type": "string"},
                "estimated_value": {"type": "number"},
                "fiscal_year": {"type": "string"},
                "priority": {"type": "string"},
                "status": {"type": "string"},
                "requestor_id": {"type": "integer"},
                "requestor_name": {"type": "string"},
                "requestor_org": {"type": "string"},
                "need_by_date": {"type": "string", "format": "date"},
                "derived_acquisition_type": {"type": "string"},
                "derived_tier": {"type": "string"},
                "derived_pipeline": {"type": "string"},
                "derived_contract_character": {"type": "string"},
                "intake_completed": {"type": "boolean"},
                "created_at": {"type": "string", "format": "date-time"},
                "updated_at": {"type": "string", "format": "date-time"}
            }
        },
        "ApprovalStep": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "request_id": {"type": "integer"},
                "step_number": {"type": "integer"},
                "step_name": {"type": "string"},
                "approver_role": {"type": "string"},
                "status": {"type": "string", "enum": ["pending", "active", "approved", "rejected", "returned", "skipped"]},
                "actor_name": {"type": "string"},
                "comments": {"type": "string"},
                "is_overdue": {"type": "boolean"},
                "completed_at": {"type": "string", "format": "date-time"}
            }
        },
        "AdvisoryInput": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "request_id": {"type": "integer"},
                "team": {"type": "string"},
                "status": {"type": "string", "enum": ["requested", "in_review", "info_requested", "complete_no_issues", "complete_issues_found", "waived"]},
                "findings": {"type": "string"},
                "recommendation": {"type": "string"},
                "impacts_strategy": {"type": "boolean"},
                "blocks_gate": {"type": "string"},
                "completed_date": {"type": "string", "format": "date-time"}
            }
        },
        "CLIN": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "request_id": {"type": "integer"},
                "clin_number": {"type": "string"},
                "description": {"type": "string"},
                "clin_type": {"type": "string"},
                "estimated_value": {"type": "number"},
                "clin_ceiling": {"type": "number"},
                "clin_obligated": {"type": "number"},
                "clin_invoiced": {"type": "number"},
                "loa_id": {"type": "integer"},
                "psc_code_id": {"type": "integer"},
                "contract_type": {"type": "string"},
                "sort_order": {"type": "integer"}
            }
        },
        "PackageDocument": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "request_id": {"type": "integer"},
                "title": {"type": "string"},
                "document_type": {"type": "string"},
                "status": {"type": "string", "enum": ["not_started", "in_progress", "complete", "uploaded", "not_required"]},
                "is_required": {"type": "boolean"},
                "content": {"type": "string"},
                "ai_generated": {"type": "boolean"},
                "required_before_gate": {"type": "string"},
                "created_at": {"type": "string", "format": "date-time"}
            }
        },
        "LineOfAccounting": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "display_name": {"type": "string"},
                "appropriation": {"type": "string"},
                "fund_code": {"type": "string"},
                "fund_type": {"type": "string"},
                "expenditure_type": {"type": "string"},
                "fiscal_year": {"type": "string"},
                "total_allocation": {"type": "number"},
                "projected_amount": {"type": "number"},
                "committed_amount": {"type": "number"},
                "obligated_amount": {"type": "number"},
                "available_balance": {"type": "number"},
                "status": {"type": "string"}
            }
        },
        "DemandForecast": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "title": {"type": "string"},
                "source": {"type": "string"},
                "estimated_value": {"type": "number"},
                "need_by_date": {"type": "string", "format": "date"},
                "fiscal_year": {"type": "string"},
                "buy_category": {"type": "string"},
                "status": {"type": "string"},
                "acquisition_request_id": {"type": "integer"}
            }
        },
        "CLINExecutionRequest": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "request_number": {"type": "string"},
                "execution_type": {"type": "string", "enum": ["odc", "travel"]},
                "contract_id": {"type": "integer"},
                "clin_id": {"type": "integer"},
                "title": {"type": "string"},
                "estimated_cost": {"type": "number"},
                "status": {"type": "string"},
                "funding_status": {"type": "string"},
                "pm_approval": {"type": "string"},
                "cto_approval": {"type": "string"}
            }
        },
        "PSCCode": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "code": {"type": "string"},
                "title": {"type": "string"},
                "group_name": {"type": "string"},
                "category": {"type": "string"},
                "service_or_product": {"type": "string"},
                "is_it_related": {"type": "boolean"},
                "status": {"type": "string"}
            }
        },
        "Notification": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "user_id": {"type": "integer"},
                "title": {"type": "string"},
                "message": {"type": "string"},
                "notification_type": {"type": "string"},
                "is_read": {"type": "boolean"},
                "link": {"type": "string"},
                "created_at": {"type": "string", "format": "date-time"}
            }
        }
    }
}

SWAGGER_CONFIG = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/apispec.json",
            "rule_filter": lambda rule: rule.rule.startswith('/api/'),
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/apidocs/"
}


def create_app(config_name=None):
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')

    app = Flask(__name__)
    app.url_map.strict_slashes = False
    app.config.from_object(config[config_name])

    db.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})
    jwt.init_app(app)

    Swagger(app, config=SWAGGER_CONFIG, template=SWAGGER_TEMPLATE)

    from app.api import register_blueprints
    register_blueprints(app)

    register_error_handlers(app)

    @app.route('/api/health')
    def health_check():
        """Health check endpoint.
        ---
        tags:
          - System
        security: []
        responses:
          200:
            description: Service is healthy
        """
        from flask import jsonify
        from datetime import datetime
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'app': 'acquisition-lifecycle-lite'
        })

    try:
        from demo_auth import init_demo_auth
        from demo_sessions import SessionManager
        db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
        if db_uri.startswith('sqlite:///'):
            template_db = os.path.join(app.instance_path, db_uri.replace('sqlite:///', ''))
        else:
            template_db = os.path.join(app.instance_path, 'acquisition_lifecycle.db')
        _session_mgr = SessionManager(
            template_db=template_db,
            sessions_dir=os.path.join(os.path.dirname(app.instance_path), 'data', 'sessions')
        )
        init_demo_auth(app, session_manager=_session_mgr)
    except ImportError:
        pass

    register_cli(app)
    return app


def register_cli(app):
    @app.cli.command('seed')
    def seed_command():
        from app.seed import seed
        seed()
        print('Database seeded.')

    @app.cli.command('init-db')
    def init_db_command():
        db.create_all()
        print('Database initialized.')

    @app.cli.command('reset-db')
    def reset_db_command():
        db.drop_all()
        db.create_all()
        from app.seed import seed
        seed()
        print('Database reset and seeded.')
