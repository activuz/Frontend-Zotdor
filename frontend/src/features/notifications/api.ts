import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, paramOf, query } from '../../api/http';
import type { components } from '../../api/schema';

export type Notification = components['schemas']['Notification'];
type Page = components['schemas']['PaginatedNotificationList'];

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: ['notifications'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api<Page>('GET', `/notifications${query({ cursor: pageParam })}`),
    getNextPageParam: (last) => paramOf(last.next, 'cursor'),
  });
}

export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api<components['schemas']['UnreadCount']>('GET', '/notifications/unread-count'),
    enabled,
    refetchInterval: 60_000,
  });
}

/** Without ids marks everything as read. */
export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids?: number[]) => api<void>('POST', '/notifications/read', ids ? { ids } : {}),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
