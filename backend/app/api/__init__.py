from app.api.auth import auth_bp
from app.api.requests import requests_bp
from app.api.dashboard import dashboard_bp
from app.api.approvals import approvals_bp
from app.api.documents import documents_bp
from app.api.funding import funding_bp
from app.api.lifecycle import lifecycle_bp
from app.api.comments import comments_bp
from app.api.wizard import wizard_bp
from app.api.integrations import integrations_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(requests_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(approvals_bp)
    app.register_blueprint(documents_bp)
    app.register_blueprint(funding_bp)
    app.register_blueprint(lifecycle_bp)
    app.register_blueprint(comments_bp)
    app.register_blueprint(wizard_bp)
    app.register_blueprint(integrations_bp)
