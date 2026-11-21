import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { ME_KEY, useLoginStatus, useMe, useStartLogin, type LoginStart } from './api';
import { safeNext } from './next';
import { PageLoading } from '../../components/ui/PageState';

/** Shows typed digits as "90 123 45 67". */
function formatLocal(digits: string): string {
  const d = digits.slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
}

function useCountdown(until: string | undefined): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!until) return '';
  const left = Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

export const LoginPage: React.FC = () => {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const { data: me, isPending: meLoading } = useMe();
  const [digits, setDigits] = useState('');
  const [attempt, setAttempt] = useState<LoginStart | null>(null);
  const start = useStartLogin();

  if (meLoading) return <PageLoading />;
  if (me) return <Navigate to={me.needs_profile ? `/me/setup?next=${encodeURIComponent(next)}` : next} replace />;

  if (attempt) {
    return <WaitForTelegram attempt={attempt} next={next} onRestart={() => setAttempt(null)} />;
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start.mutate(`+998${digits}`, { onSuccess: setAttempt });
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-8">
      <h1 className="font-display text-[28px] leading-tight text-ink">Kirish</h1>
      <p className="mt-2 text-[15px] text-ink-muted">
        Telefon raqamingizni kiriting. Tasdiqlash Telegram orqali boʻladi, parol kerak emas.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <label htmlFor="phone" className="block text-[15px] font-semibold text-ink">
          Telefon raqami
        </label>
        <div className="flex items-stretch rounded-xl border border-line bg-surface focus-within:ring-2 focus-within:ring-brand">
          <span className="px-3 flex items-center text-[17px] font-semibold text-ink-muted border-r border-line tabular-nums">
            +998
          </span>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="90 123 45 67"
            value={formatLocal(digits)}
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 9))}
            aria-invalid={start.isError}
            aria-describedby={start.isError ? 'phone-error' : undefined}
            className="flex-1 min-w-0 px-3 py-3 text-[17px] tabular-nums text-ink bg-transparent rounded-r-xl focus:outline-none"
          />
        </div>
        {start.isError && (
          <p id="phone-error" role="alert" className="text-[15px] text-danger">
            {start.error.message}
          </p>
        )}
        <button
          type="submit"
          disabled={digits.length !== 9 || start.isPending}
          className="w-full min-h-touch rounded-xl bg-ink text-page text-[16px] font-bold flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
        >
          <Send className="w-5 h-5" aria-hidden="true" />
          {start.isPending ? 'Yuborilmoqda…' : 'Telegram orqali tasdiqlash'}
        </button>
      </form>
    </div>
  );
};

const WaitForTelegram: React.FC<{ attempt: LoginStart; next: string; onRestart: () => void }> = ({
  attempt,
  next,
  onRestart,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isError, error } = useLoginStatus(attempt.request_id);
  const timeLeft = useCountdown(attempt.expires_at);

  useEffect(() => {
    if (data?.status === 'verified' && data.user) {
      queryClient.setQueryData(ME_KEY, data.user);
      navigate(data.user.needs_profile ? `/me/setup?next=${encodeURIComponent(next)}` : next, { replace: true });
    }
  }, [data, navigate, next, queryClient]);

  const finished = data?.status === 'failed' || data?.status === 'expired' || isError;

  return (
    <div className="max-w-sm mx-auto px-4 py-8">
      <h1 className="font-display text-[28px] leading-tight text-ink">Telegramʼda tasdiqlang</h1>

      {!finished && (
        <>
          <ol className="mt-5 space-y-3 text-[15px] text-ink list-decimal pl-5">
            <li>Quyidagi tugma orqali botni oching.</li>
            <li>Botda «Raqamni ulashish» tugmasini bosing.</li>
            <li>Shu sahifaga qayting — kirish oʻzi davom etadi.</li>
          </ol>
          <a
            href={attempt.deep_link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 w-full min-h-touch rounded-xl bg-ink text-page text-[16px] font-bold flex items-center justify-center gap-2"
          >
            <Send className="w-5 h-5" aria-hidden="true" />
            Telegramʼni ochish
          </a>
          <p className="mt-4 text-[15px] text-ink-muted tabular-nums" aria-live="polite">
            Tasdiqlash kutilmoqda · {timeLeft}
          </p>
        </>
      )}

      {finished && (
        <div role="alert" className="mt-5 rounded-xl border border-danger/30 bg-danger-soft p-4 text-[15px] text-danger">
          {data?.status === 'failed'
            ? (data.message ?? 'Tasdiqlash rad etildi.')
            : data?.status === 'expired'
              ? 'Tasdiqlash vaqti tugadi.'
              : error?.message}
        </div>
      )}

      <button
        type="button"
        onClick={onRestart}
        className="mt-4 min-h-touch text-[15px] font-semibold text-brand underline-offset-4 hover:underline"
      >
        {finished ? 'Qaytadan urinish' : 'Raqamni oʻzgartirish'}
      </button>
    </div>
  );
};
