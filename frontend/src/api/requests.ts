import client from './client';
import type { AcquisitionRequest, FundingSource, PriorAcquisition } from '@/types';

interface RequestFilters {
  status?: string;
  category?: string;
  priority?: string;
  fiscal_year?: string;
  search?: string;
}

export interface RequestDetail extends AcquisitionRequest {
  approval_steps: any[];
  documents: any[];
  comments: any[];
  activities: any[];
  funding_source_name?: string;
  funding_source_available?: number;
}

export const requestsApi = {
  list: async (filters?: RequestFilters): Promise<AcquisitionRequest[]> => {
    const { data } = await client.get('/requests', { params: filters });
    return data.requests || [];
  },

  get: async (id: number): Promise<RequestDetail> => {
    const { data } = await client.get(`/requests/${id}`);
    return data;
  },

  create: async (req: Partial<AcquisitionRequest>): Promise<AcquisitionRequest> => {
    const { data } = await client.post('/requests', req);
    return data;
  },

  update: async (id: number, req: Partial<AcquisitionRequest>): Promise<AcquisitionRequest> => {
    const { data } = await client.put(`/requests/${id}`, req);
    return data;
  },

  submit: async (id: number): Promise<AcquisitionRequest> => {
    const { data } = await client.post(`/requests/${id}/submit`);
    return data;
  },

  updateStatus: async (
    id: number,
    status: string,
    extra?: Record<string, any>
  ): Promise<AcquisitionRequest> => {
    const { data } = await client.patch(`/requests/${id}/status`, { status, ...extra });
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await client.delete(`/requests/${id}`);
  },

  getFundingSources: async (): Promise<FundingSource[]> => {
    const { data } = await client.get('/requests/funding-sources');
    return data.funding_sources || [];
  },

  searchPriorAcquisitions: async (search: string): Promise<PriorAcquisition[]> => {
    const { data } = await client.get('/requests/prior-acquisitions', { params: { search } });
    return data.prior_acquisitions || [];
  },
};
