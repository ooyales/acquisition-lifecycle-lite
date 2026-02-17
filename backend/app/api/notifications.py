from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.notification import Notification

notifications_bp = Blueprint('notifications', __name__)


@notifications_bp.route('', methods=['GET'])
@jwt_required()
def list_notifications():
    """Get notifications for the current user, newest first."""
    user_id = int(get_jwt_identity())
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    per_page = min(per_page, 50)

    query = Notification.query.filter_by(user_id=user_id).order_by(
        Notification.created_at.desc()
    )

    unread_only = request.args.get('unread', 'false').lower() == 'true'
    if unread_only:
        query = query.filter_by(is_read=False)

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'notifications': [n.to_dict() for n in paginated.items],
        'total': paginated.total,
        'page': paginated.page,
        'pages': paginated.pages,
    })


@notifications_bp.route('/unread-count', methods=['GET'])
@jwt_required()
def unread_count():
    """Return the count of unread notifications for the current user."""
    user_id = int(get_jwt_identity())
    count = Notification.query.filter_by(user_id=user_id, is_read=False).count()
    return jsonify({'unread_count': count})


@notifications_bp.route('/<int:notification_id>/read', methods=['POST'])
@jwt_required()
def mark_read(notification_id):
    """Mark a single notification as read."""
    user_id = int(get_jwt_identity())
    n = Notification.query.get_or_404(notification_id)
    if n.user_id != user_id:
        return jsonify({'error': 'Not your notification'}), 403
    n.is_read = True
    db.session.commit()
    return jsonify(n.to_dict())


@notifications_bp.route('/mark-all-read', methods=['POST'])
@jwt_required()
def mark_all_read():
    """Mark all notifications as read for the current user."""
    user_id = int(get_jwt_identity())
    count = Notification.query.filter_by(user_id=user_id, is_read=False).update(
        {'is_read': True}
    )
    db.session.commit()
    return jsonify({'marked_read': count})
