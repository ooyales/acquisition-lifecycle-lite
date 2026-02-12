import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  DollarSign,
  AlertTriangle,
  Loader2,
  Clock,
  Activity,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { dashboardApi } from '@/api/dashboard';
import { PriorityBadge, LifecycleStatusBadge } from '@/components/common/StatusBadge';
import type { DashboardData, Priority } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  in_review: 'In Review',
  approved: 'Approved',
  package_building: 'Pkg Building',
  submitted_to_contracting: 'Contracting',
  awarded: 'Awarded',
  delivered: 'Delivered',
  closed: 'Closed',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#999',
  submitted: '#5bc0de',
  in_review: '#f0ad4e',
  approved: '#5cb85c',
  package_building: '#337ab7',
  submitted_to_contracting: '#337ab7',
  awarded: '#5cb85c',
  delivered: '#5cb85c',
  closed: '#999',
  cancelled: '#d9534f',
  returned: '#d9534f',
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '$0';
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

function formatFullCurrency(value: number | null | undefined): string {
  if (value == null) return '$0';
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

  return formatDate(dateStr);
}

function activityIcon(type: string) {
  switch (type) {
    case 'status_change':
      return <Activity size={14} className="text-eaw-primary" />;
    case 'created':
      return <FileText size={14} className="text-eaw-success" />;
    case 'comment':
      return <ClipboardCheck size={14} className="text-eaw-info" />;
    case 'approval':
      return <ClipboardCheck size={14} className="text-eaw-success" />;
    default:
      return <Clock size={14} className="text-eaw-muted" />;
  }
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi
      .get()
      .then(setData)
      .catch((err: any) => {
        setError(err?.response?.data?.error || 'Failed to load dashboard data.');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-eaw-primary" />
        <span className="ml-2 text-sm text-eaw-muted">Loading dashboard...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <LayoutDashboard size={24} className="text-eaw-primary" />
          <div>
            <h1 className="text-xl font-bold text-eaw-font">Dashboard</h1>
            <p className="text-sm text-eaw-muted">
              Acquisition pipeline overview and key metrics
            </p>
          </div>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const pipelineData = (data.pipeline || []).map((item) => ({
    ...item,
    label: STATUS_LABELS[item.status] || item.status,
    color: STATUS_COLORS[item.status] || '#999',
  }));

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <LayoutDashboard size={24} className="text-eaw-primary" />
        <div>
          <h1 className="text-xl font-bold text-eaw-font">Dashboard</h1>
          <p className="text-sm text-eaw-muted">
            Acquisition pipeline overview and key metrics
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="kpi-card">
          <div className="kpi-icon bg-blue-50 text-eaw-primary">
            <FileText size={22} />
          </div>
          <div>
            <div className="kpi-value">{data.active_requests}</div>
            <div className="kpi-label">Active Requests</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon bg-amber-50 text-eaw-warning">
            <ClipboardCheck size={22} />
          </div>
          <div>
            <div className="kpi-value">{data.pending_approvals}</div>
            <div className="kpi-label">Pending Approvals</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon bg-green-50 text-eaw-success">
            <DollarSign size={22} />
          </div>
          <div>
            <div className="kpi-value">{formatCurrency(data.total_committed)}</div>
            <div className="kpi-label">Budget Committed</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon bg-red-50 text-eaw-danger">
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="kpi-value">{data.overdue_steps}</div>
            <div className="kpi-label">Overdue Steps</div>
          </div>
        </div>
      </div>

      {/* Pipeline + Approval Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Pipeline by Status */}
        <div className="eaw-card">
          <h2 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-4">
            Pipeline by Status
          </h2>
          {pipelineData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={pipelineData}
                  layout="vertical"
                  margin={{ top: 0, right: 20, bottom: 0, left: 80 }}
                >
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis
                    dataKey="label"
                    type="category"
                    tick={{ fontSize: 11 }}
                    width={80}
                  />
                  <Tooltip
                    formatter={(value: number) => [value, 'Requests']}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 4,
                      border: '1px solid #ddd',
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {pipelineData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-eaw-muted text-center py-8">
              No requests in the pipeline yet.
            </p>
          )}
        </div>

        {/* Approval Queue */}
        <div className="eaw-card">
          <h2 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-4">
            Approval Queue
          </h2>
          {data.approval_queue && data.approval_queue.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="eaw-table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Step</th>
                    <th>Due</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {data.approval_queue.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/requests/${item.id}`)}
                      className="cursor-pointer"
                    >
                      <td>
                        <div className="font-mono text-xs text-eaw-link">
                          {item.request_number}
                        </div>
                        <div className="text-sm font-medium truncate max-w-[200px]">
                          {item.title}
                        </div>
                      </td>
                      <td className="text-sm">{item.step_name}</td>
                      <td className="text-sm text-eaw-muted whitespace-nowrap">
                        {formatDate(item.due_date)}
                      </td>
                      <td>
                        {item.priority ? (
                          <PriorityBadge priority={item.priority as Priority} />
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-eaw-muted text-center py-8">
              No pending approvals.
            </p>
          )}
        </div>
      </div>

      {/* Budget Summary + Lifecycle Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Budget Summary */}
        <div className="eaw-card">
          <h2 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-4">
            Budget Summary
          </h2>
          {data.budget_summary && data.budget_summary.length > 0 ? (
            <div className="space-y-4">
              {data.budget_summary.map((source) => {
                const total = (source as any).total_budget ?? source.total ?? 0;
                const usedPercent =
                  total > 0
                    ? Math.min(
                        ((source.spent + source.committed) / total) * 100,
                        100
                      )
                    : 0;
                const spentPercent =
                  total > 0
                    ? Math.min((source.spent / total) * 100, 100)
                    : 0;
                return (
                  <div key={source.name} className="pb-3 border-b border-eaw-border-light last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-eaw-font">
                        {source.name}
                      </span>
                      <span className="text-xs text-eaw-muted">
                        {formatFullCurrency(source.available)} available
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-1">
                      <div className="h-full relative rounded-full" style={{ width: `${usedPercent}%` }}>
                        {/* Spent portion */}
                        <div
                          className="absolute left-0 top-0 h-full rounded-l-full"
                          style={{
                            width:
                              usedPercent > 0
                                ? `${(spentPercent / usedPercent) * 100}%`
                                : '0%',
                            backgroundColor: '#5cb85c',
                          }}
                        />
                        {/* Committed portion */}
                        <div
                          className="absolute top-0 h-full rounded-r-full"
                          style={{
                            left:
                              usedPercent > 0
                                ? `${(spentPercent / usedPercent) * 100}%`
                                : '0%',
                            width:
                              usedPercent > 0
                                ? `${((usedPercent - spentPercent) / usedPercent) * 100}%`
                                : '0%',
                            backgroundColor: '#f0ad4e',
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-eaw-muted">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-eaw-success inline-block" />
                        Spent: {formatFullCurrency(source.spent)}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-eaw-warning inline-block" />
                        Committed: {formatFullCurrency(source.committed)}
                      </span>
                      <span>Total: {formatFullCurrency(total)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-eaw-muted text-center py-8">
              No funding sources configured.
            </p>
          )}
        </div>

        {/* Lifecycle Alerts */}
        <div className="eaw-card">
          <h2 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-4">
            Lifecycle Alerts
          </h2>
          {data.lifecycle_alerts && data.lifecycle_alerts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="eaw-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Status</th>
                    {data.lifecycle_alerts.some((a) => a.estimated_cost != null) && (
                      <th>Est. Cost</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.lifecycle_alerts.map((alert) => (
                    <tr key={alert.id}>
                      <td className="text-sm font-medium">{alert.asset_name}</td>
                      <td className="text-sm text-eaw-muted">{alert.event_type}</td>
                      <td className="text-sm text-eaw-muted whitespace-nowrap">
                        {formatDate(alert.event_date)}
                      </td>
                      <td>
                        <LifecycleStatusBadge
                          status={
                            alert.status as
                              | 'upcoming'
                              | 'action_needed'
                              | 'in_progress'
                              | 'acquisition_created'
                              | 'completed'
                          }
                        />
                      </td>
                      {data.lifecycle_alerts.some((a) => a.estimated_cost != null) && (
                        <td className="text-sm font-mono">
                          {alert.estimated_cost != null
                            ? formatFullCurrency(alert.estimated_cost)
                            : '-'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-eaw-muted text-center py-8">
              No upcoming lifecycle events.
            </p>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="eaw-card">
        <h2 className="text-sm font-semibold text-eaw-font uppercase tracking-wide mb-4">
          Recent Activity
        </h2>
        {data.recent_activity && data.recent_activity.length > 0 ? (
          <div className="space-y-0">
            {data.recent_activity.map((activity, idx) => (
              <div
                key={activity.id}
                className={`flex items-start gap-3 py-3 ${
                  idx < data.recent_activity.length - 1
                    ? 'border-b border-eaw-border-light'
                    : ''
                }`}
              >
                <div className="mt-0.5 p-1.5 bg-gray-50 rounded">
                  {activityIcon(activity.activity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-eaw-font">{activity.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-eaw-muted">
                    <span>{activity.actor}</span>
                    <ChevronRight size={12} />
                    <span>{formatRelativeDate(activity.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-eaw-muted text-center py-8">
            No recent activity.
          </p>
        )}
      </div>
    </div>
  );
}
