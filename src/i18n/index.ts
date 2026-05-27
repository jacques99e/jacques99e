import type { Language } from "@/types";
import fr from "./fr.json";
import en from "./en.json";
import sw from "./sw.json";
import wo from "./wo.json";

const dictionaries: Record<Language, Record<string, string>> = {
  fr: fr as Record<string, string>,
  en: en as Record<string, string>,
  sw: sw as Record<string, string>,
  wo: wo as Record<string, string>,
};

export const languages: { code: Language; label: string }[] = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "sw", label: "Kiswahili" },
  { code: "wo", label: "Wolof" },
];

export function t(key: string, lang: Language = "fr"): string {
  return dictionaries[lang]?.[key] ?? dictionaries.fr[key] ?? key;
}

export { dictionaries };
