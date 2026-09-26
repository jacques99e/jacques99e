import { NextResponse } from "next/server";
import { issueCertificateForEnrollment, type CertificateIssueInput } from "@/lib/certificate-issue";
import { allowIp } from "@/lib/rate-limit";
import {
  buildCertificatePdfBuffer,
  certificateContentDisposition,
  certificateFilename,
} from "@/lib/certificate-server";

export async function POST(request: Request) {
  if (!(await allowIp(request, "certificate-download", 12, 60 * 60 * 1000))) {
    return NextResponse.json(
      { success: false, error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429 }
    );
  }
  try {
    const body = (await request.json().catch(() => ({}))) as CertificateIssueInput;

    const result = await issueCertificateForEnrollment(body);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const studentName = result.studentName;
    const courseTitle = "Formation";
    const instructorName = "Wazo Digital";

    const pdf = await buildCertificatePdfBuffer({
      studentName,
      courseTitle,
      organizationName: instructorName,
      instructorName,
      completedAt: result.completedAt || new Date().toISOString(),
      verifyToken: result.token,
    });

    const filename = certificateFilename(studentName);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": certificateContentDisposition(filename),
        "Content-Length": String(pdf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
