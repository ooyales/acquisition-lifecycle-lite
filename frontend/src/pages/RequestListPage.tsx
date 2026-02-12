import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, PlusCircle, Filter, Loader2 } from 'lucide-react';
import { requestsApi } from '@/api/requests';
import { RequestStatusBadge, PriorityBadge } from '@/components/common/StatusBadge';
import type { AcquisitionRequest, RequestCategory, RequestStatus, Priority } from '@/types';

const CATEGORY_LABELS: Record<RequestCategory, string> = {
  hardware_purchase: 'Hardware',
  software_license: 'Software',
  service_contract: 'Service Contract',
  cloud_service: 'Cloud',
  maintenance_support: 'Maintenance',
  other: 'Other',
};

const STATUS_OPTIONS: { value: RequestStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'package_building', label: 'Package Building' },
  { value: 'submitted_to_contracting', label: 'Submitted to Contracting' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returned', label: 'Returned' },
];

const CATEGORY_OPTIONS: { value: RequestCategory | ''; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'hardware_purchase', label: 'Hardware' },
  { value: 'software_license', label: 'Software' },
  { value: 'service_contract', label: 'Service Contract' },
  { value: 'cloud_service', label: 'Cloud' },
  { value: 'maintenance_support', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_OPTIONS: { value: Priority | ''; label: string }[] = [
  { value: '', label: 'All Priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default function RequestListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [requests, setRequests] = useState<AcquisitionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || '');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  const [sortKey, setSortKey] = useState<string>('updated_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters: Record<string, string> = {};
      if (statusFilter) filters.status = statusFilter;
      if (categoryFilter) filters.category = categoryFilter;
      if (priorityFilter) filters.priority = priorityFilter;
      if (searchQuery.trim()) filters.search = searchQuery.trim();

      const data = await requestsApi.list(filters);
      setRequests(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, priorityFilter, searchQuery]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Sync filters to URL params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category = categoryFilter;
    if (priorityFilter) params.priority = priorityFilter;
    if (searchQuery.trim()) params.search = searchQuery.trim();
    setSearchParams(params, { replace: true });
  }, [statusFilter, categoryFilter, priorityFilter, searchQuery, setSearchParams]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedRequests = [...requests].sort((a, b) => {
    const aVal = (a as any)[sortKey];
    const bVal = (b as any)[sortKey];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    const cmp = String(aVal).localeCompare(String(bVal));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortIndicator = ({ column }: { column: string }) => {
    if (sortKey !== column) return null;
    return (
      <span className="ml-1 text-eaw-primary">
        {sortDir === 'asc' ? '\u2191' : '\u2193'}
      </span>
    );
  };

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText size={24} className="text-eaw-primary" />
          <div>
            <h1 className="text-xl font-bold text-eaw-font">All Requests</h1>
            <p className="text-sm text-eaw-muted">
              Browse and manage acquisition requests across all statuses
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/requests/new')}
          className="btn-primary"
        >
          <PlusCircle size={16} />
          New Request
        </button>
      </div>

      {/* Filter Bar */}
      <div className="eaw-card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Filter size={16} className="text-eaw-muted flex-shrink-0" />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select-field"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="select-field"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="select-field"
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title or request #..."
            className="input-field max-w-xs"
          />

          {(statusFilter || categoryFilter || priorityFilter || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('');
                setCategoryFilter('');
                setPriorityFilter('');
                setSearchQuery('');
              }}
              className="text-sm text-eaw-link hover:text-eaw-link-hover"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="eaw-card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-eaw-primary" />
            <span className="ml-2 text-sm text-eaw-muted">Loading requests...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="eaw-table">
              <thead>
                <tr>
                  <th
                    className="cursor-pointer select-none"
                    onClick={() => handleSort('request_number')}
                  >
                    Request # <SortIndicator column="request_number" />
                  </th>
                  <th
                    className="cursor-pointer select-none"
                    onClick={() => handleSort('title')}
                  >
                    Title <SortIndicator column="title" />
                  </th>
                  <th
                    className="cursor-pointer select-none"
                    onClick={() => handleSort('category')}
                  >
                    Category <SortIndicator column="category" />
                  </th>
                  <th
                    className="cursor-pointer select-none"
                    onClick={() => handleSort('estimated_total')}
                  >
                    Est. Cost <SortIndicator column="estimated_total" />
                  </th>
                  <th
                    className="cursor-pointer select-none"
                    onClick={() => handleSort('status')}
                  >
                    Status <SortIndicator column="status" />
                  </th>
                  <th
                    className="cursor-pointer select-none"
                    onClick={() => handleSort('priority')}
                  >
                    Priority <SortIndicator column="priority" />
                  </th>
                  <th
                    className="cursor-pointer select-none"
                    onClick={() => handleSort('requestor_name')}
                  >
                    Requestor <SortIndicator column="requestor_name" />
                  </th>
                  <th
                    className="cursor-pointer select-none"
                    onClick={() => handleSort('updated_at')}
                  >
                    Updated <SortIndicator column="updated_at" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-eaw-muted">
                      {searchQuery || statusFilter || categoryFilter || priorityFilter
                        ? 'No requests match your filters.'
                        : 'No acquisition requests yet. Click "New Request" to create one.'}
                    </td>
                  </tr>
                ) : (
                  sortedRequests.map((req) => (
                    <tr
                      key={req.id}
                      onClick={() => navigate(`/requests/${req.id}`)}
                      className="cursor-pointer"
                    >
                      <td className="font-mono text-sm text-eaw-link">
                        {req.request_number}
                      </td>
                      <td className="font-medium max-w-xs truncate">
                        {req.title}
                      </td>
                      <td>
                        {CATEGORY_LABELS[req.category] || req.category}
                      </td>
                      <td className="font-mono">
                        {formatCurrency(req.estimated_total)}
                      </td>
                      <td>
                        <RequestStatusBadge status={req.status} />
                      </td>
                      <td>
                        <PriorityBadge priority={req.priority} />
                      </td>
                      <td className="text-eaw-muted">
                        {req.requestor_name}
                      </td>
                      <td className="text-eaw-muted whitespace-nowrap">
                        {formatRelativeDate(req.updated_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
