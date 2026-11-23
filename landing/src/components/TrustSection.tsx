"use client";

import React from "react";
import { Camera, EyeOff, Flag, RotateCcw, ShieldCheck, Star } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Section, SectionTitle } from "./ui";

const ICONS = [Camera, ShieldCheck, EyeOff, Star, Flag, RotateCcw];

export const TrustSection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <Section labelledBy="trust-title">
      <SectionTitle id="trust-title">{t.trust.title}</SectionTitle>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {t.trust.items.map((item, i) => {
          const Icon = ICONS[i] ?? ShieldCheck;
          return (
            <li key={item.title} className="flex gap-4 rounded-2xl border border-line bg-surface p-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft">
                <Icon className="h-5 w-5 text-brand" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-[17px] font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">{item.text}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
};
