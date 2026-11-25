import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, query } from './http';
import type { components } from './schema';

type C = components['schemas'];
export type PanelStats = C['PanelStats'];
export type PanelAuctionRow = C['PanelAuctionRow'];
export type PanelAuctionDetail = C['PanelAuctionDetail'];
export type PanelReport = C['PanelReport'];
export type PanelLead = C['PanelLead'];
export type PanelBugReport = C['PanelBugReport'];
export type PanelClaim = C['PanelClaim'];
export type PanelRefund = C['PanelRefund'];
export type PanelUser = C['PanelUser'];
export type PanelUserDetail = C['PanelUserDetail'];
export type PanelAuditRow = C['PanelAuditRow'];
export type Settings = C['Settings'];
export type Direction = C['DirectionPanel'];
export type AnimalType = C['AnimalTypePanel'];
export type AnimalClass = C['AnimalClassPanel'];
export type Breed = C['BreedPanel'];
export type District = C['DistrictPanel'];

/** `http.ts` sends paths starting with /panel/ to /api/panel. */
const P = '/panel';
export const PAGE = 50;

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => api<PanelStats>('GET', `${P}/stats`),
    refetchInterval: 60_000,
  });
}

export function useAuctionQueue(status: string, q: string, offset: number) {
  return useQuery({
    queryKey: ['auctions', status, q, offset],
    queryFn: () =>
      api<C['PaginatedPanelAuctionList']>('GET', `${P}/auctions${query({ status, q, limit: PAGE, offset })}`),
  });
}

export function useAuctionDetail(id: string) {
  return useQuery({
    queryKey: ['auction', id],
    queryFn: () => api<PanelAuctionDetail>('GET', `${P}/auctions/${id}`),
  });
}

export function useAuctionAction(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ action, reason }: { action: 'approve' | 'reject' | 'block'; reason: string }) =>
      api<C['PanelActionResult']>('POST', `${P}/auctions/${id}/${action}`, { reason }),
    onSuccess: () => void client.invalidateQueries(),
  });
}

export function useReports(status: string, offset: number) {
  return useQuery({
    queryKey: ['reports', status, offset],
    queryFn: () =>
      api<C['PaginatedPanelReportList']>('GET', `${P}/reports${query({ status, limit: PAGE, offset })}`),
  });
}

export function useResolveReport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, outcome, note }: { id: string; outcome: 'resolved' | 'dismissed'; note: string }) =>
      api<PanelReport>('POST', `${P}/reports/${id}/resolve`, { outcome, note }),
    onSuccess: () => void client.invalidateQueries(),
  });
}

export function useLeads(status: string, offset: number) {
  return useQuery({
    queryKey: ['leads', status, offset],
    queryFn: () =>
      api<C['PaginatedPanelLeadList']>('GET', `${P}/leads${query({ status, limit: PAGE, offset })}`),
  });
}

export function useSetLeadStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: 'contacted' | 'closed'; note: string }) =>
      api<PanelLead>('POST', `${P}/leads/${id}/status`, { status, note }),
    onSuccess: () => void client.invalidateQueries(),
  });
}

export function useBugReports(status: string, offset: number) {
  return useQuery({
    queryKey: ['bug-reports', status, offset],
    queryFn: () =>
      api<C['PaginatedPanelBugReportList']>('GET', `${P}/bug-reports${query({ status, limit: PAGE, offset })}`),
  });
}

export function useSetBugReportStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: 'resolved' | 'closed'; note: string }) =>
      api<PanelBugReport>('POST', `${P}/bug-reports/${id}/status`, { status, note }),
    onSuccess: () => void client.invalidateQueries(),
  });
}

export function useClaims(status: string, offset: number) {
  return useQuery({
    queryKey: ['claims', status, offset],
    queryFn: () =>
      api<C['PaginatedPanelClaimList']>('GET', `${P}/claims${query({ status, limit: PAGE, offset })}`),
  });
}

export function useResolveClaim() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve, note }: { id: string; approve: boolean; note: string }) =>
      api<PanelClaim>('POST', `${P}/claims/${id}/resolve`, { approve, note }),
    onSuccess: () => void client.invalidateQueries(),
  });
}

export function useRefunds(status: string, offset: number) {
  return useQuery({
    queryKey: ['refunds', status, offset],
    queryFn: () =>
      api<C['PaginatedPanelRefundList']>('GET', `${P}/refund-requests${query({ status, limit: PAGE, offset })}`),
  });
}

export function useResolveRefund() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done, note }: { id: string; done: boolean; note: string }) =>
      api<PanelRefund>('POST', `${P}/refund-requests/${id}/resolve`, { done, note }),
    onSuccess: () => void client.invalidateQueries(),
  });
}

export function useUsers(q: string, role: string, blocked: boolean, offset: number) {
  return useQuery({
    queryKey: ['users', q, role, blocked, offset],
    queryFn: () =>
      api<C['PaginatedPanelUserList']>(
        'GET',
        `${P}/users${query({ q, role, blocked: blocked ? '1' : undefined, limit: PAGE, offset })}`,
      ),
  });
}

export function useUserDetail(id: string) {
  return useQuery({ queryKey: ['user', id], queryFn: () => api<PanelUserDetail>('GET', `${P}/users/${id}`) });
}

export function useBlockUser(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (d: { blocked: boolean; reason: string }) => api<PanelUser>('POST', `${P}/users/${id}/block`, d),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['user', id] }),
  });
}

export function useSetRole(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (role: PanelUser['role']) => api<PanelUser>('POST', `${P}/users/${id}/role`, { role }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['user', id] }),
  });
}

export function useAdjustWallet(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (d: { bucket: 'main' | 'bonus'; amount: number; note: string }) =>
      api<C['Wallet']>('POST', `${P}/users/${id}/wallet/adjust`, d),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['user', id] }),
  });
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('GET', `${P}/settings`) });
}

export function useSaveSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (d: C['PatchedSettingsRequest']) => api<Settings>('PATCH', `${P}/settings`, d),
    onSuccess: (s) => client.setQueryData(['settings'], s),
  });
}

export function useAuditLog(action: string, offset: number) {
  return useQuery({
    queryKey: ['audit', action, offset],
    queryFn: () =>
      api<C['PaginatedPanelAuditList']>('GET', `${P}/audit-log${query({ action, limit: PAGE, offset })}`),
  });
}

export type TaxonomyKind = 'directions' | 'animal-types' | 'classes' | 'breeds' | 'districts';

const taxPath = (kind: TaxonomyKind) => (kind === 'districts' ? `${P}/districts` : `${P}/taxonomy/${kind}`);

export function useTaxonomyList<T>(kind: TaxonomyKind) {
  return useQuery({ queryKey: ['tax', kind], queryFn: () => api<T[]>('GET', taxPath(kind)) });
}

export function useTaxonomySave<T>(kind: TaxonomyKind) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id?: number }) =>
      id ? api<T>('PATCH', `${taxPath(kind)}/${id}`, data) : api<T>('POST', taxPath(kind), data),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['tax', kind] }),
  });
}
