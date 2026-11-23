/**
 * The only HTTP client for the Zotdor API (docs/API.md).
 * - session cookie auth (`credentials: 'include'`), CSRF header on unsafe methods
 * - every failure becomes an ApiError carrying the server's `code` and Uzbek `message`
 * There is deliberately no mock fallback: if the API fails, the UI shows the error.
 */

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const NETWORK_MESSAGE = 'Serverga ulanib boʻlmadi. Internetni tekshirib, qayta urinib koʻring.';

function readCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

let csrfReady: Promise<void> | null = null;

/** Ensures the csrftoken cookie exists; called lazily before the first unsafe request. */
function ensureCsrf(): Promise<void> {
  if (readCookie('csrftoken')) return Promise.resolve();
  csrfReady ??= fetch(`${API_BASE}/api/v1/auth/csrf`, { credentials: 'include' }).then(() => undefined);
  return csrfReady;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface ErrorBody {
  error?: { code?: string; message?: string; fields?: Record<string, string[]> };
}

export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') {
    await ensureCsrf();
    headers['X-CSRFToken'] = readCookie('csrftoken') ?? '';
  }
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/v1${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network', NETWORK_MESSAGE);
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data as ErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'error',
      error?.message ?? 'Xatolik yuz berdi. Qayta urinib koʻring.',
      error?.fields,
    );
  }
  return data as T;
}

/** Uploaded files come back as `/media/...`; prefix the API host when the API lives elsewhere. */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  return path.startsWith('/') ? `${API_BASE}${path}` : path;
}

/** Builds `?a=1&b=2`, skipping empty values. */
export function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** DRF returns `next` as a full URL; pull one parameter (cursor / offset) out of it. */
export function paramOf(next: string | null | undefined, name: string): string | undefined {
  if (!next) return undefined;
  return new URL(next, window.location.origin).searchParams.get(name) ?? undefined;
}
