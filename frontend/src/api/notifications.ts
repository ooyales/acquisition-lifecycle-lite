import client from './client';

export const notificationsApi = {
  list: (params?: { page?: number; per_page?: number; unread?: string }) =>
    client.get('/notifications', { params }).then(r => r.data),
  unreadCount: () =>
    client.get('/notifications/unread-count').then(r => r.data),
  markRead: (notificationId: number) =>
    client.post(`/notifications/${notificationId}/read`).then(r => r.data),
  markAllRead: () =>
    client.post('/notifications/mark-all-read').then(r => r.data),
};
