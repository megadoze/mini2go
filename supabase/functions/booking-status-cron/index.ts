import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceRole);

  const now = new Date().toISOString();

  // confirmed -> rent (если стартанули)
  await sb.from("bookings")
    .update({ status: "rent", updated_at: now })
    .gte("start_at", "1970-01-01") // заглушка чтобы работали индексы
    .lte("start_at", now)
    .eq("mark", "booking")
    .eq("status", "confirmed");

  // rent -> finished (если закончились)
  await sb.from("bookings")
    .update({ status: "finished", updated_at: now })
    .gte("end_at", "1970-01-01")
    .lte("end_at", now)
    .eq("mark", "booking")
    .eq("status", "rent");

  return new Response("ok", { status: 200 });
});
