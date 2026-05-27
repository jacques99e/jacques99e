"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { t as translate, languages } from "@/i18n";
import { localLang } from "@/lib/db";
import type { Language } from "@/types";

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
  languages: typeof languages;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("fr");

  useEffect(() => {
    const saved = localLang.get() as Language;
    if (saved) setLangState(saved);
  }, []);

  const setLang = (l: Language) => {
    setLangState(l);
    localLang.set(l);
  };

  const t = (key: string) => translate(key, lang);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, languages }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
