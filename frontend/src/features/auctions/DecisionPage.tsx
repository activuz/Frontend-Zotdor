import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Star } from 'lucide-react';
import { commissionFor } from '../reference/api';
import { formatKm, formatRating, formatSom } from '../../lib/format';
import { EmptyState, PageError, PageLoading } from '../../components/ui/PageState';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useAcceptBid, useAuction, useDecision, useRejectAll, type DecisionBid } from './api';
import { Countdown } from './Countdown';
import { TIER_BORDER, TIER_TEXT } from './labels';

const TAG_LABEL: Record<string, string> = { highest: 'Eng yuqori', nearest: 'Eng yaqin' };

/** F4: seller picks the winning bid (FR-09, BR-35 for early sale). */
export const DecisionPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [sort, setSort] = useState<'amount' | 'distance'>('amount');
  const auction = useAuction(id, { poll: false });
  const decision = useDecision(id, sort);
  const accept = useAcceptBid(id);
  const rejectAll = useRejectAll(id);
  const [chosen, setChosen] = useState<DecisionBid | null>(null);
  const [rejecting, setRejecting] = useState(false);

  if (decision.isPending || auction.isPending) return <PageLoading />;
  if (decision.isError) return <PageError message={decision.error.message} onRetry={() => void decision.refetch()} />;
  if (auction.isError) return <PageError message={auction.error.message} onRetry={() => void auction.refetch()} />;
  const d = decision.data;
  const a = auction.data;
  const early = a.status === 'live';
  const closed = a.status !== 'ended' && a.status !== 'live';

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link to={`/a/${id}`} className="inline-flex items-center gap-1 min-h-touch text-[15px] font-semibold text-brand">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Auksionga qaytish
      </Link>
      <h1 className="font-display text-[28px] text-ink">Xaridorni tanlang</h1>
      <p className="text-[15px] text-ink-muted">{a.title}</p>
      {d.deadline && a.status === 'ended' && (
        <p className="text-[15px] text-ink">
          Tanlash uchun qolgan vaqt: <Countdown to={d.deadline} className="font-semibold" />
        </p>
      )}
      {early && !d.can_accept_now && (
        <Alert tone="warning">“Hozir sotish” hali ochilmagan. Auksion boshlanganidan keyin biroz kuting.</Alert>
      )}
      {closed && <Alert tone="info">Bu auksion yakunlangan.</Alert>}

      {d.bids.length === 0 ? (
        <EmptyState title="Takliflar yoʻq" />
      ) : (
        <>
          {d.recommended.length > 0 && (
            <section aria-labelledby="rec-title">
              <h2 id="rec-title" className="font-display text-[20px] text-ink">
                Tavsiya
              </h2>
              <ul className="mt-2 space-y-2">
                {d.recommended.map((b) => (
                  <Row key={b.bid_id} bid={b} disabled={closed || (early && !d.can_accept_now)} onChoose={setChosen} />
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="all-title">
            <div className="flex items-center justify-between gap-2">
              <h2 id="all-title" className="font-display text-[20px] text-ink">
                Barcha takliflar
              </h2>
              <div role="group" aria-label="Saralash" className="flex gap-1">
                {(['amount', 'distance'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={sort === s}
                    onClick={() => setSort(s)}
                    className={`min-h-touch px-3 rounded-xl text-[15px] font-semibold ${sort === s ? 'bg-brand-soft text-ink' : 'text-ink-muted'}`}
                  >
                    {s === 'amount' ? 'Summa' : 'Masofa'}
                  </button>
                ))}
              </div>
            </div>
            <ul className="mt-2 space-y-2">
              {d.bids.map((b) => (
                <Row key={b.bid_id} bid={b} disabled={closed || (early && !d.can_accept_now)} onChoose={setChosen} />
              ))}
            </ul>
          </section>
        </>
      )}

      {!closed && a.status === 'ended' && (
        <Button variant="danger" className="w-full" onClick={() => setRejecting(true)}>
          Hech birini tanlamayman
        </Button>
      )}

      <Modal open={chosen !== null} title="Sotishni tasdiqlang" onClose={() => setChosen(null)}>
        {chosen && (
          <div className="space-y-3 text-[15px] text-ink">
            <p>
              {chosen.pseudonym} ga {formatSom(chosen.amount)}ga sotasiz. Komissiya{' '}
              {formatSom(commissionFor(chosen.amount, d.commission_rate_bp))} balansingizdan yechiladi. Shundan keyin
              ikkalangizga ham kontaktlar ochiladi.
            </p>
            {early && <Alert tone="warning">Auksion hozir yakunlanadi, boshqa takliflar qabul qilinmaydi.</Alert>}
            {accept.isError && <Alert>{accept.error.message}</Alert>}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setChosen(null)}>
                Ortga
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                disabled={accept.isPending}
                onClick={() =>
                  accept.mutate(chosen.bid_id, { onSuccess: (r) => navigate(`/deals/${r.deal_id}`, { replace: true }) })
                }
              >
                {accept.isPending ? 'Bajarilmoqda…' : 'Sotish'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={rejecting} title="Hech kimga sotmaysizmi?" onClose={() => setRejecting(false)}>
        <p className="text-[15px] text-ink">
          Auksion “Sotilmagan” boʻlib yopiladi va band qilingan summa balansingizga qaytadi.
        </p>
        {rejectAll.isError && <div className="mt-3"><Alert>{rejectAll.error.message}</Alert></div>}
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={() => setRejecting(false)}>
            Ortga
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            disabled={rejectAll.isPending}
            onClick={() => rejectAll.mutate(undefined, { onSuccess: () => navigate(`/a/${id}`, { replace: true }) })}
          >
            Tasdiqlash
          </Button>
        </div>
      </Modal>
    </div>
  );
};

const Row: React.FC<{ bid: DecisionBid; disabled: boolean; onChoose: (b: DecisionBid) => void }> = ({
  bid: b,
  disabled,
  onChoose,
}) => {
  const km = formatKm(b.distance_km);
  const rating = formatRating(b.rating_avg);
  return (
    <li className={`flex items-center gap-3 rounded-xl border border-line border-l-4 bg-surface p-3 ${TIER_BORDER[b.tier] ?? ''}`}>
      <span className={`w-8 text-[17px] font-semibold tabular-nums ${TIER_TEXT[b.tier] ?? ''}`}>{b.rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[17px] font-semibold text-ink tabular-nums">{formatSom(b.amount)}</p>
        <p className="text-[13px] text-ink-muted">
          {b.pseudonym}
          {km && ` · ${km}`}
          {' · '}
          {rating ? (
            <span className="inline-flex items-center gap-0.5">
              <Star className="w-3.5 h-3.5" aria-hidden="true" />
              {rating}
            </span>
          ) : (
            'baho yoʻq'
          )}
          {` · ${b.deals_count} bitim`}
        </p>
        {b.tags.length > 0 && (
          <p className="mt-1 flex gap-1">
            {b.tags.map((t) => (
              <span key={t} className="rounded-lg bg-brand-soft px-2 text-[13px] text-ink">
                {TAG_LABEL[t] ?? t}
              </span>
            ))}
          </p>
        )}
      </div>
      <Button onClick={() => onChoose(b)} disabled={disabled} className="px-3">
        Tanlash
      </Button>
    </li>
  );
};
