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
  const roomId = store ? `store-${store.id}` : "general";

  useEffect(() => {
    if (!store) return;

    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(50);
      if (data) setMessages(data);
    };

    load();

    const channel = supabase
      .channel(`messages:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [store, roomId]);

  const send = async () => {
    if (!body.trim() || !store) return;
    const { data } = await supabase
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
    if (data) {
      setMessages((prev) => [...prev, data]);
      setBody("");
    }
  };

  return (
    <>
      <AppHeader title={t("nav.messages")} />
      <main className="mx-auto flex max-w-lg flex-col gap-3 p-4 pb-24">
        <div className="flex-1 space-y-2 min-h-[50vh]">
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
            <Button onClick={send}>{t("messages.send")}</Button>
          </div>
        </div>
      </main>
    </>
  );
}
