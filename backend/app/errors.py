from flask import jsonify


class ACQLError(Exception):
    """Base error class for Acquisition Lifecycle Lite."""
    status_code = 500

    def __init__(self, message, status_code=None, payload=None):
        super().__init__()
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.payload = payload

    def to_dict(self):
        rv = dict(self.payload or ())
        rv['message'] = self.message
        return rv


class NotFoundError(ACQLError):
    status_code = 404


class ForbiddenError(ACQLError):
    status_code = 403


class BadRequestError(ACQLError):
    status_code = 400


class ConflictError(ACQLError):
    status_code = 409


class UnauthorizedError(ACQLError):
    status_code = 401


def register_error_handlers(app):
    @app.errorhandler(ACQLError)
    def handle_acql_error(error):
        response = jsonify(error.to_dict())
        response.status_code = error.status_code
        return response

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'message': 'Resource not found'}), 404

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'message': 'Internal server error'}), 500

    @app.errorhandler(422)
    def unprocessable(error):
        return jsonify({'message': 'Unprocessable entity'}), 422
