"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { siteUrl, type PublicConfig } from "@/api/http";
import { fill } from "@/lib/i18n";
import { formatRate } from "@/lib/format";
import { ButtonLink, Container } from "./ui";

/* eslint-disable @next/next/no-img-element -- static local photos, already compressed webp */

export const Hero: React.FC<{ config: PublicConfig | null }> = ({ config }) => {
  const { t } = useLanguage();
  const facts = [
    config
      ? fill(t.hero.factCommission, { rate: formatRate(config.commission_rate_bp) })
      : t.hero.factCommissionNoRate,
    t.hero.factBuyer,
    t.hero.factContacts,
  ];

  return (
    <section id="top" className="border-b border-line bg-page py-12 sm:py-16 lg:py-20">
      <Container className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-[15px] font-semibold uppercase tracking-wide text-brand">{t.hero.eyebrow}</p>
          <h1 className="mt-3 font-display text-[40px] leading-[1.05] sm:text-[56px] lg:text-[64px]">
            {t.hero.title}
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-muted sm:text-[20px]">
            {t.hero.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={siteUrl()}>{t.hero.primary}</ButtonLink>
            <ButtonLink href={siteUrl("/sell")} variant="secondary">
              {t.hero.secondary}
            </ButtonLink>
          </div>
          <ul className="mt-8 space-y-2.5">
            {facts.map((fact) => (
              <li key={fact} className="flex items-start gap-2.5 text-[15px] font-medium">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-5 grid-rows-2 gap-3 sm:gap-4 h-[320px] sm:h-[440px]">
          <img
            src="/image0.webp"
            alt={t.hero.photoAlt}
            className="col-span-3 row-span-2 h-full w-full rounded-2xl border border-line object-cover"
            fetchPriority="high"
          />
          <img
            src="/image3.webp"
            alt={t.hero.photoAlt2}
            className="col-span-2 h-full w-full rounded-2xl border border-line object-cover"
          />
          <img
            src="/images.webp"
            alt={t.hero.photoAlt3}
            className="col-span-2 h-full w-full rounded-2xl border border-line object-cover"
          />
        </div>
      </Container>
    </section>
  );
};
