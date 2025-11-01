import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

export function useIsHost() {
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let mounted = true;

    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) {
          setIsHost(false);
          setLoading(false);
        }
        return;
      }
      const { count } = await supabase
        .from("cars")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id);

      if (mounted) {
        setIsHost((count ?? 0) > 0);
        setLoading(false);
      }
    };

    (async () => {
      await check(); // первичная проверка

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // подписываемся только на свои изменения
      channel = supabase
        .channel("host-flag-side")
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
          } // колбэк без async сигнатуры
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      channel?.unsubscribe(); // или supabase.removeChannel(channel)
    };
  }, []);

  return { isHost, loading };
}
