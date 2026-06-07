import { localStore } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";

interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}

/**
 * Non-blocking audit helper.
 * Never throws to avoid breaking user flows.
 */
export async function logAuditEvent(input: AuditInput): Promise<void> {
  try {
    if (!navigator.onLine) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const store = localStore.get();
    await supabase.from("audit_logs").insert({
      store_id: store?.id ?? null,
      user_id: user?.id ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      payload: input.payload ?? {},
    });
  } catch {
    // Intentionally swallow errors: audit must not break business actions.
  }
}
