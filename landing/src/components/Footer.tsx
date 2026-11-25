"use client";

import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { SITE_URL, siteUrl } from "@/api/http";
import { fill } from "@/lib/i18n";
import { CONTACTS } from "@/lib/contacts";
import { Container } from "./ui";

export const Footer: React.FC = () => {
  const { t, toggle } = useLanguage();
  const links = [
    { href: SITE_URL, label: `${t.footer.site}: ${SITE_URL.replace(/^https?:\/\//, "")}` },
    { href: CONTACTS.channel, label: t.footer.channel, external: true },
    { href: CONTACTS.bot, label: t.footer.bot, external: true },
    { href: `tel:${CONTACTS.phone}`, label: `${t.footer.phone}: ${CONTACTS.phoneLabel}` },
  ];

  return (
    <footer className="border-t border-line bg-page py-10">
      <Container className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-display text-[24px]">
            Zotdor<span className="text-brand">.uz</span>
          </p>
          <p className="mt-1 text-[15px] text-ink-muted">{t.footer.tagline}</p>
        </div>
        <ul className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-6">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="inline-flex min-h-touch items-center text-[15px] font-medium text-ink hover:text-brand"
                {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={toggle}
              aria-label={t.nav.switchLabel}
              className="inline-flex min-h-touch items-center text-[15px] font-medium text-brand hover:text-ink"
            >
              {t.nav.switchTo}
            </button>
          </li>
        </ul>
      </Container>
      <Container>
        <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-ink-muted">{fill(t.footer.rights, { year: new Date().getFullYear() })}</p>
          <nav aria-label={t.footer.legal}>
            <ul className="flex flex-wrap gap-x-5">
              {(["terms", "privacy", "offer"] as const).map((slug) => (
                <li key={slug}>
                  <a
                    href={siteUrl(`/${slug}`)}
                    className="inline-flex min-h-touch items-center text-[13px] font-medium text-ink-muted hover:text-ink"
                  >
                    {t.footer[slug]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </Container>
    </footer>
  );
};
