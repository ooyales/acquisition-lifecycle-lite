from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, get_jwt_identity, jwt_required, get_jwt
)
from app.extensions import db
from app.models.user import User
from app.errors import BadRequestError, UnauthorizedError

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate user and return JWT token."""
    data = request.get_json()
    if not data:
        raise BadRequestError('Request body is required')

    email = data.get('email', '').strip()
    password = data.get('password', '').strip()

    if not email or not password:
        raise BadRequestError('Email and password are required')

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        raise UnauthorizedError('Invalid email or password')

    additional_claims = {
        'email': user.email,
        'role': user.role,
        'name': user.name,
        'team': user.team,
    }
    access_token = create_access_token(
        identity=user.email,
        additional_claims=additional_claims,
    )

    return jsonify({
        'token': access_token,
        'access_token': access_token,
        'user': user.to_dict(),
    })


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    """Return current user info from JWT."""
    identity = get_jwt_identity()
    claims = get_jwt()
    return jsonify({
        'email': identity,
        'role': claims.get('role', 'requestor'),
        'name': claims.get('name', identity),
        'team': claims.get('team', ''),
    })


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required()
def refresh():
    """Refresh the JWT access token."""
    identity = get_jwt_identity()
    claims = get_jwt()
    additional_claims = {
        'email': identity,
        'role': claims.get('role', 'requestor'),
        'name': claims.get('name', identity),
        'team': claims.get('team', ''),
    }
    access_token = create_access_token(
        identity=identity,
        additional_claims=additional_claims,
    )
    return jsonify({'access_token': access_token})
