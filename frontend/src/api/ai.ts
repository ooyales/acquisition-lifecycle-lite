import client from './client';

export const aiApi = {
  chat: (data: { mode: string; message: string; request_id?: number; history?: Array<{ role: string; content: string }> }) => {
    // Backend expects { messages: [...], mode } — build full message array from history + new message
    const messages = [
      ...(data.history || []),
      { role: 'user', content: data.message },
    ];
    return client.post('/ai/chat', { messages, mode: data.mode }).then(r => r.data);
  },
  draft: (data: { document_id: number; request_id: number }) =>
    client.post('/ai/draft', data).then(r => r.data),
  review: (data: { document_id: number; request_id: number }) =>
    client.post('/ai/review', data).then(r => r.data),
  scenarios: (mode: string) =>
    client.get('/ai/scenarios', { params: { mode } }).then(r => r.data),
};
