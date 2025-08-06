import { supabase } from "@/lib/supabase";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export async function fetchAddressFromCoords(lat: number, lon: number) {
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?types=address&language=en&access_token=${MAPBOX_TOKEN}`
  );
  const data = await response.json();

  const feature =
    data.features?.find((f: any) => f.place_type?.includes("address")) ||
    data.features?.find((f: any) => f.place_type?.includes("place")) ||
    data.features?.[0];

  if (!feature) return null;

  const context = feature.context || [];

  const country =
    context.find((c: any) => c.id.startsWith("country"))?.text ?? "";

  const city =
    context.find((c: any) => c.id.startsWith("place"))?.text ??
    context.find((c: any) => c.id.startsWith("locality"))?.text ??
    "";

  return {
    address: feature.place_name || "",
    country,
    city,
  };
}

export async function getCountryByName(name: string) {
  const { data, error } = await supabase
    .from("countries")
    .select("*")
    .ilike("name", name)
    .single();
  if (error) return null;
  return data;
}

export async function getLocationByName(name: string, countryId: string) {
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .ilike("name", name)
    .eq("country_id", countryId)
    .single();
  if (error) return null;
  return data;
}
