import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/http';
import type { components } from '../../api/schema';

export type Deal = components['schemas']['Deal'];

export function useMyDeals() {
  return useQuery({ queryKey: ['me', 'deals'], queryFn: () => api<Deal[]>('GET', '/me/deals') });
}

export function useDeal(id: string) {
  return useQuery({ queryKey: ['deal', id], queryFn: () => api<Deal>('GET', `/deals/${id}`) });
}

export function useRateDeal(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: { score: number; comment: string }) => api<Deal>('POST', `/deals/${id}/rating`, data),
    onSuccess: (deal) => client.setQueryData(['deal', id], deal),
  });
}

export function useClaimDeal(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => api<Deal>('POST', `/deals/${id}/claims`, { reason }),
    onSuccess: (deal) => client.setQueryData(['deal', id], deal),
  });
}
