import { api, ApiError } from '../../api/http';
import type { components } from '../../api/schema';
import { inNativeApp } from './native';

type PushPublicKey = components['schemas']['PushPublicKey'];
type PushSubscriptionIn = components['schemas']['PushSubscriptionInRequest'];

/**
 * Browser push notifications (FR-20): the service worker (public/sw.js) shows them even when the
 * site is closed, on computers and phones. Each browser is one subscription on the server.
 *
 * iPhone/iPad: Safari delivers push only to a site added to the Home Screen (iOS 16.4+).
 */

export type PushState =
  | 'loading'
  | 'unsupported' // the browser has no Push API
  | 'ios-install' // iOS Safari tab: add to Home Screen first
  | 'unconfigured' // the server has no VAPID keys
  | 'denied' // blocked in the browser settings
  | 'off'
  | 'on';

export function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Called once at start-up: the worker also serves the offline page. */
export function registerServiceWorker(): void {
  // In the Android app the native shell shows its own offline screen and push (FR-21); a
  // worker answering failed loads with offline.html would hide those errors from it.
  if (!('serviceWorker' in navigator) || inNativeApp()) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  return existing ?? navigator.serviceWorker.register('/sw.js');
}

let keyPromise: Promise<string | null> | null = null;
function publicKey(): Promise<string | null> {
  keyPromise ??= api<PushPublicKey>('GET', '/push/public-key')
    .then((r) => r.public_key)
    .catch((e: unknown) => {
      keyPromise = null;
      throw e;
    });
  return keyPromise;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const current = sub.options.applicationServerKey;
  if (!current) return false;
  const a = new Uint8Array(current);
  return a.length === key.length && a.every((v, i) => v === key[i]);
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported';
  if (!(await publicKey())) return 'unconfigured';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

/**
 * Ask for permission (only when `prompt`), subscribe this browser and tell the server.
 * Without `prompt` it never shows a permission dialog: used to re-sync after login.
 */
export async function enablePush({ prompt }: { prompt: boolean }): Promise<PushState> {
  if (!pushSupported()) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported';
  const key = await publicKey();
  if (!key) return 'unconfigured';
  let permission = Notification.permission;
  if (permission === 'default' && prompt) permission = await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'off';

  const reg = await registration();
  await navigator.serviceWorker.ready;
  const bytes = keyBytes(key);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub, bytes)) {
    // The server keys changed: the old subscription can no longer receive anything.
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  await api<void>('POST', '/me/push-subscriptions', sub.toJSON() as PushSubscriptionIn);
  return 'on';
}

/** Stop push on this browser: on request, and on logout so a shared device stays quiet. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  try {
    await api<void>('DELETE', '/me/push-subscriptions', { endpoint: sub.endpoint });
  } catch (e) {
    // Offline or already logged out: the server drops it once the push service reports it gone.
    if (!(e instanceof ApiError)) throw e;
  }
  await sub.unsubscribe();
}
