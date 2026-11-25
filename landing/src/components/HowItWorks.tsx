"use client";

import React, { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { siteUrl, type PublicConfig } from "@/api/http";
import { fill } from "@/lib/i18n";
import { formatDuration } from "@/lib/format";
import { ButtonLink, Section, SectionTitle } from "./ui";

type Side = "seller" | "buyer";

export const HowItWorks: React.FC<{ config: PublicConfig | null }> = ({ config }) => {
  const { t } = useLanguage();
  const [side, setSide] = useState<Side>("seller");

  // Steps that quote admin-editable limits only show the numbers when /config loaded.
  const values = config
    ? {
        min: formatDuration(config.min_duration_min, t),
        max: formatDuration(config.max_duration_min, t),
        minPct: config.min_bid_pct,
      }
    : null;
  const steps = (side === "seller" ? t.how.seller : t.how.buyer).map((s) => ({
    title: s.title,
    text: values ? fill(s.text, values) : s.plain || s.text,
  }));

  const tabs: { key: Side; label: string }[] = [
    { key: "seller", label: t.how.sellerTab },
    { key: "buyer", label: t.how.buyerTab },
  ];

  return (
    <Section id="how" tone="soft" labelledBy="how-title">
      <SectionTitle id="how-title">{t.how.title}</SectionTitle>

      <div role="tablist" aria-label={t.how.title} className="mb-8 inline-flex rounded-full border border-line bg-surface p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`how-tab-${tab.key}`}
            aria-selected={side === tab.key}
            aria-controls="how-panel"
            onClick={() => setSide(tab.key)}
            className={`min-h-touch rounded-full px-5 text-[15px] font-semibold transition-colors ${
              side === tab.key ? "bg-ink text-page" : "text-ink-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ol id="how-panel" role="tabpanel" aria-labelledby={`how-tab-${side}`} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <li key={step.title} className="rounded-2xl border border-line bg-surface p-6">
            <span className="font-display text-[32px] leading-none text-brand tabular-nums">{i + 1}</span>
            <h3 className="mt-3 text-[17px] font-semibold">{step.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{step.text}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        <ButtonLink href={siteUrl(side === "seller" ? "/sell" : "/")} variant="secondary">
          {t.how.cta}
        </ButtonLink>
      </div>
    </Section>
  );
};
