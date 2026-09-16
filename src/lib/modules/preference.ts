import { billingPayHref } from "@/lib/billing-checkout";
import { localModules } from "@/lib/db";
import { normalizeModuleIds } from "@/lib/modules/config";
import { setBusinessVertical } from "@/lib/onboarding";
import type { ModuleId } from "@/types";

const PENDING_KEY = "wazo_pending_module";
export const PENDING_PLAN_KEY = "wazo_pending_plan";
export const PENDING_PLAN_PAY_KEY = "wazo_pending_plan_pay";

export function isPaidVitrinePlan(plan: string | null | undefined): boolean {
  const normalized = plan?.toLowerCase();
  return normalized === "pro" || normalized === "business";
}

export function readPendingModule(): ModuleId | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PENDING_KEY) ?? new URLSearchParams(window.location.search).get("module");
  if (!raw) return null;
  const ids = normalizeModuleIds([raw]);
  return ids[0] ?? null;
}

export function savePendingModule(moduleId: string) {
  if (typeof window === "undefined") return;
  const ids = normalizeModuleIds([moduleId]);
  if (!ids.length) return;
  sessionStorage.setItem(PENDING_KEY, ids[0]);
}

export function applyPendingModule(): ModuleId | null {
  const pending = readPendingModule();
  if (!pending) return null;
  const modules = normalizeModuleIds([pending]);
  localModules.save(modules);
  setBusinessVertical(modules[0]);
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(PENDING_KEY);
  }
  return modules[0];
}

export function savePendingPlan(planId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_PLAN_KEY, planId);
  writeCookie(PENDING_PLAN_KEY, planId);
}

function writeCookie(name: string, value: string, maxAgeSec = 600) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
}

function clearCookie(name: string) {
  document.cookie = `${encodeURIComponent(name)}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) {
      try {
        return decodeURIComponent(part.slice(prefix.length));
      } catch {
        return part.slice(prefix.length);
      }
    }
  }
  return null;
}

export function readPendingPlan(): string | null {
  if (typeof window === "undefined") return null;
  return (
    sessionStorage.getItem(PENDING_PLAN_KEY) ??
    new URLSearchParams(window.location.search).get("plan") ??
    readCookie(PENDING_PLAN_KEY)
  );
}

export function applyPendingPlan(): string | null {
  const pending = readPendingPlan();
  if (!pending) return null;
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(PENDING_PLAN_KEY);
    clearCookie(PENDING_PLAN_KEY);
  }
  return pending;
}

export function savePendingPlanPay(shouldPay = true) {
  if (typeof window === "undefined") return;
  if (shouldPay) {
    sessionStorage.setItem(PENDING_PLAN_PAY_KEY, "1");
    writeCookie(PENDING_PLAN_PAY_KEY, "1");
  } else {
    sessionStorage.removeItem(PENDING_PLAN_PAY_KEY);
    clearCookie(PENDING_PLAN_PAY_KEY);
  }
}

export function readPendingPlanPay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    sessionStorage.getItem(PENDING_PLAN_PAY_KEY) === "1" ||
    new URLSearchParams(window.location.search).get("pay") === "1" ||
    readCookie(PENDING_PLAN_PAY_KEY) === "1"
  );
}

export function applyPendingPlanPay(): boolean {
  const pay = readPendingPlanPay();
  if (pay && typeof window !== "undefined") {
    sessionStorage.removeItem(PENDING_PLAN_PAY_KEY);
    clearCookie(PENDING_PLAN_PAY_KEY);
  }
  return pay;
}

/** Garde le lien PRO (?plan=&pay=1) si la session n’est pas encore ouverte. */
export function captureCheckoutIntentFromLocation(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const plan = params.get("plan");
  const pay = params.get("pay") === "1";
  const onBilling =
    window.location.pathname === "/billing" || window.location.pathname.startsWith("/billing/");
  if (isPaidVitrinePlan(plan)) {
    savePendingPlan(plan!);
    if (pay) savePendingPlanPay(true);
    return;
  }
  if (onBilling && pay) {
    savePendingPlan("pro");
    savePendingPlanPay(true);
  }
}

export function checkoutResumePath(plan: string | null | undefined, pay: boolean): string | null {
  if (!pay || !isPaidVitrinePlan(plan) || !plan) return null;
  return billingCheckoutPath(plan);
}

export function postLoginHref(): string {
  return checkoutResumePath(readPendingPlan(), readPendingPlanPay()) ?? "/dashboard";
}

export function billingCheckoutPath(plan: string): string {
  const normalized = plan.toLowerCase();
  if (normalized === "business") return billingPayHref("business");
  if (normalized === "pro") return billingPayHref("pro");
  return billingPayHref("pro");
}
