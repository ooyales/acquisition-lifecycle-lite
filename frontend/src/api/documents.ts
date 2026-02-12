import client from './client';
import type { PackageDocument } from '@/types';

export interface DocumentCompleteness {
  checklist: {
    type: string;
    title: string;
    exists: boolean;
    status: string;
    doc_id: number | null;
  }[];
  complete: number;
  total: number;
  all_complete: boolean;
}

export const documentsApi = {
  list: (requestId: number) =>
    client.get<{ documents: PackageDocument[] }>(`/documents/request/${requestId}`).then(r => r.data.documents),
  get: (docId: number) =>
    client.get<PackageDocument>(`/documents/${docId}`).then(r => r.data),
  create: (requestId: number, data: { document_type: string; title: string; assigned_to?: string; due_date?: string }) =>
    client.post<PackageDocument>(`/documents/request/${requestId}`, data).then(r => r.data),
  update: (docId: number, data: Partial<PackageDocument>) =>
    client.put<PackageDocument>(`/documents/${docId}`, data).then(r => r.data),
  draft: (docId: number) =>
    client.post<PackageDocument>(`/documents/${docId}/draft`).then(r => r.data),
  completeness: (requestId: number) =>
    client.get<DocumentCompleteness>(`/documents/request/${requestId}/completeness`).then(r => r.data),
  delete: (docId: number) =>
    client.delete(`/documents/${docId}`).then(r => r.data),
};
