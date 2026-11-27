import type { Query } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { removeOldestQuery } from '@tanstack/react-query-persist-client';

/**
 * Keeps a few slow-changing answers on the device so the app opens with content at once and
 * refreshes it in the background (docs/ARCHITECTURE.md, "Kesh").
 *
 * Only these are stored: the feed lists and the reference data. Never an auction page, bids,
 * the decision screen, the wallet or anything under /me: a stale price or balance would mislead.
 */
const PERSISTED_KEYS = new Set(['feed', 'regions', 'taxonomy', 'config']);

export const PERSIST_MAX_AGE = 24 * 60 * 60_000;

/** A new build drops what an older one stored, in case the response shapes changed. */
export const PERSIST_BUSTER = (import.meta.env.VITE_BUILD_ID as string | undefined) ?? 'dev';

export function shouldPersist(query: Query): boolean {
  const head = query.queryKey[0];
  return query.state.status === 'success' && typeof head === 'string' && PERSISTED_KEYS.has(head);
}

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined; // private mode or storage disabled: the app just works without the cache
  }
}

export const persister = createSyncStoragePersister({
  storage: storage(),
  key: 'zotdor-query-cache',
  throttleTime: 2000,
  retry: removeOldestQuery, // storage full: drop the oldest entry instead of failing
});
