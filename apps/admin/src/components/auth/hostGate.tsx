// src/components/auth/HostGate.tsx
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import HydrateFallback from "@/components/hydrateFallback";
import HostLayout from "@/layout/hostLayout"; // твой текущий
import type { RealtimeChannel } from "@supabase/supabase-js";

export default function HostGate() {
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let mounted = true;

    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
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

      if (!mounted) return;
      setIsHost((count ?? 0) > 0);
      setLoading(false);
    };

    (async () => {
      await check();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel("host-gate")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "cars",
            filter: `owner_id=eq.${user.id}`,
          },
          () => {
            void check();
          }
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      channel?.unsubscribe();
    };
  }, []);

  if (loading) return <HydrateFallback />;

  // если не хост — уводим в гостевой кабинет, HostLayout даже не монтируем
  if (!isHost) {
    if (userId) {
      return (
        <Navigate
          to={`/user/${userId}/dashboard`}
          replace
          state={{ from: location }}
        />
      );
    }
    return <Navigate to="/auth" replace />;
  }

  // хост — показываем весь "хостовый" shell
  return <HostLayout />;
}
