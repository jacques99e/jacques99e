function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "";
}

export function mapErrorToUserMessage(
  error: unknown,
  fallback = "Une erreur est survenue. Veuillez reessayer."
): string {
  const raw = extractErrorMessage(error);
  const message = raw.toLowerCase();

  if (!message) return fallback;
  if (
    message.includes("unauthorized") ||
    message.includes("session expir") ||
    message.includes("reconnecter")
  ) {
    return "Session expiree. Veuillez vous reconnecter.";
  }
  if (message.includes("migration") || message.includes("billing_payments")) {
    return raw;
  }
  if (message.includes("paydunya") || message.includes("paiement") || message.includes("boutique")) {
    return raw;
  }
  if (
    message.includes("forbidden") ||
    message.includes("permission") ||
    message.includes("rls") ||
    message.includes("row-level security") ||
    message.includes("not_authenticated") ||
    message.includes("42501")
  ) {
    return "Session expiree ou acces refuse. Veuillez vous reconnecter.";
  }
  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("timeout")
  ) {
    return "Connexion impossible pour le moment. Verifiez internet puis reessayez.";
  }
  if (message.includes("duplicate") || message.includes("unique")) {
    return "Cette information existe deja.";
  }
  if (message.includes("invalid") || message.includes("required")) {
    return "Certaines informations sont invalides ou manquantes.";
  }

  return fallback;
}

