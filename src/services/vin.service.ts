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
  const transmission = getValue("Seat Belt Type");
  const engine = getValue("Displacement (L)");
  const driveType = getValue("Drive Type");
  const doors = getValue("Doors");
  const seats = getValue("Number of Seats");
  
  // console.log("make:", make, "model:", model, "year:", year, "fuelType:", fuelType, "transmission:", transmission, "engine:", engine, "driveType:", driveType, "doors:", doors, "seats:", seats);
  

  if (!make || !model) return null;

  // === Бренд ===
  let brandId: string | null = null;
  const { data: brandData } = await supabase
    .from("brands")
    .select("*")
    .ilike("name", make);

  if (brandData && brandData.length > 0) {
    brandId = brandData[0].id;
  } else {
    const { data: newBrand } = await supabase
      .from("brands")
      .insert({ name: make })
      .select()
      .single();

    brandId = newBrand?.id ?? null;
  }

  // === Модель ===
  let modelId: string | null = null;
  const { data: modelData } = await supabase
    .from("models")
    .select("*")
    .eq("brand_id", brandId)
    .ilike("name", model);

  if (modelData && modelData.length > 0) {
    modelId = modelData[0].id;
  } else {
    const { data: newModel } = await supabase
      .from("models")
      .insert({ name: model, brand_id: brandId })
      .select()
      .single();

    modelId = newModel?.id ?? null;
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
    brandMatched: !!brandData?.length,
    modelMatched: !!modelData?.length,
  };
}
