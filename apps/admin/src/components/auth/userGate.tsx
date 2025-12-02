// src/components/auth/UserGate.tsx
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import HydrateFallback from "@/components/hydrateFallback";
import UserLayout from "@/layout/userLayout";

export default function UserGate() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        setUserId(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data: adminRow, error } = await supabase
        .from("admin_users")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error && error.code !== "PGRST116") {
        console.error("admin_users select error", error);
      }

      setIsAdmin(!!adminRow);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <HydrateFallback />;

  // не залогинен
  if (!userId) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  // админ пытается зайти в /user/:id → посылаем его в кабинет админа
  if (isAdmin) {
    return (
      <Navigate to={`/admin/dashboard`} replace state={{ from: location }} />
    );
  }

  // обычный пользователь → нормальный пользовательский layout
  return <UserLayout />;
}
