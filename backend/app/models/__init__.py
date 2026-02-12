# Import all models so SQLAlchemy can discover them for create_all()
from app.models.user import User  # noqa: F401
from app.models.funding import FundingSource  # noqa: F401
from app.models.request import AcquisitionRequest  # noqa: F401
from app.models.approval import ApprovalTemplate, ApprovalTemplateStep, ApprovalStep  # noqa: F401
from app.models.document import PackageDocument  # noqa: F401
from app.models.lifecycle import LifecycleEvent  # noqa: F401
from app.models.activity import ActivityLog, Comment  # noqa: F401
from app.models.prior import PriorAcquisition  # noqa: F401
from app.models.wizard_import import WizardImport, WizardSession  # noqa: F401
