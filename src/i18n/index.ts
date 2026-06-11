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

export function t(
  key: string,
  lang: Language = "fr",
  vars?: Record<string, string | number>
): string {
  let text = dictionaries[lang]?.[key] ?? dictionaries.fr[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return text;
}

export { dictionaries };
