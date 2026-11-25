import { useCallback, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../api/http';
import type { components } from '../../api/schema';
import { ME_KEY, useMe } from '../auth/api';

type Me = components['schemas']['Me'];

/**
 * Browser geolocation for "nearest" sorting and distances (docs/API.md, /me/location).
 *
 * Logged in: the position is sent to the server (stored rounded to ~100 m) and used everywhere.
 * Guest: it stays in this browser tab (sessionStorage) and is sent as ?lat&lng with feed queries.
 * The exact position is never shown to other users (BR-33).
 */

const KEY = 'zotdor_point';

export interface Point {
  lat: number;
  lng: number;
}

export function storedPoint(): Point | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Point>;
    return typeof p.lat === 'number' && typeof p.lng === 'number' ? { lat: p.lat, lng: p.lng } : null;
  } catch {
    return null;
  }
}

// One shared guest point for every component in the tab.
const listeners = new Set<() => void>();
let cached: Point | null = storedPoint();

function setGuestPoint(point: Point | null) {
  try {
    if (point) sessionStorage.setItem(KEY, JSON.stringify(point));
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: keep the point in memory for this page.
  }
  cached = point;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function currentGuestPoint(): Point | null {
  return cached;
}

export type LocateStatus = 'idle' | 'locating' | 'done' | 'denied' | 'unavailable' | 'error';

const MESSAGES: Partial<Record<LocateStatus, string>> = {
  denied: 'Joylashuvga ruxsat berilmadi. Brauzer sozlamalarida ruxsat bering yoki hududni profilda tanlang.',
  unavailable: 'Bu qurilmada joylashuvni aniqlab boʻlmaydi. Hududni profilda tanlang.',
  error: 'Joylashuvni aniqlab boʻlmadi. Qayta urinib koʻring.',
};

function position(): Promise<Point> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      // Coarse is enough (~100 m is kept anyway) and much faster outdoors without a GPS fix.
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 },
    );
  });
}

export function useDeviceLocation() {
  const client = useQueryClient();
  const { data: me } = useMe();
  const [status, setStatus] = useState<LocateStatus>('idle');
  const [message, setMessage] = useState('');
  const guestPoint = useSyncExternalStore(subscribe, currentGuestPoint);

  const locate = useCallback(async () => {
    setMessage('');
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      setMessage(MESSAGES.unavailable ?? '');
      return;
    }
    setStatus('locating');
    let point: Point;
    try {
      point = await position();
    } catch (e) {
      const denied = e instanceof GeolocationPositionError && e.code === e.PERMISSION_DENIED;
      const next: LocateStatus = denied ? 'denied' : 'error';
      setStatus(next);
      setMessage(MESSAGES[next] ?? '');
      return;
    }
    try {
      if (me) {
        const updated = await api<Me>('PUT', '/me/location', point);
        client.setQueryData(ME_KEY, updated);
      } else {
        setGuestPoint(point);
      }
      await client.invalidateQueries({ queryKey: ['feed'] });
      setStatus('done');
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof ApiError ? e.message : (MESSAGES.error ?? ''));
    }
  }, [client, me]);

  const clear = useCallback(async () => {
    setMessage('');
    setGuestPoint(null);
    try {
      if (me) client.setQueryData(ME_KEY, await api<Me>('DELETE', '/me/location'));
      await client.invalidateQueries({ queryKey: ['feed'] });
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof ApiError ? e.message : (MESSAGES.error ?? ''));
    }
  }, [client, me]);

  const hasLocation = Boolean(me?.has_location || (!me && guestPoint));
  return { status, message, locate, clear, hasLocation };
}
