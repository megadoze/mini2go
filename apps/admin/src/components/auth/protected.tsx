// src/components/auth/Protected.tsx
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import HydrateFallback from "@/components/hydrateFallback";

type Props = { children: JSX.Element };

export default function Protected({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let unsub = () => {};
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    unsub = () => sub.subscription.unsubscribe();
    return unsub;
  }, []);

  if (loading) return <HydrateFallback />;
  if (authed) return children;

  const from = location.pathname + location.search + location.hash;

  // ❗ Только если пользователь шёл НЕ на корень — добавляем redirect
  const shouldAppendRedirect = from !== "/" && from !== "/auth";

  if (!shouldAppendRedirect) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Navigate
      to={`/auth?redirect=${encodeURIComponent(from)}`}
      replace
      state={{ from: location }}
    />
  );
}
