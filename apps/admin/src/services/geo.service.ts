import { supabase } from "@/lib/supabase";
import type { Country } from "@/types/country";

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

export async function fetchCountries(): Promise<Country[]> {
  const { data, error } = await supabase.from("countries").select("*");
  if (error) throw error;
  return data;
}

// Получение списка моделей конкретной марки авто
export async function fetchLocationsByCountry(locationId: string) {
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("country_id", locationId); // ← теперь это string
  if (error) throw error;
  return data;
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

export async function ensureCountryAndLocationExist(
  countryName: string,
  cityName: string
): Promise<string | null> {
  // 1. Страна
  let countryId: string | null = null;

  const { data: existingCountry, error: countryError } = await supabase
    .from("countries")
    .select("id")
    .ilike("name", countryName)
    .maybeSingle();

  if (countryError) {
    console.error("Ошибка при проверке страны", countryError);
    return null;
  }

  if (existingCountry) {
    countryId = existingCountry.id;
  } else {
    const { data: newCountry, error: insertCountryError } = await supabase
      .from("countries")
      .insert({ name: countryName })
      .select("id")
      .single();

    if (insertCountryError) {
      console.error("Ошибка при добавлении страны", insertCountryError);
      return null;
    }

    countryId = newCountry.id;
  }

  // 2. Локация (город)
  let locationId: string | null = null;

  const { data: existingLocation, error: locationError } = await supabase
    .from("locations")
    .select("id")
    .ilike("name", cityName)
    .eq("country_id", countryId)
    .maybeSingle();

  if (locationError) {
    console.error("Ошибка при проверке города", locationError);
    return null;
  }

  if (existingLocation) {
    locationId = existingLocation.id;
  } else {
    const { data: newLocation, error: insertLocationError } = await supabase
      .from("locations")
      .insert({
        name: cityName,
        country_id: countryId,
      })
      .select("id")
      .single();

    if (insertLocationError) {
      console.error("Ошибка при добавлении города", insertLocationError);
      return null;
    }

    locationId = newLocation.id;
  }

  return locationId;
}
