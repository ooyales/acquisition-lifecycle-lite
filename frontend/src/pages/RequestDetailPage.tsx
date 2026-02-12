import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  ArrowLeft,
  Edit3,
  Send,
  Trash2,
  XCircle,
  CheckCircle2,
  Package,
  Truck,
  Lock,
  Award,
  Loader2,
  AlertCircle,
  Clock,
  MessageSquare,
  ClipboardList,
  Activity,
  FolderOpen,
  User,
  Calendar,
  DollarSign,
  Tag,
  Building2,
  ChevronRight,
  Plus,
  Wand2,
  Eye,
  Save,
  X,
  Search,
  ShieldCheck,
  BarChart3,
} from 'lucide-react';
import { requestsApi, type RequestDetail } from '@/api/requests';
import { approvalsApi } from '@/api/approvals';
import { documentsApi, type DocumentCompleteness } from '@/api/documents';
import { commentsApi } from '@/api/comments';
import { useAuthStore } from '@/store/authStore';
import {
  RequestStatusBadge,
  PriorityBadge,
  ApprovalStepBadge,
  DocumentStatusBadge,
} from '@/components/common/StatusBadge';
import type { RequestCategory, RequestStatus, ApprovalStep, PackageDocument, ActivityLog, Comment } from '@/types';

const CATEGORY_LABELS: Record<RequestCategory, string> = {
  hardware_purchase: 'Hardware Purchase',
  software_license: 'Software License',
  service_contract: 'Service Contract',
  cloud_service: 'Cloud Service',
  maintenance_support: 'Maintenance & Support',
  other: 'Other',
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-';
  return `$${value.toLocaleString()}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(dateStr);
}

function activityIcon(type: string) {
  switch (type) {
    case 'status_change':
      return <Activity size={14} className="text-eaw-primary" />;
    case 'created':
      return <FileText size={14} className="text-eaw-success" />;
    case 'comment':
      return <MessageSquare size={14} className="text-eaw-info" />;
    case 'approval':
      return <CheckCircle2 size={14} className="text-eaw-success" />;
    case 'rejection':
      return <XCircle size={14} className="text-eaw-danger" />;
    case 'document':
      return <FolderOpen size={14} className="text-eaw-warning" />;
    default:
      return <Clock size={14} className="text-eaw-muted" />;
  }
}

type TabId = 'overview' | 'approval' | 'documents' | 'activity' | 'comments';

interface AwardModalData {
  awarded_vendor: string;
  awarded_amount: string;
  po_number: string;
  awarded_date: string;
}

export default function RequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Award modal
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [awardData, setAwardData] = useState<AwardModalData>({
    awarded_vendor: '',
    awarded_amount: '',
    po_number: '',
    awarded_date: '',
  });

  const fetchRequest = () => {
    setLoading(true);
    setError('');
    requestsApi
      .get(Number(id))
      .then(setRequest)
      .catch((err: any) => {
        setError(err?.response?.data?.error || 'Failed to load request.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (id) fetchRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAction = async (action: () => Promise<any>) => {
    setActionLoading(true);
    setError('');
    try {
      await action();
      fetchRequest();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = () => handleAction(() => requestsApi.submit(Number(id)));
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this request?')) return;
    setActionLoading(true);
    try {
      await requestsApi.delete(Number(id));
      navigate('/requests');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete request.');
      setActionLoading(false);
    }
  };
  const handleCancel = () =>
    handleAction(() => requestsApi.updateStatus(Number(id), 'cancelled'));
  const handlePackageBuilding = () =>
    handleAction(() => requestsApi.updateStatus(Number(id), 'package_building'));
  const handleSubmitToContracting = () =>
    handleAction(() => requestsApi.updateStatus(Number(id), 'submitted_to_contracting'));
  const handleDelivered = () =>
    handleAction(() => requestsApi.updateStatus(Number(id), 'delivered'));
  const handleClose = () =>
    handleAction(() => requestsApi.updateStatus(Number(id), 'closed'));

  const handleRecordAward = () => {
    handleAction(() =>
      requestsApi.updateStatus(Number(id), 'awarded', {
        awarded_vendor: awardData.awarded_vendor,
        awarded_amount: awardData.awarded_amount
          ? parseFloat(awardData.awarded_amount)
          : undefined,
        po_number: awardData.po_number,
        awarded_date: awardData.awarded_date,
      })
    );
    setShowAwardModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-eaw-primary" />
        <span className="ml-2 text-sm text-eaw-muted">Loading request...</span>
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
        <button onClick={() => navigate('/requests')} className="btn-secondary mt-4">
          <ArrowLeft size={16} />
          Back to Requests
        </button>
      </div>
    );
  }

  if (!request) return null;

  const isPostAward = ['awarded', 'delivered', 'closed'].includes(request.status);
  const isActiveStatus = !['closed', 'cancelled'].includes(request.status);

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <FileText size={15} /> },
    { id: 'approval', label: 'Approval', icon: <ClipboardList size={15} /> },
    { id: 'documents', label: 'Documents', icon: <FolderOpen size={15} /> },
    { id: 'activity', label: 'Activity', icon: <Activity size={15} /> },
    { id: 'comments', label: 'Comments', icon: <MessageSquare size={15} /> },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/requests')}
            className="p-1 mt-1 hover:bg-gray-100 rounded transition-colors"
          >
            <ArrowLeft size={20} className="text-eaw-muted" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-sm text-eaw-muted">
                {request.request_number}
              </span>
              <RequestStatusBadge status={request.status} />
              <PriorityBadge priority={request.priority} />
            </div>
            <h1 className="text-xl font-bold text-eaw-font">{request.title}</h1>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-eaw-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-eaw-primary text-eaw-primary'
                : 'border-transparent text-eaw-muted hover:text-eaw-font hover:border-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.id === 'comments' && request.comments.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">
                {request.comments.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          request={request}
          isPostAward={isPostAward}
          isActiveStatus={isActiveStatus}
          actionLoading={actionLoading}
          onEdit={() => navigate(`/requests/${request.id}/edit`)}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
          onCancel={handleCancel}
          onPackageBuilding={handlePackageBuilding}
          onSubmitToContracting={handleSubmitToContracting}
          onRecordAward={() => setShowAwardModal(true)}
          onDelivered={handleDelivered}
          onClose={handleClose}
        />
      )}

      {activeTab === 'approval' && (
        <ApprovalTab steps={request.approval_steps} onRefresh={fetchRequest} />
      )}

      {activeTab === 'documents' && (
        <DocumentsTab
          documents={request.documents}
          requestId={request.id}
          onRefresh={fetchRequest}
        />
      )}

      {activeTab === 'activity' && (
        <ActivityTab activities={request.activities} />
      )}

      {activeTab === 'comments' && (
        <CommentsTab comments={request.comments} requestId={request.id} onRefresh={fetchRequest} />
      )}

      {/* Award Modal */}
      {showAwardModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-eaw-border">
              <h3 className="text-lg font-semibold text-eaw-font">Record Award</h3>
              <p className="text-sm text-eaw-muted mt-1">
                Enter the award details for this acquisition.
              </p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-eaw-font mb-1">
                  Awarded Vendor
                </label>
                <input
                  type="text"
                  value={awardData.awarded_vendor}
                  onChange={(e) =>
                    setAwardData({ ...awardData, awarded_vendor: e.target.value })
                  }
                  className="input-field"
                  placeholder="Vendor name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-eaw-font mb-1">
                  Awarded Amount ($)
                </label>
                <input
                  type="number"
                  value={awardData.awarded_amount}
                  onChange={(e) =>
                    setAwardData({ ...awardData, awarded_amount: e.target.value })
                  }
                  className="input-field"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-eaw-font mb-1">
                  PO Number
                </label>
                <input
                  type="text"
                  value={awardData.po_number}
                  onChange={(e) =>
                    setAwardData({ ...awardData, po_number: e.target.value })
                  }
                  className="input-field"
                  placeholder="Purchase order number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-eaw-font mb-1">
                  Award Date
                </label>
                <input
                  type="date"
                  value={awardData.awarded_date}
                  onChange={(e) =>
                    setAwardData({ ...awardData, awarded_date: e.target.value })
                  }
                  className="input-field"
                />
              </div>
            </div>
            <div className="p-4 border-t border-eaw-border flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAwardModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordAward}
                disabled={actionLoading}
                className="btn-primary"
              >
                {actionLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Award size={16} />
                )}
                Record Award
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Overview Tab ─────────────────────────────────────────────────────── */

interface OverviewTabProps {
  request: RequestDetail;
  isPostAward: boolean;
  isActiveStatus: boolean;
  actionLoading: boolean;
  onEdit: () => void;
  onSubmit: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onPackageBuilding: () => void;
  onSubmitToContracting: () => void;
  onRecordAward: () => void;
  onDelivered: () => void;
  onClose: () => void;
}

function OverviewTab({
  request,
  isPostAward,
  isActiveStatus,
  actionLoading,
  onEdit,
  onSubmit,
  onDelete,
  onCancel,
  onPackageBuilding,
  onSubmitToContracting,
  onRecordAward,
  onDelivered,
  onClose,
}: OverviewTabProps) {
  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="eaw-card">
        <div className="flex flex-wrap items-center gap-2">
          {request.status === 'draft' && (
            <>
              <button onClick={onEdit} disabled={actionLoading} className="btn-secondary">
                <Edit3 size={16} />
                Edit
              </button>
              <button onClick={onSubmit} disabled={actionLoading} className="btn-primary">
                <Send size={16} />
                Submit for Approval
              </button>
              <button onClick={onDelete} disabled={actionLoading} className="btn-danger">
                <Trash2 size={16} />
                Delete
              </button>
            </>
          )}

          {(request.status === 'submitted' || request.status === 'in_review') && (
            <div className="text-sm text-eaw-muted flex items-center gap-2">
              <Clock size={16} />
              <span>
                Pending approval at step {request.current_approval_step}
              </span>
            </div>
          )}

          {request.status === 'approved' && (
            <button onClick={onPackageBuilding} disabled={actionLoading} className="btn-primary">
              <Package size={16} />
              Begin Package Building
            </button>
          )}

          {request.status === 'package_building' && (
            <button onClick={onSubmitToContracting} disabled={actionLoading} className="btn-primary">
              <Send size={16} />
              Submit to Contracting
            </button>
          )}

          {request.status === 'submitted_to_contracting' && (
            <button onClick={onRecordAward} disabled={actionLoading} className="btn-primary">
              <Award size={16} />
              Record Award
            </button>
          )}

          {request.status === 'awarded' && (
            <button onClick={onDelivered} disabled={actionLoading} className="btn-success">
              <Truck size={16} />
              Record Delivery
            </button>
          )}

          {request.status === 'delivered' && (
            <button onClick={onClose} disabled={actionLoading} className="btn-success">
              <Lock size={16} />
              Close Request
            </button>
          )}

          {isActiveStatus && request.status !== 'draft' && (
            <button onClick={onCancel} disabled={actionLoading} className="btn-danger">
              <XCircle size={16} />
              Cancel Request
            </button>
          )}

          {actionLoading && (
            <Loader2 size={16} className="animate-spin text-eaw-primary ml-2" />
          )}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Request Info */}
        <div className="eaw-card">
          <h3 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-3 pb-2 border-b border-eaw-border">
            Request Information
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-eaw-muted flex items-center gap-1.5">
                <Tag size={14} />
                Category
              </dt>
              <dd className="font-medium">
                {CATEGORY_LABELS[request.category] || request.category}
              </dd>
            </div>
            {request.sub_category && (
              <div className="flex justify-between">
                <dt className="text-eaw-muted">Sub-Category</dt>
                <dd>{request.sub_category}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-eaw-muted flex items-center gap-1.5">
                <Calendar size={14} />
                Fiscal Year
              </dt>
              <dd>{request.fiscal_year}</dd>
            </div>
            {request.trigger_type && (
              <div className="flex justify-between">
                <dt className="text-eaw-muted">Trigger</dt>
                <dd>{request.trigger_type}</dd>
              </div>
            )}
            {request.need_by_date && (
              <div className="flex justify-between">
                <dt className="text-eaw-muted">Need-By Date</dt>
                <dd>{formatDate(request.need_by_date)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-eaw-muted">Created</dt>
              <dd>{formatDate(request.created_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-eaw-muted">Updated</dt>
              <dd>{formatDate(request.updated_at)}</dd>
            </div>
          </dl>
        </div>

        {/* Cost & Funding */}
        <div className="eaw-card">
          <h3 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-3 pb-2 border-b border-eaw-border">
            Cost & Funding
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-eaw-muted flex items-center gap-1.5">
                <DollarSign size={14} />
                Estimated Total
              </dt>
              <dd className="font-semibold text-base">
                {formatCurrency(request.estimated_total)}
              </dd>
            </div>
            {request.cost_breakdown &&
              Object.keys(request.cost_breakdown).length > 0 && (
                <div>
                  <dt className="text-eaw-muted mb-1">Cost Breakdown</dt>
                  <dd className="bg-gray-50 rounded p-2 text-xs">
                    {Object.entries(request.cost_breakdown).map(([key, val]) => (
                      <div key={key} className="flex justify-between py-0.5">
                        <span className="text-eaw-muted">{key}</span>
                        <span>{typeof val === 'number' ? formatCurrency(val) : String(val)}</span>
                      </div>
                    ))}
                  </dd>
                </div>
              )}
            {request.funding_source_name && (
              <div className="flex justify-between">
                <dt className="text-eaw-muted">Funding Source</dt>
                <dd>{request.funding_source_name}</dd>
              </div>
            )}
            {request.funding_source_available != null && (
              <div className="flex justify-between">
                <dt className="text-eaw-muted">Available Balance</dt>
                <dd>{formatCurrency(request.funding_source_available)}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Vendor & Product */}
        <div className="eaw-card">
          <h3 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-3 pb-2 border-b border-eaw-border">
            Vendor & Product
          </h3>
          <dl className="space-y-2 text-sm">
            {request.vendor_name && (
              <div className="flex justify-between">
                <dt className="text-eaw-muted flex items-center gap-1.5">
                  <Building2 size={14} />
                  Vendor
                </dt>
                <dd>{request.vendor_name}</dd>
              </div>
            )}
            {request.product_name && (
              <div className="flex justify-between">
                <dt className="text-eaw-muted">Product</dt>
                <dd>{request.product_name}</dd>
              </div>
            )}
            {request.quantity != null && (
              <div className="flex justify-between">
                <dt className="text-eaw-muted">Quantity</dt>
                <dd>{request.quantity}</dd>
              </div>
            )}
            {request.contract_vehicle && (
              <div className="flex justify-between">
                <dt className="text-eaw-muted">Contract Vehicle</dt>
                <dd>{request.contract_vehicle}</dd>
              </div>
            )}
            {request.existing_contract_number && (
              <div className="flex justify-between">
                <dt className="text-eaw-muted">Existing Contract #</dt>
                <dd className="font-mono text-xs">{request.existing_contract_number}</dd>
              </div>
            )}
            {request.existing_vendor && (
              <div className="flex justify-between">
                <dt className="text-eaw-muted">Existing Vendor</dt>
                <dd>{request.existing_vendor}</dd>
              </div>
            )}
            {request.existing_contract_value != null && (
              <div className="flex justify-between">
                <dt className="text-eaw-muted">Existing Contract Value</dt>
                <dd>{formatCurrency(request.existing_contract_value)}</dd>
              </div>
            )}
            {!request.vendor_name &&
              !request.product_name &&
              !request.existing_contract_number && (
                <p className="text-eaw-muted">No vendor/product information provided.</p>
              )}
          </dl>
        </div>

        {/* Requestor */}
        <div className="eaw-card">
          <h3 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-3 pb-2 border-b border-eaw-border">
            Requestor
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-eaw-muted flex items-center gap-1.5">
                <User size={14} />
                Name
              </dt>
              <dd className="font-medium">{request.requestor_name}</dd>
            </div>
            {request.requestor_org && (
              <div className="flex justify-between">
                <dt className="text-eaw-muted">Organization</dt>
                <dd>{request.requestor_org}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Post-Award */}
      {isPostAward && (
        <div className="eaw-card">
          <h3 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-3 pb-2 border-b border-eaw-border">
            Post-Award Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            {request.awarded_date && (
              <div>
                <dt className="text-eaw-muted text-xs uppercase mb-0.5">Award Date</dt>
                <dd className="font-medium">{formatDate(request.awarded_date)}</dd>
              </div>
            )}
            {request.awarded_vendor && (
              <div>
                <dt className="text-eaw-muted text-xs uppercase mb-0.5">Awarded Vendor</dt>
                <dd className="font-medium">{request.awarded_vendor}</dd>
              </div>
            )}
            {request.awarded_amount != null && (
              <div>
                <dt className="text-eaw-muted text-xs uppercase mb-0.5">Awarded Amount</dt>
                <dd className="font-medium">{formatCurrency(request.awarded_amount)}</dd>
              </div>
            )}
            {request.po_number && (
              <div>
                <dt className="text-eaw-muted text-xs uppercase mb-0.5">PO Number</dt>
                <dd className="font-mono">{request.po_number}</dd>
              </div>
            )}
            {request.delivery_date && (
              <div>
                <dt className="text-eaw-muted text-xs uppercase mb-0.5">Delivery Date</dt>
                <dd className="font-medium">{formatDate(request.delivery_date)}</dd>
              </div>
            )}
            {request.received_date && (
              <div>
                <dt className="text-eaw-muted text-xs uppercase mb-0.5">Received Date</dt>
                <dd className="font-medium">{formatDate(request.received_date)}</dd>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Description */}
      {request.description && (
        <div className="eaw-card">
          <h3 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-3 pb-2 border-b border-eaw-border">
            Description
          </h3>
          <p className="text-sm text-eaw-font whitespace-pre-wrap leading-relaxed">
            {request.description}
          </p>
        </div>
      )}

      {/* Justification */}
      {request.justification && (
        <div className="eaw-card">
          <h3 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-3 pb-2 border-b border-eaw-border">
            Business Justification
          </h3>
          <p className="text-sm text-eaw-font whitespace-pre-wrap leading-relaxed">
            {request.justification}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Approval Tab ─────────────────────────────────────────────────────── */

function ApprovalTab({ steps, onRefresh }: { steps: ApprovalStep[]; onRefresh: () => void }) {
  const userRole = useAuthStore((s) => s.user?.role);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const [stepComments, setStepComments] = useState<Record<number, string>>({});

  const handleStepAction = async (stepId: number, action: string) => {
    const comment = stepComments[stepId]?.trim() || '';

    if ((action === 'reject' || action === 'return') && !comment) {
      setActionError('Comments are required when rejecting or returning.');
      return;
    }

    setActionLoading(stepId);
    setActionError('');
    try {
      await approvalsApi.processStep(stepId, action, comment || undefined);
      setStepComments((prev) => {
        const next = { ...prev };
        delete next[stepId];
        return next;
      });
      onRefresh();
    } catch (err: any) {
      setActionError(err?.response?.data?.error || `Failed to ${action} step.`);
    } finally {
      setActionLoading(null);
    }
  };

  if (!steps || steps.length === 0) {
    return (
      <div className="eaw-card">
        <p className="text-sm text-eaw-muted text-center py-8">
          No approval steps assigned yet. Steps are created when the request is submitted.
        </p>
      </div>
    );
  }

  return (
    <div className="eaw-card">
      <h3 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-4 pb-2 border-b border-eaw-border">
        Approval Timeline
      </h3>

      {actionError && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="relative">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const canAct = step.status === 'active' && userRole === step.approver_role;
          const isProcessing = actionLoading === step.id;
          const stepOverdue =
            step.status === 'active' && step.due_date && new Date(step.due_date) < new Date();

          return (
            <div key={step.id} className="flex gap-4 mb-0">
              {/* Timeline column */}
              <div className="flex flex-col items-center w-8 flex-shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    step.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : step.status === 'active'
                      ? 'bg-yellow-100 text-yellow-700'
                      : step.status === 'rejected' || step.status === 'returned'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {step.status === 'approved' ? (
                    <CheckCircle2 size={16} />
                  ) : step.status === 'rejected' || step.status === 'returned' ? (
                    <XCircle size={16} />
                  ) : (
                    step.step_number
                  )}
                </div>
                {!isLast && (
                  <div
                    className={`w-0.5 flex-1 min-h-[24px] ${
                      step.status === 'approved' ? 'bg-green-300' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-eaw-font">
                    {step.step_name}
                  </span>
                  <ApprovalStepBadge status={step.status} />
                  {stepOverdue && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                      <Clock size={12} />
                      Overdue
                    </span>
                  )}
                </div>
                <div className="text-xs text-eaw-muted space-y-0.5">
                  <p>Role: {step.approver_role}</p>
                  {step.approver_name && <p>Approver: {step.approver_name}</p>}
                  {step.acted_on_date && (
                    <p>
                      Acted on: {formatDate(step.acted_on_date)}
                      {step.action_by && ` by ${step.action_by}`}
                    </p>
                  )}
                  {step.due_date && (
                    <p className={stepOverdue ? 'text-red-600 font-medium' : ''}>
                      Due: {formatDate(step.due_date)}
                    </p>
                  )}
                  {step.comments && (
                    <div className="mt-1 p-2 bg-gray-50 rounded text-xs text-eaw-font">
                      {step.comments}
                    </div>
                  )}
                  {step.conditions && (
                    <p className="text-eaw-warning">Conditions: {step.conditions}</p>
                  )}
                </div>

                {/* Inline Action Buttons for active step matching user role */}
                {canAct && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-xs font-medium text-yellow-800 mb-2">
                      This step requires your action
                    </p>
                    <textarea
                      value={stepComments[step.id] || ''}
                      onChange={(e) =>
                        setStepComments((prev) => ({ ...prev, [step.id]: e.target.value }))
                      }
                      placeholder="Add comments (required for reject/return)..."
                      rows={2}
                      className="input-field text-sm resize-none w-full mb-2"
                      disabled={isProcessing}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStepAction(step.id, 'approve')}
                        disabled={isProcessing}
                        className="btn-success"
                      >
                        {isProcessing ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleStepAction(step.id, 'return')}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-yellow-400 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <ChevronRight size={14} className="rotate-180" />
                        )}
                        Return
                      </button>
                      <button
                        onClick={() => handleStepAction(step.id, 'reject')}
                        disabled={isProcessing}
                        className="btn-danger"
                      >
                        {isProcessing ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <XCircle size={14} />
                        )}
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Documents Tab ────────────────────────────────────────────────────── */

const REQUIRED_DOCS: { type: string; title: string; icon: React.ReactNode }[] = [
  { type: 'strategy', title: 'Acquisition Strategy', icon: <ClipboardList size={18} /> },
  { type: 'igce', title: 'Independent Government Cost Estimate (IGCE)', icon: <DollarSign size={18} /> },
  { type: 'market_research', title: 'Market Research Report', icon: <Search size={18} /> },
  { type: 'scrm_assessment', title: 'SCRM Assessment', icon: <ShieldCheck size={18} /> },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  strategy: 'Acquisition Strategy',
  igce: 'IGCE',
  market_research: 'Market Research',
  scrm_assessment: 'SCRM Assessment',
};

function docTypeIcon(type: string) {
  switch (type) {
    case 'strategy':
      return <ClipboardList size={18} className="text-eaw-primary" />;
    case 'igce':
      return <DollarSign size={18} className="text-eaw-success" />;
    case 'market_research':
      return <Search size={18} className="text-eaw-info" />;
    case 'scrm_assessment':
      return <ShieldCheck size={18} className="text-eaw-warning" />;
    default:
      return <FileText size={18} className="text-eaw-muted" />;
  }
}

interface DocumentsTabProps {
  documents: PackageDocument[];
  requestId: number;
  onRefresh: () => void;
}

function DocumentsTab({ documents, requestId, onRefresh }: DocumentsTabProps) {
  const [completeness, setCompleteness] = useState<DocumentCompleteness | null>(null);
  const [loadingCompleteness, setLoadingCompleteness] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  // Editor state
  const [editingDoc, setEditingDoc] = useState<PackageDocument | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCompleteness = useCallback(() => {
    setLoadingCompleteness(true);
    documentsApi
      .completeness(requestId)
      .then(setCompleteness)
      .catch(() => {
        // If completeness endpoint is not available, build from documents
        const checklist = REQUIRED_DOCS.map((rd) => {
          const existing = documents.find(
            (d) => d.document_type === rd.type
          );
          return {
            type: rd.type,
            title: rd.title,
            exists: !!existing,
            status: existing?.status || 'not_started',
            doc_id: existing?.id || null,
          };
        });
        const completeCount = checklist.filter((c) => c.status === 'complete').length;
        setCompleteness({
          checklist,
          complete: completeCount,
          total: checklist.length,
          all_complete: completeCount === checklist.length,
        });
      })
      .finally(() => setLoadingCompleteness(false));
  }, [requestId, documents]);

  useEffect(() => {
    fetchCompleteness();
  }, [fetchCompleteness]);

  const handleCreate = async (docType: string, docTitle: string) => {
    setActionLoading(docType);
    setActionError('');
    try {
      await documentsApi.create(requestId, {
        document_type: docType,
        title: docTitle,
      });
      onRefresh();
    } catch (err: any) {
      setActionError(err?.response?.data?.error || `Failed to create ${docType} document.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDraft = async (docId: number, docType: string) => {
    setActionLoading(docType);
    setActionError('');
    try {
      const updated = await documentsApi.draft(docId);
      // Open the editor with the newly drafted content
      setEditingDoc(updated);
      setEditContent(updated.content || '');
      onRefresh();
    } catch (err: any) {
      setActionError(err?.response?.data?.error || 'Failed to auto-draft document.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenEditor = async (docId: number) => {
    setActionError('');
    try {
      const doc = await documentsApi.get(docId);
      setEditingDoc(doc);
      setEditContent(doc.content || '');
    } catch (err: any) {
      setActionError(err?.response?.data?.error || 'Failed to load document.');
    }
  };

  const handleSaveContent = async () => {
    if (!editingDoc) return;
    setSaving(true);
    setActionError('');
    try {
      const updated = await documentsApi.update(editingDoc.id, {
        content: editContent,
      });
      setEditingDoc(updated);
      onRefresh();
    } catch (err: any) {
      setActionError(err?.response?.data?.error || 'Failed to save document.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (docId: number, newStatus: PackageDocument['status']) => {
    setActionError('');
    try {
      const updated = await documentsApi.update(docId, { status: newStatus });
      if (editingDoc?.id === docId) {
        setEditingDoc(updated);
      }
      onRefresh();
    } catch (err: any) {
      setActionError(err?.response?.data?.error || 'Failed to update status.');
    }
  };

  const handleCloseEditor = () => {
    setEditingDoc(null);
    setEditContent('');
  };

  const progressPct = completeness
    ? completeness.total > 0
      ? Math.round((completeness.complete / completeness.total) * 100)
      : 0
    : 0;

  // Map documents by type for easy lookup
  const docsByType: Record<string, PackageDocument> = {};
  documents.forEach((d) => {
    docsByType[d.document_type] = d;
  });

  return (
    <div className="space-y-4">
      {/* Error */}
      {actionError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{actionError}</span>
          <button
            onClick={() => setActionError('')}
            className="ml-auto p-0.5 hover:bg-red-100 rounded"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Completeness Progress */}
      <div className="eaw-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-eaw-font uppercase tracking-wide">
            Package Completeness
          </h3>
          {loadingCompleteness ? (
            <Loader2 size={14} className="animate-spin text-eaw-muted" />
          ) : (
            <span className="text-sm font-medium text-eaw-font">
              {completeness?.complete ?? 0} of {completeness?.total ?? 4} complete
            </span>
          )}
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              completeness?.all_complete ? 'bg-eaw-success' : 'bg-eaw-primary'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {completeness?.all_complete && (
          <div className="mt-2 flex items-center gap-1.5 text-sm text-eaw-success font-medium">
            <CheckCircle2 size={14} />
            All required documents are complete
          </div>
        )}
      </div>

      {/* Required Documents Checklist */}
      <div className="eaw-card">
        <h3 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-4 pb-2 border-b border-eaw-border">
          Required Documents
        </h3>
        <div className="space-y-3">
          {REQUIRED_DOCS.map((reqDoc) => {
            const existing = docsByType[reqDoc.type];
            const checkItem = completeness?.checklist.find((c) => c.type === reqDoc.type);
            const isLoading = actionLoading === reqDoc.type;

            return (
              <div
                key={reqDoc.type}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
              >
                {/* Icon */}
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                  {docTypeIcon(reqDoc.type)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-eaw-font truncate">
                      {reqDoc.title}
                    </span>
                    {existing && <DocumentStatusBadge status={existing.status} />}
                    {existing?.ai_generated && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                        <Wand2 size={10} />
                        Auto-generated
                      </span>
                    )}
                  </div>
                  {existing && (
                    <div className="text-xs text-eaw-muted mt-0.5">
                      {existing.assigned_to && (
                        <span>Assigned: {existing.assigned_to}</span>
                      )}
                      {existing.due_date && (
                        <span className="ml-3">Due: {formatDate(existing.due_date)}</span>
                      )}
                      {existing.completed_date && (
                        <span className="ml-3">Completed: {formatDate(existing.completed_date)}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  {!existing && (
                    <button
                      onClick={() => handleCreate(reqDoc.type, reqDoc.title)}
                      disabled={isLoading}
                      className="btn-primary"
                    >
                      {isLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Plus size={14} />
                      )}
                      Create
                    </button>
                  )}

                  {existing && existing.status === 'not_started' && (
                    <button
                      onClick={() => handleDraft(existing.id, reqDoc.type)}
                      disabled={isLoading}
                      className="btn-primary"
                    >
                      {isLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Wand2 size={14} />
                      )}
                      Auto-Draft
                    </button>
                  )}

                  {existing && existing.status === 'drafting' && (
                    <>
                      <button
                        onClick={() => handleOpenEditor(existing.id)}
                        className="btn-secondary"
                      >
                        <Edit3 size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleStatusChange(existing.id, 'review')}
                        className="btn-primary"
                      >
                        <Send size={14} />
                        Submit for Review
                      </button>
                    </>
                  )}

                  {existing && existing.status === 'review' && (
                    <>
                      <button
                        onClick={() => handleOpenEditor(existing.id)}
                        className="btn-secondary"
                      >
                        <Eye size={14} />
                        View
                      </button>
                      <button
                        onClick={() => handleStatusChange(existing.id, 'complete')}
                        className="btn-success"
                      >
                        <CheckCircle2 size={14} />
                        Mark Complete
                      </button>
                    </>
                  )}

                  {existing && existing.status === 'complete' && (
                    <button
                      onClick={() => handleOpenEditor(existing.id)}
                      className="btn-secondary"
                    >
                      <Eye size={14} />
                      View
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Additional Documents (not in the required list) */}
      {documents.filter((d) => !REQUIRED_DOCS.some((rd) => rd.type === d.document_type)).length > 0 && (
        <div className="eaw-card">
          <h3 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-4 pb-2 border-b border-eaw-border">
            Additional Documents
          </h3>
          <div className="space-y-3">
            {documents
              .filter((d) => !REQUIRED_DOCS.some((rd) => rd.type === d.document_type))
              .map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                    {docTypeIcon(doc.document_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-eaw-font truncate">
                        {doc.title}
                      </span>
                      <DocumentStatusBadge status={doc.status} />
                    </div>
                    <div className="text-xs text-eaw-muted mt-0.5">
                      {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenEditor(doc.id)}
                    className="btn-secondary"
                  >
                    <Eye size={14} />
                    View
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Document Editor Modal */}
      {editingDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-eaw-border flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-eaw-font">
                  {editingDoc.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <DocumentStatusBadge status={editingDoc.status} />
                  {editingDoc.ai_generated && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                      <Wand2 size={10} />
                      Auto-generated
                    </span>
                  )}
                  <span className="text-xs text-eaw-muted">
                    Updated: {formatDate(editingDoc.updated_at)}
                  </span>
                </div>
              </div>
              <button
                onClick={handleCloseEditor}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              >
                <X size={20} className="text-eaw-muted" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="input-field w-full font-mono text-sm leading-relaxed resize-none"
                rows={20}
                style={{ minHeight: '400px' }}
                readOnly={editingDoc.status === 'complete'}
                placeholder="Document content (markdown)..."
              />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-eaw-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                {editingDoc.status === 'drafting' && (
                  <button
                    onClick={() => handleStatusChange(editingDoc.id, 'review')}
                    className="btn-primary"
                  >
                    <Send size={14} />
                    Submit for Review
                  </button>
                )}
                {editingDoc.status === 'review' && (
                  <>
                    <button
                      onClick={() => handleStatusChange(editingDoc.id, 'drafting')}
                      className="btn-secondary"
                    >
                      <Edit3 size={14} />
                      Return to Drafting
                    </button>
                    <button
                      onClick={() => handleStatusChange(editingDoc.id, 'complete')}
                      className="btn-success"
                    >
                      <CheckCircle2 size={14} />
                      Mark Complete
                    </button>
                  </>
                )}
                {editingDoc.status === 'complete' && (
                  <span className="text-sm text-eaw-muted flex items-center gap-1.5">
                    <Lock size={14} />
                    Document is finalized (read-only)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleCloseEditor} className="btn-secondary">
                  Close
                </button>
                {editingDoc.status !== 'complete' && (
                  <button
                    onClick={handleSaveContent}
                    disabled={saving}
                    className="btn-success"
                  >
                    {saving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    Save
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Activity Tab ─────────────────────────────────────────────────────── */

function ActivityTab({ activities }: { activities: ActivityLog[] }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="eaw-card">
        <p className="text-sm text-eaw-muted text-center py-8">
          No activity recorded yet.
        </p>
      </div>
    );
  }

  const sorted = [...activities].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="eaw-card">
      <div className="space-y-0">
        {sorted.map((activity, idx) => (
          <div
            key={activity.id}
            className={`flex items-start gap-3 py-3 ${
              idx < sorted.length - 1 ? 'border-b border-eaw-border-light' : ''
            }`}
          >
            <div className="mt-0.5 p-1.5 bg-gray-50 rounded">
              {activityIcon(activity.activity_type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-eaw-font">{activity.description}</p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-eaw-muted">
                <span>{activity.actor}</span>
                <ChevronRight size={12} />
                <span>{formatRelativeDate(activity.created_at)}</span>
              </div>
              {(activity.old_value || activity.new_value) && (
                <div className="mt-1 text-xs">
                  {activity.old_value && (
                    <span className="text-eaw-danger line-through mr-2">
                      {activity.old_value}
                    </span>
                  )}
                  {activity.new_value && (
                    <span className="text-eaw-success">{activity.new_value}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Comments Tab ─────────────────────────────────────────────────────── */

function CommentsTab({ comments, requestId, onRefresh }: { comments: Comment[]; requestId: number; onRefresh: () => void }) {
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  const handlePost = async () => {
    const content = newComment.trim();
    if (!content) return;

    setPosting(true);
    setPostError('');
    try {
      await commentsApi.create(requestId, content, isInternal);
      setNewComment('');
      setIsInternal(false);
      onRefresh();
    } catch (err: any) {
      setPostError(err?.response?.data?.error || 'Failed to post comment.');
    } finally {
      setPosting(false);
    }
  };

  const sorted = comments && comments.length > 0
    ? [...comments].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    : [];

  return (
    <div className="space-y-4">
      {/* Comment Input Form */}
      <div className="eaw-card">
        <h3 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-3 pb-2 border-b border-eaw-border">
          Post a Comment
        </h3>

        {postError && (
          <div className="mb-3 flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>{postError}</span>
          </div>
        )}

        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          rows={3}
          className="input-field w-full text-sm resize-y mb-3"
          disabled={posting}
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-eaw-muted cursor-pointer">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="rounded border-gray-300"
              disabled={posting}
            />
            Internal (visible only to staff)
          </label>
          <button
            onClick={handlePost}
            disabled={posting || !newComment.trim()}
            className="btn-primary"
          >
            {posting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            Post Comment
          </button>
        </div>
      </div>

      {/* Comments List */}
      {sorted.length === 0 ? (
        <div className="eaw-card">
          <p className="text-sm text-eaw-muted text-center py-8">
            No comments yet.
          </p>
        </div>
      ) : (
        <div className="eaw-card">
          <div className="space-y-4">
            {sorted.map((comment) => (
              <div key={comment.id} className="border-b border-eaw-border-light pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 bg-eaw-primary/10 text-eaw-primary rounded-full flex items-center justify-center">
                    <User size={14} />
                  </div>
                  <span className="text-sm font-medium text-eaw-font">
                    {comment.author}
                  </span>
                  <span className="text-xs text-eaw-muted">
                    {formatRelativeDate(comment.created_at)}
                  </span>
                  {comment.is_internal && (
                    <span className="badge-warning text-[10px]">Internal</span>
                  )}
                </div>
                <p className="text-sm text-eaw-font leading-relaxed pl-9 whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
