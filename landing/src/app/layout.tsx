import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";

const display = DM_Serif_Display({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});
const sans = Inter({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-sans", display: "swap" });

const TITLE = "Zotdor.uz — chorva mollari auksioni";
const DESCRIPTION =
  "Chorvangizni auksionda soting: narx va vaqtni siz belgilaysiz, xaridorlar taklif beradi, gʻolibni oʻzingiz tanlaysiz. Komissiya faqat mol sotilganda, xaridor uchun bepul.";

export const viewport: Viewport = {
  themeColor: "#eef2dc",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_LANDING_URL || "https://zotdor.uz"),
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["Zotdor", "chorva auksioni", "chorva bozori", "qoramol sotish", "qoʻy sotish", "buqa narxi"],
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    siteName: "Zotdor.uz",
    locale: "uz_UZ",
    type: "website",
  },
  // og:image comes from src/app/opengraph-image.tsx.
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  icons: { icon: "/favicon.webp", apple: "/favicon.webp" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz" className={`${display.variable} ${sans.variable}`}>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
