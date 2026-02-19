import { useEffect, useState, useCallback } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { dashboardApi } from '../api/dashboard';
import { requestsApi } from '../api/requests';
import FundingBar from '../components/charts/FundingBar';
import PipelineFlow from '../components/charts/PipelineFlow';
import Modal from '../components/common/Modal';
import { RequestDrillDownTable } from '../components/common/DrillDownTable';
import { STATUS_LABELS } from '../types';

interface CycleData {
  pipeline: string;
  avg_days: number;
  total_requests: number;
}

interface GateData {
  gate: string;
  label: string;
  count: number;
}

interface LoaData {
  id: number;
  display_name: string;
}

export default function PipelineDashboardPage() {
  const [pipeline, setPipeline] = useState<Array<{ stage: string; count: number }>>([]);
  const [cycleTime, setCycleTime] = useState<CycleData[]>([]);
  const [funding, setFunding] = useState<Array<{ name: string; projected: number; committed: number; obligated: number; available: number }>>([]);
  const [loading, setLoading] = useState(true);

  // Keep raw data for lookups
  const [gateMap, setGateMap] = useState<Record<string, GateData>>({});
  const [loaList, setLoaList] = useState<LoaData[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState<unknown[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      dashboardApi.pipeline().catch(() => ({})),
      dashboardApi.cycleTime().catch(() => ({})),
      dashboardApi.funding().catch(() => ({})),
    ]).then(([p, c, f]) => {
      const rawGates: GateData[] = p?.pipeline || [];
      const pipelineData = rawGates.map((g) => ({
        stage: (g.label || g.gate) as string,
        count: g.count as number,
      }));
      setPipeline(pipelineData);

      // Build label→gate lookup
      const gm: Record<string, GateData> = {};
      for (const g of rawGates) {
        gm[g.label || g.gate] = g;
      }
      setGateMap(gm);

      setCycleTime(Array.isArray(c) ? c : c?.pipelines || []);

      const rawLoas: LoaData[] = f?.loas || [];
      setLoaList(rawLoas);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fundingData = rawLoas.map((l: any) => ({
        name: (l.display_name || l.fund_code || 'LOA') as string,
        projected: l.projected as number,
        committed: l.committed as number,
        obligated: l.obligated as number,
        available: l.available as number,
      }));
      setFunding(fundingData);
      setLoading(false);
    });
  }, []);

  const openDrillDown = useCallback(async (title: string, fetcher: () => Promise<unknown>) => {
    setModalTitle(title);
    setModalData([] as unknown[]);
    setModalLoading(true);
    setModalOpen(true);
    try {
      const data = await fetcher();
      const raw = Array.isArray(data) ? data : (data as Record<string, unknown>).requests;
      setModalData(Array.isArray(raw) ? raw : []);
    } catch {
      setModalData([] as unknown[]);
    } finally {
      setModalLoading(false);
    }
  }, []);

  const handlePipelineBarClick = useCallback((stage: string) => {
    const gate = gateMap[stage];
    const statusKey = gate?.gate || stage;
    const label = STATUS_LABELS[statusKey] || stage;
    openDrillDown(`Pipeline: ${label} (${gate?.count ?? '?'})`, () =>
      requestsApi.list({ status: statusKey, per_page: '100' }),
    );
  }, [gateMap, openDrillDown]);

  const handleFundingBarClick = useCallback((name: string) => {
    const loa = loaList.find(l => l.display_name === name);
    if (!loa) return;
    openDrillDown(`Funding: ${name}`, () => dashboardApi.drilldownFunding(loa.id));
  }, [loaList, openDrillDown]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 size={24} className="text-eaw-primary" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline Dashboard</h1>
          <p className="text-sm text-gray-500">Gate flow, cycle time, and funding analytics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline stages */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-lg font-semibold mb-1">Pipeline Stage Distribution</h2>
          <p className="text-xs text-gray-400 mb-3">Click a bar to see requests at that gate</p>
          <PipelineFlow data={pipeline} onBarClick={handlePipelineBarClick} />
        </div>

        {/* Cycle time by pipeline */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-lg font-semibold mb-3">Average Cycle Time by Pipeline</h2>
          {cycleTime.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No cycle time data available.</p>
          ) : (
            <div className="space-y-3">
              {cycleTime.map(ct => (
                <div key={ct.pipeline} className="flex items-center gap-3">
                  <span className="text-sm w-28 capitalize">{ct.pipeline.replace(/_/g, ' ')}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div className="bg-eaw-primary h-4 rounded-full flex items-center justify-end pr-2 text-white text-[10px]"
                      style={{ width: `${Math.min((ct.avg_days / 120) * 100, 100)}%`, minWidth: '3rem' }}>
                      {ct.avg_days}d
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 w-20">{ct.total_requests} requests</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Funding overview */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-lg font-semibold mb-1">LOA Funding Overview</h2>
        <p className="text-xs text-gray-400 mb-3">Click a bar to see requests linked to that LOA</p>
        <FundingBar data={funding} onBarClick={handleFundingBarClick} />
      </div>

      {/* Drill-down modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle}>
        {modalLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-500">
            <Loader2 size={20} className="animate-spin" />
            <span>Loading...</span>
          </div>
        ) : (
          <RequestDrillDownTable data={modalData as never[]} />
        )}
      </Modal>
    </div>
  );
}
