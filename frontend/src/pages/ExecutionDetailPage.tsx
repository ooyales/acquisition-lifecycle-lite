import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, FileText, DollarSign, AlertTriangle, ExternalLink, Send } from 'lucide-react';
import { executionApi } from '../api/execution';
import StatusBadge from '../components/common/StatusBadge';
import { EXECUTION_TYPE_LABELS } from '../types';
import { useAuthStore } from '../store/authStore';

interface ExecDetail {
  id: number;
  request_id: number;
  contract_id: number;
  clin_id: number;
  execution_type: string;
  title: string;
  description: string;
  requested_amount: number;
  estimated_cost: number;
  status: string;
  product_name?: string;
  vendor?: string;
  quantity?: number;
  unit_price?: number;
  quote_reference?: string;
  traveler_name?: string;
  destination?: string;
  departure_date?: string;
  return_date?: string;
  airfare_estimate?: number;
  lodging_estimate?: number;
  per_diem_estimate?: number;
  other_travel_costs?: number;
  airfare_actual?: number;
  lodging_actual?: number;
  per_diem_actual?: number;
  travel_total_estimate?: number;
  cost_variance?: number;
  invoice_number?: string;
  invoice_amount?: number;
  invoice_date?: string;
  pm_approved_at?: string;
  cto_approved_at?: string;
  clin_number?: string;
  request_title?: string;
  created_at: string;
  // Funding fields
  funding_status?: string;
  funding_action_required?: boolean;
  funding_action_amount?: number;
  funding_request_id?: number;
}

export default function ExecutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [exec, setExec] = useState<ExecDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoiceForm, setInvoiceForm] = useState({ invoice_number: '', invoice_amount: '', invoice_date: '' });
  const [fundingLoading, setFundingLoading] = useState(false);

  const execId = Number(id);

  const loadData = () => {
    executionApi.get(execId).then(data => {
      setExec(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [execId]);

  const handleApprove = async (action: string) => {
    await executionApi.approve(execId, { role: user?.role || '', action, comments: '' });
    loadData();
  };

  const handleInvoice = async () => {
    await executionApi.invoice(execId, {
      invoice_number: invoiceForm.invoice_number,
      invoice_amount: parseFloat(invoiceForm.invoice_amount) || 0,
      invoice_date: invoiceForm.invoice_date,
    });
    loadData();
  };

  const handleValidate = async () => {
    await executionApi.validate(execId);
    loadData();
  };

  const handleSubmit = async () => {
    try {
      await executionApi.submit(execId);
      loadData();
    } catch {
      // handle error
    }
  };

  const handleRequestFunding = async () => {
    setFundingLoading(true);
    try {
      const result = await executionApi.requestFunding(execId);
      loadData();
      if (result.funding_request_id) {
        navigate(`/requests/${result.funding_request_id}`);
      }
    } catch {
      setFundingLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>;
  if (!exec) return <div className="text-center py-12 text-gray-500">Execution request not found</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/execution')} className="p-1 hover:bg-gray-200 rounded">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">
              {EXECUTION_TYPE_LABELS[exec.execution_type] || exec.execution_type} #{exec.id}
            </h1>
            <StatusBadge status={exec.status} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{exec.description}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Request</span>
            <p className="font-medium">{exec.request_title || `#${exec.contract_id || exec.request_id}`}</p>
          </div>
          <div>
            <span className="text-gray-500">CLIN</span>
            <p className="font-medium">{exec.clin_number || `#${exec.clin_id}`}</p>
          </div>
          <div>
            <span className="text-gray-500">Estimated Cost</span>
            <p className="font-medium">${(exec.estimated_cost || exec.requested_amount || 0).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-gray-500">Created</span>
            <p className="font-medium">{new Date(exec.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Type-specific details */}
        {exec.execution_type === 'odc' && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-sm mb-2">ODC Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-gray-500">Product</span><p className="font-medium">{exec.product_name || '—'}</p></div>
              <div><span className="text-gray-500">Vendor</span><p className="font-medium">{exec.vendor || '—'}</p></div>
              <div><span className="text-gray-500">Qty</span><p className="font-medium">{exec.quantity || '—'}</p></div>
              <div><span className="text-gray-500">Unit Price</span><p className="font-medium">${(exec.unit_price || 0).toLocaleString()}</p></div>
            </div>
          </div>
        )}

        {exec.execution_type === 'travel' && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-sm mb-2">Travel Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-gray-500">Traveler</span><p className="font-medium">{exec.traveler_name || '—'}</p></div>
              <div><span className="text-gray-500">Destination</span><p className="font-medium">{exec.destination || '—'}</p></div>
              <div><span className="text-gray-500">Departure</span><p className="font-medium">{exec.departure_date || '—'}</p></div>
              <div><span className="text-gray-500">Return</span><p className="font-medium">{exec.return_date || '—'}</p></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3">
              <div><span className="text-gray-500">Airfare</span><p className="font-medium">${(exec.airfare_estimate || 0).toLocaleString()}</p></div>
              <div><span className="text-gray-500">Lodging</span><p className="font-medium">${(exec.lodging_estimate || 0).toLocaleString()}</p></div>
              <div><span className="text-gray-500">Per Diem</span><p className="font-medium">${(exec.per_diem_estimate || 0).toLocaleString()}</p></div>
              <div><span className="text-gray-500">Other</span><p className="font-medium">${(exec.other_travel_costs || 0).toLocaleString()}</p></div>
            </div>
            {exec.cost_variance !== undefined && exec.cost_variance !== null && (
              <div className="mt-2 text-sm">
                <span className="text-gray-500">Variance: </span>
                <span className={exec.cost_variance > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                  ${exec.cost_variance.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Approval timeline */}
        <div className="space-y-2">
          <h3 className="font-medium text-sm">Approval Status</h3>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${exec.pm_approved_at ? 'bg-green-500' : 'bg-gray-300'}`}>
                {exec.pm_approved_at ? <Check size={10} className="text-white" /> : null}
              </div>
              <span>PM Approval</span>
              {exec.pm_approved_at && <span className="text-xs text-gray-400">{new Date(exec.pm_approved_at).toLocaleDateString()}</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${exec.cto_approved_at ? 'bg-green-500' : 'bg-gray-300'}`}>
                {exec.cto_approved_at ? <Check size={10} className="text-white" /> : null}
              </div>
              <span>CTO Approval</span>
              {exec.cto_approved_at && <span className="text-xs text-gray-400">{new Date(exec.cto_approved_at).toLocaleDateString()}</span>}
            </div>
          </div>
        </div>

        {/* Funding Status */}
        {exec.funding_status === 'sufficient' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
            <Check size={16} className="text-green-600" />
            <span className="text-sm text-green-800 font-medium">
              CLIN {exec.clin_number} has sufficient funds for this execution.
            </span>
          </div>
        )}

        {exec.funding_action_required && !exec.funding_request_id && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Insufficient CLIN Balance</p>
                <p className="text-sm text-amber-700 mt-1">
                  CLIN {exec.clin_number} does not have enough available funds to cover this
                  {' '}{exec.execution_type === 'travel' ? 'travel' : 'ODC'} request.
                  {exec.funding_action_amount != null && (
                    <> Shortfall: <span className="font-semibold">${exec.funding_action_amount.toLocaleString()}</span></>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={handleRequestFunding}
              disabled={fundingLoading}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              <DollarSign size={14} />
              {fundingLoading ? 'Creating funding request...' : 'Request Additional Funding'}
            </button>
            <p className="text-xs text-amber-600">
              This will create a pre-filled acquisition request for incremental funding that goes through the approval pipeline (KO, Budget/FM).
            </p>
          </div>
        )}

        {exec.funding_request_id && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-blue-600" />
              <span className="text-sm text-blue-800">
                <span className="font-medium">Funding action in progress</span>
                {exec.funding_action_amount != null && (
                  <> — ${exec.funding_action_amount.toLocaleString()} requested</>
                )}
              </span>
            </div>
            <button
              onClick={() => navigate(`/requests/${exec.funding_request_id}`)}
              className="text-sm text-blue-700 font-medium hover:underline flex items-center gap-1"
            >
              View Funding Request <ExternalLink size={12} />
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-gray-200">
          {exec.status === 'draft' && (
            <button onClick={handleSubmit} className="btn-primary text-sm flex items-center gap-1">
              <Send size={14} /> Submit for Approval
            </button>
          )}

          {exec.status === 'submitted' && ['admin', 'branch_chief', 'cto'].includes(user?.role || '') && (
            <>
              <button onClick={() => handleApprove('approve')} className="btn-success text-sm flex items-center gap-1">
                <Check size={14} /> Approve
              </button>
              <button onClick={() => handleApprove('reject')} className="btn-danger text-sm">
                Reject
              </button>
            </>
          )}

          {(exec.status === 'approved' || exec.status === 'authorized') && (
            <div className="flex items-end gap-3 flex-1">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Invoice #</label>
                <input className="input-field text-sm" value={invoiceForm.invoice_number}
                  onChange={e => setInvoiceForm(f => ({ ...f, invoice_number: e.target.value }))} />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Amount</label>
                <input type="number" className="input-field text-sm" value={invoiceForm.invoice_amount}
                  onChange={e => setInvoiceForm(f => ({ ...f, invoice_amount: e.target.value }))} />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input type="date" className="input-field text-sm" value={invoiceForm.invoice_date}
                  onChange={e => setInvoiceForm(f => ({ ...f, invoice_date: e.target.value }))} />
              </div>
              <button onClick={handleInvoice} className="btn-primary text-sm flex items-center gap-1">
                <FileText size={14} /> Submit Invoice
              </button>
            </div>
          )}

          {exec.status === 'invoiced' && ['admin', 'ko'].includes(user?.role || '') && (
            <button onClick={handleValidate} className="btn-success text-sm flex items-center gap-1">
              <DollarSign size={14} /> Validate & Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
