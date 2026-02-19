import { useEffect, useState } from 'react';
import { Settings, Save, Pencil, X, Plus, ChevronUp, ChevronDown, Trash2, ToggleLeft, ToggleRight, AlertTriangle, ShieldCheck } from 'lucide-react';
import { adminApi } from '../api/admin';

type Tab = 'thresholds' | 'templates' | 'rules' | 'users' | 'advisory';

interface Threshold {
  id: number;
  name: string;
  dollar_limit: number;
  far_reference: string;
}

interface TemplateStep {
  id?: number;
  step_number: number;
  gate_name: string;
  approver_role: string;
  sla_days: number;
  is_enabled: boolean;
}

interface Template {
  id: number;
  template_key: string;
  name: string;
  pipeline_type: string;
  steps: TemplateStep[];
}

interface GateCatalogItem {
  gate_name: string;
  approver_role: string;
  default_sla: number;
}

interface Rule {
  id: number;
  template_name: string;
  conditions: string;
  applicability: string;
}

interface UserItem {
  id: number;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
}

interface AdvisoryConfig {
  id: number;
  pipeline_type: string;
  team: string;
  is_enabled: boolean;
  sla_days: number;
  blocks_gate: string;
  threshold_min: number;
}

interface GateOption {
  value: string;
  label: string;
}

const ROLE_LABELS: Record<string, string> = {
  branch_chief: 'Branch Chief',
  budget: 'Budget Officer',
  ko: 'Contracting Officer',
  legal: 'Legal Counsel',
  cio: 'CIO',
  cto: 'CTO',
  branch_chief_pm: 'Program Manager',
};

function roleLabel(role: string) {
  return ROLE_LABELS[role] || role.replace(/_/g, ' ');
}

export default function AdminConfigPage() {
  const [tab, setTab] = useState<Tab>('thresholds');
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingThreshold, setEditingThreshold] = useState<number | null>(null);
  const [thresholdValue, setThresholdValue] = useState('');

  // Template editing state
  const [editingTemplate, setEditingTemplate] = useState<number | null>(null);
  const [editSteps, setEditSteps] = useState<TemplateStep[]>([]);
  const [gateCatalog, setGateCatalog] = useState<GateCatalogItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAddGate, setShowAddGate] = useState(false);

  // Advisory config state
  const [advisoryConfigs, setAdvisoryConfigs] = useState<AdvisoryConfig[]>([]);
  const [editAdvisoryConfigs, setEditAdvisoryConfigs] = useState<AdvisoryConfig[]>([]);
  const [editingAdvisory, setEditingAdvisory] = useState(false);
  const [savingAdvisory, setSavingAdvisory] = useState(false);
  const [pipelineLabels, setPipelineLabels] = useState<Record<string, string>>({});
  const [teamLabels, setTeamLabels] = useState<Record<string, string>>({});
  const [gateOptions, setGateOptions] = useState<GateOption[]>([]);

  useEffect(() => {
    setLoading(true);
    if (tab === 'thresholds') {
      adminApi.getThresholds().then(data => {
        setThresholds(Array.isArray(data) ? data : data.thresholds || []);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else if (tab === 'templates') {
      adminApi.getTemplates().then(data => {
        setTemplates(Array.isArray(data) ? data : data.templates || []);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else if (tab === 'rules') {
      adminApi.getRules().then(data => {
        setRules(Array.isArray(data) ? data : data.rules || []);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else if (tab === 'users') {
      adminApi.getUsers().then(data => {
        setUsers(Array.isArray(data) ? data : data.users || []);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else if (tab === 'advisory') {
      adminApi.getAdvisoryConfig().then(data => {
        setAdvisoryConfigs(data.configs || []);
        setPipelineLabels(data.pipeline_labels || {});
        setTeamLabels(data.team_labels || {});
        setGateOptions(data.gate_options || []);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [tab]);

  // Load gate catalog once when entering edit mode
  useEffect(() => {
    if (editingTemplate && gateCatalog.length === 0) {
      adminApi.getGateCatalog().then(data => {
        setGateCatalog(data.catalog || []);
      }).catch(() => {});
    }
  }, [editingTemplate, gateCatalog.length]);

  const handleSaveThreshold = async (id: number) => {
    await adminApi.updateThreshold(id, { dollar_limit: parseFloat(thresholdValue) });
    setEditingThreshold(null);
    adminApi.getThresholds().then(data => setThresholds(Array.isArray(data) ? data : data.thresholds || []));
  };

  // --- Template editing handlers ---

  const startEditTemplate = (t: Template) => {
    setEditingTemplate(t.id);
    setEditSteps(
      [...t.steps]
        .sort((a, b) => a.step_number - b.step_number)
        .map(s => ({ ...s, is_enabled: s.is_enabled !== false }))
    );
    setShowAddGate(false);
  };

  const cancelEditTemplate = () => {
    setEditingTemplate(null);
    setEditSteps([]);
    setShowAddGate(false);
  };

  const saveTemplateSteps = async (templateId: number) => {
    setSaving(true);
    try {
      await adminApi.updateTemplateSteps(templateId, editSteps);
      // Refresh templates
      const data = await adminApi.getTemplates();
      setTemplates(Array.isArray(data) ? data : data.templates || []);
      setEditingTemplate(null);
      setEditSteps([]);
    } catch {
      // keep editing
    } finally {
      setSaving(false);
    }
  };

  const toggleStepEnabled = (index: number) => {
    setEditSteps(prev => prev.map((s, i) =>
      i === index ? { ...s, is_enabled: !s.is_enabled } : s
    ));
  };

  const updateStepSla = (index: number, sla: number) => {
    setEditSteps(prev => prev.map((s, i) =>
      i === index ? { ...s, sla_days: sla } : s
    ));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= editSteps.length) return;
    setEditSteps(prev => {
      const copy = [...prev];
      [copy[index], copy[newIdx]] = [copy[newIdx], copy[index]];
      return copy;
    });
  };

  const removeStep = (index: number) => {
    setEditSteps(prev => prev.filter((_, i) => i !== index));
  };

  const addGateFromCatalog = (gate: GateCatalogItem) => {
    setEditSteps(prev => [
      ...prev,
      {
        step_number: prev.length + 1,
        gate_name: gate.gate_name,
        approver_role: gate.approver_role,
        sla_days: gate.default_sla,
        is_enabled: true,
      },
    ]);
    setShowAddGate(false);
  };

  // Gates available to add (not already in the template)
  const availableGates = gateCatalog.filter(
    g => !editSteps.some(s => s.gate_name === g.gate_name)
  );

  // --- Advisory config handlers ---

  const startEditAdvisory = () => {
    setEditingAdvisory(true);
    setEditAdvisoryConfigs(advisoryConfigs.map(c => ({ ...c })));
  };

  const cancelEditAdvisory = () => {
    setEditingAdvisory(false);
    setEditAdvisoryConfigs([]);
  };

  const saveAdvisoryConfig = async () => {
    setSavingAdvisory(true);
    try {
      const data = await adminApi.updateAdvisoryConfig(editAdvisoryConfigs);
      setAdvisoryConfigs(data.configs || []);
      setEditingAdvisory(false);
      setEditAdvisoryConfigs([]);
    } catch {
      // keep editing
    } finally {
      setSavingAdvisory(false);
    }
  };

  const updateAdvConfig = (configId: number, field: keyof AdvisoryConfig, value: unknown) => {
    setEditAdvisoryConfigs(prev =>
      prev.map(c => c.id === configId ? { ...c, [field]: value } : c)
    );
  };

  // Group configs by pipeline type (preserving order)
  const groupByPipeline = (configs: AdvisoryConfig[]) => {
    const ordered = [
      'full', 'abbreviated', 'ko_only', 'ko_abbreviated', 'micro',
      'clin_execution', 'modification', 'clin_exec_funding', 'depends_on_value',
    ];
    const groups: Record<string, AdvisoryConfig[]> = {};
    for (const pipe of ordered) {
      const items = configs.filter(c => c.pipeline_type === pipe);
      if (items.length > 0) groups[pipe] = items;
    }
    // Also include any pipelines not in the ordered list
    for (const c of configs) {
      if (!groups[c.pipeline_type]) groups[c.pipeline_type] = [];
      if (!groups[c.pipeline_type].includes(c)) groups[c.pipeline_type].push(c);
    }
    return groups;
  };

  // Team colors for badges
  const teamColor: Record<string, string> = {
    scrm: 'bg-purple-100 text-purple-700 border-purple-200',
    sbo: 'bg-orange-100 text-orange-700 border-orange-200',
    cio: 'bg-blue-100 text-blue-700 border-blue-200',
    section508: 'bg-green-100 text-green-700 border-green-200',
    fm: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'thresholds', label: 'FAR Thresholds' },
    { key: 'templates', label: 'Approval Templates' },
    { key: 'advisory', label: 'Advisory Triggers' },
    { key: 'rules', label: 'Document Rules' },
    { key: 'users', label: 'Users' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-eaw-primary" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Configuration</h1>
          <p className="text-sm text-gray-500">Manage thresholds, templates, advisory triggers, rules, and users</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${
              tab === t.key
                ? 'border-eaw-primary text-eaw-primary font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>{t.label}</button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (
          <>
            {tab === 'thresholds' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">Configure FAR acquisition dollar thresholds</p>
                <table className="eaw-table">
                  <thead>
                    <tr><th>Tier</th><th>Dollar Limit</th><th>FAR Reference</th><th></th></tr>
                  </thead>
                  <tbody>
                    {thresholds.map(t => (
                      <tr key={t.id}>
                        <td className="font-medium capitalize">{t.name.replace(/_/g, ' ')}</td>
                        <td>
                          {editingThreshold === t.id ? (
                            <input type="number" className="input-field text-sm w-40" value={thresholdValue}
                              onChange={e => setThresholdValue(e.target.value)} />
                          ) : (
                            `$${t.dollar_limit.toLocaleString()}`
                          )}
                        </td>
                        <td className="text-sm text-gray-500">{t.far_reference}</td>
                        <td>
                          {editingThreshold === t.id ? (
                            <button onClick={() => handleSaveThreshold(t.id)}
                              className="text-xs text-green-600 hover:underline flex items-center gap-1">
                              <Save size={12} /> Save
                            </button>
                          ) : (
                            <button onClick={() => { setEditingThreshold(t.id); setThresholdValue(String(t.dollar_limit)); }}
                              className="text-xs text-eaw-primary hover:underline">Edit</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'templates' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">Approval pipeline templates and their gates. Toggle gates on/off per template.</p>
                {templates.map(t => {
                  const isEditing = editingTemplate === t.id;
                  const sortedSteps = [...(t.steps || [])].sort((a, b) => a.step_number - b.step_number);
                  const enabledCount = sortedSteps.filter(s => s.is_enabled !== false).length;

                  return (
                    <div key={t.id} className={`border rounded-lg overflow-hidden ${isEditing ? 'border-eaw-primary ring-1 ring-eaw-primary/20' : 'border-gray-200'}`}>
                      {/* Template header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {t.name || t.pipeline_type.replace(/_/g, ' ')} Pipeline
                          </h3>
                          <span className="text-xs text-gray-400">
                            {t.template_key} &middot; {enabledCount} active gate{enabledCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {!isEditing ? (
                          <button
                            onClick={() => startEditTemplate(t)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <Pencil size={12} /> Edit Gates
                          </button>
                        ) : (
                          <button
                            onClick={cancelEditTemplate}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                          >
                            <X size={14} /> Cancel
                          </button>
                        )}
                      </div>

                      {/* View mode */}
                      {!isEditing && (
                        <div className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {sortedSteps.map((s, i) => {
                              const enabled = s.is_enabled !== false;
                              return (
                                <div key={s.id || i}
                                  className={`rounded px-3 py-1.5 text-xs flex items-center gap-2 ${
                                    enabled ? 'bg-gray-100' : 'bg-gray-50 opacity-50'
                                  }`}>
                                  <span className={`rounded-full w-5 h-5 flex items-center justify-center text-[10px] text-white ${
                                    enabled ? 'bg-green-500' : 'bg-gray-300'
                                  }`}>
                                    {enabled ? s.step_number : '\u2013'}
                                  </span>
                                  <span className={`font-medium ${!enabled ? 'line-through text-gray-400' : ''}`}>
                                    {s.gate_name}
                                  </span>
                                  <span className="text-gray-400">
                                    ({roleLabel(s.approver_role)}, {s.sla_days}d)
                                  </span>
                                  {!enabled && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">OFF</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Edit mode */}
                      {isEditing && (
                        <div className="p-4 space-y-3">
                          {/* Warning banner */}
                          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700">
                            <AlertTriangle size={14} className="shrink-0" />
                            Changes apply to <strong>new requests only</strong>. In-flight approvals are not affected.
                          </div>

                          {/* Step rows */}
                          <div className="space-y-1">
                            {editSteps.map((s, i) => {
                              const enabledNum = editSteps.slice(0, i + 1).filter(x => x.is_enabled).length;
                              return (
                                <div
                                  key={s.id || `new-${i}`}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${
                                    s.is_enabled
                                      ? 'border-gray-200 bg-white'
                                      : 'border-gray-100 bg-gray-50 opacity-60'
                                  }`}
                                >
                                  {/* Reorder arrows */}
                                  <div className="flex flex-col gap-0.5">
                                    <button
                                      onClick={() => moveStep(i, -1)}
                                      disabled={i === 0}
                                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                    >
                                      <ChevronUp size={14} />
                                    </button>
                                    <button
                                      onClick={() => moveStep(i, 1)}
                                      disabled={i === editSteps.length - 1}
                                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                    >
                                      <ChevronDown size={14} />
                                    </button>
                                  </div>

                                  {/* Step number */}
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${
                                    s.is_enabled ? 'bg-green-500' : 'bg-gray-300'
                                  }`}>
                                    {s.is_enabled ? enabledNum : '\u2013'}
                                  </span>

                                  {/* Gate name */}
                                  <span className={`text-sm font-medium flex-1 ${!s.is_enabled ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                    {s.gate_name}
                                  </span>

                                  {/* Role */}
                                  <span className="text-xs text-gray-400 w-28 text-right">
                                    {roleLabel(s.approver_role)}
                                  </span>

                                  {/* SLA input */}
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min={1}
                                      max={30}
                                      value={s.sla_days}
                                      onChange={e => updateStepSla(i, Math.max(1, parseInt(e.target.value) || 1))}
                                      className="w-12 text-center text-xs border border-gray-200 rounded px-1 py-1"
                                    />
                                    <span className="text-[10px] text-gray-400">days</span>
                                  </div>

                                  {/* Toggle */}
                                  <button
                                    onClick={() => toggleStepEnabled(i)}
                                    className={`transition-colors ${s.is_enabled ? 'text-green-500' : 'text-gray-300'}`}
                                    title={s.is_enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                                  >
                                    {s.is_enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                  </button>

                                  {/* Remove */}
                                  <button
                                    onClick={() => removeStep(i)}
                                    className="text-gray-300 hover:text-red-500 transition-colors"
                                    title="Remove gate from template"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          {/* Add gate */}
                          <div className="relative">
                            {!showAddGate ? (
                              <button
                                onClick={() => setShowAddGate(true)}
                                disabled={availableGates.length === 0}
                                className="flex items-center gap-1.5 text-xs text-eaw-primary hover:underline disabled:text-gray-300 disabled:no-underline"
                              >
                                <Plus size={14} /> Add a gate
                              </button>
                            ) : (
                              <div className="border border-gray-200 rounded-md bg-white shadow-sm p-2 max-h-48 overflow-y-auto">
                                <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 px-1">Select a gate to add</div>
                                {availableGates.map(g => (
                                  <button
                                    key={g.gate_name}
                                    onClick={() => addGateFromCatalog(g)}
                                    className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-blue-50 flex items-center justify-between"
                                  >
                                    <span className="font-medium">{g.gate_name}</span>
                                    <span className="text-gray-400">{roleLabel(g.approver_role)} &middot; {g.default_sla}d</span>
                                  </button>
                                ))}
                                <button
                                  onClick={() => setShowAddGate(false)}
                                  className="w-full text-center px-2 py-1 text-[10px] text-gray-400 hover:text-gray-600 mt-1"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Save / Cancel buttons */}
                          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                            <button
                              onClick={() => saveTemplateSteps(t.id)}
                              disabled={saving}
                              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md text-white transition-colors"
                              style={{ backgroundColor: '#337ab7' }}
                            >
                              <Save size={14} />
                              {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button
                              onClick={cancelEditTemplate}
                              className="px-4 py-2 text-xs font-medium rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                              Cancel
                            </button>
                            <span className="text-[10px] text-gray-400 ml-auto">
                              {editSteps.filter(s => s.is_enabled).length} of {editSteps.length} gates enabled
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'rules' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">Document checklist conditional rules ({rules.length} rules)</p>
                <div className="max-h-96 overflow-y-auto">
                  <table className="eaw-table text-xs">
                    <thead>
                      <tr><th>Document</th><th>Conditions</th><th>Applicability</th></tr>
                    </thead>
                    <tbody>
                      {rules.map(r => (
                        <tr key={r.id}>
                          <td className="font-medium">{r.template_name}</td>
                          <td className="font-mono text-gray-600 max-w-xs truncate">{r.conditions}</td>
                          <td className="text-gray-500">{r.applicability}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'advisory' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Configure which advisory teams are triggered for each pipeline type</p>
                  </div>
                  {!editingAdvisory ? (
                    <button
                      onClick={startEditAdvisory}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Pencil size={12} /> Edit Triggers
                    </button>
                  ) : (
                    <button
                      onClick={cancelEditAdvisory}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                      <X size={14} /> Cancel
                    </button>
                  )}
                </div>

                {editingAdvisory && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700">
                    <AlertTriangle size={14} className="shrink-0" />
                    Changes apply to <strong>new requests only</strong>. Existing advisory reviews are not affected.
                  </div>
                )}

                {Object.entries(groupByPipeline(editingAdvisory ? editAdvisoryConfigs : advisoryConfigs)).map(([pipeline, configs]) => (
                  <div key={pipeline} className={`border rounded-lg overflow-hidden ${editingAdvisory ? 'border-eaw-primary/30' : 'border-gray-200'}`}>
                    {/* Pipeline header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-gray-400" />
                        <h3 className="font-medium text-gray-900">{pipelineLabels[pipeline] || pipeline.replace(/_/g, ' ')}</h3>
                        <span className="text-xs text-gray-400">
                          {configs.filter(c => c.is_enabled).length} of {configs.length} teams active
                        </span>
                      </div>
                    </div>

                    {/* View mode */}
                    {!editingAdvisory && (
                      <div className="p-4">
                        <div className="flex flex-wrap gap-2">
                          {configs.map(c => {
                            const colorClass = c.is_enabled
                              ? teamColor[c.team] || 'bg-gray-100 text-gray-700 border-gray-200'
                              : 'bg-gray-50 text-gray-400 border-gray-100';
                            return (
                              <div key={c.id} className={`rounded-md px-3 py-2 text-xs border ${colorClass} ${!c.is_enabled ? 'opacity-50' : ''}`}>
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${!c.is_enabled ? 'line-through' : ''}`}>
                                    {teamLabels[c.team] || c.team}
                                  </span>
                                  {!c.is_enabled && (
                                    <span className="text-[10px] px-1 py-0.5 rounded bg-gray-200 text-gray-500">OFF</span>
                                  )}
                                </div>
                                {c.is_enabled && (
                                  <div className="text-[10px] mt-1 opacity-70">
                                    SLA {c.sla_days}d
                                    {c.blocks_gate ? ` \u00b7 blocks ${c.blocks_gate.toUpperCase()}` : ' \u00b7 parallel'}
                                    {c.threshold_min > 0 ? ` \u00b7 >${'$'}${c.threshold_min.toLocaleString()}` : ''}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Edit mode */}
                    {editingAdvisory && (
                      <div className="p-4 space-y-2">
                        {configs.map(c => (
                          <div
                            key={c.id}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-md border transition-colors ${
                              c.is_enabled
                                ? 'border-gray-200 bg-white'
                                : 'border-gray-100 bg-gray-50 opacity-60'
                            }`}
                          >
                            {/* Toggle */}
                            <button
                              onClick={() => updateAdvConfig(c.id, 'is_enabled', !c.is_enabled)}
                              className={`transition-colors shrink-0 ${c.is_enabled ? 'text-green-500' : 'text-gray-300'}`}
                              title={c.is_enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                            >
                              {c.is_enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                            </button>

                            {/* Team badge */}
                            <span className={`text-xs font-semibold px-2 py-1 rounded border shrink-0 w-28 text-center ${
                              c.is_enabled
                                ? teamColor[c.team] || 'bg-gray-100 text-gray-700 border-gray-200'
                                : 'bg-gray-50 text-gray-400 border-gray-100'
                            }`}>
                              {teamLabels[c.team] || c.team}
                            </span>

                            {/* SLA */}
                            <div className="flex items-center gap-1">
                              <label className="text-[10px] text-gray-400">SLA</label>
                              <input
                                type="number"
                                min={1}
                                max={30}
                                value={c.sla_days}
                                onChange={e => updateAdvConfig(c.id, 'sla_days', Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-12 text-center text-xs border border-gray-200 rounded px-1 py-1"
                                disabled={!c.is_enabled}
                              />
                              <span className="text-[10px] text-gray-400">days</span>
                            </div>

                            {/* Blocks gate */}
                            <div className="flex items-center gap-1">
                              <label className="text-[10px] text-gray-400">Blocks</label>
                              <select
                                value={c.blocks_gate || ''}
                                onChange={e => updateAdvConfig(c.id, 'blocks_gate', e.target.value)}
                                className="text-xs border border-gray-200 rounded px-1.5 py-1"
                                disabled={!c.is_enabled}
                              >
                                {gateOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>

                            {/* Threshold */}
                            <div className="flex items-center gap-1 ml-auto">
                              <label className="text-[10px] text-gray-400">Min $</label>
                              <input
                                type="number"
                                min={0}
                                step={1000}
                                value={c.threshold_min}
                                onChange={e => updateAdvConfig(c.id, 'threshold_min', Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-24 text-right text-xs border border-gray-200 rounded px-1.5 py-1"
                                disabled={!c.is_enabled}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Save / Cancel */}
                {editingAdvisory && (
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                    <button
                      onClick={saveAdvisoryConfig}
                      disabled={savingAdvisory}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md text-white transition-colors"
                      style={{ backgroundColor: '#337ab7' }}
                    >
                      <Save size={14} />
                      {savingAdvisory ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={cancelEditAdvisory}
                      className="px-4 py-2 text-xs font-medium rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {editAdvisoryConfigs.filter(c => c.is_enabled).length} of {editAdvisoryConfigs.length} triggers enabled
                    </span>
                  </div>
                )}
              </div>
            )}

            {tab === 'users' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">System users and roles</p>
                <table className="eaw-table">
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td className="font-medium">{u.display_name}</td>
                        <td className="text-sm text-gray-500">{u.email}</td>
                        <td className="text-sm capitalize">{u.role.replace(/_/g, ' ')}</td>
                        <td>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
