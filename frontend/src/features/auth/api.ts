import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../api/http';
import type { components } from '../../api/schema';
import { disablePush } from '../notifications/push';
import { forgetNativeDevice, inNativeApp } from '../notifications/native';

export type Me = components['schemas']['Me'];
export type LoginStart = components['schemas']['LoginStartResponse'];
export type LoginStatus = components['schemas']['LoginStatus'];
export type Region = components['schemas']['Region'];
export type ProfileUpdate = components['schemas']['PatchedProfileUpdateRequest'];

export const ME_KEY = ['me'] as const;

/** Current user, or null when not logged in. Other errors surface as query errors. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async (): Promise<Me | null> => {
      try {
        return await api<Me>('GET', '/me');
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useStartLogin() {
  return useMutation({
    mutationFn: (phone: string) => api<LoginStart>('POST', '/auth/telegram/start', { phone }),
  });
}

export function useLoginStatus(requestId: string | null) {
  return useQuery({
    queryKey: ['login-status', requestId],
    queryFn: () => api<LoginStatus>('GET', `/auth/telegram/status/${requestId}`),
    enabled: requestId !== null,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 2000 : false),
    refetchIntervalInBackground: true,
    retry: false,
    gcTime: 0,
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // A shared phone must not keep getting this account's notifications (FR-20).
      await (inNativeApp() ? forgetNativeDevice() : disablePush()).catch(() => undefined);
      return api<void>('POST', '/auth/logout');
    },
    onSuccess: () => client.setQueryData(ME_KEY, null),
  });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: ProfileUpdate) => api<Me>('PATCH', '/me', data),
    onSuccess: (me) => client.setQueryData(ME_KEY, me),
  });
}

export function useRegions() {
  return useQuery({
    queryKey: ['regions'],
    queryFn: () => api<Region[]>('GET', '/reference/regions'),
    staleTime: 60 * 60_000,
  });
}
