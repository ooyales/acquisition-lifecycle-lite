import os
from dotenv import load_dotenv

load_dotenv()


class BaseConfig:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = 3600
    JWT_REFRESH_TOKEN_EXPIRES = 86400 * 30
    JWT_TOKEN_LOCATION = ['headers']
    ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///acquisition_lifecycle.db')


class TestingConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv('TEST_DATABASE_URL', 'sqlite:///acquisition_lifecycle_test.db')


class ProductionConfig(BaseConfig):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    SECRET_KEY = os.getenv('SECRET_KEY')


config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}
