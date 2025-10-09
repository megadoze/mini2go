// supabase/functions/booking-status-cron/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
  const sb = createClient(url, serviceKey);

  try {
    const now = new Date().toISOString();

    const u1 = await sb
      .from("bookings")
      .update({ status: "rent" })         // ← убрали updated_at
      .lte("start_at", now)
      .eq("mark", "booking")
      .eq("status", "confirmed")
      .select("id", { count: "exact" })
      .throwOnError();

    const u2 = await sb
      .from("bookings")
      .update({ status: "finished" })     // ← убрали updated_at
      .lte("end_at", now)
      .eq("mark", "booking")
      .eq("status", "rent")
      .select("id", { count: "exact" })
      .throwOnError();

    return new Response(
      JSON.stringify({
        ok: true,
        now,
        changed_to_rent: u1.count ?? 0,
        changed_to_finished: u2.count ?? 0,
      }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (e) {
    console.error("Cron error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
