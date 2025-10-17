import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
  const sb = createClient(url, serviceKey);

  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // 1) confirmed -> rent
    const u1 = await sb
      .from("bookings")
      .update({ status: "rent" })
      .lte("start_at", nowIso)
      .eq("mark", "booking")
      .eq("status", "confirmed")
      .select("id", { count: "exact" })
      .throwOnError();

    // 2) rent -> finished
    const u2 = await sb
      .from("bookings")
      .update({ status: "finished" })
      .lte("end_at", nowIso)
      .eq("mark", "booking")
      .eq("status", "rent")
      .select("id", { count: "exact" })
      .throwOnError();

    // 3a) onApproval -> canceledHost (старше 2 часов и ещё НЕ началась)
    const olderThan2h = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const u3a = await sb
      .from("bookings")
      .update({ status: "canceledHost" })
      .lte("created_at", olderThan2h)
      .gt("start_at", nowIso)
      .eq("mark", "booking")
      .eq("status", "onApproval")
      .select("id", { count: "exact" })
      .throwOnError();

    // 3b) onApproval -> canceledHost (время старта уже наступило)
    const u3b = await sb
      .from("bookings")
      .update({ status: "canceledHost" })
      .lte("start_at", nowIso)
      .eq("mark", "booking")
      .eq("status", "onApproval")
      .select("id", { count: "exact" })
      .throwOnError();

    return new Response(
      JSON.stringify({
        ok: true,
        now: nowIso,
        changed_to_rent: u1.count ?? 0,
        changed_to_finished: u2.count ?? 0,
        canceled_unapproved_waited: u3a.count ?? 0,
        canceled_unapproved_at_start: u3b.count ?? 0,
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
