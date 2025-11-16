import { supabaseServer } from "@/lib/supabaseServer";
import { toCamelCar } from "./helpers";

export async function fetchCarByIdServer(id: string) {
  const { data, error } = await supabaseServer
    .from("cars")
    .select(
      `
      *,
      model:models(id, name, brand_id, brands(*)),
      owner:profiles(id, full_name, email),
      location:locations(*, country_id)
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return toCamelCar ? toCamelCar(data) : data;
}
