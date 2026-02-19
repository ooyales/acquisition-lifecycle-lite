import { useNavigate } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { ACQUISITION_TYPE_LABELS, TIER_LABELS } from '../../types';

interface RequestRow {
  id: number;
  request_number?: string;
  title: string;
  acquisition_type?: string | null;
  tier?: string | null;
  estimated_value?: number;
  status: string;
  // From drill-down endpoints: plain string. From /requests list: {display_name, id} object.
  requestor?: string | { display_name: string; id: number } | null;
  gate_name?: string;
  approver_role?: string;
  is_overdue?: boolean;
  team?: string;
  advisory_status?: string;
  clin_number?: string;
}

function getRequestorName(r: RequestRow['requestor']): string {
  if (!r) return '—';
  if (typeof r === 'string') return r;
  return r.display_name || '—';
}

interface ExecutionRow {
  id: number;
  request_number?: string;
  title: string;
  execution_type: string;
  estimated_cost?: number;
  status: string;
  requested_by?: string | null;
}

export function RequestDrillDownTable({ data }: { data: RequestRow[] }) {
  const navigate = useNavigate();

  if (data.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-6">No records found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="eaw-table">
        <thead>
          <tr>
            <th>Request #</th>
            <th>Title</th>
            <th>Type</th>
            <th>Tier</th>
            <th className="text-right">Value</th>
            <th>Status</th>
            <th>Requestor</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr
              key={row.id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => navigate(`/requests/${row.id}`)}
            >
              <td className="text-sm font-mono">{row.request_number || '—'}</td>
              <td className="font-medium max-w-[260px] truncate">{row.title}</td>
              <td className="text-sm">{ACQUISITION_TYPE_LABELS[row.acquisition_type || ''] || row.acquisition_type || '—'}</td>
              <td><StatusBadge status={row.tier || ''} label={TIER_LABELS[row.tier || '']} /></td>
              <td className="text-right text-sm font-mono">
                {row.estimated_value != null ? `$${row.estimated_value.toLocaleString()}` : '—'}
              </td>
              <td><StatusBadge status={row.status} /></td>
              <td className="text-sm">{getRequestorName(row.requestor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-2">{data.length} record{data.length !== 1 ? 's' : ''}</p>
    </div>
  );
}

const EXEC_TYPE: Record<string, string> = { odc: 'ODC (HW/SW)', travel: 'Travel' };

export function ExecutionDrillDownTable({ data }: { data: ExecutionRow[] }) {
  const navigate = useNavigate();

  if (data.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-6">No records found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="eaw-table">
        <thead>
          <tr>
            <th>Request #</th>
            <th>Title</th>
            <th>Type</th>
            <th className="text-right">Est. Cost</th>
            <th>Status</th>
            <th>Requested By</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr
              key={row.id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => navigate(`/execution/${row.id}`)}
            >
              <td className="text-sm font-mono">{row.request_number || '—'}</td>
              <td className="font-medium max-w-[280px] truncate">{row.title}</td>
              <td className="text-sm">{EXEC_TYPE[row.execution_type] || row.execution_type}</td>
              <td className="text-right text-sm font-mono">
                {row.estimated_cost != null ? `$${row.estimated_cost.toLocaleString()}` : '—'}
              </td>
              <td><StatusBadge status={row.status} /></td>
              <td className="text-sm">{row.requested_by || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-2">{data.length} record{data.length !== 1 ? 's' : ''}</p>
    </div>
  );
}
