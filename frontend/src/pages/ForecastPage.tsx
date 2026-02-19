import { useEffect, useState } from 'react';
import { TrendingUp, Plus, FileText, Pencil, Trash2, Save, X } from 'lucide-react';
import { forecastsApi } from '../api/forecasts';
import StatusBadge from '../components/common/StatusBadge';

interface Forecast {
  id: number;
  title: string;
  source: string;
  estimated_value: number;
  need_by_date: string;
  suggested_loa_id: number | null;
  status: string;
  created_date: string;
  acquisition_request_id: number | null;
  contract_number: string | null;
  clin_number: string | null;
  color_of_money: string | null;
}

const COLOR_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'om', label: 'O&M' },
  { value: 'rdte', label: 'RDT&E' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'milcon', label: 'MILCON' },
  { value: 'working_capital', label: 'Working Capital' },
];

const COLOR_LABELS: Record<string, string> = {
  om: 'O&M', rdte: 'RDT&E', procurement: 'Procurement',
  milcon: 'MILCON', working_capital: 'Working Capital',
};

const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manual Entry' },
  { value: 'contract_expiration', label: 'Contract Expiration' },
  { value: 'option_year_due', label: 'Option Year Due' },
  { value: 'planned_refresh', label: 'Planned Refresh' },
  { value: 'technology_sunset', label: 'Technology Sunset' },
];

export default function ForecastPage() {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    title: '', source: 'manual', estimated_value: '', need_by_date: '',
    contract_number: '', clin_number: '', color_of_money: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  const loadForecasts = () => {
    forecastsApi.list().then(data => {
      setForecasts(Array.isArray(data) ? data : data.forecasts || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadForecasts(); }, []);

  const handleCreate = async () => {
    await forecastsApi.create({
      ...form,
      estimated_value: parseFloat(form.estimated_value) || 0,
      contract_number: form.contract_number || null,
      clin_number: form.clin_number || null,
      color_of_money: form.color_of_money || null,
    });
    setShowForm(false);
    setForm(emptyForm);
    loadForecasts();
  };

  const startEdit = (f: Forecast) => {
    setEditingId(f.id);
    setEditForm({
      title: f.title || '',
      source: f.source || 'manual',
      estimated_value: String(f.estimated_value || ''),
      need_by_date: f.need_by_date || '',
      contract_number: f.contract_number || '',
      clin_number: f.clin_number || '',
      color_of_money: f.color_of_money || '',
    });
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await forecastsApi.update(editingId, {
        title: editForm.title,
        source: editForm.source,
        estimated_value: parseFloat(editForm.estimated_value) || 0,
        need_by_date: editForm.need_by_date || null,
        contract_number: editForm.contract_number || null,
        clin_number: editForm.clin_number || null,
        color_of_money: editForm.color_of_money || null,
      });
      setEditingId(null);
      loadForecasts();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (f: Forecast) => {
    if (!window.confirm(`Delete forecast "${f.title}"? This cannot be undone.`)) return;
    try {
      await forecastsApi.delete(f.id);
      loadForecasts();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete forecast';
      alert(msg);
    }
  };

  const handleCreateRequest = async (id: number) => {
    await forecastsApi.createRequest(id);
    loadForecasts();
  };

  const inp = "w-full text-xs border border-gray-200 rounded px-2 py-1.5";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp size={24} className="text-eaw-primary" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Demand Forecasting</h1>
            <p className="text-sm text-gray-500">{forecasts.length} forecast items</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Forecast
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="font-medium">New Demand Forecast</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <input className={inp} placeholder="Title *" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <select className={inp} value={form.source}
              onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
              {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <input type="number" className={inp} placeholder="Estimated Value ($)"
              value={form.estimated_value}
              onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))} />
            <input type="date" className={inp} value={form.need_by_date}
              onChange={e => setForm(f => ({ ...f, need_by_date: e.target.value }))} />
            <input className={inp} placeholder="Contract #" value={form.contract_number}
              onChange={e => setForm(f => ({ ...f, contract_number: e.target.value }))} />
            <input className={inp} placeholder="CLIN #" value={form.clin_number}
              onChange={e => setForm(f => ({ ...f, clin_number: e.target.value }))} />
            <select className={inp} value={form.color_of_money}
              onChange={e => setForm(f => ({ ...f, color_of_money: e.target.value }))}>
              {COLOR_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label || 'Color of Money'}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn-primary text-sm">Create Forecast</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="eaw-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Source</th>
                <th>Contract #</th>
                <th>CLIN</th>
                <th>Color of Money</th>
                <th>Est. Value</th>
                <th>Need By</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {forecasts.map(f => (
                editingId === f.id ? (
                  <tr key={f.id} className="bg-blue-50/30">
                    <td>
                      <input className={inp} value={editForm.title}
                        onChange={e => setEditForm(ef => ({ ...ef, title: e.target.value }))} />
                    </td>
                    <td>
                      <select className={inp} value={editForm.source}
                        onChange={e => setEditForm(ef => ({ ...ef, source: e.target.value }))}>
                        {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <input className={inp} value={editForm.contract_number}
                        onChange={e => setEditForm(ef => ({ ...ef, contract_number: e.target.value }))} />
                    </td>
                    <td>
                      <input className={inp} value={editForm.clin_number}
                        onChange={e => setEditForm(ef => ({ ...ef, clin_number: e.target.value }))} />
                    </td>
                    <td>
                      <select className={inp} value={editForm.color_of_money}
                        onChange={e => setEditForm(ef => ({ ...ef, color_of_money: e.target.value }))}>
                        {COLOR_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="number" className={inp} value={editForm.estimated_value}
                        onChange={e => setEditForm(ef => ({ ...ef, estimated_value: e.target.value }))} />
                    </td>
                    <td>
                      <input type="date" className={inp} value={editForm.need_by_date}
                        onChange={e => setEditForm(ef => ({ ...ef, need_by_date: e.target.value }))} />
                    </td>
                    <td colSpan={2}>
                      <div className="flex items-center gap-1">
                        <button onClick={handleSave} disabled={saving}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded text-white"
                          style={{ backgroundColor: '#337ab7' }}>
                          <Save size={11} /> {saving ? '...' : 'Save'}
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="p-1 text-gray-400 hover:text-gray-600">
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={f.id}>
                    <td className="font-medium">{f.title}</td>
                    <td className="text-sm capitalize">{(f.source || '').replace(/_/g, ' ')}</td>
                    <td className="text-sm text-gray-600">{f.contract_number || '—'}</td>
                    <td className="text-sm text-gray-600">{f.clin_number || '—'}</td>
                    <td className="text-sm text-gray-600">{f.color_of_money ? (COLOR_LABELS[f.color_of_money] || f.color_of_money) : '—'}</td>
                    <td className="text-sm">${(f.estimated_value || 0).toLocaleString()}</td>
                    <td className="text-sm">{f.need_by_date || '—'}</td>
                    <td><StatusBadge status={f.status} /></td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(f)}
                          className="text-gray-400 hover:text-eaw-primary transition-colors" title="Edit">
                          <Pencil size={13} />
                        </button>
                        {!f.acquisition_request_id ? (
                          <button onClick={() => handleDelete(f)}
                            className="text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                            <Trash2 size={13} />
                          </button>
                        ) : null}
                        {f.status === 'forecasted' && !f.acquisition_request_id && (
                          <button onClick={() => handleCreateRequest(f.id)}
                            className="text-xs text-eaw-primary hover:underline flex items-center gap-1 ml-1">
                            <FileText size={11} /> Create Req
                          </button>
                        )}
                        {f.acquisition_request_id && (
                          <span className="text-xs text-gray-400 ml-1">Req #{f.acquisition_request_id}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
