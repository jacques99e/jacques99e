import { NextResponse, type NextRequest } from "next/server";
import { billingPayHref } from "@/lib/billing-checkout";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const plan = (request.cookies.get("wazo_pending_plan")?.value || "").toLowerCase();
      const pay = request.cookies.get("wazo_pending_plan_pay")?.value === "1";
      const next =
        pay && (plan === "pro" || plan === "business") ? billingPayHref(plan) : "/dashboard";
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
