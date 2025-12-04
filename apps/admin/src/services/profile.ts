import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/profile";

export async function fetchMyProfile(): Promise<Profile | null> {
  const {
    data: { user },
    error: uErr,
  } = await supabase.auth.getUser();
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

export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | "full_name"
    | "phone"
    | "avatar_url"
    | "age"
    | "driver_dob"
    | "driver_license_issue"
    | "driver_license_expiry"
    | "driver_license_number"
    | "driver_license_file_url"
  >
>;

export async function updateMyProfile(patch: ProfileUpdate): Promise<Profile> {
  const {
    data: { user },
    error: uErr,
  } = await supabase.auth.getUser();
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
