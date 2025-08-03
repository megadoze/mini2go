import { supabase } from "@/lib/supabase";
import type { AppSettingsUpdatePayload } from "@/types/appSettingsUpdatePayload";
import type { AppSettings } from "@/types/setting";

const SETTINGS_SCOPE = "global";

// Получение настроек бронирования
export async function getGlobalSettings(): Promise<AppSettings | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("scope", SETTINGS_SCOPE)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? settingsSnakeToCamel(data) : null;
}

function settingsSnakeToCamel(input: any): AppSettings {
  return {
    id: input.id,
    currency: input.currency,
    scope: input.scope,
    openTime: input.open_time,
    closeTime: input.close_time,
    minRentPeriod: input.min_rent_period,
    maxRentPeriod: input.max_rent_period,
    intervalBetweenBookings: input.interval_between_bookings,
    ageRenters: input.age_renters,
    minDriverLicense: input.min_driver_license,
    isInstantBooking: input.is_instant_booking,
    isSmoking: input.is_smoking,
    isPets: input.is_pets,
    isAbroad: input.is_abroad,
    updatedAt: input.updated_at,
  };
}

function settingsCamelToSnake(input: AppSettingsUpdatePayload) {
  return {
    currency: input.currency,
    open_time: input.openTime,
    close_time: input.closeTime,
    min_rent_period: input.minRentPeriod,
    max_rent_period: input.maxRentPeriod,
    interval_between_bookings: input.intervalBetweenBookings,
    age_renters: input.ageRenters,
    min_driver_license: input.minDriverLicense,
    is_instant_booking: input.isInstantBooking,
    is_smoking: input.isSmoking,
    is_pets: input.isPets,
    is_abroad: input.isAbroad,
  };
}

// Обновление глобальных настроек
export async function upsertGlobalSettings(payload: AppSettingsUpdatePayload) {
  const snake = settingsCamelToSnake(payload);

  const { data, error } = await supabase
    .from("app_settings")
    .upsert([{ scope: SETTINGS_SCOPE, ...snake }], {
      onConflict: "scope",
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data ? settingsSnakeToCamel(data) : null;
}
