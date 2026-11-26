import React from 'react';
import { BellOff, BellRing } from 'lucide-react';
import { usePush } from './usePush';

const HINT_IOS =
  'iPhone yoki iPadʼda: Safariʼda “Ulashish” → “Bosh ekranga qoʻshish”, keyin saytni bosh ekrandagi belgidan ochib yoqing.';
const HINT_BLOCKED =
  'Manzil qatoridagi qulf belgisini bosing, “Bildirishnomalar”da “Ruxsat berish”ni tanlang va sahifani yangilang.';

const actionClass =
  'shrink-0 min-h-touch px-4 rounded-xl text-[15px] font-semibold disabled:opacity-50';

/**
 * Compact "Bildirishnomalar" row (FR-20, FR-21), like the location row: status on the left,
 * one action on the right. Hidden where the server or the browser cannot push at all.
 */
export const PushToggle: React.FC = () => {
  const { state, busy, error, native, enable, disable, openSettings } = usePush();
  if (state === 'loading' || state === 'unconfigured' || state === 'unsupported') return null;

  const on = state === 'on';
  const status =
    state === 'on'
      ? 'Yoqilgan — sayt yopiq boʻlsa ham xabar keladi'
      : state === 'denied'
        ? native
          ? 'Telefon sozlamalarida oʻchirilgan'
          : 'Brauzerda bloklangan'
        : state === 'ios-install'
          ? 'iPhoneʼda avval bosh ekranga qoʻshing'
          : 'Oʻchirilgan';

  let action: React.ReactNode = null;
  if (state === 'off') {
    action = (
      <button type="button" onClick={enable} disabled={busy} className={`${actionClass} bg-ink text-surface`}>
        {busy ? 'Yoqilmoqda…' : 'Yoqish'}
      </button>
    );
  } else if (on || (state === 'denied' && native)) {
    action = (
      <button
        type="button"
        onClick={native ? openSettings : disable}
        disabled={busy}
        className={`${actionClass} text-ink-muted hover:bg-brand-soft`}
      >
        {native ? 'Sozlamalar' : busy ? 'Oʻchirilmoqda…' : 'Oʻchirish'}
      </button>
    );
  }

  const hint = state === 'ios-install' ? HINT_IOS : state === 'denied' && !native ? HINT_BLOCKED : '';

  return (
    <section
      aria-label="Bildirishnomalar"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-surface px-4 py-2"
    >
      {on ? (
        <BellRing className="w-5 h-5 shrink-0 text-brand" aria-hidden="true" />
      ) : (
        <BellOff className="w-5 h-5 shrink-0 text-ink-muted" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1 py-1">
        <p className="text-[15px] font-semibold text-ink">Bildirishnomalar</p>
        <p className="text-[13px] text-ink-muted">{status}</p>
      </div>
      {action}
      {hint && <p className="w-full pb-1 text-[13px] text-ink-muted">{hint}</p>}
      {error && (
        <p role="alert" className="w-full pb-1 text-[13px] text-danger">
          {error}
        </p>
      )}
    </section>
  );
};
