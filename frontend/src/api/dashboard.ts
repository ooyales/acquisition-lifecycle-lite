import client from './client';
import type { DashboardData } from '@/types';

export const dashboardApi = {
  get: async (): Promise<DashboardData> => {
    const { data } = await client.get('/dashboard');
    return data;
  },
};
