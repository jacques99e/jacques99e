export function isEmailNotConfirmedError(message: string | null | undefined): boolean {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("email not confirmed") ||
    m.includes("not confirmed") ||
    m.includes("email_not_confirmed") ||
    m.includes("confirm your email")
  );
}
