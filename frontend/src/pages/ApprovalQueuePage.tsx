import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  Clock,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { approvalsApi, type QueueItem } from '@/api/approvals';
import { useAuthStore } from '@/store/authStore';
import {
  RequestStatusBadge,
  PriorityBadge,
  ApprovalStepBadge,
} from '@/components/common/StatusBadge';
import type { RequestStatus, Priority } from '@/types';

const CATEGORY_LABELS: Record<string, string> = {
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

function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

export default function ApprovalQueuePage() {
  const navigate = useNavigate();
  const userRole = useAuthStore((s) => s.user?.role);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, string>>({});

  const fetchQueue = () => {
    setLoading(true);
    setError('');
    approvalsApi
      .getQueue()
      .then(setQueue)
      .catch((err: any) => {
        setError(err?.response?.data?.error || 'Failed to load approval queue.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleAction = async (stepId: number, action: string) => {
    const comment = comments[stepId]?.trim() || '';

    if ((action === 'reject' || action === 'return') && !comment) {
      setError('Comments are required when rejecting or returning a request.');
      return;
    }

    setActionLoading(stepId);
    setError('');
    try {
      await approvalsApi.processStep(stepId, action, comment || undefined);
      setComments((prev) => {
        const next = { ...prev };
        delete next[stepId];
        return next;
      });
      fetchQueue();
    } catch (err: any) {
      setError(err?.response?.data?.error || `Failed to ${action} step.`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <ClipboardCheck size={24} className="text-eaw-primary" />
        <div>
          <h1 className="text-xl font-bold text-eaw-font">My Approval Queue</h1>
          <p className="text-sm text-eaw-muted">
            Requests awaiting your review and approval
          </p>
        </div>
      </div>

      {/* Role Note */}
      {userRole && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
          <Clock size={16} className="flex-shrink-0" />
          <span>
            You are viewing items for your role: <strong>{userRole}</strong>
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-eaw-primary" />
          <span className="ml-2 text-sm text-eaw-muted">Loading approval queue...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && queue.length === 0 && !error && (
        <div className="eaw-card">
          <div className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 size={48} className="text-green-300 mb-4" />
            <p className="text-lg font-medium text-eaw-font mb-1">
              No items in your approval queue
            </p>
            <p className="text-sm text-eaw-muted">
              All caught up! There are no requests awaiting your approval.
            </p>
          </div>
        </div>
      )}

      {/* Queue Items */}
      {!loading && queue.length > 0 && (
        <div className="space-y-4">
          {queue.map((item) => {
            const stepOverdue = item.step.status === 'active' && isOverdue(item.step.due_date);
            const stepId = item.step.id;
            const isProcessing = actionLoading === stepId;

            return (
              <div
                key={stepId}
                className={`eaw-card ${stepOverdue ? 'ring-1 ring-red-300' : ''}`}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <button
                        onClick={() => navigate(`/requests/${item.request.id}`)}
                        className="font-mono text-sm text-eaw-primary hover:underline"
                      >
                        {item.request.request_number}
                      </button>
                      <RequestStatusBadge status={item.request.status as RequestStatus} />
                      <PriorityBadge priority={item.request.priority as Priority} />
                      {stepOverdue && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                          <AlertTriangle size={12} />
                          Overdue
                        </span>
                      )}
                    </div>
                    <h3
                      className="text-base font-semibold text-eaw-font cursor-pointer hover:text-eaw-primary transition-colors"
                      onClick={() => navigate(`/requests/${item.request.id}`)}
                    >
                      {item.request.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => navigate(`/requests/${item.request.id}`)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0 ml-2"
                    title="View request details"
                  >
                    <ChevronRight size={18} className="text-eaw-muted" />
                  </button>
                </div>

                {/* Info Row */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-eaw-muted mb-3">
                  <span>
                    Category: {CATEGORY_LABELS[item.request.category] || item.request.category}
                  </span>
                  <span>
                    Estimated: {formatCurrency(item.request.estimated_total)}
                  </span>
                  <span>Requestor: {item.request.requestor_name}</span>
                </div>

                {/* Step Info */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mb-4 p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-1.5">
                    <ClipboardCheck size={14} className="text-eaw-muted" />
                    <span className="font-medium text-eaw-font">{item.step.step_name}</span>
                    <ApprovalStepBadge status={item.step.status} />
                  </div>
                  {item.step.due_date && (
                    <div
                      className={`flex items-center gap-1 ${
                        stepOverdue ? 'text-red-600 font-medium' : 'text-eaw-muted'
                      }`}
                    >
                      <Clock size={14} />
                      <span>
                        SLA Due: {formatDate(item.step.due_date)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Comments Field */}
                <div className="mb-3">
                  <textarea
                    value={comments[stepId] || ''}
                    onChange={(e) =>
                      setComments((prev) => ({ ...prev, [stepId]: e.target.value }))
                    }
                    placeholder="Add comments (required for reject/return)..."
                    rows={2}
                    className="input-field text-sm resize-none w-full"
                    disabled={isProcessing}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAction(stepId, 'approve')}
                    disabled={isProcessing}
                    className="btn-success"
                  >
                    {isProcessing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(stepId, 'return')}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-yellow-400 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RotateCcw size={16} />
                    )}
                    Return
                  </button>
                  <button
                    onClick={() => handleAction(stepId, 'reject')}
                    disabled={isProcessing}
                    className="btn-danger"
                  >
                    {isProcessing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <XCircle size={16} />
                    )}
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
