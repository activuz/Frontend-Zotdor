"use client";

import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { siteUrl } from "@/api/http";
import { Container } from "./ui";

export const FinalCta: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section aria-labelledby="final-title" className="bg-ink py-14 sm:py-16 text-page">
      <Container className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <h2 id="final-title" className="font-display text-[32px] leading-tight sm:text-[40px]">
            {t.finalCta.title}
          </h2>
          <p className="mt-2 text-[17px] text-brand-soft">{t.finalCta.text}</p>
        </div>
        <a
          href={siteUrl()}
          className="inline-flex min-h-touch shrink-0 items-center rounded-full bg-accent px-7 text-[17px] font-semibold text-ink hover:bg-brand-soft"
        >
          {t.nav.openSite}
        </a>
      </Container>
    </section>
  );
};
