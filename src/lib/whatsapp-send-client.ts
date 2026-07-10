import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { apiFetch } from "@/lib/api-client";

export interface WhatsAppSendClientResult {
  ok: boolean;
  /** Envoi API réussi (ou simulé). */
  sentViaApi: boolean;
  simulated?: boolean;
  error?: string;
  /** true si on a ouvert wa.me en secours. */
  openedFallback?: boolean;
}

/**
 * Tente l’envoi auto via Cloud API ; sinon ouvre wa.me (comportement actuel).
 */
export async function sendWhatsAppAuto(options: {
  phone: string;
  message: string;
  /** Si false, n’ouvre pas wa.me en cas d’échec API. Défaut true. */
  fallbackOpen?: boolean;
  useTemplate?: boolean;
  templateName?: string;
  templateLanguage?: string;
}): Promise<WhatsAppSendClientResult> {
  const phone = options.phone.trim();
  const message = options.message.trim();
  if (!phone || !message) {
    return { ok: false, sentViaApi: false, error: "Téléphone ou message manquant" };
  }

  try {
    const res = await apiFetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        message,
        useTemplate: options.useTemplate === true,
        templateName: options.templateName,
        templateLanguage: options.templateLanguage,
      }),
    });
    const data = (await res.json()) as {
      success?: boolean;
      configured?: boolean;
      simulated?: boolean;
      error?: string;
      fallbackUrl?: string | null;
    };

    if (res.ok && data.success) {
      return {
        ok: true,
        sentViaApi: true,
        simulated: data.simulated,
      };
    }

    // API non configurée → fallback silencieux vers wa.me
    if (data.configured === false || res.status === 503) {
      if (options.fallbackOpen === false) {
        return {
          ok: false,
          sentViaApi: false,
          error: data.error || "WhatsApp API non configurée",
        };
      }
      const url =
        data.fallbackUrl || buildWhatsAppUrl(phone, message) || null;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        return { ok: true, sentViaApi: false, openedFallback: true };
      }
      return { ok: false, sentViaApi: false, error: "Numéro invalide" };
    }

    // API configurée mais échec (ex. hors fenêtre 24 h)
    if (options.fallbackOpen !== false) {
      const url =
        data.fallbackUrl || buildWhatsAppUrl(phone, message) || null;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        return {
          ok: true,
          sentViaApi: false,
          openedFallback: true,
          error: data.error,
        };
      }
    }

    return {
      ok: false,
      sentViaApi: false,
      error: data.error || "Échec envoi WhatsApp",
    };
  } catch {
    if (options.fallbackOpen === false) {
      return { ok: false, sentViaApi: false, error: "Réseau indisponible" };
    }
    const url = buildWhatsAppUrl(phone, message);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return { ok: true, sentViaApi: false, openedFallback: true };
    }
    return { ok: false, sentViaApi: false, error: "Numéro invalide" };
  }
}
