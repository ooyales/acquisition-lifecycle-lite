import { useState } from 'react';
import {
  Upload,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  DollarSign,
  Calendar,
  Archive,
  ClipboardCheck,
} from 'lucide-react';
import { wizardApi, type ImportResult } from '@/api/wizard';

interface StepConfig {
  id: string;
  label: string;
  entityType: string;
  icon: React.ReactNode;
  columns: string[];
  description: string;
}

const STEPS: StepConfig[] = [
  {
    id: 'requests',
    label: 'Requests',
    entityType: 'requests',
    icon: <FileText size={18} />,
    columns: [
      'title', 'description', 'category', 'sub_category', 'justification',
      'estimated_total', 'fiscal_year', 'priority', 'need_by_date',
      'vendor_name', 'product_name', 'quantity',
    ],
    description: 'Import acquisition requests with titles, categories, cost estimates, and vendor information.',
  },
  {
    id: 'funding',
    label: 'Funding Sources',
    entityType: 'funding_sources',
    icon: <DollarSign size={18} />,
    columns: [
      'name', 'fiscal_year', 'total_budget', 'committed', 'spent',
      'funding_type', 'owner', 'notes',
    ],
    description: 'Import funding sources with budget amounts, fiscal years, and ownership details.',
  },
  {
    id: 'lifecycle',
    label: 'Lifecycle Events',
    entityType: 'lifecycle_events',
    icon: <Calendar size={18} />,
    columns: [
      'asset_name', 'asset_tracker_id', 'event_type', 'event_date',
      'lead_time_days', 'action_needed', 'estimated_cost', 'status',
      'fiscal_year_impact', 'notes',
    ],
    description: 'Import lifecycle events such as contract renewals, warranty expirations, and tech refresh cycles.',
  },
  {
    id: 'prior',
    label: 'Prior Acquisitions',
    entityType: 'prior_acquisitions',
    icon: <Archive size={18} />,
    columns: [
      'description', 'vendor', 'product_category', 'unit_cost',
      'total_cost', 'quantity', 'award_date', 'contract_number',
      'contract_vehicle',
    ],
    description: 'Import historical acquisition records for trend analysis and market research reference.',
  },
  {
    id: 'review',
    label: 'Review',
    entityType: '',
    icon: <ClipboardCheck size={18} />,
    columns: [],
    description: 'Review the summary of all imported data before finishing.',
  },
];

interface StepResult {
  entityType: string;
  result: ImportResult | null;
  error: string;
}

export default function DataWizardPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [pasteData, setPasteData] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, StepResult>>({});
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const step = STEPS[currentStep];
  const isReviewStep = currentStep === STEPS.length - 1;

  const handleImport = async () => {
    if (isReviewStep) return;
    const text = pasteData[step.id]?.trim();
    if (!text) return;

    setImporting(true);
    try {
      const result = await wizardApi.importData(step.entityType, text);
      setResults((prev) => ({
        ...prev,
        [step.id]: { entityType: step.entityType, result, error: '' },
      }));
    } catch (err: any) {
      setResults((prev) => ({
        ...prev,
        [step.id]: {
          entityType: step.entityType,
          result: null,
          error: err?.response?.data?.error || 'Import failed.',
        },
      }));
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    if (isReviewStep) return;
    setDownloadingTemplate(true);
    try {
      const csv = await wizardApi.getSample(step.entityType);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${step.entityType}_template.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // If the sample endpoint is not available, generate a local template from columns
      const csv = step.columns.join('\t') + '\n';
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${step.entityType}_template.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const totalImported = Object.values(results).reduce(
    (sum, r) => sum + (r.result?.imported || 0),
    0
  );
  const totalErrors = Object.values(results).reduce(
    (sum, r) => sum + (r.result?.errors?.length || 0) + (r.error ? 1 : 0),
    0
  );

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <Upload size={24} className="text-eaw-primary" />
        <div>
          <h1 className="text-xl font-bold text-eaw-font">Data Import Wizard</h1>
          <p className="text-sm text-eaw-muted">
            Import acquisition data from spreadsheets and external systems
          </p>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="eaw-card mb-6">
        <div className="flex items-center gap-1">
          {STEPS.map((s, idx) => {
            const stepResult = results[s.id];
            const isActive = idx === currentStep;
            const isCompleted = stepResult?.result && stepResult.result.imported > 0;
            const hasError = stepResult?.error || (stepResult?.result?.errors && stepResult.result.errors.length > 0);

            return (
              <button
                key={s.id}
                onClick={() => setCurrentStep(idx)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded transition-colors flex-1 justify-center ${
                  isActive
                    ? 'bg-eaw-primary text-white'
                    : isCompleted
                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                    : hasError
                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                    : 'bg-gray-50 text-eaw-muted hover:bg-gray-100'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : isCompleted
                    ? 'bg-green-200 text-green-800'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    idx + 1
                  )}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      {isReviewStep ? (
        <ReviewStep results={results} steps={STEPS} />
      ) : (
        <div className="space-y-4">
          {/* Step Description */}
          <div className="eaw-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 rounded-lg text-eaw-primary">
                {step.icon}
              </div>
              <div>
                <h2 className="text-base font-semibold text-eaw-font">
                  Step {currentStep + 1}: Import {step.label}
                </h2>
                <p className="text-sm text-eaw-muted">{step.description}</p>
              </div>
            </div>
          </div>

          {/* Expected Columns */}
          <div className="eaw-card">
            <h3 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-3">
              Expected Columns
            </h3>
            <div className="flex flex-wrap gap-2">
              {step.columns.map((col) => (
                <span
                  key={col}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-gray-100 text-eaw-font rounded-full"
                >
                  {col}
                </span>
              ))}
            </div>
            <div className="mt-3">
              <button
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="btn-secondary"
              >
                {downloadingTemplate ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                Download CSV Template
              </button>
            </div>
          </div>

          {/* Paste Area */}
          <div className="eaw-card">
            <h3 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-3">
              Paste Tab-Separated Data
            </h3>
            <p className="text-xs text-eaw-muted mb-2">
              Copy rows from a spreadsheet and paste them below. Include the header row. Columns should be separated by tabs.
            </p>
            <textarea
              value={pasteData[step.id] || ''}
              onChange={(e) =>
                setPasteData((prev) => ({ ...prev, [step.id]: e.target.value }))
              }
              placeholder={`Paste your ${step.label.toLowerCase()} data here...\n\nExample:\n${step.columns.join('\t')}\nvalue1\tvalue2\t...`}
              rows={10}
              className="input-field w-full font-mono text-sm resize-y"
            />

            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={handleImport}
                disabled={importing || !pasteData[step.id]?.trim()}
                className="btn-primary"
              >
                {importing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                Import
              </button>
              {pasteData[step.id]?.trim() && (
                <button
                  onClick={() =>
                    setPasteData((prev) => ({ ...prev, [step.id]: '' }))
                  }
                  className="btn-secondary"
                >
                  <X size={14} />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Import Result */}
          {results[step.id] && (
            <ImportResultDisplay stepResult={results[step.id]} />
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
          disabled={currentStep === 0}
          className="btn-secondary"
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <span className="text-xs text-eaw-muted">
          Step {currentStep + 1} of {STEPS.length}
        </span>
        <button
          onClick={() =>
            setCurrentStep((prev) => Math.min(STEPS.length - 1, prev + 1))
          }
          disabled={currentStep === STEPS.length - 1}
          className="btn-primary"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ── Import Result Display ─────────────────────────────────────────── */

function ImportResultDisplay({ stepResult }: { stepResult: StepResult }) {
  if (stepResult.error) {
    return (
      <div className="eaw-card border-l-4 border-l-red-500">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle size={16} />
          <span className="text-sm font-medium">Import Failed</span>
        </div>
        <p className="text-sm text-red-600 mt-1">{stepResult.error}</p>
      </div>
    );
  }

  if (!stepResult.result) return null;

  const { imported, errors, total } = stepResult.result;

  return (
    <div className={`eaw-card border-l-4 ${errors.length > 0 ? 'border-l-yellow-500' : 'border-l-green-500'}`}>
      <div className="flex items-center gap-2 mb-2">
        {errors.length === 0 ? (
          <CheckCircle2 size={16} className="text-eaw-success" />
        ) : (
          <AlertCircle size={16} className="text-eaw-warning" />
        )}
        <span className="text-sm font-medium text-eaw-font">
          Import Complete
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-eaw-muted uppercase">Total Rows</p>
          <p className="text-lg font-bold text-eaw-font">{total}</p>
        </div>
        <div>
          <p className="text-xs text-eaw-muted uppercase">Imported</p>
          <p className="text-lg font-bold text-eaw-success">{imported}</p>
        </div>
        <div>
          <p className="text-xs text-eaw-muted uppercase">Errors</p>
          <p className={`text-lg font-bold ${errors.length > 0 ? 'text-eaw-danger' : 'text-eaw-muted'}`}>
            {errors.length}
          </p>
        </div>
      </div>
      {errors.length > 0 && (
        <div className="mt-3 p-2 bg-red-50 rounded text-xs text-red-700 max-h-40 overflow-y-auto">
          <p className="font-medium mb-1">Errors:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── Review Step ───────────────────────────────────────────────────── */

function ReviewStep({
  results,
  steps,
}: {
  results: Record<string, StepResult>;
  steps: StepConfig[];
}) {
  const importSteps = steps.filter((s) => s.id !== 'review');
  const hasAnyImport = Object.values(results).some(
    (r) => r.result && r.result.imported > 0
  );

  return (
    <div className="space-y-4">
      <div className="eaw-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-50 rounded-lg text-eaw-primary">
            <ClipboardCheck size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-eaw-font">
              Import Summary
            </h2>
            <p className="text-sm text-eaw-muted">
              Review what was imported across all data types.
            </p>
          </div>
        </div>

        {!hasAnyImport ? (
          <p className="text-sm text-eaw-muted text-center py-8">
            No data has been imported yet. Go back to each step to import data.
          </p>
        ) : (
          <div className="space-y-3">
            {importSteps.map((s) => {
              const stepResult = results[s.id];
              const imported = stepResult?.result?.imported || 0;
              const errorCount = stepResult?.result?.errors?.length || 0;
              const hasErrors = errorCount > 0 || !!stepResult?.error;

              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    imported > 0
                      ? 'bg-green-50 border-green-200'
                      : stepResult?.error
                      ? 'bg-red-50 border-red-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-eaw-primary">
                    {s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-eaw-font">
                      {s.label}
                    </span>
                    {stepResult?.error && (
                      <p className="text-xs text-red-600 mt-0.5">{stepResult.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {imported > 0 && (
                      <span className="flex items-center gap-1 text-eaw-success font-medium">
                        <CheckCircle2 size={14} />
                        {imported} imported
                      </span>
                    )}
                    {hasErrors && (
                      <span className="flex items-center gap-1 text-eaw-danger font-medium">
                        <AlertCircle size={14} />
                        {errorCount || 1} error{(errorCount || 1) > 1 ? 's' : ''}
                      </span>
                    )}
                    {!stepResult && (
                      <span className="text-xs text-eaw-muted">Skipped</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Totals */}
      {hasAnyImport && (
        <div className="eaw-card">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-xs text-eaw-muted uppercase tracking-wide mb-0.5">
                Total Records Imported
              </p>
              <p className="text-2xl font-bold text-eaw-success">
                {Object.values(results).reduce(
                  (sum, r) => sum + (r.result?.imported || 0),
                  0
                )}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-eaw-muted uppercase tracking-wide mb-0.5">
                Total Errors
              </p>
              <p className={`text-2xl font-bold ${
                Object.values(results).reduce(
                  (sum, r) => sum + (r.result?.errors?.length || 0),
                  0
                ) > 0
                  ? 'text-eaw-danger'
                  : 'text-eaw-muted'
              }`}>
                {Object.values(results).reduce(
                  (sum, r) => sum + (r.result?.errors?.length || 0),
                  0
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
