// src/services/host.service.ts
import { supabase } from "@/lib/supabase";

export type Host = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
};

// export type HostCar = {
//   id: string;
//   year: number | null;
//   photos: string[] | null;
//   license_plate: string | null;
//   model: {
//     id: string;
//     name: string;
//     brand: { id: string; name: string };
//   } | null;
// };

export async function fetchHostById(hostId: string): Promise<Host | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, avatar_url")
    .eq("id", hostId)
    .single();
  if (error) throw error;
  return data as Host;
}

// export async function fetchHostCars(hostId: string): Promise<HostCar[]> {
//   const { data, error } = await supabase
//     .from("cars")
//     .select(`
//       id, year, photos, license_plate,
//       model:models(
//         id, name,
//         brand:brands(id, name)
//       )
//     `)
//     .eq("owner_id", hostId)
//     .order("created_at", { ascending: false });
//   if (error) throw error;
//   return (data ?? []) as HostCar[];
// }
