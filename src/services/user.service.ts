// services/user.service.ts
import { supabase } from "@/lib/supabase";

// Поиск по имени/почте/телефону
export async function searchUsers(q: string) {
  if (!q) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone")
    .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

export async function createUserProfile(payload: {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  age?: number | null;
  driver_license_issue?: string | null;
}) {
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      full_name: payload.full_name,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      age: payload.age ?? null,
      driver_license_issue: payload.driver_license_issue ?? null,
    })
    .select("id, full_name, email, phone, age, driver_license_issue")
    .single();
  if (error) throw error;
  return data;
}

export async function getUserById(id: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, age, driver_license_issue")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// Список пользователей для таблицы
export async function fetchUsers(): Promise<
  {
    id: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    status?: string | null;
    avatar_url?: string | null;
  }[]
> {
  const { data, error } = await supabase
    .from("profiles")
    // если у тебя другие имена колонок для аватара/статуса — поправь их здесь
    .select("id, full_name, email, phone, status, avatar_url")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
