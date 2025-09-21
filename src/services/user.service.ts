// services/user.service.ts
import { supabase } from "@/lib/supabase";

export type UserListRow = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  avatar_url?: string | null;
};

type UsersPageParams = {
  limit: number;
  offset: number;

  /** опционально — серверный поиск по имени/почте/телефону */
  q?: string;

  /** опционально — фильтр по статусу */
  status?: string;

  /** опционально — сортировка */
  sort?: "full_name" | "email" | "created_at";
  dir?: "asc" | "desc";
};

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
  car: any;
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
    .select(
      `id, user_id, car_id, start_at, end_at, status, mark,  car:cars (
    id, year, photos, license_plate, model_id, deposit,
    model:models (
      id, name, brand_id,
      brand:brands ( id, name )
    )
  )`
    )
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

// удаление заметки юзера
export async function deleteUserNote(id: string) {
  const { error } = await supabase.from("user_notes").delete().eq("id", id);
  if (error) throw error;
  return { id };
}

export async function fetchUsersPage(
  params: UsersPageParams
): Promise<{ items: UserListRow[]; count: number }> {
  const { limit, offset, q, status, sort = "full_name", dir = "asc" } = params;

  // базовый select с подсчётом общего количества
  let query = supabase
    .from("profiles")
    .select("id, full_name, email, phone, status, avatar_url", {
      count: "exact",
    });

  // поиск по имени/почте/телефону (ilike, регистронезависимо)
  if (q && q.trim() !== "") {
    // чуть экранируем спецсимволы для like
    const safe = q.replace(/%/g, "\\%").replace(/_/g, "\\_");
    query = query.or(
      `full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`
    );
  }

  // фильтр по статусу
  if (status && status.trim() !== "") {
    query = query.eq("status", status);
  }

  // сортировка
  query = query.order(sort, { ascending: dir === "asc", nullsFirst: true });

  // пагинация
  const from = offset;
  const to = offset + limit - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) throw error;

  return {
    items: (data ?? []) as UserListRow[],
    count: count ?? data?.length ?? 0,
  };
}
