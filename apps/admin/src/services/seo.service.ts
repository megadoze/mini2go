// services/seo.service.ts
import { supabase } from "@/lib/supabase";
import type { SeoCarRow } from "@/types/seoCarRow";

export async function fetchSeoCarsPage(params: {
  limit: number;
  offset: number;
}) {
  const { limit, offset } = params;

  const { data, error, count } = await supabase
    .from("cars_seo_admin_list")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return { items: (data ?? []) as SeoCarRow[], count: count ?? 0 };
}
