"use client";

import React from "react";
import { Languages } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { siteUrl } from "@/api/http";
import { Container, buttonClass } from "./ui";

export const Header: React.FC = () => {
  const { t, toggle } = useLanguage();
  const links = [
    { href: "#how", label: t.nav.how },
    { href: "#auctions", label: t.nav.auctions },
    { href: "#pricing", label: t.nav.pricing },
    { href: "#faq", label: t.nav.faq },
    { href: "#contact", label: t.nav.contact },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2"
      >
        {t.meta.skip}
      </a>
      <Container className="flex h-16 items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-2.5 shrink-0" aria-label="Zotdor.uz">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.webp" alt="" width={36} height={36} className="h-9 w-9 rounded-full" />
          <span className="font-display text-[24px] leading-none">
            Zotdor<span className="text-brand">.uz</span>
          </span>
        </a>

        <nav aria-label={t.nav.how} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-full px-3 py-2 text-[15px] font-medium text-ink-muted hover:bg-brand-soft hover:text-ink"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={t.nav.switchLabel}
            className="inline-flex min-h-touch items-center gap-1.5 rounded-full px-3 text-[15px] font-semibold text-ink hover:bg-brand-soft"
          >
            <Languages className="h-4 w-4" aria-hidden="true" />
            {t.nav.switchTo}
          </button>
          <a href={siteUrl()} className={buttonClass("secondary", "hidden sm:inline-flex px-5")}>
            {t.nav.openSite}
          </a>
        </div>
      </Container>
    </header>
  );
};
