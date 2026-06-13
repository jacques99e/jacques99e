export interface PhoneCountry {
  iso: string;
  name: string;
  dial: string;
  /** Exemple national sans indicatif */
  example: string;
}

/** Pays cibles Wazo Digital (Afrique de l'Ouest / Centrale + voisins). */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "SN", name: "Sénégal", dial: "+221", example: "77 123 45 67" },
  { iso: "CI", name: "Côte d'Ivoire", dial: "+225", example: "07 00 00 00 00" },
  { iso: "ML", name: "Mali", dial: "+223", example: "65 00 00 00" },
  { iso: "BF", name: "Burkina Faso", dial: "+226", example: "70 00 00 00" },
  { iso: "BJ", name: "Bénin", dial: "+229", example: "90 00 00 00" },
  { iso: "TG", name: "Togo", dial: "+228", example: "90 00 00 00" },
  { iso: "NE", name: "Niger", dial: "+227", example: "90 00 00 00" },
  { iso: "GN", name: "Guinée", dial: "+224", example: "620 00 00 00" },
  { iso: "CM", name: "Cameroun", dial: "+237", example: "6 00 00 00 00" },
  { iso: "GA", name: "Gabon", dial: "+241", example: "06 00 00 00" },
  { iso: "CD", name: "RDC", dial: "+243", example: "81 000 0000" },
  { iso: "CG", name: "Congo", dial: "+242", example: "06 000 0000" },
  { iso: "MR", name: "Mauritanie", dial: "+222", example: "22 00 00 00" },
  { iso: "KE", name: "Kenya", dial: "+254", example: "712 345 678" },
  { iso: "GH", name: "Ghana", dial: "+233", example: "24 000 0000" },
  { iso: "NG", name: "Nigeria", dial: "+234", example: "801 234 5678" },
  { iso: "FR", name: "France", dial: "+33", example: "6 12 34 56 78" },
];

export const DEFAULT_PHONE_COUNTRY =
  PHONE_COUNTRIES.find((c) => c.iso === "SN") ?? PHONE_COUNTRIES[0];

const DIAL_STORAGE_KEY = "wazo_phone_dial";

export function readStoredDialCode(): string {
  if (typeof window === "undefined") return DEFAULT_PHONE_COUNTRY.dial;
  const stored = localStorage.getItem(DIAL_STORAGE_KEY);
  if (stored && PHONE_COUNTRIES.some((c) => c.dial === stored)) return stored;
  return DEFAULT_PHONE_COUNTRY.dial;
}

export function storeDialCode(dial: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DIAL_STORAGE_KEY, dial);
}

export function countryByDial(dial: string): PhoneCountry {
  return PHONE_COUNTRIES.find((c) => c.dial === dial) ?? DEFAULT_PHONE_COUNTRY;
}
