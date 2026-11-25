import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ImageOff, MapPin, PlayCircle, Users } from 'lucide-react';
import { mediaUrl } from '../../api/http';
import { formatDateTime, formatKm, formatSom } from '../../lib/format';
import type { AuctionList } from './api';
import { Countdown } from './Countdown';
import { STATUS_LABEL, STATUS_TONE } from './labels';

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const AuctionCard: React.FC<{ auction: AuctionList; to?: string }> = ({ auction: a, to }) => {
  // Hover (mouse) or keyboard focus plays the attached video, muted. The file is requested only
  // then, so a feed of cards does not download every video. Touch devices keep the photo.
  const [playing, setPlaying] = useState(false);
  const video = a.preview_video;
  const start = () => {
    if (video && !reducedMotion()) setPlaying(true);
  };
  const stop = () => setPlaying(false);
  const status = a.status ?? 'draft';
  const place = [a.district?.name, a.region?.name].filter(Boolean).join(', ');
  const km = formatKm(a.distance_km);
  const top = a.top_bid_amount ?? null;

  return (
    <Link
      to={to ?? `/a/${a.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface hover:shadow-md"
      onPointerEnter={(e) => e.pointerType === 'mouse' && start()}
      onPointerLeave={stop}
      onFocus={start}
      onBlur={stop}
    >
      <div className="relative aspect-[4/3] bg-page">
        {a.cover ? (
          <img
            src={mediaUrl(a.cover.thumb_url || a.cover.url)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-muted">
            <ImageOff className="w-8 h-8" aria-hidden="true" />
          </div>
        )}
        {video && playing && (
          <video
            src={mediaUrl(video.url)}
            poster={video.poster_url ? mediaUrl(video.poster_url) : undefined}
            muted
            loop
            autoPlay
            playsInline
            preload="auto"
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {video && !playing && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-ink/80 px-2 py-0.5 text-[13px] font-semibold text-surface">
            <PlayCircle className="w-4 h-4" aria-hidden="true" />
            Video
          </span>
        )}
        <span
          className={`absolute left-2 top-2 rounded-lg px-2 py-0.5 text-[13px] font-semibold ${STATUS_TONE[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-[15px] font-semibold text-ink line-clamp-2">{a.title || 'Nomsiz eʼlon'}</p>
        <p className="text-[13px] text-ink-muted">
          {[a.age_label, a.weight_kg ? `${a.weight_is_estimated ? '~' : ''}${a.weight_kg} kg` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="mt-auto pt-2">
          <p className="text-[13px] text-ink-muted">{top ? 'Eng yuqori taklif' : 'Sotuvchi narxi'}</p>
          <p className="font-display text-[20px] leading-tight text-ink tabular-nums">
            {formatSom(top ?? a.asking_price ?? 0)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
          {status === 'live' && a.ends_at && (
            <span>
              Tugashiga <Countdown to={a.ends_at} className="font-semibold text-ink" />
            </span>
          )}
          {status === 'scheduled' && a.starts_at && <span>Boshlanadi: {formatDateTime(a.starts_at)}</span>}
          {(a.bidders_count ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="w-4 h-4" aria-hidden="true" />
              {a.bidders_count} xaridor
            </span>
          )}
        </div>
        {place && (
          <p className="inline-flex items-center gap-1 text-[13px] text-ink-muted">
            <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {place}
              {km && ` · ${km}`}
            </span>
          </p>
        )}
      </div>
    </Link>
  );
};

export const AuctionGrid: React.FC<{ items: AuctionList[] }> = ({ items }) => (
  <ul className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
    {items.map((a) => (
      <li key={a.id} className="flex">
        <AuctionCard auction={a} />
      </li>
    ))}
  </ul>
);
