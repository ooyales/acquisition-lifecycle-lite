from flask import jsonify


class ACQLError(Exception):
    status_code = 500
    message = 'Internal server error'

    def __init__(self, message=None, status_code=None):
        if message:
            self.message = message
        if status_code:
            self.status_code = status_code

    def to_dict(self):
        return {'error': self.message, 'status_code': self.status_code}


class NotFoundError(ACQLError):
    status_code = 404
    message = 'Resource not found'


class BadRequestError(ACQLError):
    status_code = 400
    message = 'Bad request'


class ForbiddenError(ACQLError):
    status_code = 403
    message = 'Forbidden'


class ConflictError(ACQLError):
    status_code = 409
    message = 'Conflict'


def register_error_handlers(app):
    @app.errorhandler(ACQLError)
    def handle_app_error(error):
        return jsonify(error.to_dict()), error.status_code

    @app.errorhandler(404)
    def handle_404(error):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(500)
    def handle_500(error):
        return jsonify({'error': 'Internal server error'}), 500
