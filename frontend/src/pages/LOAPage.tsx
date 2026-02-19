import { useEffect, useState } from 'react';
import { DollarSign, Plus, AlertTriangle, Pencil, Trash2, Save, X } from 'lucide-react';
import { loaApi } from '../api/loa';
import StatusBadge from '../components/common/StatusBadge';

interface LOA {
  id: number;
  fund_code: string;
  appropriation: string | null;
  fiscal_year: string;
  description: string | null;
  display_name: string;
  total_amount: number;
  total_allocation: number;
  projected_amount: number;
  committed_amount: number;
  obligated_amount: number;
  available_balance: number;
  uncommitted_balance: number;
  fund_type: string | null;
  project: string | null;
  task: string | null;
  status: string;
}

const FUND_TYPES = [
  { value: '', label: 'Select...' },
  { value: 'om', label: 'O&M' },
  { value: 'rdte', label: 'RDT&E' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'milcon', label: 'MILCON' },
  { value: 'working_capital', label: 'Working Capital' },
];

const FUND_TYPE_LABELS: Record<string, string> = {
  om: 'O&M', rdte: 'RDT&E', procurement: 'Procurement',
  milcon: 'MILCON', working_capital: 'Working Capital',
};

export default function LOAPage() {
  const [loas, setLoas] = useState<LOA[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    fund_code: '', appropriation: '', fiscal_year: new Date().getFullYear().toString(),
    total_allocation: '', display_name: '', fund_type: '', project: '', task: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  const loadLoas = () => {
    loaApi.list().then(data => {
      setLoas(Array.isArray(data) ? data : data.loas || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadLoas(); }, []);

  const handleCreate = async () => {
    await loaApi.create({
      fund_code: form.fund_code,
      appropriation: form.appropriation,
      display_name: form.display_name || form.fund_code,
      total_allocation: parseFloat(form.total_allocation) || 0,
      fiscal_year: form.fiscal_year,
      fund_type: form.fund_type || null,
      project: form.project || null,
      task: form.task || null,
    });
    setShowForm(false);
    setForm(emptyForm);
    loadLoas();
  };

  const startEdit = (loa: LOA) => {
    setEditingId(loa.id);
    setEditForm({
      fund_code: loa.fund_code || '',
      appropriation: loa.appropriation || '',
      fiscal_year: loa.fiscal_year || '',
      total_allocation: String(loa.total_allocation || 0),
      display_name: loa.display_name || '',
      fund_type: loa.fund_type || '',
      project: loa.project || '',
      task: loa.task || '',
    });
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await loaApi.update(editingId, {
        fund_code: editForm.fund_code,
        appropriation: editForm.appropriation,
        display_name: editForm.display_name || editForm.fund_code,
        total_allocation: parseFloat(editForm.total_allocation) || 0,
        fiscal_year: editForm.fiscal_year,
        fund_type: editForm.fund_type || null,
        project: editForm.project || null,
        task: editForm.task || null,
      });
      setEditingId(null);
      loadLoas();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (loa: LOA) => {
    if (!window.confirm(`Delete LOA "${loa.display_name || loa.fund_code}"? This cannot be undone.`)) return;
    try {
      await loaApi.delete(loa.id);
      loadLoas();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete LOA';
      alert(msg);
    }
  };

  const healthColor = (loa: LOA) => {
    const avail = loa.available_balance || 0;
    const total = loa.total_amount || 1;
    const pct = avail / total;
    if (pct > 0.3) return 'bg-green-500';
    if (pct > 0.1) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const healthStatus = (loa: LOA) => {
    const avail = loa.available_balance || 0;
    const total = loa.total_amount || 1;
    const pct = avail / total;
    if (pct > 0.3) return 'healthy';
    if (pct > 0.1) return 'watch';
    return 'critical';
  };

  const inp = "w-full text-xs border border-gray-200 rounded px-2 py-1.5";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign size={24} className="text-eaw-primary" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lines of Accounting</h1>
            <p className="text-sm text-gray-500">{loas.length} LOAs</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add LOA
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="font-medium">New Line of Accounting</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input className={inp} placeholder="Fund Code *" value={form.fund_code}
              onChange={e => setForm(f => ({ ...f, fund_code: e.target.value }))} />
            <input className={inp} placeholder="Appropriation" value={form.appropriation}
              onChange={e => setForm(f => ({ ...f, appropriation: e.target.value }))} />
            <input className={inp} placeholder="Project" value={form.project}
              onChange={e => setForm(f => ({ ...f, project: e.target.value }))} />
            <input className={inp} placeholder="Task" value={form.task}
              onChange={e => setForm(f => ({ ...f, task: e.target.value }))} />
            <select className={inp} value={form.fund_type}
              onChange={e => setForm(f => ({ ...f, fund_type: e.target.value }))}>
              {FUND_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
            </select>
            <input type="number" className={inp} placeholder="Fiscal Year" value={form.fiscal_year}
              onChange={e => setForm(f => ({ ...f, fiscal_year: e.target.value }))} />
            <input type="number" className={inp} placeholder="Total Allocation ($)" value={form.total_allocation}
              onChange={e => setForm(f => ({ ...f, total_allocation: e.target.value }))} />
            <input className={inp} placeholder="Description / Display Name" value={form.display_name}
              onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn-primary text-sm">Create LOA</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : loas.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No lines of accounting defined.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loas.map(loa => {
            const avail = loa.available_balance || 0;
            const total = loa.total_amount || 0;
            const used = total - avail;
            const pct = total > 0 ? (used / total) * 100 : 0;
            const isEditing = editingId === loa.id;

            return (
              <div key={loa.id} className={`bg-white rounded-lg border p-4 ${isEditing ? 'border-eaw-primary ring-1 ring-eaw-primary/20' : 'border-gray-200'}`}>
                {!isEditing ? (
                  <>
                    {/* View mode */}
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium">{loa.fund_code}</span>
                        <span className="text-sm text-gray-500 ml-2">FY{loa.fiscal_year}</span>
                        {loa.fund_type && (
                          <span className="text-xs text-gray-400 ml-2">({FUND_TYPE_LABELS[loa.fund_type] || loa.fund_type})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={healthStatus(loa)} />
                        <button onClick={() => startEdit(loa)}
                          className="text-gray-400 hover:text-eaw-primary transition-colors" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(loa)}
                          className="text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {loa.description && <p className="text-sm text-gray-500 mb-1">{loa.description}</p>}
                    {(loa.project || loa.task) && (
                      <div className="flex gap-3 text-xs text-gray-400 mb-2">
                        {loa.project && <span>Project: <span className="text-gray-600">{loa.project}</span></span>}
                        {loa.task && <span>Task: <span className="text-gray-600">{loa.task}</span></span>}
                      </div>
                    )}

                    {/* Balance bar */}
                    <div className="space-y-1 mb-3">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Used: ${used.toLocaleString()}</span>
                        <span>Available: ${avail.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div className={`h-3 rounded-full transition-all ${healthColor(loa)}`}
                          style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <div className="text-xs text-gray-400 text-right">Total: ${total.toLocaleString()}</div>
                    </div>

                    {/* Breakdown */}
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div><span className="text-gray-400">Projected</span><p className="font-medium">${(loa.projected_amount || 0).toLocaleString()}</p></div>
                      <div><span className="text-gray-400">Committed</span><p className="font-medium">${(loa.committed_amount || 0).toLocaleString()}</p></div>
                      <div><span className="text-gray-400">Obligated</span><p className="font-medium">${(loa.obligated_amount || 0).toLocaleString()}</p></div>
                      <div><span className="text-gray-400">Available</span><p className="font-medium text-green-600">${avail.toLocaleString()}</p></div>
                    </div>

                    {avail < 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                        <AlertTriangle size={12} /> Over-allocated by ${Math.abs(avail).toLocaleString()}
                      </div>
                    )}
                  </>
                ) : (
                  /* Edit mode */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm">Edit LOA</h3>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-[10px] text-gray-400">Fund Code</label>
                        <input className={inp} value={editForm.fund_code}
                          onChange={e => setEditForm(f => ({ ...f, fund_code: e.target.value }))} /></div>
                      <div><label className="text-[10px] text-gray-400">Appropriation</label>
                        <input className={inp} value={editForm.appropriation}
                          onChange={e => setEditForm(f => ({ ...f, appropriation: e.target.value }))} /></div>
                      <div><label className="text-[10px] text-gray-400">Project</label>
                        <input className={inp} value={editForm.project}
                          onChange={e => setEditForm(f => ({ ...f, project: e.target.value }))} /></div>
                      <div><label className="text-[10px] text-gray-400">Task</label>
                        <input className={inp} value={editForm.task}
                          onChange={e => setEditForm(f => ({ ...f, task: e.target.value }))} /></div>
                      <div><label className="text-[10px] text-gray-400">Fund Type</label>
                        <select className={inp} value={editForm.fund_type}
                          onChange={e => setEditForm(f => ({ ...f, fund_type: e.target.value }))}>
                          {FUND_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                        </select></div>
                      <div><label className="text-[10px] text-gray-400">Fiscal Year</label>
                        <input type="number" className={inp} value={editForm.fiscal_year}
                          onChange={e => setEditForm(f => ({ ...f, fiscal_year: e.target.value }))} /></div>
                      <div><label className="text-[10px] text-gray-400">Total Allocation ($)</label>
                        <input type="number" className={inp} value={editForm.total_allocation}
                          onChange={e => setEditForm(f => ({ ...f, total_allocation: e.target.value }))} /></div>
                      <div><label className="text-[10px] text-gray-400">Display Name</label>
                        <input className={inp} value={editForm.display_name}
                          onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))} /></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-white transition-colors"
                        style={{ backgroundColor: '#337ab7' }}>
                        <Save size={12} /> {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
