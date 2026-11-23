import React from 'react';
import { Link } from 'react-router-dom';
import { useStats } from '../api/panel';
import { formatSom } from '../lib/format';
import { PageError, PageLoading } from '../components/PageState';
import { AUCTION_STATUS, Title } from './common';

export const Dashboard: React.FC = () => {
  const stats = useStats();
  if (stats.isPending) return <PageLoading />;
  if (stats.isError) return <PageError message={stats.error.message} onRetry={() => void stats.refetch()} />;
  const s = stats.data;

  const queues = [
    { to: '/auctions', label: 'Moderatsiyadagi auksionlar', n: s.queues.pending_review },
    { to: '/reports', label: 'Ochiq shikoyatlar', n: s.queues.reports },
    { to: '/claims', label: '“Bitim boʻlmadi” arizalari', n: s.queues.claims },
    { to: '/refunds', label: 'Pul qaytarish arizalari', n: s.queues.refunds },
  ];

  return (
    <div className="space-y-6">
      <Title>Umumiy holat</Title>
      <section aria-label="Navbatlar" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {queues.map((q) => (
          <Link key={q.to} to={q.to} className="rounded-2xl border border-line bg-surface p-4 hover:border-brand">
            <p className="text-[15px] text-ink-muted">{q.label}</p>
            <p className={`font-display text-[32px] tabular-nums ${q.n > 0 ? 'text-danger' : 'text-ink'}`}>{q.n}</p>
          </Link>
        ))}
      </section>
      <section aria-labelledby="week" className="rounded-2xl border border-line bg-surface p-4">
        <h2 id="week" className="font-display text-[20px]">
          Oxirgi 7 kun
        </h2>
        <dl className="mt-2 grid gap-3 sm:grid-cols-3 text-[15px]">
          <div>
            <dt className="text-ink-muted">Bitimlar</dt>
            <dd className="text-[24px] tabular-nums">{s.deals_7d}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Komissiya</dt>
            <dd className="text-[24px] tabular-nums">{formatSom(s.commission_7d)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Yangi foydalanuvchilar</dt>
            <dd className="text-[24px] tabular-nums">{s.new_users_7d}</dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="by-status" className="rounded-2xl border border-line bg-surface p-4">
        <h2 id="by-status" className="font-display text-[20px]">
          Auksionlar holati boʻyicha
        </h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-[15px]">
          {Object.entries(s.auctions_by_status).map(([k, v]) => (
            <li key={k} className="flex justify-between border-b border-line py-1">
              <span>{AUCTION_STATUS[k] ?? k}</span>
              <span className="tabular-nums">{v}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
