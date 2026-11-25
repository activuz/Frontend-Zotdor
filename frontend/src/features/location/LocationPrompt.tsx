import React from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import { useDeviceLocation } from './useDeviceLocation';

/** "Show auctions near me": asks the browser for the position, explains why, shows each outcome. */
export const LocationPrompt: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { status, message, locate, clear, hasLocation } = useDeviceLocation();
  const busy = status === 'locating';

  if (hasLocation) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-ink">
        <span className="inline-flex items-center gap-1.5">
          <LocateFixed className="w-4 h-4 text-brand" aria-hidden="true" />
          Joylashuvingiz boʻyicha saralanmoqda
        </span>
        <button
          type="button"
          onClick={() => void locate()}
          disabled={busy}
          className="min-h-touch font-semibold text-brand disabled:opacity-50"
        >
          {busy ? 'Aniqlanmoqda…' : 'Yangilash'}
        </button>
        <button type="button" onClick={() => void clear()} className="min-h-touch font-semibold text-ink-muted">
          Oʻchirish
        </button>
        {message && (
          <p role="alert" className="w-full text-[13px] text-danger">
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'rounded-2xl border border-line bg-surface p-4'}>
      {!compact && (
        <p className="flex items-start gap-2 text-[15px] text-ink">
          <MapPin className="mt-0.5 w-5 h-5 shrink-0 text-brand" aria-hidden="true" />
          Yaqin atrofdagi auksionlarni koʻrish uchun joylashuvingizni aniqlang. Aniq manzilingiz hech kimga
          koʻrsatilmaydi.
        </p>
      )}
      <button
        type="button"
        onClick={() => void locate()}
        disabled={busy}
        className="mt-3 inline-flex min-h-touch items-center gap-2 rounded-xl border border-ink px-4 text-[15px] font-semibold text-ink hover:bg-brand-soft disabled:opacity-50"
      >
        <LocateFixed className="w-4 h-4" aria-hidden="true" />
        {busy ? 'Aniqlanmoqda…' : 'Joylashuvimni aniqlash'}
      </button>
      {message && (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {message}
        </p>
      )}
    </div>
  );
};
