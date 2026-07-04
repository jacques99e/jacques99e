import { NextResponse } from "next/server";
import { certificateVerifyUrl } from "@/lib/certificate";
import { certificatePdfUrl } from "@/lib/certificate-server";
import { issueCertificateForEnrollment, type CertificateIssueInput } from "@/lib/certificate-issue";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as CertificateIssueInput;
    const result = await issueCertificateForEnrollment(body);

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      token: result.token,
      verify_url: certificateVerifyUrl(result.token),
      pdf_url: certificatePdfUrl(result.token),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
