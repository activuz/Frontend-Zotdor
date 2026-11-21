/** Accepts only in-app paths, so ?next= cannot redirect to another site (open-redirect guard). */
export function safeNext(raw: string | null, fallback = '/'): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : fallback;
}
