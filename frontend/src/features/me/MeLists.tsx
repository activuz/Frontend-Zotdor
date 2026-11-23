import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { mediaUrl } from '../../api/http';
import { formatDateTime, formatSom } from '../../lib/format';
import { EmptyState, PageError, PageLoading } from '../../components/ui/PageState';
import { useMyAuctions, useMyBids, useWatchlist, type AuctionList, type AuctionStatus } from '../auctions/api';
import { AuctionGrid } from '../auctions/AuctionCard';
import { STATUS_LABEL, STATUS_TONE, TIER_TEXT } from '../auctions/labels';
import { useMyDeals } from '../deals/api';

const GROUPS: { key: string; label: string; statuses: AuctionStatus[] }[] = [
  { key: 'active', label: 'Faol', statuses: ['live', 'scheduled', 'pending_review'] },
  { key: 'decide', label: 'Tanlash kerak', statuses: ['ended'] },
  { key: 'drafts', label: 'Qoralamalar', statuses: ['draft', 'rejected'] },
  { key: 'archive', label: 'Arxiv', statuses: ['sold', 'unsold', 'cancelled', 'blocked'] },
];

const Title: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h1 className="font-display text-[28px] text-ink mb-4">{children}</h1>
);

const Row: React.FC<{ auction: AuctionList; to: string; extra?: React.ReactNode }> = ({ auction: a, to, extra }) => {
  const status = a.status ?? 'draft';
  return (
    <li>
      <Link to={to} className="flex gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-brand">
        <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-page">
          {a.cover && <img src={mediaUrl(a.cover.thumb_url)} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{a.title || 'Nomsiz eʼlon'}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
            <span className={`rounded-lg px-2 font-semibold ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
            {a.ends_at && <span>{formatDateTime(a.ends_at)}</span>}
          </p>
          {extra ?? (
            <p className="text-[15px] text-ink tabular-nums">
              {formatSom(a.top_bid_amount ?? a.asking_price ?? 0)}
              {(a.bidders_count ?? 0) > 0 && <span className="text-ink-muted"> · {a.bidders_count} xaridor</span>}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
};

function myAuctionLink(a: AuctionList): string {
  if (a.status === 'draft' || a.status === 'rejected') return `/sell/${a.id}`;
  if (a.status === 'ended') return `/a/${a.id}/decision`;
  return `/a/${a.id}`;
}

export const MyAuctionsPage: React.FC = () => {
  const list = useMyAuctions();
  const [group, setGroup] = useState(GROUPS[0].key);
  const current = GROUPS.find((g) => g.key === group) ?? GROUPS[0];
  const items = list.data?.filter((a) => a.status && current.statuses.includes(a.status)) ?? [];

  return (
    <div className="max-w-2xl mx-auto">
      <Title>Auksionlarim</Title>
      <div role="tablist" aria-label="Holat" className="-mx-3 px-3 mb-4 flex gap-2 overflow-x-auto no-scrollbar">
        {GROUPS.map((g) => {
          const n = list.data?.filter((a) => a.status && g.statuses.includes(a.status)).length ?? 0;
          return (
            <button
              key={g.key}
              type="button"
              role="tab"
              aria-selected={group === g.key}
              onClick={() => setGroup(g.key)}
              className={`shrink-0 min-h-touch px-4 rounded-full border text-[15px] font-semibold ${group === g.key ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-surface text-ink-muted'}`}
            >
              {g.label}
              {n > 0 && ` (${n})`}
            </button>
          );
        })}
      </div>
      {list.isPending && <PageLoading />}
      {list.isError && <PageError message={list.error.message} onRetry={() => void list.refetch()} />}
      {list.isSuccess && items.length === 0 && (
        <EmptyState title="Bu boʻlimda auksion yoʻq" action={{ to: '/sell', label: 'Auksion ochish' }} />
      )}
      {list.isSuccess && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((a) => (
            <Row key={a.id} auction={a} to={myAuctionLink(a)} />
          ))}
        </ul>
      )}
    </div>
  );
};

const BID_STATE: Record<string, string> = { active: 'Faol', won: 'Yutdingiz', lost: 'Tanlanmadi' };

export const MyBidsPage: React.FC = () => {
  const list = useMyBids();
  return (
    <div className="max-w-2xl mx-auto">
      <Title>Takliflarim</Title>
      {list.isPending && <PageLoading />}
      {list.isError && <PageError message={list.error.message} onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.length === 0 && (
        <EmptyState title="Siz hali taklif bermagansiz" action={{ to: '/', label: 'Auksionlarni koʻrish' }} />
      )}
      {list.isSuccess && list.data.length > 0 && (
        <ul className="space-y-2">
          {list.data.map((row) => (
            <Row
              key={row.auction.id}
              auction={row.auction}
              to={row.deal_id ? `/deals/${row.deal_id}` : `/a/${row.auction.id}`}
              extra={
                <p className="text-[15px] tabular-nums">
                  <span className="text-ink">Taklifingiz: {formatSom(row.amount)}</span>
                  {row.rank !== null && (
                    <span className={`font-semibold ${TIER_TEXT[row.tier ?? ''] ?? ''}`}> · {row.rank}-oʻrin</span>
                  )}
                  <span className="text-ink-muted"> · {BID_STATE[row.state]}</span>
                </p>
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
};

export const MyDealsPage: React.FC = () => {
  const list = useMyDeals();
  return (
    <div className="max-w-2xl mx-auto">
      <Title>Bitimlarim</Title>
      {list.isPending && <PageLoading />}
      {list.isError && <PageError message={list.error.message} onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.length === 0 && <EmptyState title="Hali bitim yoʻq" />}
      {list.isSuccess && list.data.length > 0 && (
        <ul className="space-y-2">
          {list.data.map((d) => (
            <li key={d.id}>
              <Link to={`/deals/${d.id}`} className="flex gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-brand">
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-page">
                  {d.cover_url && <img src={mediaUrl(d.cover_url)} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink">{d.title}</p>
                  <p className="text-[15px] text-ink tabular-nums">{formatSom(d.price)}</p>
                  <p className="text-[13px] text-ink-muted">
                    {d.role === 'seller' ? 'Sotdingiz' : 'Sotib oldingiz'} · {d.counterparty.name} ·{' '}
                    {formatDateTime(d.created_at)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const SavedPage: React.FC = () => {
  const list = useWatchlist();
  return (
    <div>
      <Title>Saqlanganlar</Title>
      {list.isPending && <PageLoading />}
      {list.isError && <PageError message={list.error.message} onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.length === 0 && (
        <EmptyState title="Saqlangan auksion yoʻq" text="Auksion sahifasida “Saqlash” tugmasini bosing." />
      )}
      {list.isSuccess && list.data.length > 0 && <AuctionGrid items={list.data} />}
    </div>
  );
};
