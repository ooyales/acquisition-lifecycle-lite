import client from './client';

export const loaApi = {
  list: (params?: Record<string, string>) =>
    client.get('/loa', { params }).then(r => r.data),
  get: (id: number) =>
    client.get(`/loa/${id}`).then(r => r.data),
  create: (data: Record<string, unknown>) =>
    client.post('/loa', data).then(r => r.data),
  update: (id: number, data: Record<string, unknown>) =>
    client.put(`/loa/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    client.delete(`/loa/${id}`).then(r => r.data),
};
