import { supabase } from "@/lib/supabase";

export type PricingRule = {
  id?: string;
  car_id: string;
  min_days: number; // от скольких дней действует скидка/надбавка
  discount_percent: number; // -10 => скидка 10%, +15 => надбавка 15%
  created_at?: string;
};

export type SeasonalRate = {
  id?: string;
  car_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  adjustment_percent: number; // +25 => надбавка 25%, -10 => скидка 10%
  created_at?: string;
};

export async function fetchPricingRules(carId: string) {
  const { data, error } = await supabase
    .from("pricing_rules")
    .select("id, car_id, min_days, discount_percent, created_at")
    .eq("car_id", carId)
    .order("min_days", { ascending: true });
  if (error) throw error;
  return data as PricingRule[];
}

export async function upsertPricingRule(rule: PricingRule) {
  const payload = { ...rule };
  const { data, error } = await supabase
    .from("pricing_rules")
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as PricingRule;
}

export async function deletePricingRule(id: string) {
  const { error } = await supabase.from("pricing_rules").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchSeasonalRates(carId: string) {
  const { data, error } = await supabase
    .from("seasonal_rates")
    .select("id, car_id, start_date, end_date, adjustment_percent, created_at")
    .eq("car_id", carId)
    .order("start_date", { ascending: true });
  if (error) throw error;
  return data as SeasonalRate[];
}

export async function upsertSeasonalRate(rate: SeasonalRate) {
  const payload = { ...rate };
  const { data, error } = await supabase
    .from("seasonal_rates")
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as SeasonalRate;
}

export async function deleteSeasonalRate(id: string) {
  const { error } = await supabase.from("seasonal_rates").delete().eq("id", id);
  if (error) throw error;
}
