import { buildWhatsAppUrl, formatPhoneForWhatsApp } from "@/lib/whatsapp";

export type WhatsAppProvider = "meta" | "twilio" | "simulate" | "none";

export interface SendWhatsAppResult {
  ok: boolean;
  error?: string;
  simulated?: boolean;
  provider?: WhatsAppProvider;
  messageId?: string;
  /** Lien wa.me si l’API n’est pas dispo (fallback client). */
  fallbackUrl?: string | null;
}

export interface WhatsAppTemplateSend {
  /** Nom du modèle approuvé Meta / Content SID Twilio (HX…). */
  name: string;
  language?: string;
  /** Variables corps {{1}}, {{2}}… (Meta) ou contentVariables (Twilio). */
  variables?: Record<string, string>;
}

export interface SendWhatsAppInput {
  phone: string;
  /** Message texte libre (fenêtre 24 h ou sandbox). */
  message?: string;
  /** Envoi modèle (hors fenêtre 24 h). */
  template?: WhatsAppTemplateSend;
}

function digitsOnly(phone: string): string | null {
  return formatPhoneForWhatsApp(phone);
}

function e164(phone: string): string | null {
  const digits = digitsOnly(phone);
  if (!digits) return null;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export function getWhatsAppProvider(): WhatsAppProvider {
  if (
    process.env.WHATSAPP_SIMULATE === "true" ||
    process.env.WHATSAPP_SIMULATE === "1"
  ) {
    return "simulate";
  }
  const explicit = (process.env.WHATSAPP_PROVIDER || "").toLowerCase().trim();
  if (explicit === "meta" || explicit === "cloud" || explicit === "facebook") {
    return "meta";
  }
  if (explicit === "twilio") return "twilio";
  if (explicit === "simulate") return "simulate";
  if (explicit === "none" || explicit === "off") return "none";

  if (
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID
  ) {
    return "meta";
  }
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_FROM_NUMBER)
  ) {
    return "twilio";
  }
  return "none";
}

export function isWhatsAppApiConfigured(): boolean {
  const provider = getWhatsAppProvider();
  if (provider === "simulate") return true;
  if (provider === "meta") {
    return Boolean(
      process.env.WHATSAPP_ACCESS_TOKEN &&
        process.env.WHATSAPP_PHONE_NUMBER_ID
    );
  }
  if (provider === "twilio") {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        (process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_FROM_NUMBER)
    );
  }
  return false;
}

function defaultTemplateName(): string | undefined {
  return (
    process.env.WHATSAPP_TEMPLATE_NAME?.trim() ||
    process.env.WHATSAPP_UTILITY_TEMPLATE?.trim() ||
    undefined
  );
}

function defaultTemplateLanguage(): string {
  return process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "fr";
}

async function sendViaMeta(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";
  const to = digitsOnly(input.phone);
  if (!token || !phoneNumberId) {
    return {
      ok: false,
      provider: "meta",
      error:
        "Meta non configuré (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID)",
    };
  }
  if (!to) return { ok: false, provider: "meta", error: "Numéro invalide" };

  const template = input.template?.name
    ? input.template
    : !input.message?.trim() && defaultTemplateName()
      ? {
          name: defaultTemplateName()!,
          language: defaultTemplateLanguage(),
          variables: {},
        }
      : undefined;

  let payload: Record<string, unknown>;

  if (template?.name) {
    const vars = template.variables || {};
    const ordered = Object.keys(vars)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => vars[k]);
    // Si message libre fourni sans variables, l’injecter en {{1}}
    if (!ordered.length && input.message?.trim()) {
      ordered.push(input.message.trim().slice(0, 1024));
    }
    const components =
      ordered.length > 0
        ? [
            {
              type: "body",
              parameters: ordered.map((text) => ({
                type: "text",
                text,
              })),
            },
          ]
        : undefined;

    payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template.name,
        language: { code: template.language || defaultTemplateLanguage() },
        ...(components ? { components } : {}),
      },
    };
  } else {
    const body = input.message?.trim();
    if (!body) {
      return {
        ok: false,
        provider: "meta",
        error: "Message ou modèle WhatsApp requis",
      };
    }
    payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: false, body: body.slice(0, 4096) },
    };
  }

  const response = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const data = (await response.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string; code?: number; error_user_msg?: string };
  };

  if (!response.ok || data.error) {
    const msg =
      data.error?.error_user_msg ||
      data.error?.message ||
      response.statusText ||
      "Échec Meta Cloud API";
    return {
      ok: false,
      provider: "meta",
      error: msg,
      fallbackUrl: buildWhatsAppUrl(
        input.phone,
        input.message?.trim() || "Bonjour"
      ),
    };
  }

  return {
    ok: true,
    provider: "meta",
    messageId: data.messages?.[0]?.id,
  };
}

async function sendViaTwilio(
  input: SendWhatsAppInput
): Promise<SendWhatsAppResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromRaw =
    process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_FROM_NUMBER;
  const to = e164(input.phone);
  if (!sid || !token || !fromRaw) {
    return {
      ok: false,
      provider: "twilio",
      error:
        "Twilio WhatsApp non configuré (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM)",
    };
  }
  if (!to) return { ok: false, provider: "twilio", error: "Numéro invalide" };

  const from = fromRaw.startsWith("whatsapp:")
    ? fromRaw
    : `whatsapp:${fromRaw.startsWith("+") ? fromRaw : `+${fromRaw.replace(/\D/g, "")}`}`;
  const toWa = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  const params = new URLSearchParams({
    From: from,
    To: toWa,
  });

  const templateName =
    input.template?.name ||
    (!input.message?.trim() ? defaultTemplateName() : undefined);

  if (templateName?.startsWith("HX")) {
    params.set("ContentSid", templateName);
    const vars = input.template?.variables || {};
    if (Object.keys(vars).length) {
      params.set("ContentVariables", JSON.stringify(vars));
    } else if (input.message?.trim()) {
      params.set(
        "ContentVariables",
        JSON.stringify({ "1": input.message.trim().slice(0, 1024) })
      );
    }
  } else {
    const body = input.message?.trim();
    if (!body) {
      return {
        ok: false,
        provider: "twilio",
        error: "Message WhatsApp requis (ou ContentSid HX…)",
      };
    }
    params.set("Body", body.slice(0, 1600));
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    }
  );

  const data = (await response.json().catch(() => ({}))) as {
    sid?: string;
    error_message?: string;
    message?: string;
  };

  if (!response.ok) {
    return {
      ok: false,
      provider: "twilio",
      error: data.error_message || data.message || response.statusText,
      fallbackUrl: buildWhatsAppUrl(
        input.phone,
        input.message?.trim() || "Bonjour"
      ),
    };
  }

  return { ok: true, provider: "twilio", messageId: data.sid };
}

/**
 * Envoi WhatsApp serveur (Meta Cloud API ou Twilio).
 * Hors fenêtre 24 h Meta exige un modèle approuvé — passez `template` ou
 * configurez WHATSAPP_TEMPLATE_NAME.
 */
export async function sendWhatsAppMessage(
  input: SendWhatsAppInput
): Promise<SendWhatsAppResult> {
  const phone = input.phone?.trim();
  if (!phone) return { ok: false, error: "Numéro invalide" };

  const fallbackUrl = buildWhatsAppUrl(
    phone,
    input.message?.trim() || "Bonjour"
  );

  const provider = getWhatsAppProvider();
  if (provider === "none") {
    return {
      ok: false,
      provider: "none",
      error: "WhatsApp Business API non configuré",
      fallbackUrl,
    };
  }

  if (provider === "simulate") {
    console.info("[whatsapp-simulate]", {
      to: digitsOnly(phone),
      message: input.message?.slice(0, 200),
      template: input.template?.name,
    });
    return { ok: true, simulated: true, provider: "simulate" };
  }

  try {
    if (provider === "meta") return await sendViaMeta(input);
    return await sendViaTwilio(input);
  } catch (e) {
    return {
      ok: false,
      provider,
      error: e instanceof Error ? e.message : "Erreur WhatsApp",
      fallbackUrl,
    };
  }
}

/** Notifie le vendeur d’une commande COD si l’API est configurée. */
export async function notifySellerWhatsApp(
  sellerPhone: string | null | undefined,
  message: string
): Promise<SendWhatsAppResult | null> {
  if (!sellerPhone?.trim() || !message.trim()) return null;
  if (!isWhatsAppApiConfigured()) return null;
  return sendWhatsAppMessage({ phone: sellerPhone, message });
}
