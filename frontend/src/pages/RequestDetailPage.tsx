import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, ClipboardCheck, Shield, Package, ArrowLeft, Send, Trash2 } from 'lucide-react';
import { requestsApi } from '../api/requests';
import { documentsApi } from '../api/documents';
import { approvalsApi } from '../api/approvals';
import { advisoryApi } from '../api/advisory';
import { clinsApi } from '../api/clins';
import StatusBadge from '../components/common/StatusBadge';
import DocumentChecklist from '../components/documents/DocumentChecklist';
import ApprovalPipeline from '../components/approvals/ApprovalPipeline';
import AdvisoryPanel from '../components/advisory/AdvisoryPanel';
import { ACQUISITION_TYPE_LABELS, TIER_LABELS, PIPELINE_LABELS } from '../types';
import type { AcquisitionRequest, PackageDocument, ApprovalStep, AdvisoryInput, AcquisitionCLIN } from '../types';
import { useAuthStore } from '../store/authStore';

type Tab = 'overview' | 'documents' | 'approvals' | 'advisory' | 'clins';

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [request, setRequest] = useState<AcquisitionRequest | null>(null);
  const [documents, setDocuments] = useState<PackageDocument[]>([]);
  const [approvals, setApprovals] = useState<ApprovalStep[]>([]);
  const [advisories, setAdvisories] = useState<AdvisoryInput[]>([]);
  const [clins, setClins] = useState<AcquisitionCLIN[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);

  const reqId = Number(id);

  const loadData = () => {
    Promise.all([
      requestsApi.get(reqId),
      documentsApi.getForRequest(reqId).catch(() => []),
      approvalsApi.forRequest(reqId).catch(() => []),
      advisoryApi.forRequest(reqId).catch(() => []),
      clinsApi.forRequest(reqId).catch(() => []),
    ]).then(([req, docs, apprs, advs, cls]) => {
      setRequest(req);
      setDocuments(Array.isArray(docs) ? docs : docs.documents || []);
      setApprovals(Array.isArray(apprs) ? apprs : apprs.steps || []);
      setAdvisories(Array.isArray(advs) ? advs : advs.advisories || []);
      setClins(Array.isArray(cls) ? cls : cls.clins || []);
      setLoading(false);
    });
  };

  useEffect(() => { loadData(); }, [reqId]);

  const handleSubmit = async () => {
    await requestsApi.submit(reqId);
    loadData();
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete request "${request?.title}"? This cannot be undone.`)) return;
    await requestsApi.delete(reqId);
    navigate('/requests');
  };

  const canDelete = user?.role === 'admin';

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>;
  if (!request) return <div className="text-center py-12 text-gray-500">Request not found</div>;

  const tabs: { key: Tab; label: string; icon: typeof FileText; count?: number }[] = [
    { key: 'overview', label: 'Overview', icon: FileText },
    { key: 'documents', label: 'Documents', icon: FileText, count: documents.filter(d => d.is_required).length },
    { key: 'approvals', label: 'Approvals', icon: ClipboardCheck, count: approvals.length },
    { key: 'advisory', label: 'Advisory', icon: Shield, count: advisories.length },
    { key: 'clins', label: 'CLINs', icon: Package, count: clins.length },
  ];

  const clinTotal = clins.reduce((s, c) => s + (c.clin_ceiling || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/requests')} className="p-1 hover:bg-gray-200 rounded">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{request.title}</h1>
            <StatusBadge status={request.status} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {ACQUISITION_TYPE_LABELS[request.acquisition_type || ''] || request.acquisition_type}
            {' · '}{TIER_LABELS[request.tier || ''] || request.tier}
            {' · '}{PIPELINE_LABELS[request.pipeline || ''] || request.pipeline} pipeline
            {' · '}${(request.estimated_value || 0).toLocaleString()}
          </p>
        </div>
        {request.status === 'draft' && (
          <button onClick={handleSubmit} className="btn-primary flex items-center gap-2">
            <Send size={16} /> Submit
          </button>
        )}
        <button onClick={() => navigate(`/requests/${reqId}/clins`)} className="btn-secondary flex items-center gap-2">
          <Package size={16} /> Manage CLINs
        </button>
        {canDelete && (
          <button onClick={handleDelete} className="btn-danger flex items-center gap-2">
            <Trash2 size={16} /> Delete
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors ${
              tab === t.key
                ? 'border-eaw-primary text-eaw-primary font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon size={14} /> {t.label}
            {t.count !== undefined && (
              <span className="bg-gray-200 text-gray-600 text-xs rounded-full px-1.5">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Need Type</span>
                <p className="font-medium capitalize">{(request.need_type || '').replace(/_/g, ' ')}</p>
              </div>
              <div>
                <span className="text-gray-500">Category</span>
                <p className="font-medium capitalize">{(request.buy_category || '').replace(/_/g, ' ')}</p>
              </div>
              <div>
                <span className="text-gray-500">Character</span>
                <p className="font-medium capitalize">{(request.contract_character || '').replace(/_/g, ' ')}</p>
              </div>
              <div>
                <span className="text-gray-500">CLIN Total</span>
                <p className="font-medium">${clinTotal.toLocaleString()}</p>
              </div>
            </div>
            {request.description && (
              <div>
                <span className="text-sm text-gray-500">Description</span>
                <p className="text-sm mt-1">{request.description}</p>
              </div>
            )}
            {request.existing_contract_number && (
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Contract #</span>
                  <p className="font-medium">{request.existing_contract_number}</p>
                </div>
                <div>
                  <span className="text-gray-500">Contractor</span>
                  <p className="font-medium">{request.existing_contractor_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">End Date</span>
                  <p className="font-medium">{request.existing_contract_end}</p>
                </div>
              </div>
            )}

            {/* Quick advisory summary */}
            {advisories.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Advisory Status</h3>
                <div className="flex gap-2">
                  {advisories.map(a => (
                    <StatusBadge key={a.id} status={a.status} label={`${a.team.toUpperCase()}: ${a.status}`} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'documents' && (
          <DocumentChecklist documents={documents} requestId={reqId} onRefresh={loadData} />
        )}

        {tab === 'approvals' && (
          <ApprovalPipeline steps={approvals} />
        )}

        {tab === 'advisory' && (
          <AdvisoryPanel advisories={advisories} />
        )}

        {tab === 'clins' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Contract Line Items</h3>
              <button onClick={() => navigate(`/requests/${reqId}/clins`)}
                className="text-sm text-eaw-primary hover:underline">
                Open CLIN Builder
              </button>
            </div>
            {clins.length === 0 ? (
              <p className="text-sm text-gray-500">No CLINs defined yet.</p>
            ) : (
              <table className="eaw-table">
                <thead>
                  <tr>
                    <th>CLIN #</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th>PSC</th>
                    <th>Ceiling</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {clins.map(c => (
                    <tr key={c.id}>
                      <td className="font-medium">{c.clin_number}</td>
                      <td className="text-sm">{c.description}</td>
                      <td className="text-sm capitalize">{(c.clin_type || '').replace(/_/g, ' ')}</td>
                      <td className="text-sm">{c.psc_code}</td>
                      <td className="text-sm">${(c.clin_ceiling || 0).toLocaleString()}</td>
                      <td><StatusBadge status={c.clin_status || 'healthy'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
