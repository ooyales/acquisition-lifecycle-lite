import client from './client';
import type { Comment } from '@/types';

export const commentsApi = {
  list: (requestId: number) =>
    client.get<{ comments: Comment[] }>(`/comments/request/${requestId}`).then(r => r.data.comments),
  create: (requestId: number, content: string, isInternal: boolean = false) =>
    client.post<Comment>(`/comments/request/${requestId}`, { content, is_internal: isInternal }).then(r => r.data),
  delete: (commentId: number) =>
    client.delete(`/comments/${commentId}`).then(r => r.data),
};
