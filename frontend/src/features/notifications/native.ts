import { api, ApiError } from '../../api/http';
import type { components } from '../../api/schema';

type DeviceIn = components['schemas']['DeviceInRequest'];

/**
 * Bridge to the Zotdor Android app (FR-21, android/). Inside the app the page runs in a WebView
 * that exposes `window.ZotdorAndroid`; the app shows notifications natively through Firebase,
 * so the site only has to hand the app's token to the server with the user's session.
 *
 * The app tells the page about changes with a `zotdor-native` event (new token, permission).
 */

interface ZotdorAndroidBridge {
  getPushToken(): string;
  notificationPermission(): string; // "granted" | "denied" | "default"
  requestNotificationPermission(): void;
  openNotificationSettings(): void;
  appVersion(): string;
}

declare global {
  interface Window {
    ZotdorAndroid?: ZotdorAndroidBridge;
  }
}

export type NativeEvent =
  | { type: 'push-token'; token: string }
  | { type: 'notification-permission'; value: 'granted' | 'denied' | 'default' };

/** The app also marks its user agent, so this works before the bridge object is attached. */
export function inNativeApp(): boolean {
  return Boolean(window.ZotdorAndroid) || navigator.userAgent.includes('ZotdorApp/');
}

export function nativeBridge(): ZotdorAndroidBridge | null {
  return window.ZotdorAndroid ?? null;
}

export function onNativeEvent(listener: (event: NativeEvent) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<NativeEvent>).detail);
  window.addEventListener('zotdor-native', handler);
  return () => window.removeEventListener('zotdor-native', handler);
}

let sentToken = '';

/** Give the app's Firebase token to the server for the logged-in user. Safe to call often. */
export async function syncNativeDevice(): Promise<void> {
  const app = nativeBridge();
  const token = app?.getPushToken() ?? '';
  if (!app || !token || token === sentToken) return;
  const body: DeviceIn = { token, platform: 'android', app_version: app.appVersion() };
  await api<void>('POST', '/me/devices', body);
  sentToken = token;
}

/** On logout: this phone stops getting the account's notifications. */
export async function forgetNativeDevice(): Promise<void> {
  const token = nativeBridge()?.getPushToken() ?? '';
  sentToken = '';
  if (!token) return;
  try {
    await api<void>('DELETE', '/me/devices', { token });
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }
}
