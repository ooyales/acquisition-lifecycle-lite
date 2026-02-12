import os
import json
from jinja2 import Environment, FileSystemLoader
from app.extensions import db
from app.models.document import PackageDocument
from app.models.request import AcquisitionRequest

# Template directory
TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), '..', 'templates')


def get_jinja_env():
    return Environment(loader=FileSystemLoader(TEMPLATE_DIR))


def draft_document(request_id, document_type):
    """Draft a document using Jinja2 templates. If ANTHROPIC_API_KEY is set, refine with Claude."""
    req = AcquisitionRequest.query.get(request_id)
    if not req:
        raise ValueError(f"Request {request_id} not found")

    env = get_jinja_env()
    template_map = {
        'strategy': 'strategy.md.j2',
        'igce': 'igce.md.j2',
        'market_research': 'market_research.md.j2',
        'scrm_assessment': 'scrm_assessment.md.j2',
    }

    template_name = template_map.get(document_type)
    if not template_name:
        return f"# {document_type.replace('_', ' ').title()}\n\nDocument template not available for this type."

    template = env.get_template(template_name)

    # Build context from request
    context = {
        'request': req,
        'request_number': req.request_number,
        'title': req.title,
        'description': req.description or '',
        'category': req.category,
        'sub_category': req.sub_category or '',
        'justification': req.justification or '',
        'estimated_total': req.estimated_total or 0,
        'cost_breakdown': json.loads(req.cost_breakdown or '{}'),
        'vendor_name': req.vendor_name or 'TBD',
        'product_name': req.product_name or 'TBD',
        'quantity': req.quantity or 1,
        'contract_vehicle': req.contract_vehicle or 'TBD',
        'fiscal_year': req.fiscal_year or 'FY26',
        'need_by_date': req.need_by_date or 'TBD',
        'requestor_name': req.requestor_name or '',
        'requestor_org': req.requestor_org or '',
        'existing_contract_number': req.existing_contract_number or '',
        'existing_vendor': req.existing_vendor or '',
        'existing_contract_value': req.existing_contract_value,
    }

    content = template.render(**context)

    # Claude API stub: if ANTHROPIC_API_KEY is set, refine the document
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if api_key:
        try:
            content = _refine_with_claude(content, document_type, api_key)
        except Exception:
            pass  # Fall back to template output

    return content


def _refine_with_claude(content, document_type, api_key):
    """Stub: When activated, sends template output to Claude for refinement."""
    # This would use the Anthropic SDK to refine the document
    # For now, just return the template content
    return content
