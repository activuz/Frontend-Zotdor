"use client";

import React from "react";
import { Clock, HandCoins, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Section, SectionTitle } from "./ui";

const ICONS = [HandCoins, Clock, ShieldAlert];

export const ProblemSection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <Section labelledBy="problem-title">
      <SectionTitle id="problem-title">{t.problem.title}</SectionTitle>
      <ul className="grid gap-4 md:grid-cols-3">
        {t.problem.items.map((item, i) => {
          const Icon = ICONS[i] ?? ShieldAlert;
          return (
            <li key={item.title} className="rounded-2xl border border-line bg-surface p-6">
              <Icon className="h-7 w-7 text-brand" aria-hidden="true" />
              <h3 className="mt-4 text-[20px] font-semibold leading-snug">{item.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{item.text}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
};
