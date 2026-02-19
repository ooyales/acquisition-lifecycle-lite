import client from './client';

export const adminApi = {
  getThresholds: () => client.get('/admin/thresholds').then(r => r.data),
  updateThreshold: (id: number, data: Record<string, unknown>) =>
    client.put(`/admin/thresholds/${id}`, data).then(r => r.data),
  getTemplates: () => client.get('/admin/templates').then(r => r.data),
  getRules: () => client.get('/admin/document-rules').then(r => r.data),
  getUsers: () => client.get('/admin/users').then(r => r.data),
  updateUser: (id: number, data: Record<string, unknown>) =>
    client.put(`/admin/users/${id}`, data).then(r => r.data),
  updateTemplateSteps: (templateId: number, steps: unknown[]) =>
    client.put(`/admin/templates/${templateId}/steps`, { steps }).then(r => r.data),
  getGateCatalog: () => client.get('/admin/gate-catalog').then(r => r.data),
  getAdvisoryConfig: () => client.get('/admin/advisory-config').then(r => r.data),
  updateAdvisoryConfig: (configs: unknown[]) =>
    client.put('/admin/advisory-config', { configs }).then(r => r.data),
};
