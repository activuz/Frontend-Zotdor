import React, { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Flag, ImageOff, MapPin, Star } from 'lucide-react';
import { ApiError, mediaUrl } from '../../api/http';
import { useMe } from '../auth/api';
import { formatDateTime, formatKm, formatRating, formatSom } from '../../lib/format';
import { useNow } from '../../lib/useNow';
import { auctionSeo } from './seo';
import { useSeo } from '../../lib/seo';
import { PageError, PageLoading } from '../../components/ui/PageState';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Alert, MoneyInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import {
  isOpen,
  useAuction,
  useBids,
  useCancelAuction,
  usePlaceBid,
  useReport,
  useWatch,
  type AuctionDetail,
  type PublicBid,
} from './api';
import { Countdown } from './Countdown';
import { REPORT_REASONS, STATUS_LABEL, STATUS_TONE, TIER_BORDER, TIER_TEXT } from './labels';

export const AuctionPage: React.FC = () => {
  const { id = '' } = useParams();
  const auction = useAuction(id);
  useSeo(
    auction.isSuccess
      ? auctionSeo(auction.data)
      : { title: auction.isError ? 'Auksion topilmadi' : 'Auksion', noindex: auction.isError },
  );

  if (auction.isPending) return <PageLoading />;
  if (auction.isError)
    return <PageError message={auction.error.message} onRetry={() => void auction.refetch()} />;
  const a = auction.data;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6 pb-40 lg:pb-0">
      <div className="space-y-5 min-w-0">
        <Gallery auction={a} />
        <Info auction={a} />
        <BidList auction={a} />
      </div>
      <aside className="lg:sticky lg:top-24 lg:self-start mt-5 lg:mt-0" aria-label="Taklif paneli">
        {a.is_owner ? <OwnerPanel auction={a} /> : <BidPanel auction={a} />}
      </aside>
    </div>
  );
};

const Gallery: React.FC<{ auction: AuctionDetail }> = ({ auction }) => {
  const ready = auction.media.filter((m) => m.status === 'ready');
  const [index, setIndex] = useState(0);
  const current = ready[Math.min(index, ready.length - 1)];

  if (!current) {
    return (
      <div className="aspect-[4/3] rounded-2xl border border-line bg-surface flex items-center justify-center text-ink-muted">
        <ImageOff className="w-10 h-10" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div>
      <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-ink">
        {current.kind === 'video' ? (
          <video
            key={current.id}
            src={mediaUrl(current.url)}
            poster={mediaUrl(current.thumb_url) || undefined}
            controls
            playsInline
            className="h-full w-full object-contain"
          />
        ) : (
          <img src={mediaUrl(current.url)} alt={auction.title} className="h-full w-full object-contain" />
        )}
      </div>
      {ready.length > 1 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto no-scrollbar" aria-label="Rasmlar">
          {ready.map((m, i) => (
            <li key={m.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${m.kind === 'video' ? 'Video' : 'Rasm'} ${i + 1}`}
                aria-current={i === index}
                className={`block h-16 w-20 overflow-hidden rounded-xl border-2 ${i === index ? 'border-brand' : 'border-transparent'}`}
              >
                {m.thumb_url ? (
                  <img src={mediaUrl(m.thumb_url)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center bg-page text-[13px] text-ink">Video</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Info: React.FC<{ auction: AuctionDetail }> = ({ auction: a }) => {
  const status = a.status ?? 'draft';
  const place = [a.district?.name, a.region?.name].filter(Boolean).join(', ');
  const km = formatKm(a.distance_km);
  const rating = formatRating(a.seller.rating_avg);
  const facts: [string, string | null | undefined][] = [
    ['Yoʻnalish', a.direction?.name],
    ['Hayvon turi', a.animal_type?.name],
    ['Toifa', a.animal_class?.name],
    ['Zot', a.breed?.name ?? (a.breed_other || null)],
    ['Yoshi', a.age_label],
    ['Vazni', a.weight_kg ? `${a.weight_kg} kg${a.weight_is_estimated ? ' (taxminiy)' : ''}` : null],
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-lg px-2 py-0.5 text-[13px] font-semibold ${STATUS_TONE[status]}`}>
          {STATUS_LABEL[status]}
        </span>
        {place && (
          <span className="inline-flex items-center gap-1 text-[15px] text-ink-muted">
            <MapPin className="w-4 h-4" aria-hidden="true" />
            {place}
            {km && ` · ${km}`}
          </span>
        )}
      </div>
      <h1 className="font-display text-[28px] leading-tight text-ink">{a.title || 'Nomsiz eʼlon'}</h1>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface p-4 text-[15px]">
        {facts
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt className="text-[13px] text-ink-muted">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
      </dl>

      {a.description && (
        <div>
          <h2 className="font-display text-[20px] text-ink">Tavsif</h2>
          <p className="mt-1 whitespace-pre-line text-[15px] text-ink">{a.description}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
        <div>
          <p className="text-[13px] text-ink-muted">Sotuvchi</p>
          <Link to={`/u/${a.seller.id}`} className="text-[17px] font-semibold text-brand">
            {a.seller.display_name}
          </Link>
          <p className="text-[13px] text-ink-muted">
            {rating ? (
              <span className="inline-flex items-center gap-1">
                <Star className="w-4 h-4" aria-hidden="true" /> {rating} ({a.seller.rating_count} baho)
              </span>
            ) : (
              'Hali baho yoʻq'
            )}
            {' · '}
            {a.seller.deals_count} ta bitim
          </p>
        </div>
        {!a.is_owner && <ReportButton targetType="auction" targetId={a.id} />}
      </div>
    </section>
  );
};

const BidList: React.FC<{ auction: AuctionDetail }> = ({ auction }) => {
  const bids = useBids(auction.id, auction.status === 'live');
  if (auction.status === 'draft' || auction.status === 'pending_review' || auction.status === 'rejected') return null;

  return (
    <section aria-labelledby="bids-title">
      <h2 id="bids-title" className="font-display text-[20px] text-ink">
        Takliflar
      </h2>
      {bids.isPending && <PageLoading />}
      {bids.isError && <PageError message={bids.error.message} onRetry={() => void bids.refetch()} />}
      {bids.isSuccess && bids.data.length === 0 && (
        <p className="mt-2 text-[15px] text-ink-muted">Hali taklif yoʻq.</p>
      )}
      {bids.isSuccess && bids.data.length > 0 && (
        <ol className="mt-2 space-y-2" aria-live="polite">
          {bids.data.map((b) => (
            <BidRow key={`${b.pseudonym}-${b.amount}-${b.created_at}`} bid={b} />
          ))}
        </ol>
      )}
    </section>
  );
};

const BidRow: React.FC<{ bid: PublicBid }> = ({ bid: b }) => (
  <li
    className={`animate-row-in flex items-center gap-3 rounded-xl border border-line border-l-4 bg-surface px-3 py-2 ${TIER_BORDER[b.tier] ?? ''} ${b.is_mine ? 'ring-2 ring-brand' : ''}`}
  >
    <span className={`w-8 text-[17px] font-semibold tabular-nums ${TIER_TEXT[b.tier] ?? ''}`}>{b.rank}</span>
    <span className="flex-1 min-w-0">
      <span className="block text-[15px] text-ink">{b.is_mine ? 'Siz' : b.pseudonym}</span>
      <span className="block text-[13px] text-ink-muted">{formatDateTime(b.created_at)}</span>
    </span>
    <span className={`text-[17px] font-semibold tabular-nums ${TIER_TEXT[b.tier] ?? ''}`}>{formatSom(b.amount)}</span>
  </li>
);

const PriceBlock: React.FC<{ auction: AuctionDetail }> = ({ auction: a }) => (
  <div className="space-y-2">
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="text-[13px] text-ink-muted">Eng yuqori taklif</p>
        <p className="font-display text-[32px] leading-tight text-ink tabular-nums">
          {a.top_bid_amount ? formatSom(a.top_bid_amount) : '—'}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[13px] text-ink-muted">Sotuvchi narxi</p>
        <p className="text-[17px] font-semibold text-ink tabular-nums">{formatSom(a.asking_price ?? 0)}</p>
      </div>
    </div>
    <TimeLine auction={a} />
  </div>
);

const TimeLine: React.FC<{ auction: AuctionDetail }> = ({ auction: a }) => {
  if (a.status === 'live' && a.ends_at)
    return (
      <p className="text-[15px] text-ink">
        Tugashiga: <Countdown to={a.ends_at} className="text-[20px] font-semibold" />
      </p>
    );
  if (a.status === 'scheduled' && a.starts_at)
    return (
      <p className="text-[15px] text-ink">
        {formatDateTime(a.starts_at)} da boshlanadi · <Countdown to={a.starts_at} className="font-semibold" />
      </p>
    );
  if (a.ends_at && !isOpen(a.status))
    return <p className="text-[15px] text-ink-muted">Tugadi: {formatDateTime(a.ends_at)}</p>;
  return null;
};

const QUICK_STEP = 100_000;

const BidPanel: React.FC<{ auction: AuctionDetail }> = ({ auction: a }) => {
  const location = useLocation();
  const { data: me } = useMe();
  const place = usePlaceBid(a.id);
  const watch = useWatch(a.id);
  const now = useNow();
  const [amount, setAmount] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const live = a.status === 'live' && a.ends_at !== null && a.ends_at !== undefined && new Date(a.ends_at).getTime() > now;
  const min = a.min_bid ?? 0;
  const max = a.max_bid ?? null;
  const loginHref = `/login?next=${encodeURIComponent(location.pathname)}`;

  const tooLow = amount !== null && amount < min;
  const tooHigh = amount !== null && max !== null && amount > max;

  const submit = () => {
    if (amount === null) return;
    place.mutate(amount, { onSettled: () => setConfirm(false), onSuccess: () => setAmount(null) });
  };

  const panel = (
    <div className="space-y-3">
      <PriceBlock auction={a} />
      {a.my_bid && (
        <p className={`text-[15px] font-semibold ${TIER_TEXT[a.my_bid.tier] ?? 'text-ink'}`}>
          Siz {a.my_bid.rank}-oʻrindasiz · {formatSom(a.my_bid.amount)}
        </p>
      )}
      {a.deal_id && <ButtonLink to={`/deals/${a.deal_id}`} variant="primary" className="w-full">Bitimni ochish</ButtonLink>}

      {!me && isOpen(a.status) && (
        <ButtonLink to={loginHref} variant="primary" className="w-full">
          Taklif berish uchun kiring
        </ButtonLink>
      )}

      {me && live && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (amount !== null && !tooLow && !tooHigh) setConfirm(true);
          }}
          className="space-y-2"
        >
          <label htmlFor="bid-amount" className="block text-[15px] font-semibold text-ink">
            Taklifingiz
          </label>
          <MoneyInput id="bid-amount" value={amount} onChange={setAmount} aria-describedby="bid-limits" />
          <p id="bid-limits" className={`text-[13px] ${tooLow || tooHigh ? 'text-danger' : 'text-ink-muted'}`}>
            {formatSom(min)} dan{max ? ` ${formatSom(max)} gacha` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="flex-1 px-3"
              onClick={() => setAmount(Math.max(min, (a.top_bid_amount ?? 0) + QUICK_STEP))}
            >
              Eng yuqori + 100 000
            </Button>
            <Button className="flex-1 px-3" onClick={() => setAmount(a.asking_price ?? null)}>
              Sotuvchi narxi
            </Button>
          </div>
          {place.isError && <Alert>{bidError(place.error)}</Alert>}
          <Button type="submit" variant="primary" className="w-full" disabled={amount === null || tooLow || tooHigh}>
            Taklif berish
          </Button>
        </form>
      )}

      {me && a.status === 'scheduled' && (
        <p className="text-[15px] text-ink-muted">Takliflar auksion boshlanganda qabul qilinadi.</p>
      )}
      {!isOpen(a.status) && !a.deal_id && <p className="text-[15px] text-ink-muted">Auksion tugadi, taklif qabul qilinmaydi.</p>}

      {me && (
        <Button
          variant="ghost"
          className="w-full"
          disabled={watch.isPending}
          onClick={() => watch.mutate(!a.is_watched)}
          aria-pressed={a.is_watched}
        >
          {a.is_watched ? <BookmarkCheck className="w-5 h-5" aria-hidden="true" /> : <Bookmark className="w-5 h-5" aria-hidden="true" />}
          {a.is_watched ? 'Saqlanganlardan olib tashlash' : 'Saqlash'}
        </Button>
      )}
      {watch.isError && <Alert>{watch.error.message}</Alert>}
    </div>
  );

  return (
    <>
      {/* Mobile: fixed above the bottom navigation; desktop: sticky right column (DESIGN.md §6). */}
      <div className="fixed inset-x-0 bottom-16 z-30 max-h-[60vh] overflow-y-auto border-t border-line bg-surface p-4 lg:static lg:max-h-none lg:overflow-visible lg:rounded-2xl lg:border">
        {panel}
      </div>
      <Modal open={confirm} title="Taklifni tasdiqlang" onClose={() => setConfirm(false)}>
        <p className="text-[15px] text-ink">
          {formatSom(amount ?? 0)} taklif qilasiz.
          {a.my_bid && ` Oldingi taklifingiz (${formatSom(a.my_bid.amount)}) bekor boʻladi.`}
        </p>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={() => setConfirm(false)}>
            Bekor qilish
          </Button>
          <Button variant="primary" className="flex-1" onClick={submit} disabled={place.isPending}>
            {place.isPending ? 'Yuborilmoqda…' : 'Tasdiqlash'}
          </Button>
        </div>
      </Modal>
    </>
  );
};

function bidError(error: Error): string {
  if (error instanceof ApiError && error.code === 'auction_not_live') return 'Auksion tugadi, taklif qabul qilinmadi.';
  return error.message;
}

const OwnerPanel: React.FC<{ auction: AuctionDetail }> = ({ auction: a }) => {
  const owner = a.owner;
  const cancel = useCancelAuction(a.id);
  const [confirm, setConfirm] = useState(false);
  const editable = a.status === 'draft' || a.status === 'rejected';

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
      <PriceBlock auction={a} />
      <p className="text-[15px] text-ink">
        {a.bidders_count ?? 0} xaridor · {a.active_bids_count ?? 0} ta faol taklif
      </p>
      {owner?.hold_amount ? (
        <p className="text-[13px] text-ink-muted">Komissiya uchun band qilingan: {formatSom(owner.hold_amount)}</p>
      ) : null}

      {a.status === 'pending_review' && (
        <Alert tone="warning">Moderator tekshirmoqda. Natija Telegram orqali keladi.</Alert>
      )}
      {a.status === 'rejected' && owner?.rejection_reason && <Alert>{owner.rejection_reason}</Alert>}
      {owner && owner.checks.some((c) => c.result !== 'pass') && (
        <ul className="space-y-1 text-[13px]">
          {owner.checks
            .filter((c) => c.result !== 'pass')
            .map((c) => (
              <li key={c.check_name} className={c.result === 'fail' ? 'text-danger' : 'text-warning'}>
                {c.message}
              </li>
            ))}
        </ul>
      )}

      {editable && (
        <ButtonLink to={`/sell/${a.id}`} variant="primary" className="w-full">
          Tahrirlash va qayta yuborish
        </ButtonLink>
      )}
      {a.status === 'ended' && (
        <>
          {owner?.decision_deadline && (
            <p className="text-[15px] text-ink">
              Xaridorni tanlash muddati: <Countdown to={owner.decision_deadline} className="font-semibold" />
            </p>
          )}
          <ButtonLink to={`/a/${a.id}/decision`} variant="primary" className="w-full">
            Xaridorni tanlash
          </ButtonLink>
        </>
      )}
      {a.status === 'live' && owner?.can_accept_now && (
        <ButtonLink to={`/a/${a.id}/decision`} variant="primary" className="w-full">
          Hozir sotish
        </ButtonLink>
      )}
      {a.status === 'live' && !owner?.can_accept_now && owner?.early_accept_from && (a.active_bids_count ?? 0) > 0 && (
        <p className="text-[13px] text-ink-muted">
          “Hozir sotish” {formatDateTime(owner.early_accept_from)} dan keyin ochiladi.
        </p>
      )}
      {a.deal_id && (
        <ButtonLink to={`/deals/${a.deal_id}`} variant="primary" className="w-full">
          Bitimni ochish
        </ButtonLink>
      )}
      {owner?.can_cancel && (
        <Button variant="danger" className="w-full" onClick={() => setConfirm(true)}>
          Auksionni bekor qilish
        </Button>
      )}
      {cancel.isError && <Alert>{cancel.error.message}</Alert>}

      <Modal open={confirm} title="Auksionni bekor qilasizmi?" onClose={() => setConfirm(false)}>
        <p className="text-[15px] text-ink">Auksion yopiladi va band qilingan summa balansingizga qaytadi.</p>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={() => setConfirm(false)}>
            Ortga
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate('', { onSettled: () => setConfirm(false) })}
          >
            Bekor qilish
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export const ReportButton: React.FC<{ targetType: 'auction' | 'user'; targetId: string }> = ({
  targetType,
  targetId,
}) => {
  const { data: me } = useMe();
  const report = useReport();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]['value']>('fake');
  const [comment, setComment] = useState('');
  if (!me) return null;

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} className="px-3">
        <Flag className="w-4 h-4" aria-hidden="true" />
        Shikoyat
      </Button>
      <Modal
        open={open}
        title="Shikoyat qilish"
        onClose={() => {
          setOpen(false);
          report.reset();
        }}
      >
        {report.isSuccess ? (
          <Alert tone="success">Shikoyatingiz moderatorga yuborildi.</Alert>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              report.mutate({ target_type: targetType, target_id: targetId, reason, comment });
            }}
          >
            <fieldset className="space-y-1">
              <legend className="text-[15px] font-semibold text-ink mb-1">Sabab</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 min-h-touch text-[15px] text-ink">
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="w-5 h-5 accent-brand"
                  />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <label htmlFor="report-comment" className="block text-[15px] font-semibold text-ink">
              Izoh (ixtiyoriy)
            </label>
            <textarea
              id="report-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={1000}
              className="w-full rounded-xl border border-line p-3 text-[15px]"
            />
            {report.isError && <Alert>{report.error.message}</Alert>}
            <Button type="submit" variant="primary" className="w-full" disabled={report.isPending}>
              Shikoyat yuborish
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
};
