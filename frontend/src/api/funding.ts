import client from './client';
import type { FundingSource } from '@/types';

export const fundingApi = {
  list: () => client.get<{ funding_sources: FundingSource[] }>('/funding').then(r => r.data.funding_sources),
  get: (id: number) => client.get<FundingSource>(`/funding/${id}`).then(r => r.data),
  commit: (id: number, amount: number, requestId: number) =>
    client.post(`/funding/${id}/commit`, { amount, request_id: requestId }).then(r => r.data),
  release: (id: number, amount: number, requestId: number) =>
    client.post(`/funding/${id}/release`, { amount, request_id: requestId }).then(r => r.data),
  summary: () => client.get<{ summary: any[] }>('/funding/summary').then(r => r.data.summary),
};
