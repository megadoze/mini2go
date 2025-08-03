import { supabase } from "@/lib/supabase";
import type { Country } from "@/types/country";
import type { Location } from "@/types/location";
import type { Address } from "@/types/address";

export async function fetchCountries(): Promise<Country[]> {
  const { data, error } = await supabase.from("countries").select("*");
  if (error) throw error;
  return data || [];
}

export async function fetchLocationsByCountry(
  countryId: string
): Promise<Location[]> {
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("country_id", countryId);

  if (error) throw error;
  return data || [];
}

export async function fetchAddressByLocation(
  locationId: string
): Promise<Address[]> {
  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("location_id", locationId)
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}
