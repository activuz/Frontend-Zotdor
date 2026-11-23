"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_SCRIPT, dictionaries, type Dict, type Script } from "@/lib/i18n";
import { toCyrillic } from "@/lib/transliterate";

interface LanguageContextValue {
  script: Script;
  t: Dict;
  toggle: () => void;
  /** Transliterates server data (region names, auction titles) to the current script. */
  tr: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const STORAGE_KEY = "zotdor_script";

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Server HTML is always Latin; a saved choice is applied after mount to avoid a hydration mismatch.
  const [script, setScript] = useState<Script>(DEFAULT_SCRIPT);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "cyrl") setScript("cyrl");
    } catch {
      // Storage unavailable (private mode): keep the default.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = script === "cyrl" ? "uz-Cyrl" : "uz";
  }, [script]);

  const toggle = useCallback(() => {
    setScript((prev) => {
      const next: Script = prev === "latn" ? "cyrl" : "latn";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      script,
      t: dictionaries[script],
      toggle,
      tr: (text: string) => (script === "cyrl" ? toCyrillic(text) : text),
    }),
    [script, toggle],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
