// booking-status-cron/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET")!;
  if (req.headers.get("x-cron-secret") !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ВАЖНО: работаем в UTC — сравниваем timestamptz с текущим UTC
  const now = new Date().toISOString();

  const u1 = await sb
    .from("bookings")
    .update({ status: "rent", updated_at: now })
    .lte("start_at", now)
    .eq("mark", "booking")
    .eq("status", "confirmed")
    .select("id", { count: "exact" });

  const u2 = await sb
    .from("bookings")
    .update({ status: "finished", updated_at: now })
    .lte("end_at", now)
    .eq("mark", "booking")
    .eq("status", "rent")
    .select("id", { count: "exact" });

  return new Response(
    JSON.stringify({
      ok: true,
      changed_to_rent: u1.count ?? 0,
      changed_to_finished: u2.count ?? 0,
      now,
    }),
    { headers: { "content-type": "application/json" } }
  );
});
