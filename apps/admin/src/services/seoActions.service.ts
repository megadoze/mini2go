import { supabase } from "@/lib/supabase";

export async function seoGenerate(carId: string) {
  const { data, error } = await supabase.functions.invoke("generate-car-seo", {
    body: { action: "generate", car_id: carId, locale: "en" },
  });
  if (error) throw error;
  return data;
}

export async function seoReset(carId: string) {
  const { data, error } = await supabase.functions.invoke("generate-car-seo", {
    body: { action: "reset", car_id: carId, locale: "en" },
  });
  if (error) throw error;
  return data;
}

export async function seoTemplate(carId: string) {
  const { data, error } = await supabase.functions.invoke("generate-car-seo", {
    body: { action: "template", car_id: carId, locale: "en" },
  });
  if (error) throw error;
  return data;
}

export async function seoSave(
  carId: string,
  title: string,
  description: string,
  isCustom: boolean
) {
  const { data, error } = await supabase.functions.invoke("generate-car-seo", {
    body: {
      action: "save",
      car_id: carId,
      locale: "en",
      seo_title: title,
      seo_description: description,
      is_custom: isCustom,
    },
  });
  if (error) throw error;
  return data;
}
