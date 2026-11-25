import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, paramOf, query } from '../../api/http';
import type { components } from '../../api/schema';
import { currentGuestPoint } from '../location/useDeviceLocation';

export type AuctionList = components['schemas']['AuctionList'];
export type AuctionDetail = components['schemas']['AuctionDetail'];
export type AuctionStatus = components['schemas']['AuctionStatusEnum'];
export type PublicBid = components['schemas']['PublicBid'];
export type Decision = components['schemas']['Decision'];
export type DecisionBid = components['schemas']['DecisionBid'];
export type MyBidRow = components['schemas']['MyBidRow'];
type FeedPage = components['schemas']['PaginatedAuctionList'];

export type FeedSort = 'nearest' | 'ending_soon' | 'most_active' | 'newest' | 'price_asc' | 'price_desc';

export interface FeedFilters {
  status?: 'live' | 'scheduled' | 'ended' | 'all_open';
  sort?: FeedSort;
  q?: string;
  direction?: number;
  animal_type?: number;
  animal_class?: number;
  breed?: number;
  region?: number;
  district?: number;
  price_min?: number;
  price_max?: number;
  seller?: string;
}

const OPEN: AuctionStatus[] = ['scheduled', 'live'];

/** True while the auction can still change on its own (worker transitions, new bids). */
export function isOpen(status: AuctionStatus | undefined): boolean {
  return status !== undefined && OPEN.includes(status);
}

export function useFeed(filters: FeedFilters, { limit = 20, enabled = true } = {}) {
  // A guest's device position (sessionStorage) drives distances and "nearest"; logged-in users'
  // position is stored on the server and applied there.
  const point = currentGuestPoint();
  const params = point ? { ...filters, lat: point.lat, lng: point.lng } : filters;
  return useInfiniteQuery({
    queryKey: ['feed', params, limit],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api<FeedPage>('GET', `/auctions${query({ ...params, limit, offset: pageParam })}`),
    getNextPageParam: (last) => {
      const offset = paramOf(last.next, 'offset');
      return offset === undefined ? undefined : Number(offset);
    },
    enabled,
  });
}

export function useAuction(id: string | undefined, { poll = true } = {}) {
  return useQuery({
    queryKey: ['auction', id],
    queryFn: () => api<AuctionDetail>('GET', `/auctions/${id}`),
    enabled: id !== undefined,
    // F3: 5 s polling while the auction is open; processing video also needs a refresh.
    refetchInterval: (q) => {
      const a = q.state.data;
      if (!poll || !a) return false;
      if (a.media.some((m) => m.status === 'processing')) return 3000;
      return isOpen(a.status) ? 5000 : false;
    },
  });
}

export function useBids(id: string, live: boolean) {
  return useQuery({
    queryKey: ['bids', id],
    queryFn: () => api<PublicBid[]>('GET', `/auctions/${id}/bids`),
    refetchInterval: live ? 5000 : false,
  });
}

export function usePlaceBid(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) => api<PublicBid[]>('POST', `/auctions/${id}/bids`, { amount }),
    onSuccess: (bids) => {
      client.setQueryData(['bids', id], bids);
      void client.invalidateQueries({ queryKey: ['auction', id] });
      void client.invalidateQueries({ queryKey: ['me', 'bids'] });
    },
  });
}

export function useWatch(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (watch: boolean) => api<void>(watch ? 'POST' : 'DELETE', `/auctions/${id}/watch`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['auction', id] });
      void client.invalidateQueries({ queryKey: ['me', 'watchlist'] });
      void client.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useCancelAuction(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => api<AuctionDetail>('POST', `/auctions/${id}/cancel`, { reason }),
    onSuccess: (a) => {
      client.setQueryData(['auction', id], a);
      void client.invalidateQueries({ queryKey: ['wallet'] });
      void client.invalidateQueries({ queryKey: ['me', 'auctions'] });
    },
  });
}

export function useDecision(id: string, sort: 'amount' | 'distance') {
  return useQuery({
    queryKey: ['decision', id, sort],
    queryFn: () => api<Decision>('GET', `/auctions/${id}/decision${query({ sort })}`),
    refetchInterval: 10_000,
  });
}

export function useAcceptBid(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (bidId: string) =>
      api<components['schemas']['AcceptOut']>('POST', `/auctions/${id}/accept`, { bid_id: bidId }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['auction', id] });
      void client.invalidateQueries({ queryKey: ['wallet'] });
      void client.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useRejectAll(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<AuctionDetail>('POST', `/auctions/${id}/reject-all`),
    onSuccess: (a) => {
      client.setQueryData(['auction', id], a);
      void client.invalidateQueries({ queryKey: ['wallet'] });
    },
  });
}

export function useMyAuctions() {
  return useQuery({
    queryKey: ['me', 'auctions'],
    queryFn: () => api<AuctionList[]>('GET', '/me/auctions'),
  });
}

export function useMyBids() {
  return useQuery({
    queryKey: ['me', 'bids'],
    queryFn: () => api<MyBidRow[]>('GET', '/me/bids'),
  });
}

export function useWatchlist() {
  return useQuery({
    queryKey: ['me', 'watchlist'],
    queryFn: () => api<AuctionList[]>('GET', '/me/watchlist'),
  });
}

export type ReportIn = components['schemas']['ReportInRequest'];

export function useReport() {
  return useMutation({
    mutationFn: (data: ReportIn) => api<void>('POST', '/reports', data),
  });
}
