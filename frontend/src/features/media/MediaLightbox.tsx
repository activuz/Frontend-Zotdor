import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { mediaUrl } from '../../api/http';
import { MediaCarousel, type Media } from './MediaCarousel';

/**
 * Full-screen viewer over the page: swipe or arrows, thumbnails, Escape or ✕ closes and hands
 * the last slide back, so the page gallery stays in sync. A native <dialog>, so focus is
 * trapped and returns to the opener (DESIGN.md §4).
 */
export const MediaLightbox: React.FC<{
  items: Media[];
  alt: string;
  /** null = closed. */
  openAt: number | null;
  onClose: (lastIndex: number) => void;
}> = ({ items, alt, openAt, onClose }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const open = openAt !== null && items.length > 0;
  const [index, setIndex] = useState(openAt ?? 0);
  const [openedAt, setOpenedAt] = useState(openAt);
  if (openedAt !== openAt) {
    setOpenedAt(openAt);
    if (openAt !== null) setIndex(openAt);
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={`${alt}: rasmlar va video`}
      onCancel={(e) => {
        e.preventDefault(); // Escape: close through React state
        onClose(index);
      }}
      className="m-0 h-[100dvh] max-h-none w-full max-w-none bg-ink p-0 text-surface"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 px-2 py-1">
            <p className="truncate px-2 text-[15px] font-semibold">{alt}</p>
            <button
              type="button"
              onClick={() => onClose(index)}
              aria-label="Yopish"
              className="min-h-touch min-w-touch flex items-center justify-center rounded-xl"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <MediaCarousel
            key={openAt}
            items={items}
            alt={alt}
            index={index}
            onIndexChange={setIndex}
            fullscreen
            className="min-h-0 flex-1"
          />
          {items.length > 1 && (
            <ul className="no-scrollbar flex gap-2 overflow-x-auto p-3 sm:justify-center" aria-label="Fayllar">
              {items.map((m, i) => (
                <li key={m.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`${m.kind === 'video' ? 'Video' : 'Rasm'} ${i + 1}`}
                    aria-current={i === index}
                    className={`block h-14 w-14 overflow-hidden rounded-lg border-2 ${i === index ? 'border-surface' : 'border-transparent opacity-60'}`}
                  >
                    <Thumb media={m} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </dialog>
  );
};

export const Thumb: React.FC<{ media: Media }> = ({ media }) =>
  media.thumb_url ? (
    <img src={mediaUrl(media.thumb_url)} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
  ) : (
    <span className="flex h-full w-full items-center justify-center bg-page text-[13px] text-ink">
      {media.kind === 'video' ? 'Video' : 'Rasm'}
    </span>
  );
