import { countryByDial } from "@/lib/phone-countries";

/** Convertit un numéro local + indicatif en E.164 pour Supabase Auth SMS. */
export function formatPhoneE164(localNumber: string, dialCode: string): string {
  const trimmed = localNumber.trim();
  if (!trimmed) {
    throw new Error("Indiquez votre numéro de téléphone.");
  }

  if (trimmed.startsWith("+")) {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 8) {
      throw new Error("Numéro invalide. Vérifiez l'indicatif pays et le numéro.");
    }
    return `+${digits}`;
  }

  if (!dialCode || dialCode === "+") {
    throw new Error("Indiquez votre numéro avec l'indicatif pays.");
  }

  const dialDigits = dialCode.replace(/\D/g, "");
  if (!dialDigits) {
    throw new Error("Indicatif pays invalide.");
  }

  let localDigits = trimmed.replace(/\D/g, "");
  if (!localDigits) {
    throw new Error("Numéro invalide.");
  }

  if (localDigits.startsWith("00")) {
    return `+${localDigits.slice(2)}`;
  }

  if (localDigits.startsWith(dialDigits)) {
    return `+${localDigits}`;
  }

  if (localDigits.startsWith("0")) {
    localDigits = localDigits.replace(/^0+/, "");
  }

  const e164 = `+${dialDigits}${localDigits}`;
  if (e164.length < 10 || e164.length > 16) {
    const example = countryByDial(dialCode).example;
    throw new Error(`Numéro invalide. Exemple : ${dialCode} ${example}`);
  }

  return e164;
}

/** Affichage lisible : +221 77 123 45 67 */
export function formatPhoneDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (!digits) return e164;
  if (digits.length <= 3) return `+${digits}`;
  const rest = digits.slice(3);
  const chunks = rest.match(/.{1,2}/g) ?? [rest];
  return `+${digits.slice(0, 3)} ${chunks.join(" ")}`.trim();
}
