import type { RequestStatus, Priority } from '@/types';

// ── Request Status Badge ─────────────────────────────────────────────

const statusBadgeMap: Record<RequestStatus, string> = {
  draft: 'badge-muted',
  submitted: 'badge-info',
  in_review: 'badge-warning',
  approved: 'badge-success',
  package_building: 'badge-info',
  submitted_to_contracting: 'badge-info',
  awarded: 'badge-success',
  delivered: 'badge-success',
  closed: 'badge-muted',
  cancelled: 'badge-danger',
  returned: 'badge-danger',
};

const statusLabelMap: Record<RequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  in_review: 'In Review',
  approved: 'Approved',
  package_building: 'Package Building',
  submitted_to_contracting: 'Submitted to Contracting',
  awarded: 'Awarded',
  delivered: 'Delivered',
  closed: 'Closed',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

interface RequestStatusBadgeProps {
  status: RequestStatus;
}

export function RequestStatusBadge({ status }: RequestStatusBadgeProps) {
  const badgeClass = statusBadgeMap[status] || 'badge-muted';
  const label = statusLabelMap[status] || status;
  return <span className={badgeClass}>{label}</span>;
}

// ── Priority Badge ───────────────────────────────────────────────────

const priorityBadgeMap: Record<Priority, string> = {
  critical: 'badge-danger',
  high: 'badge-warning',
  medium: 'badge-info',
  low: 'badge-muted',
};

const priorityLabelMap: Record<Priority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

interface PriorityBadgeProps {
  priority: Priority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const badgeClass = priorityBadgeMap[priority] || 'badge-muted';
  const label = priorityLabelMap[priority] || priority;
  return <span className={badgeClass}>{label}</span>;
}

// ── Approval Step Status Badge ───────────────────────────────────────

type ApprovalStepStatus = 'pending' | 'active' | 'approved' | 'rejected' | 'returned' | 'skipped';

const approvalStepBadgeMap: Record<ApprovalStepStatus, string> = {
  pending: 'badge-muted',
  active: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-danger',
  returned: 'badge-danger',
  skipped: 'badge-muted',
};

const approvalStepLabelMap: Record<ApprovalStepStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  approved: 'Approved',
  rejected: 'Rejected',
  returned: 'Returned',
  skipped: 'Skipped',
};

interface ApprovalStepBadgeProps {
  status: ApprovalStepStatus;
}

export function ApprovalStepBadge({ status }: ApprovalStepBadgeProps) {
  const badgeClass = approvalStepBadgeMap[status] || 'badge-muted';
  const label = approvalStepLabelMap[status] || status;
  return <span className={badgeClass}>{label}</span>;
}

// ── Document Status Badge ────────────────────────────────────────────

type DocumentStatus = 'not_started' | 'drafting' | 'review' | 'complete' | 'not_required';

const documentBadgeMap: Record<DocumentStatus, string> = {
  not_started: 'badge-muted',
  drafting: 'badge-info',
  review: 'badge-warning',
  complete: 'badge-success',
  not_required: 'badge-muted',
};

const documentLabelMap: Record<DocumentStatus, string> = {
  not_started: 'Not Started',
  drafting: 'Drafting',
  review: 'In Review',
  complete: 'Complete',
  not_required: 'Not Required',
};

interface DocumentStatusBadgeProps {
  status: DocumentStatus;
}

export function DocumentStatusBadge({ status }: DocumentStatusBadgeProps) {
  const badgeClass = documentBadgeMap[status] || 'badge-muted';
  const label = documentLabelMap[status] || status;
  return <span className={badgeClass}>{label}</span>;
}

// ── Lifecycle Event Status Badge ─────────────────────────────────────

type LifecycleStatus = 'upcoming' | 'action_needed' | 'in_progress' | 'acquisition_created' | 'completed';

const lifecycleBadgeMap: Record<LifecycleStatus, string> = {
  upcoming: 'badge-info',
  action_needed: 'badge-danger',
  in_progress: 'badge-warning',
  acquisition_created: 'badge-success',
  completed: 'badge-muted',
};

const lifecycleLabelMap: Record<LifecycleStatus, string> = {
  upcoming: 'Upcoming',
  action_needed: 'Action Needed',
  in_progress: 'In Progress',
  acquisition_created: 'Acquisition Created',
  completed: 'Completed',
};

interface LifecycleStatusBadgeProps {
  status: LifecycleStatus;
}

export function LifecycleStatusBadge({ status }: LifecycleStatusBadgeProps) {
  const badgeClass = lifecycleBadgeMap[status] || 'badge-muted';
  const label = lifecycleLabelMap[status] || status;
  return <span className={badgeClass}>{label}</span>;
}
