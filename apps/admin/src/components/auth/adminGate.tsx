// src/components/auth/adminGate.tsx
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import HydrateFallback from "@/components/hydrateFallback";

type Props = { children: JSX.Element };

export default function AdminGate({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data: adminRow, error } = await supabase
        .from("admin_users")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error && error.code !== "PGRST116") {
        console.error("admin_users select error", error);
      }

      setIsAdmin(!!adminRow);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <HydrateFallback />;

  // не админ — выкидываем в корень, дальше HostGate/UserGate сами разрулят
  if (!isAdmin) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  // админ — пускаем дальше
  return children;
}
