import client from './client';
import type { ApprovalStep } from '@/types';

export interface QueueItemRequest {
  id: number;
  request_number: string;
  title: string;
  category: string;
  estimated_total: number | null;
  requestor_name: string;
  priority: string;
  status?: string;
  sub_category?: string;
  requestor_org?: string;
  need_by_date?: string | null;
}

export interface QueueItem {
  step: ApprovalStep & { is_overdue?: boolean };
  request: QueueItemRequest;
}

// Backend returns step fields flat with nested request object.
// Transform into { step, request } structure for the frontend.
function transformQueueItem(raw: any): QueueItem {
  const { request, ...stepFields } = raw;
  return { step: stepFields, request };
}

export const approvalsApi = {
  getQueue: () =>
    client
      .get<{ queue: any[] }>('/approvals/queue')
      .then((r) => r.data.queue.map(transformQueueItem)),

  processStep: (stepId: number, action: string, comments?: string) =>
    client
      .post(`/approvals/${stepId}/process`, { action, comments })
      .then((r) => r.data),

  getRequestSteps: (requestId: number) =>
    client
      .get<{ steps: ApprovalStep[] }>(`/approvals/request/${requestId}`)
      .then((r) => r.data.steps),
};
