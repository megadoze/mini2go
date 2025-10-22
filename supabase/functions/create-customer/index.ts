import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
    // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
       return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const { email, password, full_name, phone, age, driver_license_issue } = body ?? {};

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "email and password are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Админ-создание пользователя (подтверждён сразу)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: full_name ?? "",
        phone: phone ?? "",
      },
    });
    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const user = created.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "User not returned" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const normalizedAge =
      age == null || Number.isNaN(Number(age)) ? null : Math.trunc(Number(age));

    // 2) Профиль создаст триггер. Ждём и читаем.
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email,
          full_name,
          phone: phone ?? null,
          age: normalizedAge,
          driver_license_issue,
        },
        { onConflict: "id" } 
      )
      .select("*")
      .eq("id", user.id)
      .single();

    if (profErr) {
      // даже если по какой-то причине профиль ещё не виден — возвращаем юзера
      return new Response(JSON.stringify({ user, profile: null, note: "profile not found yet" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ user, profile }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
