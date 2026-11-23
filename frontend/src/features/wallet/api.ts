import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, paramOf } from '../../api/http';
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


export function useWalletEntries() {
  return useInfiniteQuery({
    queryKey: ['wallet', 'entries'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<EntryPage>('GET', `/wallet/entries${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: (last) => paramOf(last.next, 'cursor'),
  });
}

export type Payment = components['schemas']['Payment'];
export type RefundRequest = components['schemas']['RefundRequest'];
type TopupOut = components['schemas']['TopupOut'];
type RefundIn = components['schemas']['RefundInRequest'];

export function useTopup() {
  return useMutation({
    mutationFn: (amount: number) => api<TopupOut>('POST', '/wallet/topups', { amount }),
  });
}

/** Watches a payment until it leaves the pending states (F6). */
export function usePayment(id: string | null) {
  const client = useQueryClient();
  return useQuery({
    queryKey: ['payment', id],
    queryFn: async () => {
      const payment = await api<Payment>('GET', `/payments/${id}`);
      if (payment.status === 'completed') void client.invalidateQueries({ queryKey: ['wallet'] });
      return payment;
    },
    enabled: id !== null,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === 'created' || s === 'prepared' || s === undefined ? 3000 : false;
    },
  });
}

/** Development-only provider: confirms a test payment without real money. */
export function useCompleteFakePayment() {
  return useMutation({
    mutationFn: (id: string) => api<Payment>('POST', `/payments/fake/${id}/complete`),
  });
}

export function useRefundRequests() {
  return useQuery({
    queryKey: ['wallet', 'refunds'],
    queryFn: () => api<RefundRequest[]>('GET', '/wallet/refund-requests'),
  });
}

export function useCreateRefund() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: RefundIn) => api<RefundRequest>('POST', '/wallet/refund-requests', data),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['wallet', 'refunds'] }),
  });
}
