from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app.extensions import db
from app.models.activity import Comment, ActivityLog
from app.models.request import AcquisitionRequest
from app.errors import BadRequestError, NotFoundError

comments_bp = Blueprint('comments', __name__, url_prefix='/api/comments')


@comments_bp.route('/request/<int:request_id>', methods=['GET'])
@jwt_required()
def list_comments(request_id):
    """List all comments for a request, ordered by created_at."""
    # Verify the request exists
    req = AcquisitionRequest.query.get(request_id)
    if not req:
        raise NotFoundError(f'Request {request_id} not found')

    comments = Comment.query.filter_by(request_id=request_id) \
        .order_by(Comment.created_at).all()
    return jsonify({'comments': [c.to_dict() for c in comments]})


@comments_bp.route('/request/<int:request_id>', methods=['POST'])
@jwt_required()
def create_comment(request_id):
    """Create a comment on a request. Actor derived from JWT claims."""
    # Verify the request exists
    req = AcquisitionRequest.query.get(request_id)
    if not req:
        raise NotFoundError(f'Request {request_id} not found')

    data = request.get_json()
    if not data:
        raise BadRequestError('Request body is required')

    content = data.get('content', '').strip()
    if not content:
        raise BadRequestError('Content is required')

    claims = get_jwt()
    author = claims.get('name', 'Unknown')

    comment = Comment(
        request_id=request_id,
        author=author,
        content=content,
        is_internal=data.get('is_internal', False),
        approval_step_id=data.get('approval_step_id'),
    )
    db.session.add(comment)
    db.session.flush()

    # Log activity
    log = ActivityLog(
        request_id=request_id,
        activity_type='comment',
        description=f'Comment added by {author}',
        actor=author,
    )
    db.session.add(log)

    db.session.commit()
    return jsonify(comment.to_dict()), 201


@comments_bp.route('/<int:comment_id>', methods=['DELETE'])
@jwt_required()
def delete_comment(comment_id):
    """Delete a comment."""
    comment = Comment.query.get(comment_id)
    if not comment:
        raise NotFoundError(f'Comment {comment_id} not found')

    db.session.delete(comment)
    db.session.commit()
    return jsonify({'message': f'Comment {comment_id} deleted'})
