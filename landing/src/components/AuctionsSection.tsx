"use client";

import React, { useState } from "react";
import { ArrowRight, ImageOff, MapPin, PlayCircle, Users } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { mediaUrl, siteUrl, type AuctionCard, type Loaded } from "@/api/http";
import { fill } from "@/lib/i18n";
import { formatDateTime, formatSom, groupDigits } from "@/lib/format";
import { ButtonLink, Section, SectionTitle } from "./ui";

const Card: React.FC<{ a: AuctionCard }> = ({ a }) => {
  const { t, tr } = useLanguage();
  // Mouse hover or keyboard focus plays the attached video (muted); loaded only then.
  const [playing, setPlaying] = useState(false);
  const video = a.preview_video;
  const start = () => {
    if (video && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(true);
  };
  const stop = () => setPlaying(false);
  const live = a.status === "live";
  const time = live ? a.ends_at : a.starts_at;
  const place = [a.region?.name, a.district?.name].filter(Boolean).join(", ");
  const weight =
    a.weight_kg != null
      ? fill(a.weight_is_estimated ? t.auctions.weightApprox : t.auctions.weight, { kg: groupDigits(a.weight_kg) })
      : null;

  return (
    <li>
      <a
        href={siteUrl(`/a/${a.id}`)}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-md"
        onPointerEnter={(e) => e.pointerType === "mouse" && start()}
        onPointerLeave={stop}
        onFocus={start}
        onBlur={stop}
      >
        <div className="relative aspect-[4/3] bg-brand-soft">
          {a.cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- thumbnails are already resized by the API
            <img
              src={mediaUrl(a.cover.thumb_url)}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-muted">
              <ImageOff className="h-6 w-6" aria-hidden="true" />
              <span className="text-[13px]">{t.auctions.noPhoto}</span>
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
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {video && !playing && (
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-[13px] font-semibold text-page">
              <PlayCircle className="h-4 w-4" aria-hidden="true" />
              {t.auctions.video}
            </span>
          )}
          <span
            className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[13px] font-semibold ${
              live ? "bg-ink text-page" : "bg-surface text-ink border border-line"
            }`}
          >
            {live ? t.auctions.live : t.auctions.scheduled}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <h3 className="text-[17px] font-semibold leading-snug group-hover:text-brand">{tr(a.title ?? "")}</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-muted">
            {place && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {tr(place)}
              </span>
            )}
            {weight && <span>{weight}</span>}
            {!!a.bidders_count && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {fill(t.auctions.bidders, { count: a.bidders_count })}
              </span>
            )}
          </div>
          <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-line pt-3">
            <div>
              <dt className="text-[13px] text-ink-muted">{t.auctions.askingPrice}</dt>
              <dd className="font-display text-[20px] tabular-nums">
                {a.asking_price != null ? formatSom(a.asking_price, t) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-ink-muted">{t.auctions.topBid}</dt>
              <dd className={`tabular-nums ${a.top_bid_amount ? "font-display text-[20px] text-bid-1" : "pt-1 text-[15px] text-ink-muted"}`}>
                {a.top_bid_amount ? formatSom(a.top_bid_amount, t) : t.auctions.noBids}
              </dd>
            </div>
          </dl>
          {time && (
            <p className="text-[13px] font-medium tabular-nums text-ink-muted">
              {fill(live ? t.auctions.endsAt : t.auctions.startsAt, { time: formatDateTime(time, t) })}
            </p>
          )}
        </div>
      </a>
    </li>
  );
};

export const AuctionsSection: React.FC<{ auctions: Loaded<AuctionCard[]> }> = ({ auctions }) => {
  const { t } = useLanguage();

  return (
    <Section id="auctions" tone="surface" labelledBy="auctions-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionTitle id="auctions-title" subtitle={t.auctions.subtitle}>
          {t.auctions.title}
        </SectionTitle>
        {auctions.ok && auctions.data.length > 0 && (
          <a href={siteUrl()} className="mb-8 sm:mb-10 inline-flex min-h-touch items-center gap-1.5 text-[15px] font-semibold text-brand">
            {t.auctions.viewAll}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>

      {!auctions.ok && (
        <div role="alert" className="rounded-2xl border border-line bg-page p-6 text-center">
          <p className="text-[17px]">{t.auctions.error}</p>
          <ButtonLink href={siteUrl()} variant="secondary" className="mt-4">
            {t.auctions.errorCta}
          </ButtonLink>
        </div>
      )}

      {auctions.ok && auctions.data.length === 0 && (
        <div className="rounded-2xl border border-line bg-page p-6 text-center">
          <p className="text-[17px]">{t.auctions.empty}</p>
          <ButtonLink href={siteUrl("/sell")} variant="secondary" className="mt-4">
            {t.auctions.emptyCta}
          </ButtonLink>
        </div>
      )}

      {auctions.ok && auctions.data.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {auctions.data.map((a) => (
            <Card key={a.id} a={a} />
          ))}
        </ul>
      )}
    </Section>
  );
};
