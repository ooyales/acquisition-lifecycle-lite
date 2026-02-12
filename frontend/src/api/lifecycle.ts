import client from './client';
import type { LifecycleEvent } from '@/types';

export const lifecycleApi = {
  list: (params?: { status?: string; event_type?: string }) =>
    client.get<{ events: LifecycleEvent[] }>('/lifecycle', { params }).then(r => r.data.events),
  get: (id: number) => client.get<LifecycleEvent>(`/lifecycle/${id}`).then(r => r.data),
  createRequest: (id: number) =>
    client.post(`/lifecycle/${id}/create-request`).then(r => r.data),
};
