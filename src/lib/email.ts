const resendKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.REPORT_EMAIL_FROM || "Wazo Digital <onboarding@wazo-digital.com>";

export async function sendWeeklyReportEmail(params: {
  to: string;
  storeName: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendKey) {
    if (process.env.REPORT_EMAIL_SIMULATE === "true") {
      console.info("[email-simulate]", params.to, params.subject);
      return { ok: true };
    }
    return { ok: false, error: "RESEND_API_KEY manquant" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return { ok: false, error: body || response.statusText };
  }
  return { ok: true };
}
