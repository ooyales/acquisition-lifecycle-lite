import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { executionApi } from '../api/execution';
import { requestsApi } from '../api/requests';
import { clinsApi } from '../api/clins';
import ODCForm from '../components/execution/ODCForm';
import TravelForm from '../components/execution/TravelForm';
import type { AcquisitionRequest, AcquisitionCLIN } from '../types';

export default function ExecutionCreatePage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<AcquisitionRequest[]>([]);
  const [clins, setClins] = useState<AcquisitionCLIN[]>([]);
  const [selectedRequest, setSelectedRequest] = useState('');
  const [selectedClin, setSelectedClin] = useState('');
  const [execType, setExecType] = useState('odc');
  const [description, setDescription] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Load awarded and approved requests — those have active contracts to execute against
    Promise.all([
      requestsApi.list({ status: 'awarded', per_page: '100' }),
      requestsApi.list({ status: 'approved', per_page: '100' }),
    ]).then(([d1, d2]) => {
      const r1 = Array.isArray(d1) ? d1 : d1.requests || [];
      const r2 = Array.isArray(d2) ? d2 : d2.requests || [];
      setRequests([...r1, ...r2]);
    });
  }, []);

  useEffect(() => {
    if (selectedRequest) {
      clinsApi.forRequest(Number(selectedRequest)).then(data => {
        setClins(Array.isArray(data) ? data : data.clins || []);
      });
    }
  }, [selectedRequest]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const computeAmount = (): number => {
    if (execType === 'odc') {
      return (parseFloat(form.quantity || '1') * parseFloat(form.unit_price || '0'));
    }
    return (parseFloat(form.airfare_estimate || '0') +
            parseFloat(form.lodging_estimate || '0') +
            parseFloat(form.per_diem_estimate || '0') +
            parseFloat(form.other_travel_costs || '0'));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        contract_id: Number(selectedRequest),
        clin_id: Number(selectedClin),
        execution_type: execType,
        title: description || `${execType === 'travel' ? 'Travel' : 'ODC'} Request`,
        description,
        estimated_cost: computeAmount(),
        ...Object.fromEntries(
          Object.entries(form).map(([k, v]) => {
            // Map frontend form fields to backend field names
            const prefix = execType === 'travel' ? 'travel_' : 'odc_';
            if (['traveler_name', 'destination', 'departure_date', 'return_date', 'purpose', 'conference_event'].includes(k)) return [`travel_${k}`, v];
            if (['airfare_estimate', 'lodging_estimate', 'per_diem_estimate', 'other_travel_costs'].includes(k)) {
              const mapped: Record<string, string> = { airfare_estimate: 'travel_airfare', lodging_estimate: 'travel_lodging', per_diem_estimate: 'travel_per_diem', other_travel_costs: 'travel_other_costs' };
              return [mapped[k], parseFloat(v) || 0];
            }
            if (['product_name', 'vendor', 'quote_reference'].includes(k)) return [`odc_${k}`, v];
            if (['quantity', 'unit_price'].includes(k)) return [k, parseFloat(v) || 0];
            return [k, v];
          })
        ),
      };
      const result = await executionApi.create(payload);
      navigate(`/execution/${result.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create execution request');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/execution')} className="p-1 hover:bg-gray-200 rounded">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">New Execution Request</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded px-3 py-2 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Acquisition Request</label>
            <select className="select-field" value={selectedRequest}
              onChange={e => setSelectedRequest(e.target.value)}>
              <option value="">Select request...</option>
              {requests.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CLIN</label>
            <select className="select-field" value={selectedClin}
              onChange={e => setSelectedClin(e.target.value)} disabled={!selectedRequest}>
              <option value="">Select CLIN...</option>
              {clins.map(c => (
                <option key={c.id} value={c.id}>
                  {c.clin_number} — ${(c.clin_available || 0).toLocaleString()} avail
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Execution Type</label>
          <div className="flex gap-3">
            {[
              { value: 'odc', label: 'ODC (Other Direct Cost)' },
              { value: 'travel', label: 'Travel' },
            ].map(opt => (
              <button key={opt.value} onClick={() => { setExecType(opt.value); setForm({}); }}
                className={`px-4 py-2 rounded border text-sm ${
                  execType === opt.value
                    ? 'border-eaw-primary bg-eaw-primary/5 font-medium'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>{opt.label}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input className="input-field" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Brief description of the execution request" />
        </div>

        {execType === 'odc' ? (
          <ODCForm form={form} onChange={handleChange} />
        ) : (
          <TravelForm form={form} onChange={handleChange} />
        )}

        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <span className="text-sm text-gray-500">
            Estimated amount: <span className="font-medium">${computeAmount().toLocaleString()}</span>
          </span>
          <button onClick={handleSubmit} disabled={submitting || !selectedRequest || !selectedClin}
            className="btn-primary flex items-center gap-2">
            <Send size={16} /> {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
