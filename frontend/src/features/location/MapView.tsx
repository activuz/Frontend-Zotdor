import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import type * as Leaflet from 'leaflet';
import type { Point } from './useDeviceLocation';

/**
 * OpenStreetMap through Leaflet, loaded only when a map is on screen.
 * No API key; tiles come from tile.openstreetmap.org (allowed in the CSP, vercel.json).
 *
 * - `pick`: the pin stays in the centre and the map moves under it (Yandex Go / Uber style);
 *   `onMove` gets the centre after every pan or zoom.
 * - `area`: a circle without a pin: the approximate location of someone's auction (BR-33a).
 * - `point`: a fixed pin: one's own saved point, or the deal location.
 */

type L = typeof Leaflet;
let loading: Promise<L> | null = null;

function loadLeaflet(): Promise<L> {
  loading ??= Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([m]) => m.default ?? m);
  return loading;
}

// Uzbekistan with a margin, so the map does not wander off to other countries.
const UZ_BOUNDS: [[number, number], [number, number]] = [
  [36.6, 55.5],
  [46.2, 73.6],
];

export interface MapViewProps {
  mode: 'pick' | 'area' | 'point';
  center: Point;
  zoom?: number;
  radiusM?: number;
  interactive?: boolean;
  onMove?: (center: Point) => void;
  /** A new value flies the map there (e.g. after "my location"). */
  flyTo?: Point | null;
  className?: string;
  label: string;
}

// Static markup for the Leaflet marker (it takes an HTML string); colour comes from `text-brand`.
const MARKER_HTML =
  '<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path fill="currentColor" stroke="white" stroke-width="1.2" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>';

export const MapView: React.FC<MapViewProps> = ({
  mode,
  center,
  zoom = 13,
  radiusM = 1500,
  interactive = true,
  onMove,
  flyTo,
  className = '',
  label,
}) => {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const onMoveRef = useRef(onMove);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  // The map is built once; later moves go through `flyTo`, so a parent re-render never
  // resets what the user has panned to.
  const initial = useRef({ center, zoom, radiusM, mode, interactive });
  useEffect(() => {
    let cancelled = false;
    void loadLeaflet()
      .then((L) => {
        if (cancelled || !host.current) return;
        const { center: c, zoom: z, radiusM: r, mode: m, interactive: i } = initial.current;
        const view = L.map(host.current, {
          center: [c.lat, c.lng],
          zoom: z,
          minZoom: 5,
          maxBounds: UZ_BOUNDS,
          maxBoundsViscosity: 1,
          zoomControl: i,
          dragging: i,
          touchZoom: i ? 'center' : false,
          scrollWheelZoom: i ? 'center' : false,
          doubleClickZoom: i ? 'center' : false,
          boxZoom: false,
          keyboard: i,
        });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        }).addTo(view);
        view.attributionControl.setPrefix(false);
        if (m === 'area') L.circle([c.lat, c.lng], { radius: r, className: 'map-area' }).addTo(view);
        if (m === 'point') {
          L.marker([c.lat, c.lng], {
            icon: L.divIcon({ html: MARKER_HTML, className: 'text-brand', iconSize: [36, 36], iconAnchor: [18, 34] }),
            keyboard: false,
            interactive: false,
          }).addTo(view);
        }
        if (m === 'pick') {
          view.on('moveend', () => {
            const p = view.getCenter();
            onMoveRef.current?.({ lat: p.lat, lng: p.lng });
          });
        }
        map.current = view;
        // Inside a dialog that has just opened the container may get its size a frame later.
        requestAnimationFrame(() => map.current?.invalidateSize());
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const view = map.current;
    if (flyTo && view) view.flyTo([flyTo.lat, flyTo.lng], Math.max(view.getZoom(), 15), { duration: 0.6 });
  }, [flyTo]);

  return (
    <div className={`relative isolate overflow-hidden bg-page ${className}`}>
      <div ref={host} role="application" aria-label={label} className="absolute inset-0" />
      {mode === 'pick' && (
        // Drawn over the map with its tip exactly at the centre.
        <MapPin
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-[500] h-11 w-11 -translate-x-1/2 -translate-y-full fill-brand stroke-surface text-surface drop-shadow-md"
        />
      )}
      {failed && (
        <p className="absolute inset-0 z-[600] flex items-center justify-center bg-page p-4 text-center text-[15px] text-ink-muted">
          Xaritani yuklab boʻlmadi. Internetni tekshirib, sahifani yangilang.
        </p>
      )}
    </div>
  );
};
