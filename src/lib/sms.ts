import { formatPhoneForWhatsApp } from "@/lib/whatsapp";

export interface SendSmsResult {
  ok: boolean;
  error?: string;
  simulated?: boolean;
}

function formatSmsPhone(raw: string): string | null {
  const digits = formatPhoneForWhatsApp(raw);
  if (!digits) return null;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

async function sendViaTwilio(to: string, message: string): Promise<SendSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return { ok: false, error: "Twilio non configuré (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)" };
  }

  const body = new URLSearchParams({ To: to, From: from, Body: message });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, error: text || response.statusText };
  }
  return { ok: true };
}

async function sendViaAfricasTalking(to: string, message: string): Promise<SendSmsResult> {
  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;
  if (!apiKey || !username) {
    return { ok: false, error: "Africa's Talking non configuré (AT_API_KEY, AT_USERNAME)" };
  }

  const body = new URLSearchParams({ username, to, message: message.replace(/\r?\n/g, "\r\n") });
  const senderId = process.env.AT_SENDER_ID?.trim();
  if (senderId) body.set("from", senderId);

  const response = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      apiKey,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, error: text || response.statusText };
  }
  return { ok: true };
}

export function buildFormationInviteSms(params: {
  studentName: string;
  courseTitle: string;
  inviteCode: string;
  formationLink: string;
}): string {
  const name = params.studentName.trim() || "Apprenant";
  return (
    `Bonjour ${name}! Formation "${params.courseTitle}" sur Wazo Digital.\n` +
    `Code: ${params.inviteCode}\n` +
    `Lien: ${params.formationLink}`
  );
}

export function buildAuthOtpMessage(otp: string): string {
  return `Votre code Wazo Digital : ${otp}`;
}

/** OTP connexion — utilisé par le hook Supabase Send SMS. */
export async function sendAuthOtpSms(phone: string, otp: string): Promise<SendSmsResult> {
  return sendSms(phone, buildAuthOtpMessage(otp));
}

export async function sendSms(phone: string, message: string): Promise<SendSmsResult> {
  const to = formatSmsPhone(phone);
  if (!to) return { ok: false, error: "Numéro invalide" };

  if (process.env.SMS_SIMULATE === "true") {
    console.info("[sms-simulate]", to, message);
    return { ok: true, simulated: true };
  }

  const provider = (process.env.SMS_PROVIDER || "twilio").toLowerCase();
  if (provider === "africastalking" || provider === "at") {
    return sendViaAfricasTalking(to, message);
  }
  return sendViaTwilio(to, message);
}

export function looksLikePhone(contact: string | null | undefined): boolean {
  if (!contact?.trim()) return false;
  const digits = contact.replace(/\D/g, "");
  return digits.length >= 8;
}
