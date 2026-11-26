import { useCallback, useEffect, useState } from 'react';
import { disablePush, enablePush, pushState, type PushState } from './push';
import { inNativeApp, nativeBridge, onNativeEvent, syncNativeDevice } from './native';

function nativeState(value: string | undefined): PushState {
  if (value === 'granted') return 'on';
  if (value === 'denied') return 'denied';
  return value === undefined ? 'unsupported' : 'off';
}

/**
 * Notification permission for this device, the same way in a browser (Web Push, FR-20) and in the
 * Android app (Firebase, FR-21). Used by the compact profile row and the first-visit prompt.
 */
export function usePush() {
  const native = inNativeApp();
  const [state, setState] = useState<PushState>(() =>
    native ? nativeState(nativeBridge()?.notificationPermission()) : 'loading',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (native) {
      return onNativeEvent((e) => {
        if (e.type !== 'notification-permission') return;
        setState(nativeState(e.value));
        if (e.value === 'granted') void syncNativeDevice().catch(() => undefined);
      });
    }
    let alive = true;
    pushState()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState('unconfigured'));
    return () => {
      alive = false;
    };
  }, [native]);

  const run = useCallback(async (action: () => Promise<PushState>) => {
    setBusy(true);
    setError('');
    try {
      setState(await action());
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Bildirishnomalarni yoqib boʻlmadi. Qayta urinib koʻring.');
    } finally {
      setBusy(false);
    }
  }, []);

  /** Shows the browser's or Android's permission dialog. Call it from a click. */
  const enable = useCallback(() => {
    if (native) nativeBridge()?.requestNotificationPermission();
    else void run(() => enablePush({ prompt: true }));
  }, [native, run]);

  const disable = useCallback(() => {
    if (native) {
      nativeBridge()?.openNotificationSettings();
      return;
    }
    void run(async () => {
      await disablePush();
      return 'off';
    });
  }, [native, run]);

  const openSettings = useCallback(() => nativeBridge()?.openNotificationSettings(), []);

  return { state, busy, error, native, enable, disable, openSettings };
}
