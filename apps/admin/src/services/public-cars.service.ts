// src/services/public-cars.service.ts
import { supabase } from "@/lib/supabase";

export type PublicCar = {
  id: string;
  year: number | null;
  photos: string[] | null;
  license_plate: string | null;
  price: number | null;
  currency: string | null;
  deposit: number | null;
  address: string | null;
  owner: { id: string; full_name: string | null; email: string | null } | null;
  model: { id: string; name: string; brand: { id: string; name: string } } | null;
};

export async function fetchPublicCarById(carId: string): Promise<PublicCar | null> {
  const { data, error } = await supabase
    .from("cars")
    .select(`
      *,
      owner:profiles(id, full_name, email),
      model:models(
        id, name,
        brand:brands(id, name)
      )
    `)
    .eq("id", carId)
    .single();
  if (error) throw error;
  return data as unknown as PublicCar;
}
