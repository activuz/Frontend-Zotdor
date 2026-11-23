import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useMe } from '../auth/api';
import { useTaxonomy } from '../reference/api';
import { useFeed, type FeedFilters } from './api';
import { AuctionGrid } from './AuctionCard';
import { PageError, PageLoading } from '../../components/ui/PageState';
import { query } from '../../api/http';

/** FR-06: feed sections. Each section links to the same filters on /search. */
export const FeedPage: React.FC = () => {
  const { data: me } = useMe();
  const hasLocation = Boolean(me?.district);

  return (
    <div className="space-y-8">
      <Directions />
      <Section title="Jonli auksionlar" filters={{ status: 'live', sort: 'ending_soon' }} empty="Hozir jonli auksion yoʻq." />
      {hasLocation && (
        <Section title="Yaqin atrofda" filters={{ sort: 'nearest' }} empty="Yaqin atrofda auksion topilmadi." />
      )}
      <Section
        title="Tez orada boshlanadi"
        filters={{ status: 'scheduled', sort: 'ending_soon' }}
        empty="Rejalashtirilgan auksion yoʻq."
      />
      <SellPrompt />
    </div>
  );
};

const Directions: React.FC = () => {
  const taxonomy = useTaxonomy();
  if (!taxonomy.isSuccess || taxonomy.data.directions.length === 0) return null;
  return (
    <nav aria-label="Yoʻnalishlar" className="-mx-3 sm:mx-0 overflow-x-auto no-scrollbar">
      <ul className="flex gap-2 px-3 sm:px-0">
        {taxonomy.data.directions.map((d) => (
          <li key={d.id} className="shrink-0">
            <Link
              to={`/search?direction=${d.id}`}
              className="inline-flex items-center min-h-touch px-4 rounded-full border border-line bg-surface text-[15px] font-semibold text-ink hover:border-brand"
            >
              {d.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

const Section: React.FC<{ title: string; filters: FeedFilters; empty: string }> = ({ title, filters, empty }) => {
  const feed = useFeed(filters, { limit: 8 });
  const items = feed.data?.pages[0]?.results ?? [];
  const more = (feed.data?.pages[0]?.count ?? 0) > items.length;

  return (
    <section aria-labelledby={`s-${title}`}>
      <div className="flex items-end justify-between gap-3 mb-3">
        <h2 id={`s-${title}`} className="font-display text-[24px] text-ink">
          {title}
        </h2>
        {more && (
          <Link
            to={`/search${query({ ...filters })}`}
            className="inline-flex items-center min-h-touch text-[15px] font-semibold text-brand"
          >
            Barchasi <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      {feed.isPending && <PageLoading />}
      {feed.isError && <PageError message={feed.error.message} onRetry={() => void feed.refetch()} />}
      {feed.isSuccess && items.length === 0 && <p className="text-[15px] text-ink-muted">{empty}</p>}
      {feed.isSuccess && items.length > 0 && <AuctionGrid items={items} />}
    </section>
  );
};

const SellPrompt: React.FC = () => (
  <section className="rounded-2xl border border-line bg-surface p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
    <div>
      <h2 className="font-display text-[20px] text-ink">Molingizni sotmoqchimisiz?</h2>
      <p className="text-[15px] text-ink-muted">
        Narx va vaqtni oʻzingiz belgilaysiz, xaridorni ham oʻzingiz tanlaysiz.
      </p>
    </div>
    <Link
      to="/sell"
      className="inline-flex items-center justify-center min-h-touch px-5 rounded-xl border border-line bg-page text-[15px] font-semibold text-ink"
    >
      Auksion ochish
    </Link>
  </section>
);
