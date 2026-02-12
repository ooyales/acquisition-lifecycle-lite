import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Loader2,
  AlertCircle,
  Filter,
  Clock,
  DollarSign,
  Play,
  ArrowRight,
} from 'lucide-react';
import { lifecycleApi } from '@/api/lifecycle';
import { LifecycleStatusBadge } from '@/components/common/StatusBadge';
import type { LifecycleEvent } from '@/types';

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-';
  return `$${value.toLocaleString()}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key: string): string {
  const [year, month] = key.split('-');
  const d = new Date(Number(year), Number(month) - 1);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const EVENT_TYPES = [
  { value: '', label: 'All Event Types' },
  { value: 'contract_renewal', label: 'Contract Renewal' },
  { value: 'warranty_expiration', label: 'Warranty Expiration' },
  { value: 'end_of_life', label: 'End of Life' },
  { value: 'tech_refresh', label: 'Tech Refresh' },
  { value: 'license_renewal', label: 'License Renewal' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'action_needed', label: 'Action Needed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'acquisition_created', label: 'Acquisition Created' },
  { value: 'completed', label: 'Completed' },
];

export default function LifecycleCalendarPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<LifecycleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Filters
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchEvents = () => {
    setLoading(true);
    setError('');
    const params: { status?: string; event_type?: string } = {};
    if (statusFilter) params.status = statusFilter;
    if (eventTypeFilter) params.event_type = eventTypeFilter;

    lifecycleApi
      .list(params)
      .then(setEvents)
      .catch((err: any) => {
        setError(err?.response?.data?.error || 'Failed to load lifecycle events.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventTypeFilter, statusFilter]);

  const handleCreateRequest = async (eventId: number) => {
    setActionLoading(eventId);
    setError('');
    try {
      const result = await lifecycleApi.createRequest(eventId);
      if (result.request_id) {
        navigate(`/requests/${result.request_id}`);
      } else {
        fetchEvents();
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create acquisition request.');
    } finally {
      setActionLoading(null);
    }
  };

  // Group events by month
  const groupedByMonth: Record<string, LifecycleEvent[]> = {};
  const sorted = [...events].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
  );
  sorted.forEach((evt) => {
    const key = getMonthKey(evt.event_date);
    if (!groupedByMonth[key]) groupedByMonth[key] = [];
    groupedByMonth[key].push(evt);
  });
  const monthKeys = Object.keys(groupedByMonth).sort();

  // Summary stats
  const totalCost = events.reduce((sum, e) => sum + (e.estimated_cost || 0), 0);
  const upcomingCount = events.filter((e) => e.status === 'upcoming').length;
  const actionNeededCount = events.filter((e) => e.status === 'action_needed').length;
  const createdCount = events.filter((e) => e.status === 'acquisition_created').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-eaw-primary" />
        <span className="ml-2 text-sm text-eaw-muted">Loading lifecycle events...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <Calendar size={24} className="text-eaw-primary" />
        <div>
          <h1 className="text-xl font-bold text-eaw-font">Lifecycle Calendar</h1>
          <p className="text-sm text-eaw-muted">
            Upcoming lifecycle events, renewals, and end-of-life dates
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="eaw-card">
          <h2 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-2">
            Upcoming (30 days)
          </h2>
          <p className="text-sm text-eaw-muted">
            Events within the next 30 days that need attention.
          </p>
          <div className="mt-3 text-2xl font-bold text-eaw-warning">
            {upcomingCount}
          </div>
        </div>

        <div className="eaw-card">
          <h2 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-2">
            Action Needed
          </h2>
          <p className="text-sm text-eaw-muted">
            Events past their lead time requiring immediate action.
          </p>
          <div className="mt-3 text-2xl font-bold text-eaw-danger">
            {actionNeededCount}
          </div>
        </div>

        <div className="eaw-card">
          <h2 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-2">
            Acquisitions Created
          </h2>
          <p className="text-sm text-eaw-muted">
            Lifecycle events that already have linked acquisition requests.
          </p>
          <div className="mt-3 text-2xl font-bold text-eaw-success">
            {createdCount}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="eaw-card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-eaw-muted">
            <Filter size={16} />
            <span className="font-medium">Filters:</span>
          </div>
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="input-field text-sm py-1.5 w-auto"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field text-sm py-1.5 w-auto"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-eaw-muted ml-auto">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Timeline View grouped by month */}
      {events.length === 0 ? (
        <div className="eaw-card">
          <p className="text-sm text-eaw-muted text-center py-12">
            No lifecycle events found matching the current filters.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {monthKeys.map((monthKey) => (
            <div key={monthKey}>
              <h3 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-3 flex items-center gap-2">
                <Calendar size={16} className="text-eaw-primary" />
                {getMonthLabel(monthKey)}
                <span className="badge-muted ml-1">
                  {groupedByMonth[monthKey].length}
                </span>
              </h3>

              <div className="space-y-2">
                {groupedByMonth[monthKey].map((evt) => {
                  const days = daysUntil(evt.event_date);
                  const isPast = days < 0;
                  const isUrgent = days >= 0 && days <= 30;
                  const isProcessing = actionLoading === evt.id;

                  return (
                    <div
                      key={evt.id}
                      className={`eaw-card border-l-4 ${
                        evt.status === 'action_needed'
                          ? 'border-l-red-500'
                          : evt.status === 'acquisition_created'
                          ? 'border-l-green-500'
                          : evt.status === 'completed'
                          ? 'border-l-gray-400'
                          : isUrgent
                          ? 'border-l-yellow-500'
                          : 'border-l-blue-400'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                        {/* Main Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-eaw-font truncate">
                              {evt.asset_name}
                            </span>
                            <LifecycleStatusBadge status={evt.status} />
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-eaw-muted">
                            <span className="capitalize">
                              {evt.event_type.replace(/_/g, ' ')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {formatDate(evt.event_date)}
                            </span>
                            {evt.asset_tracker_id && (
                              <span className="font-mono">{evt.asset_tracker_id}</span>
                            )}
                          </div>
                          {evt.action_needed && (
                            <p className="text-xs text-eaw-font mt-1">
                              {evt.action_needed}
                            </p>
                          )}
                        </div>

                        {/* Lead Time */}
                        <div className="flex-shrink-0 text-center px-3">
                          <div
                            className={`flex items-center gap-1 text-sm font-medium ${
                              isPast
                                ? 'text-eaw-danger'
                                : isUrgent
                                ? 'text-eaw-warning'
                                : 'text-eaw-muted'
                            }`}
                          >
                            <Clock size={14} />
                            {isPast
                              ? `${Math.abs(days)}d overdue`
                              : days === 0
                              ? 'Today'
                              : `${days}d away`}
                          </div>
                          <p className="text-[10px] text-eaw-muted mt-0.5">
                            Lead: {evt.lead_time_days}d
                          </p>
                        </div>

                        {/* Cost */}
                        <div className="flex-shrink-0 text-center px-3">
                          <div className="flex items-center gap-1 text-sm font-semibold text-eaw-font">
                            <DollarSign size={14} className="text-eaw-success" />
                            {formatCurrency(evt.estimated_cost)}
                          </div>
                          <p className="text-[10px] text-eaw-muted mt-0.5">
                            Est. Cost
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex-shrink-0 flex items-center gap-2">
                          {evt.acquisition_request_id ? (
                            <button
                              onClick={() =>
                                navigate(`/requests/${evt.acquisition_request_id}`)
                              }
                              className="btn-secondary"
                            >
                              <ArrowRight size={14} />
                              View Request
                            </button>
                          ) : evt.status !== 'completed' ? (
                            <button
                              onClick={() => handleCreateRequest(evt.id)}
                              disabled={isProcessing}
                              className="btn-primary"
                            >
                              {isProcessing ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Play size={14} />
                              )}
                              Start Acquisition
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cost Rollup Summary */}
      {events.length > 0 && (
        <div className="eaw-card mt-6">
          <h3 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-3 pb-2 border-b border-eaw-border">
            Cost Rollup Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-eaw-muted uppercase tracking-wide mb-0.5">
                Total Estimated Cost
              </p>
              <p className="text-lg font-bold text-eaw-font">
                {formatCurrency(totalCost)}
              </p>
            </div>
            <div>
              <p className="text-xs text-eaw-muted uppercase tracking-wide mb-0.5">
                Pending Action Cost
              </p>
              <p className="text-lg font-bold text-eaw-warning">
                {formatCurrency(
                  events
                    .filter((e) =>
                      ['upcoming', 'action_needed', 'in_progress'].includes(e.status)
                    )
                    .reduce((sum, e) => sum + (e.estimated_cost || 0), 0)
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-eaw-muted uppercase tracking-wide mb-0.5">
                Acquisitions Initiated
              </p>
              <p className="text-lg font-bold text-eaw-success">
                {formatCurrency(
                  events
                    .filter((e) =>
                      ['acquisition_created', 'completed'].includes(e.status)
                    )
                    .reduce((sum, e) => sum + (e.estimated_cost || 0), 0)
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
