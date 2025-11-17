// src/services/geo.service.ts
"use client";

import { getSupabaseClient } from "@/lib/supabase";
import type { Country } from "@/types/country";

// читаем токен один раз, это норм
const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  // вдруг ещё осталась старая Vite-переменная
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_MAPBOX_TOKEN) ||
  "";

/**
 * Обратное геокодирование через Mapbox
 */
export async function fetchAddressFromCoords(lat: number, lon: number) {
  if (!MAPBOX_TOKEN) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[geo.service] MAPBOX token missing");
    }
    return null;
  }

  const resp = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?types=address&language=en&access_token=${MAPBOX_TOKEN}`
  );

  if (!resp.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[geo.service] mapbox response not ok", resp.status);
    }
    return null;
  }

  const data = await resp.json();

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

/**
 * страны (публичный вызов — не валим билд)
 */
export async function fetchCountries(): Promise<Country[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return []; // билд / нет env
  const { data, error } = await supabase
    .from("countries")
    .select("*")
    .eq("is_active", true);
  if (error) throw error;
  return data ?? [];
}

/**
 * локации по стране
 */
export async function fetchLocationsByCountry(locationId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("country_id", locationId)
    .eq("is_active", true);
  if (error) throw error;
  return data ?? [];
}

export async function getCountryByName(name: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("countries")
    .select("*")
    .ilike("name", name)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function getLocationByName(name: string, countryId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .ilike("name", name)
    .eq("country_id", countryId)
    .maybeSingle();
  if (error) return null;
  return data;
}

/**
 * создать страну/город, если нет
 * это уже "запись" → здесь лучше упасть, если клиента нет
 */
export async function ensureCountryAndLocationExist(
  countryName: string,
  cityName: string
): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "[geo.service] supabase client not available for ensureCountryAndLocationExist"
    );
  }

  // 1. страна
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

  // 2. город
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
