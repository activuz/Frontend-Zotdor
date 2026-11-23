import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useClaims,
  useLeads,
  useRefunds,
  useReports,
  useResolveClaim,
  useResolveRefund,
  useResolveReport,
  useSetLeadStatus,
} from '../api/panel';
import { formatDateTime, formatSom } from '../lib/format';
import { EmptyState, PageError, PageLoading } from '../components/PageState';
import { DecisionForm, Pager, Tabs, Title } from './common';

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="rounded-2xl border border-line bg-surface p-4 space-y-2 text-[15px]">{children}</li>
);

const STATUS_LABEL: Record<string, string> = {
  open: 'Ochiq',
  resolved: 'Hal qilingan',
  dismissed: 'Asossiz',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
  done: 'Qaytarilgan',
  new: 'Yangi',
  contacted: 'Bogʻlanildi',
  closed: 'Yopilgan',
  all: 'Hammasi',
};

const tabs = (values: string[]) => values.map((v) => ({ value: v, label: STATUS_LABEL[v] ?? v }));

export const Reports: React.FC = () => {
  const [status, setStatus] = useState('open');
  const [offset, setOffset] = useState(0);
  const list = useReports(status, offset);
  const resolve = useResolveReport();

  return (
    <div>
      <Title>Shikoyatlar</Title>
      <Tabs value={status} options={tabs(['open', 'resolved', 'dismissed', 'all'])} onChange={(v) => { setStatus(v); setOffset(0); }} />
      {list.isPending && <PageLoading />}
      {list.isError && <PageError message={list.error.message} onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.results.length === 0 && <EmptyState title="Shikoyatlar yoʻq" />}
      <ul className="space-y-3">
        {list.data?.results.map((r) => (
          <Card key={r.id}>
            <p className="font-semibold">
              {r.reason_label} ·{' '}
              <Link to={r.target_type === 'auction' ? `/auctions/${r.target_id}` : `/users/${r.target_id}`} className="text-brand">
                {r.target_type === 'auction' ? 'Auksionni ochish' : 'Foydalanuvchini ochish'}
              </Link>
            </p>
            {r.comment && <p className="rounded-xl bg-page p-3">{r.comment}</p>}
            <p className="text-[13px] text-ink-muted">
              {formatDateTime(r.created_at)} · Shikoyatchi: {r.reporter_phone} · {STATUS_LABEL[r.status] ?? r.status}
            </p>
            {r.handled_note && <p className="text-[13px] text-ink-muted">Izoh: {r.handled_note}</p>}
            {r.status === 'open' && (
              <DecisionForm
                pending={resolve.isPending}
                error={resolve.isError && resolve.variables?.id === r.id ? resolve.error.message : undefined}
                notePlaceholder="Ichki izoh"
                actions={[
                  { key: 'resolved', label: 'Hal qilindi', variant: 'primary' },
                  { key: 'dismissed', label: 'Asossiz' },
                ]}
                onSubmit={(key, note) => resolve.mutate({ id: r.id, outcome: key as 'resolved' | 'dismissed', note })}
              />
            )}
          </Card>
        ))}
      </ul>
      {list.isSuccess && <Pager offset={offset} count={list.data.count} onChange={setOffset} />}
    </div>
  );
};

export const Claims: React.FC = () => {
  const [status, setStatus] = useState('open');
  const [offset, setOffset] = useState(0);
  const list = useClaims(status, offset);
  const resolve = useResolveClaim();

  return (
    <div>
      <Title>“Bitim boʻlmadi” arizalari</Title>
      <Tabs value={status} options={tabs(['open', 'approved', 'rejected', 'all'])} onChange={(v) => { setStatus(v); setOffset(0); }} />
      {list.isPending && <PageLoading />}
      {list.isError && <PageError message={list.error.message} onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.results.length === 0 && <EmptyState title="Arizalar yoʻq" />}
      <ul className="space-y-3">
        {list.data?.results.map((c) => (
          <Card key={c.id}>
            <p className="font-semibold">
              <Link to={`/auctions/${c.auction_id}`} className="text-brand">{c.auction_title}</Link> ·{' '}
              {formatSom(c.price)}
            </p>
            <p className="text-[13px] text-ink-muted">
              Sotuvchi {c.seller_phone} · Xaridor {c.buyer_phone} · Komissiya {formatSom(c.commission_amount ?? 0)}
            </p>
            <p className="rounded-xl bg-page p-3">{c.reason}</p>
            <p className="text-[13px] text-ink-muted">
              {formatDateTime(c.created_at)} · {STATUS_LABEL[c.status] ?? c.status}
              {c.resolution_note && ` · ${c.resolution_note}`}
            </p>
            {c.status === 'open' && (
              <DecisionForm
                pending={resolve.isPending}
                error={resolve.isError && resolve.variables?.id === c.id ? resolve.error.message : undefined}
                actions={[
                  { key: 'approve', label: 'Tasdiqlash (komissiyani qaytarish)', variant: 'primary' },
                  { key: 'reject', label: 'Rad etish', needsNote: true },
                ]}
                onSubmit={(key, note) => resolve.mutate({ id: c.id, approve: key === 'approve', note })}
              />
            )}
          </Card>
        ))}
      </ul>
      {list.isSuccess && <Pager offset={offset} count={list.data.count} onChange={setOffset} />}
    </div>
  );
};

export const Refunds: React.FC = () => {
  const [status, setStatus] = useState('open');
  const [offset, setOffset] = useState(0);
  const list = useRefunds(status, offset);
  const resolve = useResolveRefund();

  return (
    <div>
      <Title>Pul qaytarish arizalari</Title>
      <Tabs value={status} options={tabs(['open', 'done', 'rejected', 'all'])} onChange={(v) => { setStatus(v); setOffset(0); }} />
      {list.isPending && <PageLoading />}
      {list.isError && <PageError message={list.error.message} onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.results.length === 0 && <EmptyState title="Arizalar yoʻq" />}
      <ul className="space-y-3">
        {list.data?.results.map((r) => (
          <Card key={r.id}>
            <p className="font-semibold tabular-nums">
              {formatSom(r.amount)} ·{' '}
              <Link to={`/users/${r.user_id}`} className="text-brand">{r.user_phone}</Link>
            </p>
            <p className="text-[13px] text-ink-muted">
              Click: {r.click_reference} · Asosiy balans: {formatSom(r.main_balance)}
            </p>
            <p className="rounded-xl bg-page p-3">{r.reason}</p>
            <p className="text-[13px] text-ink-muted">
              {formatDateTime(r.created_at)} · {STATUS_LABEL[r.status] ?? r.status}
              {r.note && ` · ${r.note}`}
            </p>
            {r.status === 'open' && (
              <DecisionForm
                pending={resolve.isPending}
                error={resolve.isError && resolve.variables?.id === r.id ? resolve.error.message : undefined}
                notePlaceholder="Izoh (masalan, Click qaytarish raqami)"
                actions={[
                  { key: 'done', label: 'Qaytarildi', variant: 'primary' },
                  { key: 'reject', label: 'Rad etish', needsNote: true },
                ]}
                onSubmit={(key, note) => resolve.mutate({ id: r.id, done: key === 'done', note })}
              />
            )}
          </Card>
        ))}
      </ul>
      {list.isSuccess && <Pager offset={offset} count={list.data.count} onChange={setOffset} />}
    </div>
  );
};

export const Leads: React.FC = () => {
  const [status, setStatus] = useState('new');
  const [offset, setOffset] = useState(0);
  const list = useLeads(status, offset);
  const update = useSetLeadStatus();

  return (
    <div>
      <Title>Sayt arizalari</Title>
      <Tabs value={status} options={tabs(['new', 'contacted', 'closed', 'all'])} onChange={(v) => { setStatus(v); setOffset(0); }} />
      {list.isPending && <PageLoading />}
      {list.isError && <PageError message={list.error.message} onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.results.length === 0 && <EmptyState title="Arizalar yoʻq" />}
      <ul className="space-y-3">
        {list.data?.results.map((l) => (
          <Card key={l.id}>
            <p className="font-semibold">
              {l.name} ·{' '}
              <a href={`tel:${l.phone}`} className="text-brand tabular-nums">{l.phone}</a>
            </p>
            <p className="text-[13px] text-ink-muted">
              {l.role_label}
              {l.region && ` · ${l.region}`}
              {l.utm && ` · Manba: ${l.utm}`}
            </p>
            {l.message && <p className="rounded-xl bg-page p-3">{l.message}</p>}
            <p className="text-[13px] text-ink-muted">
              {formatDateTime(l.created_at)} · {STATUS_LABEL[l.status] ?? l.status}
              {l.handled_note && ` · ${l.handled_note}`}
            </p>
            {l.status !== 'closed' && (
              <DecisionForm
                pending={update.isPending}
                error={update.isError && update.variables?.id === l.id ? update.error.message : undefined}
                notePlaceholder="Ichki izoh"
                actions={[
                  ...(l.status === 'new' ? [{ key: 'contacted', label: 'Bogʻlanildi', variant: 'primary' as const }] : []),
                  { key: 'closed', label: 'Yopish' },
                ]}
                onSubmit={(key, note) => update.mutate({ id: l.id, status: key as 'contacted' | 'closed', note })}
              />
            )}
          </Card>
        ))}
      </ul>
      {list.isSuccess && <Pager offset={offset} count={list.data.count} onChange={setOffset} />}
    </div>
  );
};
