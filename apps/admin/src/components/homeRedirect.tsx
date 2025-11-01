import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import HydrateFallback from "@/components/hydrateFallback";

export default function HomeRedirect() {
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (!user) {
        setIsHost(false);
        setLoading(false);
        return;
      }
      const { count } = await supabase
        .from("cars")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id);
      setIsHost((count ?? 0) > 0);
      setLoading(false);
    })();
  }, []);

  if (loading) return <HydrateFallback />;
  if (isHost) return <Navigate to="/dashboard" replace />;
  if (userId) return <Navigate to={`/user/${userId}/dashboard`} replace />;
  return <Navigate to="/auth" replace />;
}
