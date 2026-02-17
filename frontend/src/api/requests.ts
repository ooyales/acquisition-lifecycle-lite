import client from './client';

export const requestsApi = {
  list: (params?: Record<string, string>) =>
    client.get('/requests', { params }).then(r => r.data),
  get: (id: number) =>
    client.get(`/requests/${id}`).then(r => r.data),
  create: (data: Record<string, unknown>) =>
    client.post('/requests', data).then(r => r.data),
  update: (id: number, data: Record<string, unknown>) =>
    client.put(`/requests/${id}`, data).then(r => r.data),
  submit: (id: number) =>
    client.post(`/requests/${id}/submit`).then(r => r.data),
  delete: (id: number) =>
    client.delete(`/requests/${id}`).then(r => r.data),
};
