/**
 * The only place the landing talks to the Zotdor API (api.zotdor.uz). Types come from the
 * generated schema.d.ts (`npm run api:types`), never written by hand.
 */

import type { components } from "./schema";

type S = components["schemas"];
export type AuctionCard = S["AuctionList"];
export type Region = S["Region"];
export type PublicConfig = S["PublicConfig"];
export type LeadIn = S["LeadInRequest"];
export type LeadCreated = S["LeadCreated"];

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://api.zotdor.uz").replace(/\/$/, "");

/** A free ngrok domain shows browsers a warning page unless this header is sent (docs/SELFHOST.md). */
const EXTRA_HEADERS: Record<string, string> = /\.ngrok(-free)?\.(app|dev|io)(\/|$)/.test(API_URL)
  ? { "ngrok-skip-browser-warning": "1" }
  : {};
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://web.zotdor.uz").replace(/\/$/, "");

/** Public address of this landing (canonical URL, sitemap, robots). */
export const LANDING_URL = (process.env.NEXT_PUBLIC_LANDING_URL || "https://zotdor.uz").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

async function parse<T>(response: Response): Promise<T> {
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const body: unknown = isJson ? await response.json() : null;
  if (!response.ok || !isJson) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(error?.message || "", response.status, error?.code || "error");
  }
  return body as T;
}

/** Server-side GET, cached by Next and refreshed every `revalidate` seconds. */
export async function apiGet<T>(path: string, revalidate = 60): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    headers: { Accept: "application/json", ...EXTRA_HEADERS },
    next: { revalidate },
  });
  return parse<T>(response);
}

/** Browser POST without cookies: public endpoints only. */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...EXTRA_HEADERS },
    body: JSON.stringify(body),
    credentials: "omit",
  });
  return parse<T>(response);
}

/** Media URLs may be relative to the API host (local storage) or absolute (Nhost). */
export function mediaUrl(url: string): string {
  return url.startsWith("/") ? `${API_URL}${url}` : url;
}

/** A link into the user site. */
export function siteUrl(path = "/"): string {
  return `${SITE_URL}${path}`;
}

/** Result of a server fetch: data, or an error flag so the section can show its error state. */
export type Loaded<T> = { ok: true; data: T } | { ok: false };

export async function load<T>(path: string, revalidate?: number): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await apiGet<T>(path, revalidate) };
  } catch {
    return { ok: false };
  }
}
