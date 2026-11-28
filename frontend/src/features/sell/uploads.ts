import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, apiOrigin, ApiError, currentCsrfToken } from '../../api/http';
import { nativeBridge, onNativeEvent } from '../notifications/native';

/**
 * Upload queue for the sell wizard (F2 step 3, docs/ARCHITECTURE.md D-14).
 *
 * A photo or video is kept on the device the moment it is taken and sent in the background,
 * so the camera never waits for the network. Two backends:
 * - the Android app: the file is handed to the app, which uploads it with WorkManager and keeps
 *   going after the app is closed (android/.../UploadWorker.kt);
 * - a browser: IndexedDB, uploaded while the page is open and resumed when it is opened again.
 * Every file still carries its capture session: the server checks freshness as before (BR-14).
 */

export type UploadKind = 'photo' | 'video';
export type UploadState = 'queued' | 'uploading' | 'failed';

export interface PendingUpload {
  id: string;
  auctionId: string;
  kind: UploadKind;
  state: UploadState;
  error: string;
  createdAt: number;
}

export interface NewUpload {
  auctionId: string;
  kind: UploadKind;
  blob: Blob;
  fileName: string;
  sessionId: string;
  meta: Record<string, string | number>;
}

interface StoredUpload extends PendingUpload {
  blob: Blob;
  fileName: string;
  sessionId: string;
  meta: Record<string, string | number>;
}

interface Backend {
  enqueue(item: StoredUpload): Promise<void>;
  list(auctionId: string): Promise<PendingUpload[]>;
  retry(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  start(): void;
}

/* ------------------------------------------------------------------ store */

const byAuction = new Map<string, PendingUpload[]>();
const previews = new Map<string, string>(); // upload id -> object URL (this page only)
const listeners = new Set<() => void>();
const EMPTY: PendingUpload[] = [];
let client: QueryClient | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function setList(auctionId: string, items: PendingUpload[]) {
  byAuction.set(auctionId, [...items].sort((a, b) => a.createdAt - b.createdAt));
  emit();
}

function uploaded(auctionId: string) {
  void client?.invalidateQueries({ queryKey: ['auction', auctionId] });
}

async function refresh(auctionId: string) {
  setList(auctionId, await backend().list(auctionId));
}

export function previewOf(id: string): string | undefined {
  return previews.get(id);
}

function dropPreview(id: string) {
  const url = previews.get(id);
  if (url) URL.revokeObjectURL(url);
  previews.delete(id);
}

/* ------------------------------------------------------------------ browser backend */

const DB_NAME = 'zotdor-uploads';
const STORE = 'items';
let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('auctionId', 'auctionId');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = run(d.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
      }),
  );
}

const getAll = () => tx<StoredUpload[]>('readonly', (s) => s.getAll());
const getOne = (id: string) => tx<StoredUpload | undefined>('readonly', (s) => s.get(id));
const put = (item: StoredUpload) => tx('readwrite', (s) => s.put(item));
const del = (id: string) => tx('readwrite', (s) => s.delete(id));

const strip = ({ id, auctionId, kind, state, error, createdAt }: StoredUpload): PendingUpload => ({
  id,
  auctionId,
  kind,
  state,
  error,
  createdAt,
});

/** A server answer that will not change on retry: the file is marked failed instead. */
function isFinal(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429;
}

let pumping = false;
let backoff = 5_000;

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    for (;;) {
      const next = (await getAll())
        .filter((i) => i.state === 'queued')
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!next) return;
      await put({ ...next, state: 'uploading' });
      await refresh(next.auctionId);
      try {
        const form = new FormData();
        form.append('file', new File([next.blob], next.fileName, { type: next.blob.type }));
        form.append('kind', next.kind);
        form.append('capture_session_id', next.sessionId);
        form.append('client_meta', JSON.stringify(next.meta));
        await api('POST', `/auctions/${next.auctionId}/media`, form);
        await del(next.id);
        dropPreview(next.id);
        await refresh(next.auctionId);
        uploaded(next.auctionId);
        backoff = 5_000;
      } catch (e) {
        if (isFinal(e)) {
          await put({ ...next, state: 'failed', error: e.message });
          await refresh(next.auctionId);
          continue;
        }
        // Network or server trouble: keep it queued and try again later.
        await put({ ...next, state: 'queued' });
        await refresh(next.auctionId);
        window.setTimeout(() => void pump(), backoff);
        backoff = Math.min(backoff * 2, 60_000);
        return;
      }
    }
  } finally {
    pumping = false;
  }
}

const browserBackend: Backend = {
  async enqueue(item) {
    await put(item);
    await refresh(item.auctionId);
    void pump();
  },
  async list(auctionId) {
    const all = await tx<StoredUpload[]>('readonly', (s) => s.index('auctionId').getAll(auctionId));
    for (const item of all) {
      if (!previews.has(item.id) && item.kind === 'photo') previews.set(item.id, URL.createObjectURL(item.blob));
    }
    return all.map(strip);
  },
  async retry(id) {
    const item = await getOne(id);
    if (!item) return;
    await put({ ...item, state: 'queued', error: '' });
    await refresh(item.auctionId);
    void pump();
  },
  async remove(id) {
    const item = await getOne(id);
    await del(id);
    dropPreview(id);
    if (item) await refresh(item.auctionId);
  },
  start() {
    void (async () => {
      // A page closed mid-upload left items "uploading": they go back to the queue.
      for (const item of (await getAll()).filter((i) => i.state === 'uploading')) {
        await put({ ...item, state: 'queued' });
      }
      void pump();
    })().catch(() => undefined);
    window.addEventListener('online', () => void pump());
  },
};

/* ------------------------------------------------------------------ Android backend */

const CHUNK = 384 * 1024; // bytes per bridge call; base64 makes it ~512 KB of text

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('read'));
    reader.readAsDataURL(blob);
  });
}

const nativeBackend: Backend = {
  async enqueue(item) {
    const app = nativeBridge();
    if (!app?.uploadBegin || !app.uploadAppend || !app.uploadCommit) throw new Error('Ilova eskirgan. Uni yangilang.');
    const header = {
      id: item.id,
      auctionId: item.auctionId,
      kind: item.kind,
      fileName: item.fileName,
      mime: item.blob.type || 'application/octet-stream',
      sessionId: item.sessionId,
      meta: JSON.stringify(item.meta),
      apiOrigin: apiOrigin(),
      csrf: await currentCsrfToken(),
      origin: window.location.origin,
      createdAt: item.createdAt,
    };
    if (!app.uploadBegin(JSON.stringify(header))) throw new Error('Faylni saqlab boʻlmadi.');
    for (let at = 0; at < item.blob.size; at += CHUNK) {
      if (!app.uploadAppend(item.id, await toBase64(item.blob.slice(at, at + CHUNK)))) {
        app.uploadRemove?.(item.id);
        throw new Error('Faylni saqlab boʻlmadi. Telefonda joy yetarlimi?');
      }
    }
    app.uploadCommit(item.id);
    await refresh(item.auctionId);
  },
  async list(auctionId) {
    try {
      return JSON.parse(nativeBridge()?.uploads?.(auctionId) ?? '[]') as PendingUpload[];
    } catch {
      return [];
    }
  },
  async retry(id) {
    // A fresh token: a "log in again" failure is fixed by logging in, then retrying.
    nativeBridge()?.uploadRetry?.(id, await currentCsrfToken());
  },
  async remove(id) {
    nativeBridge()?.uploadRemove?.(id);
    dropPreview(id);
  },
  start() {
    onNativeEvent((event) => {
      if (event.type === 'uploads') {
        void refresh(event.auctionId);
        uploaded(event.auctionId);
      }
      if (event.type === 'submit-done') {
        uploaded(event.auctionId);
        void client?.invalidateQueries({ queryKey: ['me', 'auctions'] });
        void client?.invalidateQueries({ queryKey: ['wallet'] });
      }
    });
  },
};

/* ------------------------------------------------------------------ public API */

export function inAppUploads(): boolean {
  return Boolean(nativeBridge()?.uploadBegin);
}

let chosen: Backend | null = null;
function backend(): Backend {
  if (!chosen) {
    chosen = inAppUploads() ? nativeBackend : browserBackend;
    chosen.start();
  }
  return chosen;
}

function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Keep the file on the device and send it in the background. Resolves once it is stored. */
export async function enqueueUpload(input: NewUpload): Promise<void> {
  const item: StoredUpload = { ...input, id: newId(), state: 'queued', error: '', createdAt: Date.now() };
  if (input.kind === 'photo') previews.set(item.id, URL.createObjectURL(input.blob));
  try {
    await backend().enqueue(item);
  } catch (e) {
    dropPreview(item.id);
    throw e;
  }
}

export const retryUpload = (id: string) => backend().retry(id);
export const removeUpload = (id: string) => backend().remove(id);

/** Files of this auction still on the device (queued, being sent or failed). */
export function useUploads(auctionId: string): PendingUpload[] {
  const queryClient = useQueryClient();
  useEffect(() => {
    client = queryClient;
    void refresh(auctionId).catch(() => undefined);
  }, [auctionId, queryClient]);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => byAuction.get(auctionId) ?? EMPTY,
  );
}

/** Android app: upload what is left, wait for video processing, then submit — even if closed. */
export async function submitInBackground(auctionId: string): Promise<boolean> {
  const app = nativeBridge();
  if (!app?.submitWhenReady) return false;
  return app.submitWhenReady(
    JSON.stringify({ auctionId, apiOrigin: apiOrigin(), csrf: await currentCsrfToken(), origin: window.location.origin }),
  );
}

export function pendingBackgroundSubmit(auctionId: string): boolean {
  return Boolean(nativeBridge()?.pendingSubmit?.(auctionId));
}
