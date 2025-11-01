// auth.loader.ts
import { supabase } from "@/lib/supabase";
import { redirect } from "react-router-dom";

export async function authLoader() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw redirect("/auth");
  }
  return {
    ownerId: session.user.id,
    userEmail: session.user.email ?? null, // опционально
  };
}
