import client from './client';

export interface ImportResult {
  imported: number;
  errors: string[];
  total: number;
}

export const wizardApi = {
  createSession: () => client.post('/wizard/session').then(r => r.data),
  getEntityTypes: () => client.get('/wizard/entity-types').then(r => r.data),
  getSample: (entityType: string) => client.get(`/wizard/sample/${entityType}`).then(r => r.data.csv),
  importData: (entityType: string, text: string) =>
    client.post<ImportResult>(`/wizard/import/${entityType}`, { text }).then(r => r.data),
  getStatus: () => client.get('/wizard/status').then(r => r.data),
};
