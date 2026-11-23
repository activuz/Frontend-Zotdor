import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { api } from '../../api/http';
import type { components } from '../../api/schema';
import { formatDate, formatRating } from '../../lib/format';
import { PageError, PageLoading } from '../../components/ui/PageState';
import { useFeed } from '../auctions/api';
import { AuctionGrid } from '../auctions/AuctionCard';
import { ReportButton } from '../auctions/AuctionPage';
import { useSeo } from '../../lib/seo';

type PublicProfile = components['schemas']['PublicProfile'];

/** FR-15: public seller profile — no phone or exact location here (BR-33). */
export const PublicProfilePage: React.FC = () => {
  const { id = '' } = useParams();
  const profile = useQuery({
    queryKey: ['user', id],
    queryFn: () => api<PublicProfile>('GET', `/users/${id}`),
  });
  const auctions = useFeed({ seller: id }, { limit: 12 });
  const p = profile.data?.user;
  useSeo(
    p
      ? {
          title: `${p.display_name} — sotuvchi`,
          description: [
            `${p.display_name} Zotdor.uz chorva auksionida`,
            p.rating_count ? `oʻrtacha baho ${formatRating(p.rating_avg)} (${p.rating_count} ta)` : '',
            p.deals_count ? `${p.deals_count} ta bitim` : '',
          ]
            .filter(Boolean)
            .join(', ') + '.',
        }
      : { title: 'Sotuvchi', noindex: profile.isError },
  );

  if (profile.isPending) return <PageLoading />;
  if (profile.isError) return <PageError message={profile.error.message} onRetry={() => void profile.refetch()} />;
  const { user, ratings } = profile.data;
  const rating = formatRating(user.rating_avg);
  const items = auctions.data?.pages[0]?.results ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-[28px] text-ink">{user.display_name}</h1>
          <ReportButton targetType="user" targetId={user.id} />
        </div>
        <p className="mt-1 text-[15px] text-ink">
          {rating ? (
            <span className="inline-flex items-center gap-1">
              <Star className="w-4 h-4" aria-hidden="true" /> {rating} · {user.rating_count} baho
            </span>
          ) : (
            'Hali baho yoʻq'
          )}
          {` · ${user.deals_count} ta bitim`}
        </p>
        <p className="text-[13px] text-ink-muted">
          {user.region?.name ? `${user.region.name} · ` : ''}
          {formatDate(user.member_since)} dan beri aʼzo
        </p>
      </section>

      <section aria-labelledby="pp-auctions">
        <h2 id="pp-auctions" className="font-display text-[20px] text-ink mb-3">
          Ochiq auksionlari
        </h2>
        {auctions.isPending && <PageLoading />}
        {auctions.isError && <PageError message={auctions.error.message} onRetry={() => void auctions.refetch()} />}
        {auctions.isSuccess && items.length === 0 && <p className="text-[15px] text-ink-muted">Hozir ochiq auksion yoʻq.</p>}
        {items.length > 0 && <AuctionGrid items={items} />}
      </section>

      <section aria-labelledby="pp-ratings">
        <h2 id="pp-ratings" className="font-display text-[20px] text-ink mb-3">
          Baholar
        </h2>
        {ratings.length === 0 ? (
          <p className="text-[15px] text-ink-muted">Hali baho qoldirilmagan.</p>
        ) : (
          <ul className="space-y-2">
            {ratings.map((r, i) => (
              <li key={i} className="rounded-2xl border border-line bg-surface p-3">
                <p className="text-[15px] font-semibold text-ink">
                  {r.score}/5 · {r.author}
                </p>
                {r.comment && <p className="text-[15px] text-ink">{r.comment}</p>}
                <p className="text-[13px] text-ink-muted">{formatDate(r.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
