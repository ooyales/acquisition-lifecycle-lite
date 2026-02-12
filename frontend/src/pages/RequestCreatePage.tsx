import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  PlusCircle,
  Save,
  Send,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { requestsApi } from '@/api/requests';
import type { AcquisitionRequest, RequestCategory, Priority, FundingSource } from '@/types';

const CATEGORY_OPTIONS: { value: RequestCategory; label: string }[] = [
  { value: 'hardware_purchase', label: 'Hardware Purchase' },
  { value: 'software_license', label: 'Software License' },
  { value: 'service_contract', label: 'Service Contract' },
  { value: 'cloud_service', label: 'Cloud Service' },
  { value: 'maintenance_support', label: 'Maintenance & Support' },
  { value: 'other', label: 'Other' },
];

const SUB_CATEGORY_OPTIONS: Record<RequestCategory, string[]> = {
  hardware_purchase: [
    'New Procurement',
    'Lifecycle Replacement',
    'Upgrade/Expansion',
    'Emergency Replacement',
  ],
  software_license: [
    'New License',
    'License Renewal',
    'Subscription Renewal',
    'Version Upgrade',
  ],
  service_contract: [
    'New Contract',
    'Follow-on/Re-compete',
    'Bridge Contract',
    'Modification',
  ],
  cloud_service: ['New Subscription', 'Tier/Capacity Change', 'Renewal'],
  maintenance_support: [
    'Warranty Extension',
    'Support Contract Renewal',
    'Maintenance Agreement',
  ],
  other: ['Training', 'Consulting', 'Professional Services'],
};

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const FISCAL_YEAR_OPTIONS = ['FY25', 'FY26', 'FY27'];

const CONTRACT_VEHICLE_OPTIONS = [
  'GSA Schedule',
  'BPA',
  'GWAC',
  'Open Market',
  'Full & Open',
];

const DATA_CLASSIFICATION_OPTIONS = [
  'Unclassified',
  'CUI',
  'FOUO',
  'Classified',
];

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`;
}

interface FormData {
  title: string;
  description: string;
  category: RequestCategory;
  sub_category: string;
  priority: Priority;
  fiscal_year: string;
  estimated_total: string;
  quantity: string;
  funding_source_id: string;
  need_by_date: string;
  contract_end_date: string;
  vendor_name: string;
  product_name: string;
  product_specs: string;
  existing_contract_number: string;
  existing_vendor: string;
  existing_contract_value: string;
  contract_vehicle: string;
  data_classification: string;
  justification: string;
}

const INITIAL_FORM: FormData = {
  title: '',
  description: '',
  category: 'hardware_purchase',
  sub_category: '',
  priority: 'medium',
  fiscal_year: 'FY26',
  estimated_total: '',
  quantity: '',
  funding_source_id: '',
  need_by_date: '',
  contract_end_date: '',
  vendor_name: '',
  product_name: '',
  product_specs: '',
  existing_contract_number: '',
  existing_vendor: '',
  existing_contract_value: '',
  contract_vehicle: '',
  data_classification: '',
  justification: '',
};

export default function RequestCreatePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [fundingSources, setFundingSources] = useState<FundingSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load funding sources
  useEffect(() => {
    requestsApi.getFundingSources().then(setFundingSources).catch(() => {});
  }, []);

  // Load existing request when editing
  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    requestsApi
      .get(Number(id))
      .then((data) => {
        setForm({
          title: data.title || '',
          description: data.description || '',
          category: data.category || 'hardware_purchase',
          sub_category: data.sub_category || '',
          priority: data.priority || 'medium',
          fiscal_year: data.fiscal_year || 'FY26',
          estimated_total: data.estimated_total ? String(data.estimated_total) : '',
          quantity: data.quantity ? String(data.quantity) : '',
          funding_source_id: data.funding_source_id ? String(data.funding_source_id) : '',
          need_by_date: data.need_by_date || '',
          contract_end_date: data.contract_end_date || '',
          vendor_name: data.vendor_name || '',
          product_name: data.product_name || '',
          product_specs:
            data.product_specs && Object.keys(data.product_specs).length > 0
              ? JSON.stringify(data.product_specs, null, 2)
              : '',
          existing_contract_number: data.existing_contract_number || '',
          existing_vendor: data.existing_vendor || '',
          existing_contract_value: data.existing_contract_value
            ? String(data.existing_contract_value)
            : '',
          contract_vehicle: data.contract_vehicle || '',
          data_classification:
            (data.product_specs as any)?.data_classification || '',
          justification: data.justification || '',
        });
      })
      .catch((err: any) => {
        setError(err?.response?.data?.error || 'Failed to load request.');
      })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      // Reset sub_category when category changes
      if (name === 'category') {
        next.sub_category = '';
      }
      return next;
    });
  };

  const buildPayload = (): Partial<AcquisitionRequest> => {
    const payload: Record<string, any> = {
      title: form.title,
      description: form.description,
      category: form.category,
      sub_category: form.sub_category,
      priority: form.priority,
      fiscal_year: form.fiscal_year,
      estimated_total: form.estimated_total ? parseFloat(form.estimated_total) : 0,
      justification: form.justification,
    };

    if (form.funding_source_id) {
      payload.funding_source_id = parseInt(form.funding_source_id, 10);
    }
    if (form.need_by_date) payload.need_by_date = form.need_by_date;
    if (form.contract_end_date) payload.contract_end_date = form.contract_end_date;
    if (form.vendor_name) payload.vendor_name = form.vendor_name;
    if (form.product_name) payload.product_name = form.product_name;
    if (form.quantity) payload.quantity = parseInt(form.quantity, 10);
    if (form.existing_contract_number)
      payload.existing_contract_number = form.existing_contract_number;
    if (form.existing_vendor) payload.existing_vendor = form.existing_vendor;
    if (form.existing_contract_value)
      payload.existing_contract_value = parseFloat(form.existing_contract_value);
    if (form.contract_vehicle) payload.contract_vehicle = form.contract_vehicle;

    // Build product_specs
    const specs: Record<string, any> = {};
    if (form.product_specs) {
      try {
        Object.assign(specs, JSON.parse(form.product_specs));
      } catch {
        specs.notes = form.product_specs;
      }
    }
    if (form.data_classification) {
      specs.data_classification = form.data_classification;
    }
    if (Object.keys(specs).length > 0) {
      payload.product_specs = specs;
    }

    return payload;
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = buildPayload();
      let result: AcquisitionRequest;
      if (isEdit) {
        result = await requestsApi.update(Number(id), payload);
      } else {
        result = await requestsApi.create(payload);
      }
      navigate(`/requests/${result.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save request.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!form.justification.trim()) {
      setError('Justification is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = buildPayload();
      let result: AcquisitionRequest;
      if (isEdit) {
        result = await requestsApi.update(Number(id), payload);
      } else {
        result = await requestsApi.create(payload);
      }
      // Now submit for approval
      await requestsApi.submit(result.id);
      navigate(`/requests/${result.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to submit request.');
    } finally {
      setSaving(false);
    }
  };

  const selectedFunding = fundingSources.find(
    (fs) => String(fs.id) === form.funding_source_id
  );

  const showQuantity =
    form.category === 'hardware_purchase' || form.category === 'software_license';
  const showServiceContract = form.category === 'service_contract';
  const showCloud = form.category === 'cloud_service';
  const showContractEndDate = form.category === 'service_contract';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-eaw-primary" />
        <span className="ml-2 text-sm text-eaw-muted">Loading request...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <ArrowLeft size={20} className="text-eaw-muted" />
        </button>
        <PlusCircle size={24} className="text-eaw-primary" />
        <div>
          <h1 className="text-xl font-bold text-eaw-font">
            {isEdit ? 'Edit Acquisition Request' : 'New Acquisition Request'}
          </h1>
          <p className="text-sm text-eaw-muted">
            {isEdit
              ? 'Update the request details below'
              : 'Fill in the details to create a new acquisition request'}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Section 1: Basic Information */}
      <div className="eaw-card mb-4">
        <h2 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-4 pb-2 border-b border-eaw-border">
          Basic Information
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-eaw-font mb-1">
              Title <span className="text-eaw-danger">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              className="input-field"
              placeholder="Brief title for this acquisition request"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-eaw-font mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              className="input-field"
              rows={3}
              placeholder="Detailed description of what is being acquired and why"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-eaw-font mb-1">
                Category
              </label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="select-field w-full"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-eaw-font mb-1">
                Sub-Category
              </label>
              <select
                name="sub_category"
                value={form.sub_category}
                onChange={handleChange}
                className="select-field w-full"
              >
                <option value="">Select sub-category</option>
                {(SUB_CATEGORY_OPTIONS[form.category] || []).map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-eaw-font mb-1">
                Priority
              </label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="select-field w-full"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-eaw-font mb-1">
                Fiscal Year
              </label>
              <select
                name="fiscal_year"
                value={form.fiscal_year}
                onChange={handleChange}
                className="select-field w-full"
              >
                {FISCAL_YEAR_OPTIONS.map((fy) => (
                  <option key={fy} value={fy}>
                    {fy}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Cost & Funding */}
      <div className="eaw-card mb-4">
        <h2 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-4 pb-2 border-b border-eaw-border">
          Cost & Funding
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-eaw-font mb-1">
                Estimated Total ($)
              </label>
              <input
                type="number"
                name="estimated_total"
                value={form.estimated_total}
                onChange={handleChange}
                className="input-field"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>

            {showQuantity && (
              <div>
                <label className="block text-sm font-medium text-eaw-font mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={form.quantity}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="1"
                  min="1"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-eaw-font mb-1">
                Funding Source
              </label>
              <select
                name="funding_source_id"
                value={form.funding_source_id}
                onChange={handleChange}
                className="select-field w-full"
              >
                <option value="">Select funding source</option>
                {fundingSources.map((fs) => (
                  <option key={fs.id} value={fs.id}>
                    {fs.name} ({fs.fiscal_year})
                  </option>
                ))}
              </select>
              {selectedFunding && (
                <p className="mt-1 text-xs text-eaw-muted">
                  Available: {formatCurrency(selectedFunding.available)} of{' '}
                  {formatCurrency(selectedFunding.total_budget)}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-eaw-font mb-1">
                Need-By Date
              </label>
              <input
                type="date"
                name="need_by_date"
                value={form.need_by_date}
                onChange={handleChange}
                className="input-field"
              />
            </div>

            {showContractEndDate && (
              <div>
                <label className="block text-sm font-medium text-eaw-font mb-1">
                  Contract End Date
                </label>
                <input
                  type="date"
                  name="contract_end_date"
                  value={form.contract_end_date}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Vendor & Product */}
      <div className="eaw-card mb-4">
        <h2 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-4 pb-2 border-b border-eaw-border">
          Vendor & Product
        </h2>
        <div className="space-y-4">
          {/* Common vendor fields for hardware, software, cloud */}
          {!showServiceContract && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-eaw-font mb-1">
                  Vendor Name
                </label>
                <input
                  type="text"
                  name="vendor_name"
                  value={form.vendor_name}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="e.g., Dell, Microsoft, AWS"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-eaw-font mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  name="product_name"
                  value={form.product_name}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="e.g., Latitude 5540, M365 E5"
                />
              </div>
            </div>
          )}

          {/* Hardware specific: product specs */}
          {form.category === 'hardware_purchase' && (
            <div>
              <label className="block text-sm font-medium text-eaw-font mb-1">
                Product Specifications
              </label>
              <textarea
                name="product_specs"
                value={form.product_specs}
                onChange={handleChange}
                className="input-field"
                rows={3}
                placeholder="Enter specs (e.g., CPU, RAM, storage) or paste JSON"
              />
            </div>
          )}

          {/* Software specific: license details */}
          {form.category === 'software_license' && (
            <div>
              <label className="block text-sm font-medium text-eaw-font mb-1">
                License Details
              </label>
              <textarea
                name="product_specs"
                value={form.product_specs}
                onChange={handleChange}
                className="input-field"
                rows={3}
                placeholder="License type, term, number of seats, etc."
              />
            </div>
          )}

          {/* Service Contract specific */}
          {showServiceContract && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-eaw-font mb-1">
                    Existing Contract Number
                  </label>
                  <input
                    type="text"
                    name="existing_contract_number"
                    value={form.existing_contract_number}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="e.g., GS-00F-1234"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-eaw-font mb-1">
                    Existing Vendor
                  </label>
                  <input
                    type="text"
                    name="existing_vendor"
                    value={form.existing_vendor}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Current contract vendor"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-eaw-font mb-1">
                    Existing Contract Value ($)
                  </label>
                  <input
                    type="number"
                    name="existing_contract_value"
                    value={form.existing_contract_value}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-eaw-font mb-1">
                    Contract Vehicle
                  </label>
                  <select
                    name="contract_vehicle"
                    value={form.contract_vehicle}
                    onChange={handleChange}
                    className="select-field w-full"
                  >
                    <option value="">Select vehicle</option>
                    {CONTRACT_VEHICLE_OPTIONS.map((cv) => (
                      <option key={cv} value={cv}>
                        {cv}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Cloud specific */}
          {showCloud && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-eaw-font mb-1">
                  Data Classification
                </label>
                <select
                  name="data_classification"
                  value={form.data_classification}
                  onChange={handleChange}
                  className="select-field w-full"
                >
                  <option value="">Select classification</option>
                  {DATA_CLASSIFICATION_OPTIONS.map((dc) => (
                    <option key={dc} value={dc}>
                      {dc}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Justification */}
      <div className="eaw-card mb-6">
        <h2 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-4 pb-2 border-b border-eaw-border">
          Justification
        </h2>
        <div>
          <label className="block text-sm font-medium text-eaw-font mb-1">
            Business Justification <span className="text-eaw-danger">*</span>
          </label>
          <textarea
            name="justification"
            value={form.justification}
            onChange={handleChange}
            className="input-field"
            rows={6}
            placeholder="Explain the business need, impact of not acquiring, alternatives considered, and how this supports organizational goals..."
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          Submit for Approval
        </button>

        <button
          onClick={handleSaveDraft}
          disabled={saving}
          className="btn-secondary"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          Save as Draft
        </button>

        <button
          onClick={() => navigate(-1)}
          className="btn-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
