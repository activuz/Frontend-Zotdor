import React, { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import {
  useCompleteFakePayment,
  useCreateRefund,
  usePayment,
  useRefundRequests,
  useTopup,
  useWallet,
  useWalletEntries,
  type WalletEntry,
} from './api';
import { usePublicConfig } from '../reference/api';
import { formatDate, formatDateTime, formatSom } from '../../lib/format';
import { PageError, PageLoading } from '../../components/ui/PageState';
import { Button } from '../../components/ui/Button';
import { Alert, Field, inputClass, MoneyInput } from '../../components/ui/Field';

const BUCKET_LABEL: Record<WalletEntry['bucket'], string> = {
  main: 'Asosiy',
  bonus: 'Bonus',
  hold: 'Band qilingan',
};

/** F6: balance, top-up, payment status, refund requests and history. */
export const WalletPage: React.FC = () => {
  const wallet = useWallet();
  const [params] = useSearchParams();
  const paymentId = params.get('payment');

  if (wallet.isPending) return <PageLoading />;
  if (wallet.isError) return <PageError message={wallet.error.message} onRetry={() => void wallet.refetch()} />;
  const w = wallet.data;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {paymentId && <PaymentStatus id={paymentId} />}
      {w.has_debt && (
        <p role="alert" className="flex gap-2 rounded-xl bg-danger-soft p-3 text-[15px] text-danger">
          <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
          Qarzni yoping: {formatSom(-w.main_balance)}. Shundan keyin yangi auksion ocha olasiz.
        </p>
      )}
      <section className="bg-surface rounded-2xl border border-line p-5" aria-labelledby="available-label">
        <h1 id="available-label" className="text-[15px] font-semibold text-ink-muted">
          Mavjud mablagʻ
        </h1>
        <p className="mt-1 font-display text-[32px] leading-tight text-ink tabular-nums">{formatSom(w.available)}</p>

        <dl className="mt-4 divide-y divide-line text-[15px]">
          <div className="flex justify-between py-2">
            <dt className="text-ink-muted">Asosiy balans</dt>
            <dd className={`tabular-nums ${w.has_debt ? 'text-danger font-semibold' : 'text-ink'}`}>
              {formatSom(w.main_balance)}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-ink-muted">
              Bonus
              {w.bonus_balance > 0 && w.bonus_expires_at && (
                <span className="block text-[13px]">{formatDate(w.bonus_expires_at)} gacha</span>
              )}
            </dt>
            <dd className="tabular-nums text-ink">{formatSom(w.bonus_balance)}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-ink-muted">Auksionlar uchun band qilingan</dt>
            <dd className="tabular-nums text-ink">{formatSom(w.held_amount)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[13px] text-ink-muted">Bonus faqat komissiyaga sarflanadi va naqd qilib olinmaydi.</p>
      </section>

      <Topup initial={Number(params.get('topup')) || null} />
      <History />
      <Refunds />
    </div>
  );
};

const PRESETS = [50_000, 100_000, 200_000];

const Topup: React.FC<{ initial: number | null }> = ({ initial }) => {
  const navigate = useNavigate();
  const config = usePublicConfig();
  const topup = useTopup();
  const [amount, setAmount] = useState<number | null>(initial);
  const min = config.data?.topup_min ?? 0;
  const max = config.data?.topup_max ?? Number.MAX_SAFE_INTEGER;
  const invalid = amount === null || amount < min || amount > max;

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount === null || invalid) return;
    topup.mutate(amount, {
      onSuccess: ({ redirect_url }) => {
        if (/^https?:\/\//.test(redirect_url)) window.location.assign(redirect_url);
        else navigate(redirect_url);
      },
    });
  };

  return (
    <form onSubmit={start} className="bg-surface rounded-2xl border border-line p-5 space-y-3" aria-labelledby="topup-title">
      <h2 id="topup-title" className="font-display text-[20px] text-ink">
        Balansni toʻldirish
      </h2>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={amount === p}
            onClick={() => setAmount(p)}
            className={`min-h-touch px-4 rounded-xl border text-[15px] font-semibold tabular-nums ${amount === p ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-surface text-ink-muted'}`}
          >
            {formatSom(p)}
          </button>
        ))}
      </div>
      <Field label="Summa" hint={config.data ? `${formatSom(min)} dan ${formatSom(max)} gacha` : undefined}>
        {(p) => <MoneyInput {...p} value={amount} onChange={setAmount} />}
      </Field>
      {topup.isError && <Alert>{topup.error.message}</Alert>}
      <Button type="submit" variant="primary" className="w-full" disabled={invalid || topup.isPending}>
        {topup.isPending ? 'Ochilmoqda…' : 'Toʻlovga oʻtish'}
      </Button>
    </form>
  );
};

const PAYMENT_TEXT: Record<string, { tone: 'info' | 'success' | 'danger'; text: string }> = {
  created: { tone: 'info', text: 'Toʻlov kutilmoqda…' },
  prepared: { tone: 'info', text: 'Toʻlov tasdiqlanmoqda…' },
  completed: { tone: 'success', text: 'Balans toʻldirildi.' },
  cancelled: { tone: 'danger', text: 'Toʻlov bekor qilindi.' },
  failed: { tone: 'danger', text: 'Toʻlov amalga oshmadi.' },
};

const PaymentStatus: React.FC<{ id: string }> = ({ id }) => {
  const payment = usePayment(id);
  if (payment.isPending) return <Alert tone="info">Toʻlov holati tekshirilmoqda…</Alert>;
  if (payment.isError) return <Alert>{payment.error.message}</Alert>;
  const info = PAYMENT_TEXT[payment.data.status] ?? PAYMENT_TEXT.created;
  return (
    <Alert tone={info.tone}>
      {formatSom(payment.data.amount)} — {info.text}
    </Alert>
  );
};

/** Development provider only (PAYMENTS_PROVIDER=fake): stands in for the Click page. */
export const TestPaymentPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const payment = usePayment(id);
  const complete = useCompleteFakePayment();

  if (payment.isPending) return <PageLoading />;
  if (payment.isError) return <PageError message={payment.error.message} />;
  return (
    <div className="max-w-sm mx-auto space-y-4 py-8">
      <h1 className="font-display text-[28px] text-ink">Test toʻlovi</h1>
      <Alert tone="warning">Bu sahifa faqat sinov muhitida ishlaydi. Haqiqiy pul yechilmaydi.</Alert>
      <p className="text-[17px] text-ink tabular-nums">Summa: {formatSom(payment.data.amount)}</p>
      {complete.isError && <Alert>{complete.error.message}</Alert>}
      <Button
        variant="primary"
        className="w-full"
        disabled={complete.isPending || payment.data.status === 'completed'}
        onClick={() => complete.mutate(id, { onSuccess: () => navigate(`/wallet?payment=${id}`, { replace: true }) })}
      >
        Toʻlovni tasdiqlash
      </Button>
      <Button className="w-full" onClick={() => navigate('/wallet')}>
        Hamyonga qaytish
      </Button>
    </div>
  );
};

const History: React.FC = () => {
  const entries = useWalletEntries();

  return (
    <section aria-labelledby="history-title">
      <h2 id="history-title" className="font-display text-[20px] text-ink">
        Operatsiyalar tarixi
      </h2>

      {entries.isPending && <PageLoading />}
      {entries.isError && <PageError message={entries.error.message} onRetry={() => void entries.refetch()} />}
      {entries.isSuccess && entries.data.pages[0].results.length === 0 && (
        <p className="mt-3 text-[15px] text-ink-muted">Hali operatsiyalar yoʻq.</p>
      )}

      {entries.isSuccess && entries.data.pages[0].results.length > 0 && (
        <ul className="mt-3 bg-surface rounded-2xl border border-line divide-y divide-line">
          {entries.data.pages.flatMap((page) =>
            page.results.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[15px] text-ink">{e.title}</p>
                  <p className="text-[13px] text-ink-muted">
                    {formatDateTime(e.created_at)} · {BUCKET_LABEL[e.bucket]}
                  </p>
                  {e.note && <p className="mt-1 text-[13px] text-ink-muted">{e.note}</p>}
                </div>
                <p
                  className={`shrink-0 tabular-nums text-[15px] font-semibold ${
                    e.amount > 0 && e.bucket !== 'hold' ? 'text-brand' : 'text-ink'
                  }`}
                >
                  {formatSom(e.amount, { signed: true })}
                </p>
              </li>
            )),
          )}
        </ul>
      )}

      {entries.hasNextPage && (
        <Button className="mt-3 w-full" onClick={() => void entries.fetchNextPage()} disabled={entries.isFetchingNextPage}>
          {entries.isFetchingNextPage ? 'Yuklanmoqda…' : 'Koʻproq koʻrsatish'}
        </Button>
      )}
    </section>
  );
};

const REFUND_STATUS: Record<string, string> = { open: 'Koʻrib chiqilmoqda', done: 'Qaytarildi', rejected: 'Rad etildi' };

const Refunds: React.FC = () => {
  const list = useRefundRequests();
  const create = useCreateRefund();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [ref, setRef] = useState('');
  const [reason, setReason] = useState('');
  const ready = amount !== null && ref.trim() !== '' && reason.trim() !== '';

  return (
    <section aria-labelledby="refund-title" className="space-y-3">
      <h2 id="refund-title" className="font-display text-[20px] text-ink">
        Pulni qaytarish
      </h2>
      {list.isPending && <PageLoading />}
      {list.isError && <PageError message={list.error.message} onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.length > 0 && (
        <ul className="bg-surface rounded-2xl border border-line divide-y divide-line">
          {list.data.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <p className="flex justify-between gap-3 text-[15px] text-ink">
                <span className="tabular-nums">{formatSom(r.amount)}</span>
                <span className="font-semibold">{REFUND_STATUS[r.status] ?? r.status}</span>
              </p>
              <p className="text-[13px] text-ink-muted">
                {formatDateTime(r.created_at)} · Click: {r.click_reference}
              </p>
              {r.note && <p className="text-[13px] text-ink-muted">{r.note}</p>}
            </li>
          ))}
        </ul>
      )}
      {create.isSuccess && !open && <Alert tone="success">Ariza yuborildi. Natija Telegram orqali keladi.</Alert>}
      {!open ? (
        <Button className="w-full" onClick={() => setOpen(true)}>
          Qaytarish arizasini yozish
        </Button>
      ) : (
        <form
          className="bg-surface rounded-2xl border border-line p-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ready || amount === null) return;
            create.mutate(
              { amount, click_reference: ref.trim(), reason: reason.trim() },
              {
                onSuccess: () => {
                  setOpen(false);
                  setAmount(null);
                  setRef('');
                  setReason('');
                },
              },
            );
          }}
        >
          <Field label="Summa">{(p) => <MoneyInput {...p} value={amount} onChange={setAmount} />}</Field>
          <Field label="Click toʻlov raqami">
            {(p) => <input {...p} value={ref} onChange={(e) => setRef(e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Sabab">
            {(p) => (
              <textarea
                {...p}
                rows={3}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-line p-3 text-[15px]"
              />
            )}
          </Field>
          {create.isError && <Alert>{create.error.message}</Alert>}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" className="flex-1" disabled={create.isPending || !ready}>
              Ariza yuborish
            </Button>
          </div>
        </form>
      )}
    </section>
  );
};
