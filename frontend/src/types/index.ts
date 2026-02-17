// --- Interfaces ---
export interface User {
  id: number;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
}

export interface AcquisitionRequest {
  id: number;
  title: string;
  description: string | null;
  status: string;
  // Intake answers (individual columns)
  need_type: string | null;
  need_sub_type: string | null;
  buy_category: string | null;
  predominant_element: string | null;
  estimated_value: number;
  vendor_known: string | null;
  existing_vehicle: string | null;
  justification_summary: string | null;
  // Derived classification
  acquisition_type: string | null;
  tier: string | null;
  pipeline: string | null;
  contract_character: string | null;
  // Existing contract
  existing_contract_number: string | null;
  existing_contractor_name: string | null;
  existing_contract_end: string | null;
  // Advisory status (denormalized)
  scrm_status: string | null;
  sbo_status: string | null;
  cio_status: string | null;
  section508_status: string | null;
  fm_status: string | null;
  // Post-award
  awarded_date: string | null;
  awarded_vendor: string | null;
  awarded_amount: number | null;
  // Timestamps
  created_at: string | null;
  updated_at: string | null;
  // Relations
  requestor?: { id: number; display_name: string };
  clins?: AcquisitionCLIN[];
  documents?: PackageDocument[];
  approval_steps?: ApprovalStep[];
  advisory_inputs?: AdvisoryInput[];
}

export interface AcquisitionCLIN {
  id: number;
  request_id: number;
  clin_number: string;
  description: string | null;
  clin_type: string | null;
  psc_code: string | null;
  loa_id: number | null;
  contract_type: string | null;
  severability: string | null;
  clin_ceiling: number;
  clin_obligated: number;
  clin_invoiced: number;
  clin_pending: number;
  clin_available: number;
  clin_status: string;
}

export interface PackageDocument {
  id: number;
  request_id: number;
  template_id: number | null;
  template?: DocumentTemplate;
  status: string;
  is_required: boolean;
  was_required: boolean;
  content: string | null;
  notes: string | null;
}

export interface DocumentTemplate {
  id: number;
  name: string;
  doc_type: string;
  category: string | null;
  required_before_gate: string | null;
  ai_assistable: boolean;
}

export interface ApprovalStep {
  id: number;
  request_id: number;
  step_number: number;
  gate_name: string;
  approver_role: string;
  status: string;
  comments: string | null;
  assigned_at: string | null;
  decided_at: string | null;
  sla_days: number;
  is_overdue: boolean;
}

export interface AdvisoryInput {
  id: number;
  request_id: number;
  team: string;
  status: string;
  findings: string | null;
  recommendation: string | null;
  impacts_strategy: boolean;
  blocks_gate: string | null;
  assigned_at: string | null;
  completed_at: string | null;
}

export interface Notification {
  id: number;
  user_id: number;
  request_id: number | null;
  notification_type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string | null;
}

export interface LineOfAccounting {
  id: number;
  fund_code: string;
  appropriation: string | null;
  fiscal_year: string;
  display_name: string;
  description: string | null;
  total_amount: number;
  total_allocation: number;
  projected_amount: number;
  committed_amount: number;
  obligated_amount: number;
  available_balance: number;
  uncommitted_balance: number;
  fund_type: string | null;
  status: string;
}

export interface PSCCode {
  id: number;
  code: string;
  title: string;
  category: string | null;
  service_or_product: string | null;
  is_it_related: boolean;
  sb_availability: string | null;
}

export interface DemandForecast {
  id: number;
  title: string;
  source: string;
  estimated_value: number;
  need_by_date: string | null;
  suggested_loa_id: number | null;
  status: string;
  linked_request_id: number | null;
  created_at: string | null;
}

export interface CLINExecutionRequest {
  id: number;
  request_id: number;
  clin_id: number;
  execution_type: string;
  description: string | null;
  requested_amount: number;
  status: string;
  // ODC fields
  product_name: string | null;
  vendor: string | null;
  quantity: number | null;
  unit_price: number | null;
  quote_reference: string | null;
  // Travel fields
  traveler_name: string | null;
  destination: string | null;
  departure_date: string | null;
  return_date: string | null;
  airfare_estimate: number | null;
  lodging_estimate: number | null;
  per_diem_estimate: number | null;
  other_travel_costs: number | null;
  airfare_actual: number | null;
  lodging_actual: number | null;
  per_diem_actual: number | null;
  travel_total_estimate: number | null;
  cost_variance: number | null;
  // Invoice
  invoice_number: string | null;
  invoice_amount: number | null;
  invoice_date: string | null;
  // Approval
  pm_approved_at: string | null;
  cto_approved_at: string | null;
  created_at: string;
}

export interface PerDiemRate {
  id: number;
  location: string;
  state: string | null;
  lodging_rate: number;
  mie_rate: number;
}

export interface ApprovalTemplate {
  id: number;
  pipeline_type: string;
  steps: { step_number: number; gate_name: string; approver_role: string; sla_days: number }[];
}

export interface DerivationResult {
  derived_acquisition_type: string;
  derived_tier: string;
  derived_pipeline: string;
  derived_contract_character: string;
  derived_requirements_doc_type?: string;
  derived_scls_applicable?: boolean;
  derived_qasp_required?: boolean;
  derived_eval_approach?: string;
  urgency_flag?: boolean;
  market_research_pending?: boolean;
  approval_template_key?: string;
  doc_template_set?: string;
  advisory_triggers?: string;
  matched_path_id?: string;
}

export interface IntakeOption {
  value: string;
  label: string;
  description?: string;
}

export interface IntakeOptions {
  q1_options: IntakeOption[];
  q2_options: Record<string, IntakeOption[]>;
  buy_category_options: IntakeOption[];
  vendor_options: IntakeOption[];
  paths_count: number;
}

// --- Label Maps ---
export const ACQUISITION_TYPE_LABELS: Record<string, string> = {
  new_competitive: 'New Competitive',
  brand_name_sole_source: 'Brand Name / Sole Source',
  follow_on_sole_source: 'Follow-On Sole Source',
  option_exercise: 'Option Exercise',
  recompete: 'Re-Compete',
  bridge_extension: 'Bridge / Extension',
  bilateral_mod: 'Bilateral Modification',
  unilateral_mod: 'Unilateral Modification',
  clin_reallocation: 'CLIN Reallocation',
  clin_execution_odc: 'CLIN Execution — ODC',
  clin_execution_travel: 'CLIN Execution — Travel',
  clin_execution_funding: 'CLIN Execution + Funding',
  new_competitive_urgency: 'New Competitive (Urgency)',
  gsa_order: 'GSA Schedule Order',
  gwac_order: 'GWAC Order',
  bpa_call: 'BPA Call',
  idiq_order: 'IDIQ Order',
};

export const TIER_LABELS: Record<string, string> = {
  micro: 'Micro-Purchase',
  sat: 'Simplified (SAT)',
  above_sat: 'Above SAT',
  major: 'Major Acquisition',
};

export const PIPELINE_LABELS: Record<string, string> = {
  full: 'Full Pipeline',
  abbreviated: 'Abbreviated',
  ko_only: 'KO-Only',
  ko_abbreviated: 'KO-Abbreviated',
  clin_execution: 'CLIN Execution',
  clin_exec_funding: 'CLIN Exec + Funding',
  micro: 'Micro-Purchase',
};

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  intake_complete: 'Intake Complete',
  iss_review: 'ISS Review',
  asr_review: 'ASR Review',
  finance_review: 'Finance Review',
  ko_review: 'KO Review',
  legal_review: 'Legal Review',
  cio_approval: 'CIO Approval',
  senior_review: 'Senior Leadership',
  advisory_review: 'Advisory Review',
  approval_pending: 'Approval Pending',
  approved: 'Approved',
  returned: 'Returned',
  awarded: 'Awarded',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const ADVISORY_LABELS: Record<string, string> = {
  scrm: 'SCRM',
  sbo: 'Small Business',
  cio: 'CIO / IT Gov',
  section508: 'Section 508',
  fedramp: 'FedRAMP',
  fm: 'Budget/FM',
};

export const BUY_CATEGORY_LABELS: Record<string, string> = {
  product: 'Product',
  service: 'Service',
  software_license: 'Software / License',
  mixed: 'Mixed',
};

export const EXECUTION_TYPE_LABELS: Record<string, string> = {
  odc: 'ODC (HW/SW)',
  travel: 'Travel',
};

export const SEVERABILITY_LABELS: Record<string, string> = {
  severable: 'Severable',
  non_severable: 'Non-Severable',
};
