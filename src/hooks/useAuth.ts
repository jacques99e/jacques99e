"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { localAuth } from "@/lib/db";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        localAuth.saveSession(session.access_token, {
          id: session.user.id,
          phone: session.user.phone,
        });
      } else {
        const cached = localAuth.getUser();
        if (cached && !navigator.onLine) {
          setUser({ id: cached.id, phone: cached.phone } as User);
        }
      }
      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          localAuth.saveSession(session.access_token, {
            id: session.user.id,
            phone: session.user.phone,
          });
        } else if (navigator.onLine) {
          setUser(null);
          localAuth.clear();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const sendOtp = useCallback(async (phone: string) => {
    const formatted = phone.startsWith("+") ? phone : `+${phone}`;
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
    if (error) throw error;
    return formatted;
  }, [supabase.auth]);

  const verifyOtp = useCallback(async (phone: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });
    if (error) throw error;
    return data;
  }, [supabase.auth]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localAuth.clear();
    setUser(null);
  }, [supabase.auth]);

  return { user, loading, sendOtp, verifyOtp, signOut, supabase };
}
