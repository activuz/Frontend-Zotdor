import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '../../api/http';
import type { components } from '../../api/schema';

export type Wallet = components['schemas']['Wallet'];
export type WalletEntry = components['schemas']['WalletEntry'];
type EntryPage = components['schemas']['PaginatedWalletEntryList'];

export function useWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: () => api<Wallet>('GET', '/wallet'),
  });
}

/** The server returns `next` as a full URL; only its cursor parameter is needed. */
function cursorOf(next: string | null | undefined): string | undefined {
  if (!next) return undefined;
  return new URL(next, window.location.origin).searchParams.get('cursor') ?? undefined;
}

export function useWalletEntries() {
  return useInfiniteQuery({
    queryKey: ['wallet', 'entries'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<EntryPage>('GET', `/wallet/entries${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: (last) => cursorOf(last.next),
  });
}
