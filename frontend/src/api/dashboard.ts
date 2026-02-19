import client from './client';

export const dashboardApi = {
  metrics: () => client.get('/dashboard').then(r => r.data),
  pipeline: () => client.get('/dashboard/pipeline').then(r => r.data),
  cycleTime: () => client.get('/dashboard/cycle-time').then(r => r.data),
  funding: () => client.get('/dashboard/funding').then(r => r.data),
  drilldownApprovals: (overdueOnly = false) =>
    client.get('/dashboard/drilldown/approvals', { params: { overdue_only: overdueOnly } }).then(r => r.data),
  drilldownAdvisories: () =>
    client.get('/dashboard/drilldown/advisories').then(r => r.data),
  drilldownExecutions: () =>
    client.get('/dashboard/drilldown/executions').then(r => r.data),
  drilldownFunding: (loaId: number) =>
    client.get(`/dashboard/drilldown/funding/${loaId}`).then(r => r.data),
};
