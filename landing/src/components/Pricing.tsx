"use client";

import React from "react";
import { Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { PublicConfig } from "@/api/http";
import { fill } from "@/lib/i18n";
import { commissionFor, formatRate, formatSom } from "@/lib/format";
import { Section, SectionTitle } from "./ui";

const EXAMPLE_PRICE = 20_000_000;

const Plan: React.FC<{
  title: string;
  value: string;
  desc: string;
  points: string[];
  footnote?: string;
}> = ({ title, value, desc, points, footnote }) => (
  <article className="flex flex-col rounded-2xl border border-line bg-surface p-6 sm:p-8">
    <h3 className="text-[17px] font-semibold text-ink-muted">{title}</h3>
    <p className="mt-2 font-display text-[40px] leading-none tabular-nums">{value}</p>
    <p className="mt-2 text-[15px] text-ink-muted">{desc}</p>
    <ul className="mt-6 space-y-3">
      {points.map((point) => (
        <li key={point} className="flex items-start gap-2.5 text-[15px]">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          <span>{point}</span>
        </li>
      ))}
    </ul>
    {footnote && <p className="mt-6 rounded-xl bg-page p-4 text-[15px]">{footnote}</p>}
  </article>
);

export const Pricing: React.FC<{ config: PublicConfig | null }> = ({ config }) => {
  const { t } = useLanguage();
  const rate = config?.commission_rate_bp;

  return (
    <Section id="pricing" tone="surface" labelledBy="pricing-title">
      <SectionTitle id="pricing-title" subtitle={t.pricing.subtitle}>
        {t.pricing.title}
      </SectionTitle>
      <div className="grid gap-4 md:grid-cols-2">
        <Plan
          title={t.pricing.sellerTitle}
          value={rate != null ? formatRate(rate) : t.pricing.sellerValueNoRate}
          desc={t.pricing.sellerDesc}
          points={t.pricing.sellerPoints}
          footnote={
            rate != null
              ? fill(config?.cashback_pct ? t.pricing.exampleCashback : t.pricing.example, {
                  price: formatSom(EXAMPLE_PRICE, t),
                  fee: formatSom(commissionFor(EXAMPLE_PRICE, rate), t),
                  // Same rounding as wallet.services.cashback_for (BR-47): down to whole som.
                  cashback: formatSom(
                    Math.floor((commissionFor(EXAMPLE_PRICE, rate) * (config?.cashback_pct ?? 0)) / 100),
                    t,
                  ),
                })
              : undefined
          }
        />
        <Plan
          title={t.pricing.buyerTitle}
          value={t.pricing.buyerValue}
          desc={t.pricing.buyerDesc}
          points={t.pricing.buyerPoints}
        />
      </div>
    </Section>
  );
};
