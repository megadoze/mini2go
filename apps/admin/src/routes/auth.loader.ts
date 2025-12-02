import { supabase } from "@/lib/supabase";
import { redirect } from "react-router-dom";

export type RootAuthData = {
  authUserId: string; // = session.user.id
  ownerId: string; // то же самое, для удобства
  userEmail: string | null;
  profileId: string | null; // profiles.id, если есть
  isHost: boolean;
  isAdmin: boolean; // из admin_users
};

export async function authLoader(): Promise<RootAuthData | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw redirect("/auth");
  }

  const authUserId = session.user.id;

  // профиль (host)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_host")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  // админ ли (из admin_users)
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  return {
    authUserId,
    ownerId: authUserId, // важно для host_user_blocks.owner_id
    userEmail: session.user.email ?? null,
    profileId: profile?.id ?? null,
    isHost: !!profile?.is_host,
    isAdmin: !!adminRow,
  };
}
