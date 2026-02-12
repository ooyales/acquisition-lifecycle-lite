// ── Auth ──────────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  team: string;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setAuth: (token: string, user: User) => void;
}

// ── Acquisition Request ──────────────────────────────────────────────

export interface AcquisitionRequest {
  id: number;
  request_number: string;
  title: string;
  description: string;
  category: RequestCategory;
  sub_category: string;
  justification: string;
  trigger_type: string;
  trigger_asset_id: string | null;
  estimated_total: number;
  cost_breakdown: Record<string, any>;
  funding_source_id: number | null;
  fiscal_year: string;
  priority: Priority;
  need_by_date: string | null;
  contract_end_date: string | null;
  requestor_id: number;
  requestor_name: string;
  requestor_org: string;
  cor_id: number | null;
  status: RequestStatus;
  current_approval_step: number;
  vendor_name: string | null;
  product_name: string | null;
  product_specs: Record<string, any>;
  quantity: number | null;
  existing_contract_number: string | null;
  existing_contract_value: number | null;
  existing_vendor: string | null;
  contract_vehicle: string | null;
  awarded_date: string | null;
  awarded_vendor: string | null;
  awarded_amount: number | null;
  po_number: string | null;
  delivery_date: string | null;
  received_date: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
  notes: string | null;
}

export type RequestCategory =
  | 'hardware_purchase'
  | 'software_license'
  | 'service_contract'
  | 'cloud_service'
  | 'maintenance_support'
  | 'other';

export type RequestStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'package_building'
  | 'submitted_to_contracting'
  | 'awarded'
  | 'delivered'
  | 'closed'
  | 'cancelled'
  | 'returned';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

// ── Approval ─────────────────────────────────────────────────────────

export interface ApprovalStep {
  id: number;
  request_id: number;
  step_number: number;
  step_name: string;
  approver_role: string;
  approver_name: string | null;
  status: 'pending' | 'active' | 'approved' | 'rejected' | 'returned' | 'skipped';
  acted_on_date: string | null;
  action_by: string | null;
  comments: string | null;
  conditions: string | null;
  activated_at: string | null;
  due_date: string | null;
}

export interface ApprovalTemplate {
  id: number;
  name: string;
  description: string;
  steps: ApprovalTemplateStep[];
}

export interface ApprovalTemplateStep {
  id: number;
  step_number: number;
  step_name: string;
  approver_role: string;
  sla_days: number;
}

// ── Documents ────────────────────────────────────────────────────────

export interface PackageDocument {
  id: number;
  request_id: number;
  document_type: string;
  title: string;
  status: 'not_started' | 'drafting' | 'review' | 'complete' | 'not_required';
  content: string | null;
  ai_generated: boolean;
  assigned_to: string | null;
  due_date: string | null;
  completed_date: string | null;
  created_at: string;
  updated_at: string;
}

// ── Funding ──────────────────────────────────────────────────────────

export interface FundingSource {
  id: number;
  name: string;
  fiscal_year: string;
  total_budget: number;
  committed: number;
  spent: number;
  available: number;
  funding_type: string;
  owner: string;
  notes: string | null;
}

// ── Lifecycle ────────────────────────────────────────────────────────

export interface LifecycleEvent {
  id: number;
  asset_tracker_id: string | null;
  asset_name: string;
  event_type: string;
  event_date: string;
  lead_time_days: number;
  action_needed: string;
  estimated_cost: number;
  status: 'upcoming' | 'action_needed' | 'in_progress' | 'acquisition_created' | 'completed';
  acquisition_request_id: number | null;
  fiscal_year_impact: string;
  notes: string | null;
}

// ── Activity & Comments ──────────────────────────────────────────────

export interface ActivityLog {
  id: number;
  request_id: number;
  activity_type: string;
  description: string;
  actor: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface Comment {
  id: number;
  request_id: number;
  author: string;
  content: string;
  is_internal: boolean;
  approval_step_id: number | null;
  created_at: string;
}

// ── Prior Acquisitions ───────────────────────────────────────────────

export interface PriorAcquisition {
  id: number;
  description: string;
  vendor: string;
  product_category: string;
  unit_cost: number | null;
  total_cost: number;
  quantity: number;
  award_date: string;
  contract_number: string;
  contract_vehicle: string;
}

// ── Dashboard ────────────────────────────────────────────────────────

export interface DashboardData {
  active_requests: number;
  pending_approvals: number;
  total_committed: number;
  overdue_steps: number;
  pipeline: { status: string; count: number }[];
  approval_queue: {
    id: number;
    request_number: string;
    title: string;
    step_name: string;
    due_date: string | null;
    priority?: Priority;
  }[];
  budget_summary: {
    name: string;
    total: number;
    committed: number;
    spent: number;
    available: number;
  }[];
  lifecycle_alerts: {
    id: number;
    asset_name: string;
    event_type: string;
    event_date: string;
    status: string;
    estimated_cost?: number;
  }[];
  recent_activity: {
    id: number;
    activity_type: string;
    description: string;
    actor: string;
    created_at: string;
  }[];
}
