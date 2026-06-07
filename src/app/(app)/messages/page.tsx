"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import type { Message } from "@/types";

export default function MessagesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const store = localStore.get();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const roomId = store ? `store-${store.id}` : "general";

  useEffect(() => {
    if (!store) {
      setError("Boutique indisponible. Recharge la page.");
      return;
    }

    const load = async () => {
      setLoading(true);
      setError("");
      const { data, error: loadError } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(50);
      if (loadError) {
        setError("Impossible de charger les messages pour le moment.");
      } else if (data) {
        setMessages(data);
      }
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`messages:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) =>
          setMessages((prev) => {
            const next = payload.new as Message;
            if (prev.some((item) => item.id === next.id)) return prev;
            return [...prev, next];
          })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [store, roomId]);

  const send = async () => {
    if (!body.trim() || !store) return;
    setSending(true);
    setError("");
    const { data, error: insertError } = await supabase
      .from("messages")
      .insert({
        store_id: store.id,
        room_id: roomId,
        sender_id: user?.id,
        sender_name: user?.phone || "Moi",
        body: body.trim(),
      })
      .select()
      .single();
    if (insertError) {
      setError("Envoi impossible. Verifie la connexion puis reessaie.");
      setSending(false);
      return;
    }
    if (data) {
      setMessages((prev) => {
        if (prev.some((item) => item.id === data.id)) return prev;
        return [...prev, data];
      });
      setBody("");
    }
    setSending(false);
  };

  return (
    <>
      <AppHeader title={t("nav.messages")} />
      <main className="app-page flex flex-col gap-3 pb-24">
        <div className="flex-1 space-y-2 min-h-[50vh]">
          {loading ? <p className="text-xs text-gray-500">Chargement des messages...</p> : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          {!loading && messages.length === 0 ? (
            <p className="rounded-xl bg-white p-3 text-xs text-gray-500 dark:bg-gray-800">
              Aucun message pour le moment.
            </p>
          ) : null}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.sender_id === user?.id
                  ? "ml-auto bg-wazo-green text-white"
                  : "bg-white dark:bg-gray-800"
              }`}
            >
              <p className="text-[10px] opacity-70">{m.sender_name}</p>
              <p>{m.body}</p>
            </div>
          ))}
        </div>
        <div className="fixed bottom-16 left-0 right-0 border-t bg-white p-3 dark:bg-gray-900">
          <div className="mx-auto flex max-w-lg gap-2">
            <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("messages.placeholder")} />
            <Button onClick={send} disabled={sending || !body.trim()}>
              {sending ? "Envoi..." : t("messages.send")}
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
