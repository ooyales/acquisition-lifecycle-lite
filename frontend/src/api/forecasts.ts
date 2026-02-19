import client from './client';

export const forecastsApi = {
  list: (params?: Record<string, string>) =>
    client.get('/forecasts', { params }).then(r => r.data),
  create: (data: Record<string, unknown>) =>
    client.post('/forecasts', data).then(r => r.data),
  update: (id: number, data: Record<string, unknown>) =>
    client.put(`/forecasts/${id}`, data).then(r => r.data),
  createRequest: (id: number) =>
    client.post(`/forecasts/${id}/create-request`).then(r => r.data),
  delete: (id: number) =>
    client.delete(`/forecasts/${id}`).then(r => r.data),
};
