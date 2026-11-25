import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Navigation, Phone, Send, Star } from 'lucide-react';
import { mediaUrl } from '../../api/http';
import { formatDateTime, formatRating, formatSom } from '../../lib/format';
import { PageError, PageLoading } from '../../components/ui/PageState';
import { Button, buttonClass } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Field';
import { useClaimDeal, useDeal, useRateDeal, type Deal } from './api';
import { MapView } from '../location/MapView';

const DEAL_STATUS: Record<string, string> = {
  active: 'Faol bitim',
  completed: 'Yakunlangan',
  failed: 'Bitim boʻlmadi',
};

const CLAIM_STATUS: Record<string, string> = {
  open: 'Arizangiz moderatorda koʻrib chiqilmoqda.',
  approved: 'Ariza tasdiqlandi, komissiya qaytarildi.',
  rejected: 'Ariza rad etildi.',
};

/** F5: contacts of the other party (BR-33), rating and the "deal failed" claim. */
export const DealPage: React.FC = () => {
  const { id = '' } = useParams();
  const deal = useDeal(id);

  if (deal.isPending) return <PageLoading />;
  if (deal.isError) return <PageError message={deal.error.message} onRetry={() => void deal.refetch()} />;
  const d = deal.data;
  const other = d.counterparty;
  const rating = formatRating(other.rating_avg);
  const phoneHref = `tel:${other.phone.replace(/[^\d+]/g, '')}`;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="font-display text-[28px] text-ink">Bitim</h1>
      <section className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
        {d.cover_url && (
          <img src={mediaUrl(d.cover_url)} alt="" className="h-20 w-24 shrink-0 rounded-xl object-cover" />
        )}
        <div className="min-w-0">
          <Link to={`/a/${d.auction_id}`} className="text-[17px] font-semibold text-brand">
            {d.title}
          </Link>
          <p className="font-display text-[24px] text-ink tabular-nums">{formatSom(d.price)}</p>
          <p className="text-[13px] text-ink-muted">
            {DEAL_STATUS[d.status] ?? d.status} · {formatDateTime(d.created_at)}
          </p>
          {d.commission_amount !== null && (
            <p className="text-[13px] text-ink-muted">Komissiya: {formatSom(d.commission_amount)}</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 space-y-3" aria-labelledby="party-title">
        <h2 id="party-title" className="text-[15px] font-semibold text-ink-muted">
          {d.role === 'seller' ? 'Xaridor' : 'Sotuvchi'}
        </h2>
        <p className="text-[20px] font-semibold text-ink">{other.name}</p>
        <p className="text-[13px] text-ink-muted">
          {rating ? `Reyting ${rating} (${other.rating_count} baho)` : 'Hali baho yoʻq'}
        </p>
        <p className="text-[17px] text-ink tabular-nums">{other.phone}</p>
        <div className="flex flex-wrap gap-2">
          <a href={phoneHref} className={buttonClass('primary', 'flex-1')}>
            <Phone className="w-5 h-5" aria-hidden="true" /> Qoʻngʻiroq qilish
          </a>
          {other.telegram_username && (
            <a
              href={`https://t.me/${other.telegram_username}`}
              target="_blank"
              rel="noreferrer"
              className={buttonClass('secondary', 'flex-1')}
            >
              <Send className="w-5 h-5" aria-hidden="true" /> Telegram
            </a>
          )}
        </div>
      </section>

      {d.location && <DealLocation point={d.location} />}

      <RatingBlock deal={d} />
      {d.role === 'seller' && <ClaimBlock deal={d} />}
    </div>
  );
};

const RatingBlock: React.FC<{ deal: Deal }> = ({ deal }) => {
  const rate = useRateDeal(deal.id);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');

  if (deal.my_rating !== null)
    return (
      <p className="rounded-2xl border border-line bg-surface p-4 text-[15px] text-ink">
        Siz {deal.my_rating} baho qoʻydingiz. Rahmat!
      </p>
    );
  if (!deal.can_rate) return null;

  return (
    <form
      className="rounded-2xl border border-line bg-surface p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (score > 0) rate.mutate({ score, comment });
      }}
    >
      <fieldset>
        <legend className="text-[17px] font-semibold text-ink">Bitim qanday oʻtdi?</legend>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} baho`}
              aria-pressed={score === n}
              onClick={() => setScore(n)}
              className="min-h-touch min-w-touch flex items-center justify-center rounded-xl"
            >
              <Star className={`w-7 h-7 ${n <= score ? 'fill-accent text-brand' : 'text-line'}`} aria-hidden="true" />
            </button>
          ))}
        </div>
      </fieldset>
      <label htmlFor="rate-comment" className="block text-[15px] font-semibold text-ink">
        Izoh (ixtiyoriy)
      </label>
      <textarea
        id="rate-comment"
        rows={3}
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="w-full rounded-xl border border-line p-3 text-[15px]"
      />
      {rate.isError && <Alert>{rate.error.message}</Alert>}
      <Button type="submit" className="w-full" disabled={score === 0 || rate.isPending}>
        Baho qoʻyish
      </Button>
    </form>
  );
};

const ClaimBlock: React.FC<{ deal: Deal }> = ({ deal }) => {
  const claim = useClaimDeal(deal.id);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (deal.claim_status) return <Alert tone="info">{CLAIM_STATUS[deal.claim_status] ?? deal.claim_status}</Alert>;
  if (!deal.can_claim) return null;
  if (!open)
    return (
      <Button variant="ghost" className="w-full" onClick={() => setOpen(true)}>
        Bitim boʻlmadimi? Ariza berish
      </Button>
    );

  return (
    <form
      className="rounded-2xl border border-line bg-surface p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim()) claim.mutate(reason.trim());
      }}
    >
      <label htmlFor="claim-reason" className="block text-[17px] font-semibold text-ink">
        Nima uchun bitim boʻlmadi?
      </label>
      <p className="text-[13px] text-ink-muted">
        Ariza moderatorga tushadi. Tasdiqlansa, komissiya balansingizga qaytariladi.
      </p>
      <textarea
        id="claim-reason"
        rows={4}
        maxLength={1000}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded-xl border border-line p-3 text-[15px]"
      />
      {claim.isError && <Alert>{claim.error.message}</Alert>}
      <Button type="submit" className="w-full" disabled={!reason.trim() || claim.isPending}>
        Ariza yuborish
      </Button>
    </form>
  );
};

/** BR-33a: the seller's pin opens to both parties with the contacts. */
const DealLocation: React.FC<{ point: NonNullable<Deal['location']> }> = ({ point }) => {
  const at = `${point.lat},${point.lng}`;
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface" aria-labelledby="deal-location">
      <h2 id="deal-location" className="px-4 pt-3 text-[15px] font-semibold text-ink-muted">
        Mol joylashuvi
      </h2>
      <p className="px-4 text-[13px] text-ink-muted">Sotuvchi belgilagan nuqta, taxminan 100 m aniqlikda.</p>
      <MapView mode="point" center={point} zoom={15} className="mt-3 h-52" label="Mol joylashuvi xaritada" />
      <div className="flex flex-wrap gap-2 p-4">
        <a
          href={`https://yandex.uz/maps/?rtext=~${at}&rtt=auto`}
          target="_blank"
          rel="noreferrer"
          className={buttonClass('secondary', 'flex-1')}
        >
          <Navigation className="w-5 h-5" aria-hidden="true" /> Yandex Xaritada yoʻl
        </a>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${at}`}
          target="_blank"
          rel="noreferrer"
          className={buttonClass('secondary', 'flex-1')}
        >
          <Navigation className="w-5 h-5" aria-hidden="true" /> Google Maps
        </a>
      </div>
    </section>
  );
};
