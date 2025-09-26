import { supabase } from "@/lib/supabase";
import type { AppSettings } from "@/types/setting";
import type { AppSettingsUpdatePayload } from "@/types/appSettingsUpdatePayload";

function toCamel(row: any): AppSettings {
  if (!row) return row;
  return {
    // числа/строки
    currency: row.currency ?? null,
    openTime: row.open_time ?? null,
    closeTime: row.close_time ?? null,
    minRentPeriod: row.min_rent_period ?? null,
    maxRentPeriod: row.max_rent_period ?? null,
    intervalBetweenBookings: row.interval_between_bookings ?? null,
    ageRenters: row.age_renters ?? null,
    minDriverLicense: row.min_driver_license ?? null,
    // булевы
    isInstantBooking: row.is_instant_booking ?? false,
    isSmoking: row.is_smoking ?? false,
    isPets: row.is_pets ?? false,
    isAbroad: row.is_abroad ?? false,
    // если в типе есть служебные — добавь при необходимости
  } as AppSettings;
}

export async function getGlobalSettings(ownerId: string) {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("scope", "global")
    .maybeSingle();

  if (error) throw error;
  return data ? toCamel(data) : null;
}

export async function upsertGlobalSettings(
  ownerId: string,
  payload: AppSettingsUpdatePayload
) {
  const row = {
    owner_id: ownerId,
    scope: "global",
    currency: payload.currency,
    open_time: payload.openTime,
    close_time: payload.closeTime,
    min_rent_period: payload.minRentPeriod,
    max_rent_period: payload.maxRentPeriod,
    interval_between_bookings: payload.intervalBetweenBookings,
    age_renters: payload.ageRenters,
    min_driver_license: payload.minDriverLicense,
    is_instant_booking: payload.isInstantBooking,
    is_smoking: payload.isSmoking,
    is_pets: payload.isPets,
    is_abroad: payload.isAbroad,
  };

  const { data, error } = await supabase
    .from("app_settings")
    .upsert(row, { onConflict: "owner_id,scope" })
    .select()
    .single();

  if (error) throw error;
  return toCamel(data);
}
