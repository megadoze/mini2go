// services/user.service.ts
import { supabase } from "@/lib/supabase";

export type UserListRow = {
  id: string;
  full_name: string;
  email?: string | null;
  age?: number | null;
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
  excludeUserId?: string;
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
  email: string;
  phone?: string | null;
  age?: number | null;
  driver_license_issue?: string;
  password?: string;
}) {
  const fnUrl = "https://keurknzlnafihotpbruj.functions.supabase.co/create-customer";

  const tempPassword =
    payload.password && payload.password.trim().length >= 6
      ? payload.password
      : Math.random().toString(36).slice(-8) + "A1";

  // 1) ЖЁСТКО нормализуем возраст (целое число или null)
  const body = {
    email: payload.email,
    password: tempPassword,
    full_name: payload.full_name,
    phone: payload.phone ?? "",
    age:
      payload.age == null || Number.isNaN(Number(payload.age))
        ? null
        : Math.trunc(Number(payload.age)),
    driver_license_issue: payload.driver_license_issue,
  };

  const res = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Edge function error (${res.status})`);
  }

  // 2) age приходит внутри profile
  const { user, profile } = await res.json();

  return { user, profile, password: tempPassword };
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
  userId: string,
  ownerId?: string
): Promise<BookingItem[]> {
  let query = supabase
    .from("bookings")
    .select(`
      id, user_id, car_id, start_at, end_at, status, mark,
      car:cars!inner (
        id, year, photos, license_plate, model_id, deposit, owner_id,
        model:models (
          id, name, brand_id,
          brand:brands ( id, name )
        )
      )
    `)
    .eq("user_id", userId)
    .order("start_at", { ascending: false })
    .limit(20);

  if (ownerId) {
    // фильтруем по владельцу машины
    query = query.eq("car.owner_id", ownerId);
  }

  const { data, error } = await query;
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

// ⚠️ без авторизации: автор приходит из UI
export async function createUserNote(payload: {
  userId: string;
  text: string;
}) {
  const { data, error } = await supabase
    .from("user_notes")
    .insert({
      user_id: payload.userId,
      text: payload.text,
      // author и created_by НЕ передаём — их заполнит триггер
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
  const { limit, offset, q, status, sort = "full_name", dir = "asc", excludeUserId } = params;

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, phone, status, avatar_url", { count: "exact" });

  if (q && q.trim() !== "") {
    const safe = q.replace(/%/g, "\\%").replace(/_/g, "\\_");
    query = query.or(
      `full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`
    );
  }

  if (status && status.trim() !== "") {
    query = query.eq("status", status);
  }

  // +++ исключаем текущего пользователя, если передан
  if (excludeUserId) {
    query = query.neq("id", excludeUserId);
  }

  query = query.order(sort, { ascending: dir === "asc", nullsFirst: true });

  const from = offset;
  const to = offset + limit - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return { items: (data ?? []) as UserListRow[], count: count ?? data?.length ?? 0 };
}

export async function fetchHostUsersPage(opts: {
  ownerId: string;
  limit: number;
  offset: number;
  excludeUserId?: string;
}) {
  const { ownerId, limit, offset, excludeUserId } = opts;

  const { data, error } = await supabase.rpc("host_customers", {
    _owner: ownerId,
    _limit: limit,
    _offset: offset,
    _exclude: excludeUserId ?? null,
  });

  if (error) throw error;

  const items =
    (data ?? []).map((r: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { total_count, ...u } = r;
      return u;
    }) ?? [];

  const count = (data?.[0]?.total_count as number | undefined) ?? items.length;

  return { items, count } as { items: any[]; count: number };
}


export async function sendPasswordReset(email: string) {
  // укажи redirect URL на свою страницу смены пароля
  const redirectTo = `${window.location.origin}/auth/reset`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}