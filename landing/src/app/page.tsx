import React from "react";
import { load, type AuctionCard, type PublicConfig, type Region } from "@/api/http";
import type { components } from "@/api/schema";
import { dictionaries } from "@/lib/i18n";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { AuctionsSection } from "@/components/AuctionsSection";
import { ProblemSection } from "@/components/ProblemSection";
import { HowItWorks } from "@/components/HowItWorks";
import { TrustSection } from "@/components/TrustSection";
import { Pricing } from "@/components/Pricing";
import { Faq } from "@/components/Faq";
import { faqItems } from "@/lib/faq";
import { ContactForm } from "@/components/ContactForm";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";

// Live data from api.zotdor.uz, re-fetched at most once a minute (ISR).
export const revalidate = 60;

type AuctionPage = components["schemas"]["PaginatedAuctionList"];

export default async function HomePage() {
  const [config, regions, auctionPage] = await Promise.all([
    load<PublicConfig>("/config", 300),
    load<Region[]>("/reference/regions", 3600),
    load<AuctionPage>("/auctions?status=all_open&limit=6", 60),
  ]);
  const cfg = config.ok ? config.data : null;
  const auctions = auctionPage.ok
    ? { ok: true as const, data: auctionPage.data.results as AuctionCard[] }
    : { ok: false as const };

  // FAQ rich results for search engines, in the default (Latin) script.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems(dictionaries.latn, cfg).map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Header />
      <main id="main">
        <Hero config={cfg} />
        <AuctionsSection auctions={auctions} />
        <ProblemSection />
        <HowItWorks config={cfg} />
        <TrustSection />
        <Pricing config={cfg} />
        <Faq config={cfg} />
        <ContactForm regions={regions} />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
