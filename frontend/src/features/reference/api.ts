import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/http';
import type { components } from '../../api/schema';

export type Taxonomy = components['schemas']['Taxonomy'];
export type AnimalType = components['schemas']['AnimalType'];
export type PublicConfig = components['schemas']['PublicConfig'];

export function useTaxonomy() {
  return useQuery({
    queryKey: ['taxonomy'],
    queryFn: () => api<Taxonomy>('GET', '/reference/taxonomy'),
    staleTime: 60 * 60_000,
  });
}

/** Platform limits (commission, media counts, durations) set by the admin. */
export function usePublicConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => api<PublicConfig>('GET', '/config'),
    staleTime: 10 * 60_000,
  });
}

/** Commission rounded up to whole so‘m (A-11), same formula as wallet.services.commission_for. */
export function commissionFor(amount: number, rateBp: number): number {
  if (amount <= 0) return 0;
  return Math.ceil((amount * rateBp) / 10_000);
}
