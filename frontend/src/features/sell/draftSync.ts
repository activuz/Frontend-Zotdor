import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../api/http';
import type { AuctionDetail } from '../auctions/api';
import type { DraftPatch } from './api';

/**
 * Wizard steps save without waiting (F2, docs/ARCHITECTURE.md D-14). "Saqlash va davom etish"
 * keeps the step's values on the device (localStorage), shows them at once and moves on; the
 * PATCH goes in the background. A rejected PATCH stays on the device with the server's message
 * until the seller fixes that step, so nothing typed is lost. Submit waits for it (flushDraft).
 */

export type DraftStep = 'details' | 'time';

interface Pending {
  patch: DraftPatch;
  step: DraftStep;
  error: string;
  version: number;
}

export interface DraftSyncState {
  saving: boolean;
  error: string;
  step: DraftStep | null;
}

const KEY = (id: string) => `zotdor-draft-${id}`;
const IDLE: DraftSyncState = { saving: false, error: '', step: null };
const states = new Map<string, DraftSyncState>();
const listeners = new Set<() => void>();
const flights = new Map<string, Promise<void>>();
let client: QueryClient | null = null;

function read(id: string): Pending | null {
  try {
    const raw = localStorage.getItem(KEY(id));
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}

function write(id: string, value: Pending | null) {
  try {
    if (value) localStorage.setItem(KEY(id), JSON.stringify(value));
    else localStorage.removeItem(KEY(id));
  } catch {
    // Storage full or disabled: the in-flight PATCH still carries the values.
  }
}

function setState(id: string, next: DraftSyncState) {
  states.set(id, next);
  listeners.forEach((l) => l());
}

function isFinal(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429;
}

async function send(id: string): Promise<void> {
  for (;;) {
    const pending = read(id);
    if (!pending || pending.error) {
      setState(id, pending ? { saving: false, error: pending.error, step: pending.step } : IDLE);
      return;
    }
    setState(id, { saving: true, error: '', step: pending.step });
    try {
      const saved = await api<AuctionDetail>('PATCH', `/auctions/${id}`, pending.patch);
      const now = read(id);
      if (now && now.version === pending.version) {
        write(id, null);
        client?.setQueryData(['auction', id], saved);
      }
      // A newer save arrived meanwhile: loop and send it too.
    } catch (e) {
      if (isFinal(e)) {
        const now = read(id);
        if (now) write(id, { ...now, error: e.message });
        continue;
      }
      setState(id, { saving: false, error: '', step: pending.step });
      window.setTimeout(() => void flushDraft(id).catch(() => undefined), 10_000);
      throw e;
    }
  }
}

/** Send what is still on the device; resolves when the server has it. */
export function flushDraft(id: string): Promise<void> {
  let flight = flights.get(id);
  if (!flight) {
    flight = send(id).finally(() => flights.delete(id));
    flights.set(id, flight);
  }
  return flight;
}

/**
 * Save a step: show `optimistic` at once, keep `patch` on the device, send it in the background.
 * A fresh save of a step clears that step's earlier error.
 */
export function saveDraftLater(
  queryClient: QueryClient,
  id: string,
  step: DraftStep,
  patch: DraftPatch,
  optimistic: Partial<AuctionDetail>,
) {
  client = queryClient;
  const before = read(id);
  write(id, {
    patch: { ...(before?.patch ?? {}), ...patch },
    step,
    error: before && before.step !== step ? before.error : '',
    version: (before?.version ?? 0) + 1,
  });
  queryClient.setQueryData<AuctionDetail>(['auction', id], (a) => (a ? { ...a, ...optimistic } : a));
  void flushDraft(id).catch(() => undefined);
}

/** Values of a step not yet accepted by the server (kept after a reload or a rejected PATCH). */
export function pendingPatch(id: string): DraftPatch | null {
  return read(id)?.patch ?? null;
}

export function useDraftSync(id: string): DraftSyncState {
  const queryClient = useQueryClient();
  useEffect(() => {
    client = queryClient;
    if (read(id)) void flushDraft(id).catch(() => undefined);
  }, [id, queryClient]);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => states.get(id) ?? IDLE,
  );
}
