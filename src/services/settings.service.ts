import { supabase } from "@/lib/supabase";
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
  return data ?? null;
}

type UpdatePayload = Partial<
  Pick<
    AppSettings,
    | "openTime"
    | "closeTime"
    | "minRentPeriod"
    | "maxRentPeriod"
    | "intervalBetweenBookings"
    | "ageRenters"
    | "minDriverLicense"
    | "isInstantBooking"
    | "isSmoking"
    | "isPets"
    | "isAbroad"
  >
>;

// Обновление настроек бронирования
export async function upsertGlobalSettings(payload: UpdatePayload) {
  // upsert по scope='global'
  const { data, error } = await supabase
    .from("app_settings")
    .upsert(
      [{ scope: SETTINGS_SCOPE, ...payload }],
      { onConflict: "scope" } // в БД добавь UNIQUE(scope) при желании
    )
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as AppSettings;
}
