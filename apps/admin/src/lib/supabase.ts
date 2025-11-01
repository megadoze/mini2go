// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("VITE_SUPABASE_URL is required");
}
if (!supabaseKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY is required");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { params: { eventsPerSecond: 10 } },
});

let t: number | undefined;

const kick = () => {
  if (t) window.clearTimeout(t);
  t = window.setTimeout(() => {
    if (navigator.onLine) {
      console.log("[RT] browser ONLINE → connect()");
      supabase.realtime.connect();
    } else {
      console.log("[RT] browser OFFLINE → disconnect()");
      supabase.realtime.disconnect();
    }
  }, 200);
};

if (typeof window !== "undefined") {
  window.addEventListener("online", kick);
  window.addEventListener("offline", kick);
}
