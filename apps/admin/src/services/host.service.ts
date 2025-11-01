// src/services/host.service.ts
import { supabase } from "@/lib/supabase";

export type Host = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
};


export async function fetchHostById(hostId: string): Promise<Host | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, avatar_url")
    .eq("id", hostId)
    .single();
  if (error) throw error;
  return data as Host;
}