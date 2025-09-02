// src/hooks/useCarExtrasRealtime.ts
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { QK } from "@/queryKeys";
import type {
  RealtimePostgresChangesPayload,
  RealtimeChannel,
} from "@supabase/supabase-js";

type ChangeType = "INSERT" | "UPDATE" | "DELETE";
type OnChange = (e: { type: ChangeType; row: any }) => void;

export function useCarExtrasRealtime(
  carId: string | null,
  onChange?: OnChange
) {
  const qc = useQueryClient();

  // хранить колбэк без пересоздания подписки
  const cbRef = useRef<OnChange | undefined>(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!carId) return;
    let ch: RealtimeChannel | null = null;
    let disposed = false;
    let attempt = 0;
    const MAX_DELAY = 30_000;

    const log = (msg: string) => console.log("[RT car_extras]", msg, { carId });

    const subscribe = () => {
      if (disposed) return;

      // на всякий пожарный: если вдруг есть старый канал с таким именем — уберём
      supabase
        .getChannels()
        .filter(
          (c) =>
            c.topic === `realtime:public:car_extras:car_id=eq.${carId}` ||
            c.topic === `car-extras-${carId}`
        )
        .forEach((c) => supabase.removeChannel(c));

      ch = supabase
        .channel(`car-extras-${carId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "car_extras",
            filter: `car_id=eq.${carId}`,
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const type = payload.eventType as ChangeType;
            const row = type === "DELETE" ? payload.old : payload.new;

            cbRef.current?.({ type, row });
            qc.invalidateQueries({
              queryKey: QK.carExtras(carId),
              refetchType: "all",
            });
          }
        )
        .subscribe((status) => {
          log(status);
          if (status === "SUBSCRIBED") {
            attempt = 0; // сбросить бэкофф
          }
          if (
            status === "CLOSED" ||
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT"
          ) {
            // аккуратно переподключаемся с бэкоффом
            if (disposed) return;
            const delay = Math.min(1000 * Math.pow(2, attempt++), MAX_DELAY);
            // подчистить текущий канал
            if (ch) {
              void supabase.removeChannel(ch);
              ch = null;
            }
            window.setTimeout(() => !disposed && subscribe(), delay);
          }
        });
    };

    subscribe();

    return () => {
      disposed = true;
      if (ch) {
        void supabase.removeChannel(ch);
        ch = null;
      }
    };
  }, [carId, qc]);
}
