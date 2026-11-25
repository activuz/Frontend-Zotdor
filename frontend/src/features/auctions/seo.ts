import { mediaUrl } from '../../api/http';
import { formatSom } from '../../lib/format';
import type { SeoInput } from '../../lib/seo';
import type { AuctionDetail } from './api';
import { STATUS_LABEL } from './labels';

const OPEN = new Set(['scheduled', 'live']);
const PUBLIC = new Set(['scheduled', 'live', 'ended', 'sold', 'unsold']);

/** Title, description, image and Product JSON-LD for an auction page (docs/SEO.md). */
export function auctionSeo(a: AuctionDetail): SeoInput {
  const status = a.status ?? 'draft';
  const place = [a.district?.name, a.region?.name].filter(Boolean).join(', ');
  const price = a.asking_price ? formatSom(a.asking_price) : '';
  const text = (a.description ?? '').replace(/\s+/g, ' ').trim();
  const head = [place, price && `Sotuvchi narxi ${price}`, STATUS_LABEL[status]].filter(Boolean).join('. ');
  const full = text ? `${head}. ${text}` : head;
  const description = full.length > 200 ? `${full.slice(0, 197).trimEnd()}…` : full;
  const photos = a.media.filter((m) => m.kind === 'photo' && m.status === 'ready' && m.url).map((m) => mediaUrl(m.url));
  const title = a.title || 'Chorva auksioni';
  const url = `${window.location.origin}/a/${a.id}`;

  return {
    title,
    description,
    path: `/a/${a.id}`,
    image: photos[0],
    // Drafts and moderation states are visible only to the owner: never index them.
    noindex: !PUBLIC.has(status),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: title,
      description: text || head,
      url,
      ...(photos.length ? { image: photos.slice(0, 5) } : {}),
      ...(a.animal_type?.name ? { category: a.animal_type.name } : {}),
      ...(a.breed?.name ? { brand: { '@type': 'Brand', name: a.breed.name } } : {}),
      ...(a.asking_price
        ? {
            offers: {
              '@type': 'Offer',
              url,
              price: a.asking_price,
              priceCurrency: 'UZS',
              availability: OPEN.has(status) ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
              ...(a.ends_at ? { priceValidUntil: a.ends_at.slice(0, 10) } : {}),
              ...(a.region?.name ? { areaServed: a.region.name } : {}),
            },
          }
        : {}),
    },
  };
}
