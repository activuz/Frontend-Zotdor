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
const BAD_RESPONSE_MESSAGE = 'Server notoʻgʻri javob qaytardi. Birozdan keyin qayta urinib koʻring.';

function readCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

let csrfToken: Promise<string> | null = null;

/**
 * CSRF token for unsafe requests. It comes from the /auth/csrf response body, not from
 * document.cookie: when the SPA and the API live on different subdomains the SPA cannot read
 * the API's cookie. The cookie is still sent by the browser and checked by Django.
 */
function getCsrfToken(): Promise<string> {
  csrfToken ??= fetch(`${API_BASE}/api/v1/auth/csrf`, { credentials: 'include' })
    .then((r) => (r.ok ? (r.json() as Promise<{ csrf_token?: string }>) : ({} as { csrf_token?: string })))
    .then((d) => d.csrf_token ?? readCookie('csrftoken') ?? '')
    .catch(() => {
      csrfToken = null;
      return readCookie('csrftoken') ?? '';
    });
  return csrfToken;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface ErrorBody {
  error?: { code?: string; message?: string; fields?: Record<string, string[]> };
}

export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  try {
    return await send<T>(method, path, body);
  } catch (error) {
    // Django rotates the token on login; fetch a fresh one and retry once.
    if (error instanceof ApiError && error.code === 'csrf_failed') {
      csrfToken = null;
      return send<T>(method, path, body);
    }
    throw error;
  }
}

async function send<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') {
    headers['X-CSRFToken'] = await getCsrfToken();
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
  const text = await response.text().catch(() => '');
  let data: unknown = null;
  let parsed = text === '';
  try {
    if (text) {
      data = JSON.parse(text);
      parsed = true;
    }
  } catch {
    parsed = false;
  }
  if (response.ok && !parsed) {
    // An HTML page with 200 means the request never reached the API (e.g. VITE_API_URL is
    // missing and the static host answered with index.html). Never treat it as data.
    throw new ApiError(response.status, 'bad_response', BAD_RESPONSE_MESSAGE);
  }
  if (response.ok && text === '') return undefined as T;
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
