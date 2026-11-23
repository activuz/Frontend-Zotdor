import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/http';
import type { components } from '../../api/schema';
import type { AuctionDetail } from '../auctions/api';

export type DraftPatch = components['schemas']['PatchedDraftRequest'];
export type CaptureSession = components['schemas']['CaptureSessionOut'];
export type Media = components['schemas']['Media'];
export type SubmitResult = components['schemas']['SubmitResult'];

export function useCreateDraft() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: DraftPatch) => api<AuctionDetail>('POST', '/auctions', data),
    onSuccess: (a) => {
      client.setQueryData(['auction', a.id], a);
      void client.invalidateQueries({ queryKey: ['me', 'auctions'] });
    },
  });
}

/** Every step saves to the server, so the draft survives closing the page (F2). */
export function useSaveDraft(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: DraftPatch) => api<AuctionDetail>('PATCH', `/auctions/${id}`, data),
    onSuccess: (a) => client.setQueryData(['auction', id], a),
  });
}

export function useDeleteDraft(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('DELETE', `/auctions/${id}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['me', 'auctions'] }),
  });
}

export function useOpenCaptureSession(auctionId: string) {
  return useMutation({
    mutationFn: () => api<CaptureSession>('POST', '/media/capture-sessions', { auction_id: auctionId }),
  });
}

export interface UploadInput {
  file: File;
  kind: 'photo' | 'video';
  sessionId: string;
  meta: Record<string, string | number>;
}

export function useUploadMedia(auctionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ file, kind, sessionId, meta }: UploadInput) => {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      form.append('capture_session_id', sessionId);
      form.append('client_meta', JSON.stringify(meta));
      return api<Media>('POST', `/auctions/${auctionId}/media`, form);
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['auction', auctionId] }),
  });
}

export function useDeleteMedia(auctionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (mediaId: string) => api<void>('DELETE', `/auctions/${auctionId}/media/${mediaId}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['auction', auctionId] }),
  });
}

export function useSubmitAuction(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<SubmitResult>('POST', `/auctions/${id}/submit`),
    onSuccess: (r) => {
      client.setQueryData(['auction', id], r.auction);
      void client.invalidateQueries({ queryKey: ['wallet'] });
      void client.invalidateQueries({ queryKey: ['me', 'auctions'] });
    },
  });
}
