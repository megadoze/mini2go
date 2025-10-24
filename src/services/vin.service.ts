// vin.service.ts
import { supabase } from "@/lib/supabase";

export async function decodeVinAndFillForm(vin: string) {
  const res = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`
  );
  const data = await res.json();

  const results = data?.Results ?? [];
  const getValue = (key: string) =>
    results.find((r: any) => r.Variable === key)?.Value ?? null;

  const make = getValue("Make");
  const model = getValue("Model");
  const year = getValue("Model Year");
  const fuelType = getValue("Fuel Type - Primary");
  const transmission = getValue("Seat Belt Type"); // <- ты это потом поменяешь на нормальное поле
  const engine = getValue("Displacement (L)");
  const driveType = getValue("Drive Type");
  const doors = getValue("Doors");
  const seats = getValue("Number of Seats");

  if (!make || !model) return null;

  // 1. Ищем бренд в нашей таблице (но НЕ создаём!)
  const { data: brandData } = await supabase
    .from("brands")
    .select("*")
    .ilike("name", make);

  let brandId: string | null = null;
  let brandMatched = false;

  if (brandData && brandData.length > 0) {
    brandId = brandData[0].id;
    brandMatched = true;
  }

  // 2. Ищем модель ТОЛЬКО если бренд заматчился
  let modelId: string | null = null;
  let modelMatched = false;

  if (brandId) {
    const { data: modelData } = await supabase
      .from("models")
      .select("*")
      .eq("brand_id", brandId)
      .ilike("name", model);

    if (modelData && modelData.length > 0) {
      modelId = modelData[0].id;
      modelMatched = true;
    }
  }

  return {
    brandId,
    modelId,
    brand: make,
    model,
    year,
    fuelType,
    transmission,
    engine,
    driveType,
    doors,
    seats,
    brandMatched,
    modelMatched,
  };
}

