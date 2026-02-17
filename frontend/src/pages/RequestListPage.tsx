import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { requestsApi } from '../api/requests';
import StatusBadge from '../components/common/StatusBadge';
import { ACQUISITION_TYPE_LABELS, TIER_LABELS, PIPELINE_LABELS } from '../types';
import type { AcquisitionRequest } from '../types';

const PER_PAGE = 15;

export default function RequestListPage() {
  const [requests, setRequests] = useState<AcquisitionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string | number> = { page, per_page: PER_PAGE };
    if (statusFilter) params.status = statusFilter;
    if (search) params.search = search;
    requestsApi.list(params).then(data => {
      if (Array.isArray(data)) {
        setRequests(data);
        setTotal(data.length);
        setTotalPages(1);
      } else {
        setRequests(data.requests || []);
        setTotal(data.total || 0);
        setTotalPages(data.pages || 1);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [statusFilter, search, page]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const statuses = ['draft', 'submitted', 'iss_review', 'asr_review', 'finance_review', 'ko_review', 'legal_review', 'cio_approval', 'senior_review', 'approved', 'awarded', 'closed', 'cancelled', 'returned'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Acquisition Requests</h1>
          <p className="text-sm text-gray-500 mt-1">{total} requests</p>
        </div>
        <button onClick={() => navigate('/intake')} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Acquisition
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field" style={{ paddingLeft: '2.25rem' }} placeholder="Search requests..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select-field" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No requests found.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="eaw-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Tier</th>
                  <th>Pipeline</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/requests/${req.id}`)}>
                    <td className="text-gray-500">#{req.id}</td>
                    <td className="font-medium">{req.title}</td>
                    <td className="text-sm">{ACQUISITION_TYPE_LABELS[req.acquisition_type || ''] || req.acquisition_type}</td>
                    <td><StatusBadge status={req.tier || ''} label={TIER_LABELS[req.tier || '']} /></td>
                    <td className="text-sm">{PIPELINE_LABELS[req.pipeline || ''] || req.pipeline}</td>
                    <td className="text-sm">${(req.estimated_value || 0).toLocaleString()}</td>
                    <td><StatusBadge status={req.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="text-sm text-gray-600 px-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
