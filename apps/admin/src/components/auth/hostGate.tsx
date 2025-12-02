// src/components/auth/HostGate.tsx
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import HydrateFallback from "@/components/hydrateFallback";
import HostLayout from "@/layout/hostLayout";
import type { RealtimeChannel } from "@supabase/supabase-js";

export default function HostGate() {
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let mounted = true;

    const check = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (authError) {
        console.error("[HostGate] auth.getUser error", authError);
      }

      setUserId(user?.id ?? null);

      if (!user) {
        setIsHost(false);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // 1) Проверяем, админ ли
      const { data: adminRow, error: adminError } = await supabase
        .from("admin_users")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (adminError && adminError.code !== "PGRST116") {
        console.error("[HostGate] admin_users select error", adminError);
      }

      if (adminRow) {
        // админ → дальше даже не считаем машины
        setIsAdmin(true);
        setIsHost(false);
        setLoading(false);
        return;
      }

      // 2) Не админ → проверяем, хост ли (есть ли машины)
      const { count, error: carsError } = await supabase
        .from("cars")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id);

      if (!mounted) return;

      if (carsError) {
        console.error("[HostGate] cars count error", carsError);
      }

      setIsHost((count ?? 0) > 0);
      setIsAdmin(false);
      setLoading(false);
    };

    (async () => {
      await check();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // слушаем изменения по машинам только для НЕ админа
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

  // 1) Админ → сразу в админский кабинет
  if (isAdmin && userId) {
    return (
      <Navigate to={`/admin/dashboard`} replace state={{ from: location }} />
    );
  }

  // 2) Не админ и не хост → в кабинет юзера
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

  // 3) Хост → хостовский layout
  return <HostLayout />;
}
