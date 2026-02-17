def register_blueprints(app):
    from app.api.auth import auth_bp
    from app.api.requests import requests_bp
    from app.api.intake import intake_bp
    from app.api.documents import documents_bp
    from app.api.approvals import approvals_bp
    from app.api.advisory import advisory_bp
    from app.api.clins import clins_bp
    from app.api.loa import loa_bp
    from app.api.forecasts import forecasts_bp
    from app.api.execution import execution_bp
    from app.api.psc import psc_bp
    from app.api.ai import ai_bp
    from app.api.dashboard import dashboard_bp
    from app.api.admin import admin_bp
    from app.api.notifications import notifications_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(requests_bp, url_prefix='/api/requests')
    app.register_blueprint(intake_bp, url_prefix='/api/intake')
    app.register_blueprint(documents_bp, url_prefix='/api/documents')
    app.register_blueprint(approvals_bp, url_prefix='/api/approvals')
    app.register_blueprint(advisory_bp, url_prefix='/api/advisory')
    app.register_blueprint(clins_bp, url_prefix='/api/clins')
    app.register_blueprint(loa_bp, url_prefix='/api/loa')
    app.register_blueprint(forecasts_bp, url_prefix='/api/forecasts')
    app.register_blueprint(execution_bp, url_prefix='/api/execution')
    app.register_blueprint(psc_bp, url_prefix='/api/psc')
    app.register_blueprint(ai_bp, url_prefix='/api/ai')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(notifications_bp, url_prefix='/api/notifications')
