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
    .select(
      "id, full_name, email, phone, age, driver_license_issue, status, avatar_url"
    )
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

// 👉 Изменение статуса (active | blocked)
export async function updateUserStatus(
  id: string,
  status: "active" | "blocked"
) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", id)
    .select("id, status")
    .single();
  if (error) throw error;
  return data as { id: string; status: "active" | "blocked" };
}

// 👉 Последние бронирования пользователя (по твоей схеме таблицы)
export type BookingItem = {
  id: string;
  user_id: string;
  car_id: string;
  start_at: string; // ISO
  end_at: string; // ISO
  status?: string | null;
  mark?: string | null;
};

export async function fetchUserBookings(
  userId: string
): Promise<BookingItem[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, user_id, car_id, start_at, end_at, status, mark")
    .eq("user_id", userId)
    .order("start_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as BookingItem[];
}

// 👉 Заметки хоста о пользователе
export type UserNoteItem = {
  id: string;
  user_id: string;
  text: string;
  created_at: string; // ISO
  author?: string | null;
};

export async function fetchUserNotes(userId: string): Promise<UserNoteItem[]> {
  const { data, error } = await supabase
    .from("user_notes")
    .select("id, user_id, text, created_at, created_by, author")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as UserNoteItem[];
}

// Вариант А (удобный): сервис сам берёт текущего хоста из auth
// export async function createUserNote(payload: {
//   userId: string;
//   text: string;
// }) {
//   const { data: authData } = await supabase.auth.getUser();
//   const host = authData?.user;

//   const author = (host?.user_metadata as any)?.full_name || host?.email || null;

//   const { data, error } = await supabase
//     .from("user_notes")
//     .insert({
//       user_id: payload.userId,
//       text: payload.text,
//       created_by: host?.id ?? null,
//       author,
//     })
//     .select("id, user_id, text, created_at, created_by, author")
//     .single();

//   if (error) throw error;
//   return data as UserNoteItem;
// }

// ⚠️ без авторизации: автор приходит из UI
export async function createUserNote(payload: {
  userId: string;
  text: string;
  author?: string | null; // имя/почта хоста
  hostId?: string | null; // на будущее: id хоста
}) {
  const { data, error } = await supabase
    .from("user_notes")
    .insert({
      user_id: payload.userId,
      text: payload.text,
      author: payload.author ?? null,
      created_by: payload.hostId ?? null, // пока null
    })
    .select("id, user_id, text, created_at, created_by, author")
    .single();
  if (error) throw error;
  return data as UserNoteItem;
}
