// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!,
  {
    auth: { persistSession: true, autoRefreshToken: true },
  }
);

// 1) Если у тебя есть логин — обязательно синкаем токен для realtime
supabase.auth.onAuthStateChange((_event, session) => {
  // при обновлении access_token даём его сокету realtime
  supabase.realtime.setAuth(session?.access_token ?? "");
});

// 2) Корректно реагируем на пропадание/возврат интернета
if (typeof window !== "undefined") {
  window.addEventListener("offline", () => {
    console.log("[RT] browser OFFLINE → disconnect()");
    supabase.realtime.disconnect(); // не спамим ретраями пока оффлайн
  });

  window.addEventListener("online", () => {
    console.log("[RT] browser ONLINE → connect() & rejoin channels");
    supabase.realtime.connect();
    // форсируем ре-джойн ВСЕХ каналов, которые были
    for (const ch of supabase.getChannels()) {
      const st = (ch as any).state;
      if (st !== "joined" && st !== "joining") {
        ch.subscribe((s) => console.log("[RT] rejoin", ch.topic, s));
      }
    }
  });
}
