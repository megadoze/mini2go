import { supabase } from "@/lib/supabase";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  age: number | null;
  driver_license_issue: string | null;
  status: string | null;
  created_at: string;
};

export async function fetchMyProfile(): Promise<Profile | null> {
  const { data: { user }, error: uErr } = await supabase.auth.getUser();
  if (uErr) throw uErr;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return data as Profile;
}

export type ProfileUpdate = Partial<Pick<
  Profile,
  "full_name" | "phone" | "avatar_url"
>>;

export async function updateMyProfile(patch: ProfileUpdate): Promise<Profile> {
  const { data: { user }, error: uErr } = await supabase.auth.getUser();
  if (uErr) throw uErr;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}
