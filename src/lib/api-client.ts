import { supabase } from "@/lib/supabase/client";

const API_TIMEOUT_MS = 45_000;

function resolveApiUrl(input: string): string {
  if (input.startsWith("http://") || input.startsWith("https://")) {
    return input;
  }
  if (typeof window !== "undefined") {
    return new URL(input, window.location.origin).toString();
  }
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  return base ? `${base}${input}` : input;
}

async function readAccessToken(): Promise<string | undefined> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return undefined;
    return data.session?.access_token;
  } catch {
    return undefined;
  }
}

/** Fetch API routes with session cookies + Bearer token (SSR + legacy sessions). */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const url = resolveApiUrl(input);
  const headers = new Headers(init.headers);
  const token = await readAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const run = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const outerSignal = init.signal;
    if (outerSignal) {
      if (outerSignal.aborted) controller.abort();
      else outerSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
        credentials: "include",
        headers,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error(
          "La requete a expire. Verifiez votre connexion internet puis reessayez."
        );
      }
      const msg = e instanceof Error ? e.message.toLowerCase() : "";
      if (msg.includes("failed to fetch") || msg.includes("network")) {
        throw new Error(
          "Connexion impossible. Verifiez internet, desactivez un bloqueur de pub, ou reconnectez-vous."
        );
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let response = await run();

  if (response.status === 401) {
    try {
      await supabase.auth.refreshSession();
      const refreshed = await readAccessToken();
      if (refreshed) {
        headers.set("Authorization", `Bearer ${refreshed}`);
      }
    } catch {
      // refresh optional — Bearer from getSession may still work
    }
    response = await run();
  }

  return response;
}
