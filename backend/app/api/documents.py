import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app.extensions import db
from app.models.document import PackageDocument
from app.models.request import AcquisitionRequest
from app.models.activity import ActivityLog
from app.errors import BadRequestError, NotFoundError
from datetime import datetime

documents_bp = Blueprint('documents', __name__, url_prefix='/api/documents')


@documents_bp.route('/request/<int:request_id>', methods=['GET'])
@jwt_required()
def list_documents(request_id):
    """List all documents for a request."""
    docs = PackageDocument.query.filter_by(request_id=request_id).all()
    return jsonify({'documents': [d.to_dict() for d in docs]})


@documents_bp.route('/<int:doc_id>', methods=['GET'])
@jwt_required()
def get_document(doc_id):
    """Get a single document with content."""
    doc = PackageDocument.query.get_or_404(doc_id)
    return jsonify(doc.to_dict())


@documents_bp.route('/request/<int:request_id>', methods=['POST'])
@jwt_required()
def create_document(request_id):
    """Create a new document for a request."""
    req = AcquisitionRequest.query.get_or_404(request_id)
    data = request.get_json()

    doc = PackageDocument(
        request_id=request_id,
        document_type=data.get('document_type', 'other'),
        title=data.get('title', ''),
        status='not_started',
        assigned_to=data.get('assigned_to'),
        due_date=data.get('due_date'),
        session_id=req.session_id,
    )
    db.session.add(doc)

    claims = get_jwt()
    log = ActivityLog(
        request_id=request_id,
        activity_type='document',
        description=f'Document "{doc.title}" created',
        actor=claims.get('name', 'Unknown'),
    )
    db.session.add(log)
    db.session.commit()

    return jsonify(doc.to_dict()), 201


@documents_bp.route('/<int:doc_id>', methods=['PUT'])
@jwt_required()
def update_document(doc_id):
    """Update document metadata or content."""
    doc = PackageDocument.query.get_or_404(doc_id)
    data = request.get_json()

    if 'title' in data:
        doc.title = data['title']
    if 'status' in data:
        old_status = doc.status
        doc.status = data['status']
        if data['status'] == 'complete' and not doc.completed_date:
            doc.completed_date = datetime.now().strftime('%Y-%m-%d')
    if 'content' in data:
        doc.content = data['content']
    if 'assigned_to' in data:
        doc.assigned_to = data['assigned_to']
    if 'due_date' in data:
        doc.due_date = data['due_date']
    if 'reviewed_by' in data:
        doc.reviewed_by = data['reviewed_by']

    db.session.commit()
    return jsonify(doc.to_dict())


@documents_bp.route('/<int:doc_id>/draft', methods=['POST'])
@jwt_required()
def draft_document(doc_id):
    """Draft/regenerate document content using Jinja2 templates (or Claude if API key is set)."""
    doc = PackageDocument.query.get_or_404(doc_id)

    from app.services.document_drafter import draft_document as do_draft
    content = do_draft(doc.request_id, doc.document_type)

    doc.content = content
    doc.status = 'drafting'
    doc.ai_generated = bool(os.environ.get('ANTHROPIC_API_KEY'))

    claims = get_jwt()
    log = ActivityLog(
        request_id=doc.request_id,
        activity_type='document',
        description=f'Document "{doc.title}" drafted using {"AI" if doc.ai_generated else "template"}',
        actor=claims.get('name', 'Unknown'),
    )
    db.session.add(log)
    db.session.commit()

    return jsonify(doc.to_dict())


@documents_bp.route('/request/<int:request_id>/completeness', methods=['GET'])
@jwt_required()
def check_completeness(request_id):
    """Check document completeness for a request."""
    required_types = ['strategy', 'igce', 'market_research', 'scrm_assessment']
    docs = PackageDocument.query.filter_by(request_id=request_id).all()

    doc_map = {d.document_type: d for d in docs}
    checklist = []
    for dtype in required_types:
        doc = doc_map.get(dtype)
        checklist.append({
            'type': dtype,
            'title': dtype.replace('_', ' ').title(),
            'exists': doc is not None,
            'status': doc.status if doc else 'missing',
            'doc_id': doc.id if doc else None,
        })

    complete_count = sum(1 for item in checklist if item['status'] == 'complete')
    return jsonify({
        'checklist': checklist,
        'complete': complete_count,
        'total': len(required_types),
        'all_complete': complete_count == len(required_types),
    })


@documents_bp.route('/<int:doc_id>', methods=['DELETE'])
@jwt_required()
def delete_document(doc_id):
    """Delete a document."""
    doc = PackageDocument.query.get_or_404(doc_id)
    db.session.delete(doc)
    db.session.commit()
    return jsonify({'message': 'Document deleted'})
