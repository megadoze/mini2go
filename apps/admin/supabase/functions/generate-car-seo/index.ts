import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Action = "generate" | "save" | "reset";

type Payload = {
  action?: Action; // default: "generate"
  car_id: string;
  locale: string; // пока только "en"
  force?: boolean; // для generate/reset: игнорировать is_custom

  // для save:
  seo_title?: string;
  seo_description?: string;
  is_custom?: boolean;
};

function normalizeLocale(locale: string) {
  return (locale || "").trim().toLowerCase();
}

function pick<T>(v: T | null | undefined, fallback: T): T {
  return (v ?? fallback) as T;
}

function buildSeo(locale: string, car: any) {
  const brand = car?.models?.brands?.name ?? "";
  const model = car?.models?.name ?? "";
  const year = car?.year ? String(car.year) : "";

  const locationName = car?.locations?.name ?? "";
  const countryName = car?.locations?.countries?.name ?? "";
  const placeEN = [locationName, countryName].filter(Boolean).join(", ");

  const price = car?.price != null ? Math.round(Number(car.price)) : null;
  const currency = car?.currency ?? "";
  const transmission = car?.transmission ?? "";
  const fuel = car?.fuel_type ?? "";
  const mileage = car?.include_mileage ?? 200;
  const deposit = car?.deposit ?? null;
  const delivery = !!car?.is_delivery;

  const titlePartsEN = [
    [brand, model].filter(Boolean).join(" "),
    year ? `${year}` : "",
    "for rent",
    placeEN ? `in ${placeEN}` : "",
  ].filter(Boolean);

  const title = titlePartsEN.join(" ");

  const bits: string[] = [];
  if (transmission) bits.push(`Transmission: ${transmission}`);
  if (fuel) bits.push(`Fuel: ${fuel}`);
  if (mileage) bits.push(`Included mileage: ${mileage} km`);
  if (deposit != null) bits.push(`Deposit: ${deposit} ${currency}`.trim());
  if (delivery) bits.push(`Delivery available`);
  if (price != null && currency) bits.push(`From ${price} ${currency}`);

  const description =
    `${[brand, model].filter(Boolean).join(" ")} ${
      year ? `${year}` : ""
    } — car rental.`.trim() +
    (placeEN ? ` Location: ${placeEN}.` : "") +
    (bits.length ? ` ${bits.join(". ")}.` : "");

  return { title, description };
}

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // userClient — JWT пользователя
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    const payload = (await req.json()) as Payload;

    const action = (payload.action ?? "generate") as Action;
    const car_id = String(payload.car_id || "").trim();
    const locale = normalizeLocale(payload.locale);
    let force = !!payload.force;

    if (!car_id || !locale) {
      return new Response(
        JSON.stringify({ error: "car_id and locale are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Пока EN-only
    if (locale !== "en") {
      return new Response(
        JSON.stringify({
          error: "Translations not ready. Use locale: 'en' for now.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Проверяем, админ ли пользователь
    const { data: isAdmin, error: isAdminErr } = await userClient.rpc(
      "is_admin"
    );
    const admin = !isAdminErr && isAdmin === true;

    // adminClient — для чтения/записи без RLS
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Если НЕ админ:
    // - разрешаем только generate
    // - только для своих авто (owner_id = auth.uid())
    // - save/reset запрещены
    if (!admin) {
      if (action !== "generate") {
        return new Response(
          JSON.stringify({ error: "Forbidden (hosts can only generate)" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Проверяем владельца машины
      const { data: ownerRow, error: ownerErr } = await adminClient
        .from("cars")
        .select("owner_id")
        .eq("id", car_id)
        .single();

      if (ownerErr || !ownerRow) {
        return new Response(JSON.stringify({ error: "Car not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (ownerRow.owner_id !== userId) {
        return new Response(
          JSON.stringify({ error: "Forbidden (not your car)" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Для хоста force запрещаем (чтобы не мог затирать кастом админа)
      force = false;
    }

    // ---------- ACTION: SAVE (CUSTOM) — только админ ----------
    if (action === "save") {
      if (!admin) {
        return new Response(
          JSON.stringify({ error: "Forbidden (admin only)" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const seo_title = String(payload.seo_title || "").trim();
      const seo_description = String(payload.seo_description || "").trim();

      if (!seo_title || !seo_description) {
        return new Response(
          JSON.stringify({
            error: "seo_title and seo_description are required for action=save",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const is_custom = payload.is_custom === true;

      const { data: upserted, error: upsertErr } = await adminClient
        .from("car_seo")
        .upsert(
          { car_id, locale, seo_title, seo_description, is_custom }, // ✅
          { onConflict: "car_id,locale" }
        )
        .select(
          "id, car_id, locale, seo_title, seo_description, is_custom, updated_at"
        )
        .single();

      if (upsertErr) {
        return new Response(
          JSON.stringify({
            error: "Upsert failed",
            details: upsertErr.message,
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify({ ok: true, seo: upserted }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // ---------- ACTION: RESET (TO AUTO) — только админ ----------
    if (action === "reset") {
      if (!admin) {
        return new Response(
          JSON.stringify({ error: "Forbidden (admin only)" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // reset = перегенерить даже если кастом
      force = true;

      // Сбросим флаг (не обязательно, но полезно)
      await adminClient
        .from("car_seo")
        .update({ is_custom: false })
        .eq("car_id", car_id)
        .eq("locale", locale);
    }

    // ---------- ACTION: GENERATE (AUTO) ----------
    const { data: existingSeo } = await adminClient
      .from("car_seo")
      .select("id, car_id, locale, is_custom, seo_title, seo_description")
      .eq("car_id", car_id)
      .eq("locale", locale)
      .maybeSingle();

    if (existingSeo?.is_custom && !force) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, seo: existingSeo }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const { data: car, error: carErr } = await adminClient
      .from("cars")
      .select(
        `
        id, year, price, currency, transmission, fuel_type, include_mileage, deposit,
        is_delivery, address,
        models (
          name,
          brands ( name )
        ),
        locations (
          name,
          countries ( name, id )
        )
      `
      )
      .eq("id", car_id)
      .single();

    if (carErr || !car) {
      return new Response(
        JSON.stringify({ error: "Car not found", details: carErr?.message }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { title, description } = buildSeo(locale, car);

    const { data: upserted, error: upsertErr } = await adminClient
      .from("car_seo")
      .upsert(
        {
          car_id,
          locale,
          seo_title: pick(title, ""),
          seo_description: pick(description, ""),
          is_custom: false,
        },
        { onConflict: "car_id,locale" }
      )
      .select(
        "id, car_id, locale, seo_title, seo_description, is_custom, updated_at"
      )
      .single();

    if (upsertErr) {
      return new Response(
        JSON.stringify({ error: "Upsert failed", details: upsertErr.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ ok: true, seo: upserted }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Server error",
        details: String(e?.message ?? e),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
