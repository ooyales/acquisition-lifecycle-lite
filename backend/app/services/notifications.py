"""
Notification helpers — create notifications for workflow events.

Called from workflow.py, intake.py, and advisory.py.
"""

from app.extensions import db
from app.models.notification import Notification
from app.models.user import User
from app.models.request import AcquisitionRequest


def create_notification(user_id, request_id, notification_type, title, message=None):
    """Create a single notification for a specific user."""
    n = Notification(
        user_id=user_id,
        request_id=request_id,
        notification_type=notification_type,
        title=title,
        message=message,
    )
    db.session.add(n)
    return n


def notify_users_by_role(role, request_id, notification_type, title, message=None):
    """Create notifications for ALL active users with the given role."""
    users = User.query.filter_by(role=role, is_active=True).all()
    for u in users:
        create_notification(u.id, request_id, notification_type, title, message)


def notify_users_by_team(team, request_id, notification_type, title, message=None):
    """Create notifications for users whose role maps to the advisory team.

    Uses the same role-to-team mapping as the advisory queue endpoint.
    """
    # Map advisory team names to user roles
    team_to_roles = {
        'scrm': ['scrm'],
        'sbo': ['sb'],
        'cio': ['cto', 'cio'],
        'section508': ['cto', 'cio'],
        'fm': ['budget'],
        'legal': ['legal'],
        'fedramp': ['cto', 'cio'],
    }

    roles = team_to_roles.get(team, [])
    notified_ids = set()
    for role in roles:
        users = User.query.filter_by(role=role, is_active=True).all()
        for u in users:
            if u.id not in notified_ids:
                create_notification(u.id, request_id, notification_type, title, message)
                notified_ids.add(u.id)

    # Also notify admins (they see all advisory queues)
    # Skip — admins already see everything; keep notifications focused


def notify_requestor(request_id, notification_type, title, message=None):
    """Create a notification for the requestor of a given acquisition request."""
    req = AcquisitionRequest.query.get(request_id)
    if req and req.requestor_id:
        create_notification(req.requestor_id, request_id, notification_type, title, message)
