import React, { useState } from 'react';
import { LocateFixed, Map as MapIcon, MapPin, X } from 'lucide-react';
import { useMe } from '../auth/api';
import { LocationPicker } from './LocationPicker';
import { useDeviceLocation } from './useDeviceLocation';

const DISMISS_KEY = 'zotdor_location_prompt_dismissed';

function dismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

const NOTE =
  'Nuqta yaqin auksionlarni saralash va masofani hisoblash uchun profilingizga saqlanadi. Uni hech kim koʻrmaydi.';
const GUEST_NOTE = 'Nuqta faqat shu brauzerda, yaqin auksionlarni saralash uchun ishlatiladi.';

/**
 * Where the user is: detect it with the browser or pick it on the map (FR-07 "yaqin").
 * Logged in, the point is saved to the profile (`PUT /me/location`); a guest keeps it in the tab.
 *
 * `compact` is the one-line status next to "nearest" results. Otherwise it is a card asking for
 * the location; with `dismissible` it can be hidden for this session.
 */
export const LocationPrompt: React.FC<{ compact?: boolean; dismissible?: boolean }> = ({
  compact = false,
  dismissible = false,
}) => {
  const { data: me } = useMe();
  const { status, message, locate, save, clear, hasLocation, point } = useDeviceLocation();
  const [picking, setPicking] = useState(false);
  const [dismissed, setDismissed] = useState(() => dismissible && dismissedThisSession());
  const busy = status === 'locating';

  const picker = (
    <LocationPicker
      open={picking}
      title={hasLocation ? 'Joylashuvni oʻzgartirish' : 'Joylashuvni tanlang'}
      note={me ? NOTE : GUEST_NOTE}
      initial={point}
      busy={busy}
      error={picking ? message : ''}
      onConfirm={(p) => void save(p).then((ok) => ok && setPicking(false))}
      onClose={() => setPicking(false)}
    />
  );

  if (hasLocation) {
    if (!compact) return null;
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-ink">
        <span className="inline-flex items-center gap-1.5">
          <LocateFixed className="w-4 h-4 text-brand" aria-hidden="true" />
          Joylashuvingiz boʻyicha saralanmoqda
        </span>
        <button type="button" onClick={() => setPicking(true)} className="min-h-touch font-semibold text-brand">
          Xaritada oʻzgartirish
        </button>
        <button type="button" onClick={() => void clear()} className="min-h-touch font-semibold text-ink-muted">
          Oʻchirish
        </button>
        {message && !picking && (
          <p role="alert" className="w-full text-[13px] text-danger">
            {message}
          </p>
        )}
        {picker}
      </div>
    );
  }

  if (dismissed) return null;

  return (
    <div className={compact ? 'space-y-2' : 'relative rounded-2xl border border-brand bg-brand-soft p-4 space-y-3'}>
      {!compact && (
        <div className="flex items-start gap-2 pr-10">
          <MapPin className="mt-0.5 w-5 h-5 shrink-0 text-brand" aria-hidden="true" />
          <div>
            <p className="text-[17px] font-semibold text-ink">Joylashuvingizni kiriting</p>
            <p className="text-[15px] text-ink">
              Yaqin atrofdagi auksionlar va ulargacha masofa koʻrsatiladi.
              {me ? ' Nuqta profilingizga saqlanadi.' : ''} Aniq manzilingiz hech kimga koʻrsatilmaydi.
            </p>
          </div>
        </div>
      )}
      {dismissible && (
        <button
          type="button"
          aria-label="Eslatmani yopish"
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, '1');
            } catch {
              // Storage unavailable: hide it until the page reloads.
            }
            setDismissed(true);
          }}
          className="absolute right-1 top-1 min-h-touch min-w-touch flex items-center justify-center rounded-xl text-ink-muted"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void locate()}
          disabled={busy}
          className="inline-flex min-h-touch items-center gap-2 rounded-xl bg-ink px-4 text-[15px] font-semibold text-surface disabled:opacity-50"
        >
          <LocateFixed className="w-4 h-4" aria-hidden="true" />
          {busy && !picking ? 'Aniqlanmoqda…' : 'Joylashuvimni aniqlash'}
        </button>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex min-h-touch items-center gap-2 rounded-xl border border-ink bg-surface px-4 text-[15px] font-semibold text-ink hover:bg-brand-soft"
        >
          <MapIcon className="w-4 h-4" aria-hidden="true" />
          Xaritadan tanlash
        </button>
      </div>
      {message && !picking && (
        <p role="alert" className="text-[13px] text-danger">
          {message}
        </p>
      )}
      {picker}
    </div>
  );
};
