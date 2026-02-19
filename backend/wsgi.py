import os
import fcntl
from app import create_app
from app.extensions import db

app = create_app()

with app.app_context():
    db_url = app.config.get('SQLALCHEMY_DATABASE_URI', '')
    needs_init = False
    if db_url.startswith('sqlite:'):
        path = db_url.replace('sqlite:///', '')
        if path.startswith('/'):
            needs_init = not os.path.exists(path)
        else:
            needs_init = not os.path.exists(os.path.join(app.instance_path, path))

    if needs_init:
        lock_path = os.path.join(os.path.dirname(path) if path.startswith('/') else app.instance_path, '.db_init.lock')
        os.makedirs(os.path.dirname(lock_path), exist_ok=True)
        with open(lock_path, 'w') as lock_file:
            try:
                fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
                # Won the lock — initialize DB
                db.create_all()
                from app.seed import seed
                seed()
            except BlockingIOError:
                # Another worker is initializing — wait for it
                fcntl.flock(lock_file, fcntl.LOCK_EX)
            finally:
                fcntl.flock(lock_file, fcntl.LOCK_UN)
    else:
        # Run lightweight migrations for existing databases
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)
        cols = [c['name'] for c in inspector.get_columns('approval_template_steps')]
        if 'is_enabled' not in cols:
            db.session.execute(text(
                'ALTER TABLE approval_template_steps ADD COLUMN is_enabled BOOLEAN NOT NULL DEFAULT 1'
            ))
            db.session.commit()

        # Migration: create advisory_pipeline_configs table if missing
        tables = inspector.get_table_names()
        if 'advisory_pipeline_configs' not in tables:
            from app.models.advisory_pipeline_config import AdvisoryPipelineConfig
            AdvisoryPipelineConfig.__table__.create(db.engine)

            # Seed defaults from IntakePath data
            from app.models.intake_path import IntakePath
            _CODE_MAP = {
                'SCRM': 'scrm', 'SBO': 'sbo', 'CIO': 'cio',
                '508': 'section508', 'FM': 'fm',
            }
            _GATE_MAP = {
                'scrm': 'iss', 'sbo': 'asr', 'cio': 'iss',
                'section508': 'asr', 'fm': 'finance',
            }
            ALL_PIPES = ['full', 'abbreviated', 'ko_only', 'ko_abbreviated', 'micro',
                         'clin_execution', 'modification', 'clin_exec_funding', 'depends_on_value']
            ALL_TEAMS = ['scrm', 'sbo', 'cio', 'section508', 'fm']

            pipeline_teams = {}
            for p in IntakePath.query.all():
                pl = p.derived_pipeline
                if not pl:
                    continue
                if pl not in pipeline_teams:
                    pipeline_teams[pl] = set()
                triggers = p.advisory_triggers or ''
                if triggers.strip().lower() in ('', 'none'):
                    continue
                for code in triggers.split(','):
                    team = _CODE_MAP.get(code.strip().upper())
                    if team and team in ALL_TEAMS:
                        pipeline_teams[pl].add(team)

            for pipe in ALL_PIPES:
                enabled = pipeline_teams.get(pipe, set())
                for team in ALL_TEAMS:
                    db.session.add(AdvisoryPipelineConfig(
                        pipeline_type=pipe, team=team,
                        is_enabled=team in enabled,
                        sla_days=5, blocks_gate=_GATE_MAP.get(team, ''),
                        threshold_min=0,
                    ))
            db.session.commit()

        # Migration: add project/task columns to LOA table
        loa_cols = [c['name'] for c in inspector.get_columns('lines_of_accounting')]
        if 'project' not in loa_cols:
            db.session.execute(text("ALTER TABLE lines_of_accounting ADD COLUMN project VARCHAR(100)"))
            db.session.execute(text("ALTER TABLE lines_of_accounting ADD COLUMN task VARCHAR(100)"))
            db.session.commit()

        # Migration: add contract_number/clin_number/color_of_money to forecasts
        fc_cols = [c['name'] for c in inspector.get_columns('demand_forecasts')]
        if 'contract_number' not in fc_cols:
            db.session.execute(text("ALTER TABLE demand_forecasts ADD COLUMN contract_number VARCHAR(50)"))
            db.session.execute(text("ALTER TABLE demand_forecasts ADD COLUMN clin_number VARCHAR(50)"))
            db.session.execute(text("ALTER TABLE demand_forecasts ADD COLUMN color_of_money VARCHAR(30)"))
            db.session.commit()
