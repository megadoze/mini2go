import { supabase } from "@/lib/supabase";

export type OrgSettings = {
  id?: string;
  base_currency: string; // 'EUR' | 'USD' | 'GBP' ...
  updated_at?: string;
};

export async function fetchOrgSettings(): Promise<OrgSettings | null> {
  const { data, error } = await supabase
    .from("org_settings")
    .select("id, base_currency, updated_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertOrgSettings(payload: Partial<OrgSettings>) {
  // гарантируем одну запись: если нет id — возьмём существующую
  const existing = await fetchOrgSettings();
  const toSave = existing
    ? { id: existing.id, ...existing, ...payload }
    : { base_currency: payload.base_currency ?? "EUR" };

  const { data, error } = await supabase
    .from("org_settings")
    .upsert(toSave, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data as OrgSettings;
}
