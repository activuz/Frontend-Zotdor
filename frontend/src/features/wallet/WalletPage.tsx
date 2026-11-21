import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useWallet, useWalletEntries, type WalletEntry } from './api';
import { formatDate, formatDateTime, formatSom } from '../../lib/format';
import { PageError, PageLoading } from '../../components/ui/PageState';

const BUCKET_LABEL: Record<WalletEntry['bucket'], string> = {
  main: 'Asosiy',
  bonus: 'Bonus',
  hold: 'Band qilingan',
};

/** FR-11 without top-up (Click arrives in phase 8). */
export const WalletPage: React.FC = () => {
  const wallet = useWallet();

  if (wallet.isPending) return <PageLoading />;
  if (wallet.isError) return <PageError message={wallet.error.message} onRetry={() => void wallet.refetch()} />;
  const w = wallet.data;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
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

        {w.has_debt && (
          <p role="alert" className="mt-4 flex gap-2 rounded-xl bg-danger-soft p-3 text-[15px] text-danger">
            <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
            Qarzni yoping: {formatSom(-w.main_balance)}. Shundan keyin yangi auksion ocha olasiz.
          </p>
        )}
        <p className="mt-4 text-[14px] text-ink-muted">
          Bonus faqat komissiyaga sarflanadi va naqd qilib olinmaydi. Hozircha balansni faqat administrator
          toʻldira oladi.
        </p>
      </section>

      <History />
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

      {entries.isSuccess && (
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
        <button
          type="button"
          onClick={() => void entries.fetchNextPage()}
          disabled={entries.isFetchingNextPage}
          className="mt-3 w-full min-h-touch rounded-xl border border-line bg-surface text-[15px] font-semibold text-ink disabled:opacity-50"
        >
          {entries.isFetchingNextPage ? 'Yuklanmoqda…' : 'Koʻproq koʻrsatish'}
        </button>
      )}
    </section>
  );
};
