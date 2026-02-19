import os
from flask import Flask
from sqlalchemy import BigInteger
from sqlalchemy.ext.compiler import compiles
from app.config import config
from app.extensions import db, jwt, cors
from app.errors import register_error_handlers


@compiles(BigInteger, 'sqlite')
def _render_bigint_as_int(type_, compiler, **kw):
    return 'INTEGER'


def create_app(config_name=None):
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    db.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})
    jwt.init_app(app)

    from app.api import register_blueprints
    register_blueprints(app)

    register_error_handlers(app)

    @app.route('/api/health')
    def health_check():
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
