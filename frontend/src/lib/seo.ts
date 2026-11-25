/**
 * Per-page <title>, description, canonical, robots, Open Graph and JSON-LD (docs/SEO.md).
 *
 * Google renders this SPA and reads these tags. Telegram/Facebook bots do not run JavaScript;
 * for /a/:id they are routed to the API's static preview page by vercel.json.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const SITE_NAME = 'Zotdor.uz';
const SITE_URL = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');
/** Social preview image, rendered by the landing (landing/src/app/opengraph-image.tsx). */
export const DEFAULT_IMAGE = 'https://zotdor.uz/opengraph-image';
export const DEFAULT_DESCRIPTION =
  'Qoramol, qoʻy, echki va otlarni auksion orqali soting va sotib oling. Jonli auksionlar, faqat kamerada olingan suratlar, xaridor uchun bepul.';

export interface SeoInput {
  title: string;
  description?: string;
  /** Path for the canonical URL; defaults to the current path without query. */
  path?: string;
  image?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | null;
}

function setMeta(attr: 'name' | 'property', key: string, value: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (value === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

function setCanonical(href: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (href === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

function setJsonLd(data: Record<string, unknown> | null) {
  const id = 'seo-jsonld';
  document.getElementById(id)?.remove();
  if (!data) return;
  const el = document.createElement('script');
  el.id = id;
  el.type = 'application/ld+json';
  el.textContent = JSON.stringify(data);
  document.head.appendChild(el);
}

export function applySeo(input: SeoInput, pathname: string) {
  const title = input.title === SITE_NAME ? input.title : `${input.title} — ${SITE_NAME}`;
  const description = input.description || DEFAULT_DESCRIPTION;
  const url = `${SITE_URL}${input.path ?? pathname}`;
  document.title = title;
  setMeta('name', 'description', description);
  setMeta('name', 'robots', input.noindex ? 'noindex, nofollow' : 'index, follow');
  setCanonical(input.noindex ? null : url);
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:site_name', SITE_NAME);
  setMeta('property', 'og:locale', 'uz_UZ');
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:image', input.image || DEFAULT_IMAGE);
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', input.image || DEFAULT_IMAGE);
  setJsonLd(input.jsonLd ?? null);
}

/** Sets the tags for the current page. Pass `null` while there is nothing to describe yet. */
export function useSeo(input: SeoInput | null) {
  const { pathname } = useLocation();
  const key = input ? JSON.stringify(input) : '';
  useEffect(() => {
    if (input) applySeo(input, pathname);
    // `key` captures every field of `input`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pathname]);
}

/** Tags for pages that have no data of their own. Pages matched by DYNAMIC set their own. */
const STATIC: { match: (p: string) => boolean; seo: SeoInput }[] = [
  {
    match: (p) => p === '/',
    seo: { title: 'Chorva mollari auksioni', path: '/' },
  },
  {
    match: (p) => p === '/search',
    seo: {
      title: 'Chorva qidirish',
      description: 'Hudud, hayvon turi, zot va narx boʻyicha chorva auksionlarini qidiring: qoramol, qoʻy, echki, ot.',
      path: '/search',
    },
  },
  {
    match: (p) => p === '/login',
    seo: {
      title: 'Kirish',
      description: 'Zotdor.uz ga telefon raqami va Telegram orqali kiring. Parol kerak emas. Auksion oching yoki taklif bering.',
      path: '/login',
    },
  },
  { match: (p) => p === '/sell' || p.startsWith('/sell/'), seo: { title: 'Chorva sotish', noindex: true } },
  { match: (p) => p === '/me/auctions', seo: { title: 'Mening auksionlarim', noindex: true } },
  { match: (p) => p === '/me/bids', seo: { title: 'Takliflarim', noindex: true } },
  { match: (p) => p === '/me/deals', seo: { title: 'Bitimlarim', noindex: true } },
  { match: (p) => p === '/me/saved', seo: { title: 'Saqlanganlar', noindex: true } },
  { match: (p) => p.startsWith('/me'), seo: { title: 'Profil', noindex: true } },
  { match: (p) => p.startsWith('/deals/'), seo: { title: 'Bitim', noindex: true } },
  { match: (p) => /^\/a\/[^/]+\/decision$/.test(p), seo: { title: 'Xaridorni tanlash', noindex: true } },
  { match: (p) => p === '/notifications', seo: { title: 'Bildirishnomalar', noindex: true } },
  { match: (p) => p.startsWith('/wallet'), seo: { title: 'Hamyon', noindex: true } },
];

// These pages set their own tags with useSeo().
const DYNAMIC = /^\/((a|u)\/[^/]+|terms|privacy|offer)$/;

/** Mounted once inside the router. */
export function RouteSeo() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (DYNAMIC.test(pathname)) return;
    const found = STATIC.find((s) => s.match(pathname));
    // Unknown paths render NotFound: keep them out of the index.
    applySeo(found?.seo ?? { title: 'Sahifa topilmadi', noindex: true }, pathname);
  }, [pathname]);
  return null;
}
