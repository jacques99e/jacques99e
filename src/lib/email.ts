const resendKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.REPORT_EMAIL_FROM || "Wazo Digital <reports@wazo-digital.app>";

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

export async function sendTransactionEmail(params: {
  to: string;
  storeName: string;
  subject: string;
  amountFcfa: number;
  label: string;
  reference: string;
  customerPhone?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const amount = params.amountFcfa.toLocaleString("fr-FR");
  const html = `
    <h2>Paiement Mobile Money confirmé</h2>
    <p><strong>${params.storeName}</strong></p>
    <p>Montant : <strong>${amount} FCFA</strong></p>
    <p>Motif : ${params.label}</p>
    <p>Référence : ${params.reference}</p>
    ${params.customerPhone ? `<p>Client : ${params.customerPhone}</p>` : ""}
    <p><a href="https://wazo-digital.vercel.app/sales/liens">Voir dans Wazo Digital</a></p>
  `;
  const text = `Paiement ${amount} FCFA — ${params.label} (réf. ${params.reference})`;

  return sendWeeklyReportEmail({
    to: params.to,
    storeName: params.storeName,
    subject: params.subject,
    html,
    text,
  });
}
