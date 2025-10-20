import { redirect, type LoaderFunction } from "react-router";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { getGlobalSettings } from "@/services/settings.service";
import { QK } from "@/queryKeys";
import type { AppSettings } from "@/types/setting";

export const settingsGlobalLoader: LoaderFunction = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const ownerId = session?.user?.id ?? null;
  if (!ownerId) return { ownerId: null };

  if (!ownerId) return redirect("/login");

await queryClient.ensureQueryData<AppSettings | null>({
  queryKey: QK.appSettingsByOwner(ownerId),
  queryFn: () => getGlobalSettings(ownerId),
  staleTime: 5 * 60_000,
});


  return { ownerId };
};
