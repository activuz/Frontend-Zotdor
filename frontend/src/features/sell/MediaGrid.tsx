import React, { useEffect, useRef, useState } from 'react';
import { GripVertical, Play, Trash2 } from 'lucide-react';
import { Alert } from '../../components/ui/Field';
import type { AuctionDetail } from '../auctions/api';
import { MediaLightbox, Thumb } from '../media/MediaLightbox';
import { useDeleteMedia, useReorderMedia } from './api';

type Item = AuctionDetail['media'][number];

const LONG_PRESS_MS = 250;
const MOVE_TOLERANCE = 8;

interface Gesture {
  id: string;
  pointerId: number;
  x: number;
  y: number;
  timer: number | undefined;
  /** Mouse and the grip start at once; a finger on the tile has to hold still first. */
  immediate: boolean;
}

/**
 * Taken photos and videos (F2 step 3). Drag to reorder: grab the handle, or hold a tile for a
 * moment on a phone, then slide it (BR-12a). The first photo is the cover. A tap opens the
 * viewer; the handle also moves a tile with the arrow keys.
 */
export const MediaGrid: React.FC<{ auction: AuctionDetail }> = ({ auction }) => {
  const remove = useDeleteMedia(auction.id);
  const reorder = useReorderMedia(auction.id);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const dragging = useRef(false);
  const suppressClick = useRef(false);
  const grid = useRef<HTMLUListElement>(null);

  const serverOrder = auction.media.map((m) => m.id);
  const byId = new Map(auction.media.map((m) => [m.id, m]));
  const list = (dragOrder ?? serverOrder).map((id) => byId.get(id)).filter((m): m is Item => Boolean(m));
  const viewable = list.filter((m) => m.status === 'ready');
  const coverId = list.find((m) => m.kind === 'photo' && m.status === 'ready')?.id;
  const label = (m: Item, i: number) => `${m.kind === 'video' ? 'Video' : 'Rasm'} ${i + 1}`;

  // While a tile is dragged with a finger, the page must not scroll.
  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (dragging.current) e.preventDefault();
    };
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, []);

  const commit = (next: string[]) => {
    if (next.join() !== serverOrder.join()) reorder.mutate(next);
  };

  const startDrag = (id: string) => {
    dragging.current = true;
    suppressClick.current = true;
    setDragId(id);
    setDragOrder(serverOrder);
    navigator.vibrate?.(10);
  };

  const endGesture = (save: boolean) => {
    const g = gesture.current;
    if (g?.timer) window.clearTimeout(g.timer);
    gesture.current = null;
    if (dragging.current && dragOrder && save) commit(dragOrder);
    dragging.current = false;
    setDragId(null);
    setDragOrder(null);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>, id: string, fromHandle: boolean) => {
    if (e.button !== 0 || reorder.isPending) return;
    suppressClick.current = false;
    const immediate = fromHandle || e.pointerType === 'mouse';
    const g: Gesture = { id, pointerId: e.pointerId, x: e.clientX, y: e.clientY, timer: undefined, immediate };
    gesture.current = g;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (fromHandle) startDrag(id);
    else if (!immediate) g.timer = window.setTimeout(() => startDrag(id), LONG_PRESS_MS);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    if (!dragging.current) {
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) <= MOVE_TOLERANCE) return;
      if (!g.immediate) {
        endGesture(false); // a finger that moves before the hold is a scroll, not a drag
        return;
      }
      startDrag(g.id);
    }
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-media-id]');
    const target = over?.dataset.mediaId;
    if (!target || target === g.id) return;
    setDragOrder((prev) => {
      const base = prev ?? serverOrder;
      const from = base.indexOf(g.id);
      const to = base.indexOf(target);
      if (from < 0 || to < 0) return base;
      const next = [...base];
      next.splice(from, 1);
      next.splice(to, 0, g.id);
      return next;
    });
  };

  const moveBy = (id: string, delta: number) => {
    const from = serverOrder.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= serverOrder.length) return;
    const next = [...serverOrder];
    next.splice(from, 1);
    next.splice(to, 0, id);
    commit(next);
  };

  const gestureHandlers = (id: string, fromHandle: boolean) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => onPointerDown(e, id, fromHandle),
    onPointerMove,
    onPointerUp: () => endGesture(true),
    onPointerCancel: () => endGesture(false),
  });

  if (auction.media.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[13px] text-ink-muted">
        Tartibni oʻzgartirish uchun faylni bosib turing va suring. Birinchi rasm eʼlon muqovasi boʻladi. Koʻrish uchun
        ustiga bosing.
      </p>
      {remove.isError && <Alert>{remove.error.message}</Alert>}
      {reorder.isError && <Alert>{reorder.error.message}</Alert>}
      <ul ref={grid} className="grid grid-cols-3 sm:grid-cols-4 gap-2" aria-label="Olingan fayllar">
        {list.map((m, i) => (
          <li
            key={m.id}
            data-media-id={m.id}
            className={`relative aspect-square overflow-hidden rounded-xl border bg-page transition-transform ${m.id === dragId ? 'z-10 scale-105 border-brand shadow-lg ring-2 ring-brand' : 'border-line'}`}
          >
            <button
              type="button"
              {...gestureHandlers(m.id, false)}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                const at = viewable.findIndex((v) => v.id === m.id);
                if (at >= 0) setViewerAt(at);
              }}
              aria-label={`${label(m, i)}ni koʻrish`}
              style={{ WebkitTouchCallout: 'none' }}
              className="block h-full w-full select-none"
            >
              {m.thumb_url ? (
                <Thumb media={m} />
              ) : (
                <span className="flex h-full items-center justify-center p-1 text-center text-[13px] text-ink">
                  {m.status === 'processing' ? 'Qayta ishlanmoqda…' : m.kind === 'video' ? 'Video' : 'Rasm'}
                </span>
              )}
              {m.kind === 'video' && m.thumb_url && (
                <Play className="absolute inset-0 m-auto h-7 w-7 fill-surface text-surface drop-shadow" aria-hidden="true" />
              )}
            </button>
            {m.id === coverId && (
              <span className="pointer-events-none absolute bottom-1 left-1 rounded-md bg-ink/80 px-1.5 text-[13px] font-semibold text-surface">
                Muqova
              </span>
            )}
            {m.status === 'failed' && (
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-danger px-1 text-[13px] text-surface">
                Xato
              </span>
            )}
            <button
              type="button"
              {...gestureHandlers(m.id, true)}
              onKeyDown={(e) => {
                const delta = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
                if (delta) {
                  e.preventDefault();
                  moveBy(m.id, delta);
                }
              }}
              aria-label={`${label(m, i)}ni koʻchirish. Chap yoki oʻng strelka tugmasini bosing.`}
              className="absolute left-0 top-0 flex min-h-touch min-w-touch cursor-grab touch-none items-start justify-start p-1 active:cursor-grabbing"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface/90 text-ink">
                <GripVertical className="h-5 w-5" aria-hidden="true" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => remove.mutate(m.id)}
              disabled={remove.isPending}
              aria-label={`${label(m, i)}ni oʻchirish`}
              className="absolute right-0 top-0 flex min-h-touch min-w-touch items-start justify-end p-1"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface/90 text-danger">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {reorder.isPending && (
        <p role="status" className="text-[13px] text-ink-muted">
          Tartib saqlanmoqda…
        </p>
      )}
      <MediaLightbox
        items={viewable}
        alt={auction.title || 'Eʼlon'}
        openAt={viewerAt}
        onClose={() => setViewerAt(null)}
      />
    </div>
  );
};
