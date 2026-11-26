import React, { useEffect, useId, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BellRing, X } from 'lucide-react';
import { useMe } from '../auth/api';
import { usePush } from './usePush';

const SEEN_KEY = 'zotdor_push_prompt_seen';

function seen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Storage unavailable: the prompt may come back next visit, nothing breaks.
  }
}

/**
 * The gentle first-visit ask (FR-20): once per device after login, a small card offers
 * notifications. The browser's own dialog opens only from "Yoqish". If the user says no or
 * closes it, it never comes back here; the compact row in the profile stays.
 * In the Android app the system dialog is shown on first launch instead (MainActivity).
 */
export const PushPrompt: React.FC = () => {
  const { data: me } = useMe();
  const { pathname } = useLocation();
  const { state, enable } = usePush();
  const [visible, setVisible] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!me || seen()) return;
    const timer = window.setTimeout(() => setVisible(true), 2500);
    return () => window.clearTimeout(timer);
  }, [me]);

  if (!visible || state !== 'off' || pathname.startsWith('/login')) return null;

  const close = () => {
    markSeen();
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      className="fixed inset-x-3 bottom-20 z-40 rounded-2xl border border-line bg-surface p-4 shadow-lg md:inset-x-auto md:bottom-6 md:right-6 md:w-96"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Yopish"
        className="absolute right-1 top-1 min-h-touch min-w-touch flex items-center justify-center rounded-xl text-ink-muted"
      >
        <X className="w-5 h-5" aria-hidden="true" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <BellRing className="mt-0.5 w-5 h-5 shrink-0 text-brand" aria-hidden="true" />
        <div>
          <p id={titleId} className="text-[15px] font-semibold text-ink">
            Bildirishnomalarni yoqasizmi?
          </p>
          <p className="text-[13px] text-ink-muted">
            Taklifingizdan oʻzib ketishsa, auksion boshlansa yoki bitim tuzilsa, darhol xabar beramiz.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            enable();
            close();
          }}
          className="min-h-touch flex-1 rounded-xl bg-ink px-4 text-[15px] font-semibold text-surface"
        >
          Yoqish
        </button>
        <button
          type="button"
          onClick={close}
          className="min-h-touch flex-1 rounded-xl border border-line px-4 text-[15px] font-semibold text-ink"
        >
          Keyinroq
        </button>
      </div>
    </div>
  );
};
