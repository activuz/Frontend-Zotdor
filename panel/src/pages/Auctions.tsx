import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { mediaUrl } from '../api/http';
import { useAuctionAction, useAuctionDetail, useAuctionQueue } from '../api/panel';
import { formatDateTime, formatSom } from '../lib/format';
import { EmptyState, PageError, PageLoading } from '../components/PageState';
import { Alert, inputClass } from '../components/Field';
import { AUCTION_STATUS, DecisionForm, Pager, Tabs, Title } from './common';

const TABS = [
  { value: 'pending_review', label: 'Moderatsiyada' },
  { value: 'live', label: 'Jonli' },
  { value: 'scheduled', label: 'Rejalashtirilgan' },
  { value: 'rejected', label: 'Rad etilgan' },
  { value: 'blocked', label: 'Bloklangan' },
  { value: 'all', label: 'Hammasi' },
];

/** F7.1: oldest first in the review queue. */
export const AuctionQueue: React.FC = () => {
  const [status, setStatus] = useState('pending_review');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const list = useAuctionQueue(status, q, offset);

  return (
    <div>
      <Title>Auksionlar</Title>
      <Tabs value={status} options={TABS} onChange={(v) => { setStatus(v); setOffset(0); }} />
      <label htmlFor="aq" className="sr-only">Sarlavha yoki sotuvchi telefoni</label>
      <input
        id="aq"
        type="search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOffset(0); }}
        placeholder="Sarlavha yoki sotuvchi telefoni"
        className={`${inputClass} mb-4 max-w-md`}
      />
      {list.isPending && <PageLoading />}
      {list.isError && <PageError message={list.error.message} onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.results.length === 0 && <EmptyState title="Navbat boʻsh" />}
      {list.isSuccess && list.data.results.length > 0 && (
        <ul className="space-y-2">
          {list.data.results.map((a) => (
            <li key={a.id}>
              <Link to={`/auctions/${a.id}`} className="flex gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-brand">
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-page">
                  {a.cover && <img src={mediaUrl(a.cover.thumb_url)} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">{a.title || 'Nomsiz'}</p>
                  <p className="text-[13px] text-ink-muted">
                    {AUCTION_STATUS[a.status ?? ''] ?? a.status} · {a.seller_phone} · {formatSom(a.asking_price ?? 0)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {list.isSuccess && <Pager offset={offset} count={list.data.count} onChange={setOffset} />}
    </div>
  );
};

const REJECT_REASONS = [
  'Rasm yoki video eʼlondagi molga mos emas',
  'Tavsifda kontakt maʼlumotlari bor',
  'Notoʻgʻri toifa yoki maʼlumot',
  'Haqoratli yoki nojoʻya matn',
  'Boshqa joydan olingan rasmlar',
];

export const AuctionReview: React.FC = () => {
  const { id = '' } = useParams();
  const detail = useAuctionDetail(id);
  const action = useAuctionAction(id);
  const [preset, setPreset] = useState('');

  if (detail.isPending) return <PageLoading />;
  if (detail.isError) return <PageError message={detail.error.message} onRetry={() => void detail.refetch()} />;
  const a = detail.data;
  const pending = a.status === 'pending_review';

  return (
    <div className="space-y-5">
      <Link to="/auctions" className="inline-flex min-h-touch items-center text-[15px] font-semibold text-brand">
        ← Navbatga qaytish
      </Link>
      <Title>{a.title || 'Nomsiz auksion'}</Title>
      <p className="text-[15px] text-ink-muted">
        {AUCTION_STATUS[a.status ?? ''] ?? a.status} · Narx {formatSom(a.asking_price ?? 0)} ·{' '}
        {[a.district?.name, a.region?.name].filter(Boolean).join(', ')}
      </p>

      <section aria-label="Media" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {a.media.map((m) =>
          m.kind === 'video' ? (
            <video key={m.id} src={mediaUrl(m.url)} controls playsInline className="aspect-square w-full rounded-xl bg-ink object-cover" />
          ) : (
            <a key={m.id} href={mediaUrl(m.url)} target="_blank" rel="noreferrer">
              <img src={mediaUrl(m.thumb_url || m.url)} alt="" className="aspect-square w-full rounded-xl object-cover" />
            </a>
          ),
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-4 space-y-2 text-[15px]">
          <h2 className="font-display text-[20px]">Maʼlumotlar</h2>
          <p>{[a.direction?.name, a.animal_type?.name, a.animal_class?.name, a.breed?.name ?? a.breed_other].filter(Boolean).join(' · ')}</p>
          <p>Yoshi: {a.age_label}{a.weight_kg ? ` · ${a.weight_kg} kg` : ''}</p>
          {a.description && <p className="whitespace-pre-line rounded-xl bg-page p-3">{a.description}</p>}
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 space-y-2 text-[15px]">
          <h2 className="font-display text-[20px]">Sotuvchi</h2>
          <p>
            <Link to={`/users/${a.seller.id}`} className="font-semibold text-brand">
              {a.seller.display_name}
            </Link>{' '}
            · {a.seller_phone}
          </p>
          <p className="text-ink-muted">
            Auksionlar: {a.seller_history.auctions} · Bloklangan: {a.seller_history.blocked} · Shikoyatlar:{' '}
            {a.seller_history.reports} · Bitimlar: {a.seller.deals_count}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-[20px]">Tekshiruvlar</h2>
        {a.checks.length === 0 ? (
          <p className="text-[15px] text-ink-muted">Tekshiruv natijasi yoʻq.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-[15px]">
            {a.checks.map((c) => (
              <li key={c.check_name} className={c.result === 'fail' ? 'text-danger' : c.result === 'warn' ? 'text-warning' : 'text-success'}>
                {c.check_name}: {c.result}
                {c.message && ` — ${c.message}`}
              </li>
            ))}
          </ul>
        )}
      </section>

      {action.isSuccess && <Alert tone="success">Bajarildi. Yangi holat: {AUCTION_STATUS[action.data.status] ?? action.data.status}</Alert>}

      <section className="rounded-2xl border border-line bg-surface p-4 space-y-3">
        <h2 className="font-display text-[20px]">Qaror</h2>
        {pending && (
          <div>
            <label htmlFor="preset" className="block text-[15px] font-semibold mb-1">Rad etish sababi</label>
            <select id="preset" value={preset} onChange={(e) => setPreset(e.target.value)} className={inputClass}>
              <option value="">Tanlang yoki pastda yozing</option>
              {REJECT_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}
        <DecisionForm
          key={preset}
          pending={action.isPending}
          error={action.isError ? action.error.message : undefined}
          notePlaceholder={preset ? `${preset}. Qoʻshimcha izoh…` : 'Sabab yoki izoh (foydalanuvchiga koʻrinadi)'}
          actions={[
            ...(pending
              ? [
                  { key: 'approve', label: 'Tasdiqlash', variant: 'primary' as const },
                  { key: 'reject', label: 'Rad etish', needsNote: !preset },
                ]
              : []),
            ...(a.status !== 'blocked' ? [{ key: 'block', label: 'Bloklash', variant: 'danger' as const, needsNote: true }] : []),
          ]}
          onSubmit={(key, note) =>
            action.mutate({
              action: key as 'approve' | 'reject' | 'block',
              reason: key === 'reject' && preset ? [preset, note].filter(Boolean).join('. ') : note,
            })
          }
        />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-[20px]">Tarix</h2>
        <ul className="mt-2 space-y-1 text-[15px]">
          {a.events.map((e, i) => (
            <li key={i}>
              {formatDateTime(e.created_at)}: {AUCTION_STATUS[e.from_status] ?? e.from_status} →{' '}
              {AUCTION_STATUS[e.to_status] ?? e.to_status}
              {e.actor__phone && ` · ${e.actor__phone}`}
              {e.reason && ` · ${e.reason}`}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
