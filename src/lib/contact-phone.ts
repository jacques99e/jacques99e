/** Retourne le premier numéro utilisable pour WhatsApp (min. 8 chiffres). */
export function resolveContactPhone(
  ...values: Array<string | null | undefined>
): string {
  for (const value of values) {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (digits.length >= 8) return digits;
  }
  return "";
}
