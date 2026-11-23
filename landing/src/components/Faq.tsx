"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { PublicConfig } from "@/api/http";
import { faqItems } from "@/lib/faq";
import { Section, SectionTitle } from "./ui";

export const Faq: React.FC<{ config: PublicConfig | null }> = ({ config }) => {
  const { t } = useLanguage();

  return (
    <Section id="faq" tone="soft" labelledBy="faq-title">
      <SectionTitle id="faq-title">{t.faq.title}</SectionTitle>
      <div className="max-w-3xl space-y-3">
        {faqItems(t, config).map((item) => (
          <details key={item.q} className="group rounded-2xl border border-line bg-surface">
            <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDown
                className="h-5 w-5 shrink-0 text-brand transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="px-5 pb-5 text-[15px] leading-relaxed text-ink-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
};
