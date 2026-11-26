import React, { useEffect, useState } from 'react';
import { BellOff, BellRing } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Field';
import { disablePush, enablePush, pushState, type PushState } from './push';
import { inNativeApp, nativeBridge, onNativeEvent, syncNativeDevice } from './native';

const TEXT: Partial<Record<PushState, string>> = {
  on: 'Taklifingizdan oʻzib ketishsa, auksion boshlansa yoki bitim tuzilsa, sayt yopiq boʻlsa ham xabar keladi.',
  off: 'Taklifingizdan oʻzib ketishsa, auksion boshlansa yoki bitim tuzilsa, sayt yopiq boʻlsa ham darhol xabar oling.',
  'ios-install':
    'iPhone yoki iPadʼda bildirishnoma olish uchun saytni bosh ekranga qoʻshing: Safariʼda “Ulashish” tugmasi → “Bosh ekranga qoʻshish”. Keyin saytni bosh ekrandagi belgidan ochib, shu yerda yoqing.',
  denied:
    'Bildirishnomalar brauzer sozlamalarida bloklangan. Manzil qatoridagi qulf belgisini bosing, “Bildirishnomalar” bandida “Ruxsat berish”ni tanlang va sahifani yangilang.',
};

/**
 * "Telefon va kompyuterga bildirishnoma" (FR-20): turns Web Push on or off for this browser.
 * Hidden when the server has push switched off or the browser cannot do it at all.
 */
export const PushToggle: React.FC = () => (inNativeApp() ? <NativePushToggle /> : <WebPushToggle />);

const NATIVE_DENIED =
  'Bildirishnomalar telefon sozlamalarida oʻchirilgan. “Sozlamalarni ochish”ni bosing va Zotdor uchun bildirishnomalarga ruxsat bering.';

/** Inside the Android app: the permission is the phone's, notifications come through Firebase (FR-21). */
const NativePushToggle: React.FC = () => {
  const app = nativeBridge();
  const read = (): PushState => {
    const p = app?.notificationPermission();
    return p === 'granted' ? 'on' : p === 'denied' ? 'denied' : 'off';
  };
  const [state, setState] = useState<PushState>(read);

  useEffect(
    () =>
      onNativeEvent((e) => {
        if (e.type !== 'notification-permission') return;
        setState(e.value === 'granted' ? 'on' : e.value === 'denied' ? 'denied' : 'off');
        if (e.value === 'granted') void syncNativeDevice().catch(() => undefined);
      }),
    [],
  );

  if (!app) return null;
  const on = state === 'on';
  return (
    <section
      aria-labelledby="push-title"
      className={`rounded-2xl border p-4 space-y-3 ${on ? 'border-line bg-surface' : 'border-brand bg-brand-soft'}`}
    >
      <div className="flex items-start gap-3">
        {on ? (
          <BellRing className="mt-0.5 w-5 h-5 shrink-0 text-brand" aria-hidden="true" />
        ) : (
          <BellOff className="mt-0.5 w-5 h-5 shrink-0 text-ink-muted" aria-hidden="true" />
        )}
        <div>
          <h2 id="push-title" className="text-[17px] font-semibold text-ink">
            {on ? 'Bildirishnomalar yoqilgan' : 'Bildirishnomalarni yoqing'}
          </h2>
          <p className="text-[15px] text-ink">{state === 'denied' ? NATIVE_DENIED : TEXT[state]}</p>
        </div>
      </div>
      {state === 'off' && (
        <Button variant="primary" className="w-full sm:w-auto" onClick={() => app.requestNotificationPermission()}>
          <BellRing className="w-4 h-4" aria-hidden="true" />
          Bildirishnomalarni yoqish
        </Button>
      )}
      {state !== 'off' && (
        <Button variant="ghost" onClick={() => app.openNotificationSettings()}>
          {on ? 'Bildirishnoma sozlamalari' : 'Sozlamalarni ochish'}
        </Button>
      )}
    </section>
  );
};

const WebPushToggle: React.FC = () => {
  const [state, setState] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    pushState()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState('unconfigured'));
    return () => {
      alive = false;
    };
  }, []);

  const run = async (action: () => Promise<PushState>) => {
    setBusy(true);
    setError('');
    try {
      setState(await action());
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Bildirishnomalarni yoqib boʻlmadi. Qayta urinib koʻring.');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading' || state === 'unconfigured' || state === 'unsupported') return null;
  const on = state === 'on';

  return (
    <section
      aria-labelledby="push-title"
      className={`rounded-2xl border p-4 space-y-3 ${on ? 'border-line bg-surface' : 'border-brand bg-brand-soft'}`}
    >
      <div className="flex items-start gap-3">
        {on ? (
          <BellRing className="mt-0.5 w-5 h-5 shrink-0 text-brand" aria-hidden="true" />
        ) : (
          <BellOff className="mt-0.5 w-5 h-5 shrink-0 text-ink-muted" aria-hidden="true" />
        )}
        <div>
          <h2 id="push-title" className="text-[17px] font-semibold text-ink">
            {on ? 'Bu qurilmada bildirishnomalar yoqilgan' : 'Telefon va kompyuterga bildirishnoma'}
          </h2>
          <p className="text-[15px] text-ink">{TEXT[state]}</p>
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
      {state === 'off' && (
        <Button
          variant="primary"
          className="w-full sm:w-auto"
          disabled={busy}
          onClick={() => void run(() => enablePush({ prompt: true }))}
        >
          <BellRing className="w-4 h-4" aria-hidden="true" />
          {busy ? 'Yoqilmoqda…' : 'Bildirishnomalarni yoqish'}
        </Button>
      )}
      {on && (
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await disablePush();
              return 'off';
            })
          }
        >
          {busy ? 'Oʻchirilmoqda…' : 'Bu qurilmada oʻchirish'}
        </Button>
      )}
    </section>
  );
};
