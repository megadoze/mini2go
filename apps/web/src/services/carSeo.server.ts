import { supabaseServer } from "@/lib/supabaseServer";

export async function fetchCarSeoServer(carId: string, locale = "en") {
  const { data, error } = await supabaseServer
    .from("car_seo")
    .select("seo_title, seo_description, updated_at, is_custom")
    .eq("car_id", carId)
    .eq("locale", locale)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}
