import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Play, Volume2, VolumeX } from 'lucide-react';
import { mediaUrl } from '../../api/http';
import type { components } from '../../api/schema';

export type Media = components['schemas']['Media'];

/**
 * Swipeable gallery (CSS scroll-snap, so swiping is native and smooth on phones) with arrow
 * buttons on both sides, a counter and dots. The visible video plays by itself, muted and
 * looped, like an Instagram feed; it pauses when swiped away, scrolled off screen or when the
 * tab is hidden. Sound is one tap away and the choice is kept for the session.
 */

// Sound preference for this tab, shared by every carousel and the full-screen viewer.
let soundOn = false;

function saveData(): boolean {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(conn?.saveData);
}

interface CarouselProps {
  items: Media[];
  alt: string;
  index: number;
  onIndexChange: (index: number) => void;
  /** Full-screen viewer: a tap on a video pauses it instead of toggling sound. */
  fullscreen?: boolean;
  /** Inline: open the full-screen viewer at this slide. */
  onOpen?: (index: number) => void;
  className?: string;
}

export const MediaCarousel: React.FC<CarouselProps> = ({
  items,
  alt,
  index,
  onIndexChange,
  fullscreen = false,
  onOpen,
  className = '',
}) => {
  const track = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(fullscreen);
  const [muted, setMuted] = useState(!soundOn);
  const last = items.length - 1;
  const current = Math.min(Math.max(index, 0), last);

  // Only a carousel that is actually on screen plays.
  useEffect(() => {
    const el = root.current;
    if (fullscreen || !el || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [fullscreen]);

  // Swipe -> index, as soon as the next slide is more than half in view.
  const onScroll = () => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== current && i >= 0 && i <= last) onIndexChange(i);
  };

  // Index -> scroll position (arrows, thumbnails, keyboard).
  const mounted = useRef(false);
  useEffect(() => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    if (!mounted.current) {
      // Opening the viewer at slide N: jump there without animating through the others.
      mounted.current = true;
      el.scrollLeft = current * el.clientWidth;
      return;
    }
    if (Math.round(el.scrollLeft / el.clientWidth) !== current) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo({ left: current * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    }
  }, [current]);

  const go = useCallback((i: number) => onIndexChange(Math.min(Math.max(i, 0), last)), [last, onIndexChange]);

  const toggleMute = () =>
    setMuted((m) => {
      soundOn = m;
      return !m;
    });

  return (
    <div
      ref={root}
      role="region"
      aria-roledescription="karusel"
      aria-label={alt}
      className={`relative ${className}`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          go(current + (e.key === 'ArrowLeft' ? -1 : 1));
        }
      }}
    >
      <div
        ref={track}
        onScroll={onScroll}
        className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {items.map((m, i) => (
          <div
            key={m.id}
            role="group"
            aria-roledescription="slayd"
            aria-label={`${i + 1} / ${items.length}`}
            aria-hidden={i !== current}
            className="relative h-full w-full shrink-0 snap-center snap-always"
          >
            {m.kind === 'video' ? (
              <VideoSlide
                media={m}
                active={i === current}
                playing={i === current && visible}
                muted={muted}
                fullscreen={fullscreen}
                onToggleMute={toggleMute}
                onOpen={onOpen ? () => onOpen(i) : undefined}
              />
            ) : onOpen ? (
              <button
                type="button"
                tabIndex={i === current ? 0 : -1}
                onClick={() => onOpen(i)}
                aria-label={`Rasmni kattalashtirish, ${i + 1} / ${items.length}`}
                className="block h-full w-full cursor-zoom-in"
              >
                <Photo media={m} alt={alt} eager={i === 0} />
              </button>
            ) : (
              <Photo media={m} alt={alt} eager={Math.abs(i - current) <= 1} />
            )}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <>
          <Arrow side="left" hidden={current === 0} onClick={() => go(current - 1)} />
          <Arrow side="right" hidden={current === last} onClick={() => go(current + 1)} />
          <p className="pointer-events-none absolute right-3 top-3 rounded-full bg-ink/70 px-2.5 py-0.5 text-[13px] font-semibold text-surface tabular-nums">
            {current + 1} / {items.length}
          </p>
          {items.length <= 12 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden="true">
              {items.map((m, i) => (
                <span
                  key={m.id}
                  className={`h-1.5 rounded-full bg-surface shadow transition-all ${i === current ? 'w-4' : 'w-1.5 opacity-60'}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const Arrow: React.FC<{ side: 'left' | 'right'; hidden: boolean; onClick: () => void }> = ({ side, hidden, onClick }) => {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={hidden ? -1 : 0}
      aria-hidden={hidden}
      aria-label={side === 'left' ? 'Oldingi' : 'Keyingi'}
      className={`absolute top-1/2 z-10 flex min-h-touch min-w-touch -translate-y-1/2 items-center justify-center transition-opacity ${side === 'left' ? 'left-1' : 'right-1'} ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink shadow-md">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
    </button>
  );
};

const Photo: React.FC<{ media: Media; alt: string; eager: boolean }> = ({ media, alt, eager }) => (
  <img
    src={mediaUrl(media.url || media.thumb_url)}
    alt={alt}
    loading={eager ? 'eager' : 'lazy'}
    decoding="async"
    draggable={false}
    className="h-full w-full select-none object-contain"
  />
);

const VideoSlide: React.FC<{
  media: Media;
  active: boolean;
  playing: boolean;
  muted: boolean;
  fullscreen: boolean;
  onToggleMute: () => void;
  onOpen?: () => void;
}> = ({ media, active, playing, muted, fullscreen, onToggleMute, onOpen }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(true);
  const [progress, setProgress] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(() => document.hidden);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // A video swiped away forgets the user's pause, so it plays again when it comes back.
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) setUserPaused(false);
  }

  // Muted autoplay is allowed by every mobile browser. With "data saver" on, the video waits
  // for a tap instead of downloading by itself.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing && !tabHidden && !userPaused && !saveData()) v.play().catch(() => setPaused(true));
    else v.pause();
  }, [playing, tabHidden, userPaused]);

  const togglePlay = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      setUserPaused(false);
      v.play().catch(() => setPaused(true));
    } else {
      setUserPaused(true);
      v.pause();
    }
  };

  const tapLabel = paused ? 'Videoni ijro etish' : fullscreen ? 'Pauza' : muted ? 'Ovozni yoqish' : 'Ovozni oʻchirish';

  return (
    <div className="relative h-full w-full bg-ink">
      <video
        ref={ref}
        src={mediaUrl(media.url)}
        poster={mediaUrl(media.thumb_url) || undefined}
        muted={muted}
        loop
        playsInline
        preload={active ? 'auto' : 'metadata'}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration) setProgress(v.currentTime / v.duration);
        }}
        className="h-full w-full object-contain"
      />
      {/* Tap: inline it toggles sound (Instagram feed), in the viewer it pauses. */}
      <button
        type="button"
        tabIndex={active ? 0 : -1}
        onClick={paused || fullscreen ? togglePlay : onToggleMute}
        aria-label={tapLabel}
        className="absolute inset-0 flex items-center justify-center"
      >
        {paused && (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink/60 text-surface">
            <Play className="h-8 w-8 translate-x-0.5 fill-current" aria-hidden="true" />
          </span>
        )}
      </button>
      <button
        type="button"
        tabIndex={active ? 0 : -1}
        onClick={onToggleMute}
        aria-label={muted ? 'Ovozni yoqish' : 'Ovozni oʻchirish'}
        aria-pressed={!muted}
        className="absolute bottom-5 right-2 flex min-h-touch min-w-touch items-center justify-center"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-surface">
          {muted ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
        </span>
      </button>
      {onOpen && (
        <button
          type="button"
          tabIndex={active ? 0 : -1}
          onClick={onOpen}
          aria-label="Toʻliq ekranda koʻrish"
          className="absolute left-2 top-2 flex min-h-touch min-w-touch items-center justify-center"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-surface">
            <Maximize2 className="h-5 w-5" aria-hidden="true" />
          </span>
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-surface/30" aria-hidden="true">
        <div className="h-full bg-surface" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
};
