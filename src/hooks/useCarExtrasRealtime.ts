// src/hooks/useCarExtrasRealtime.ts
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { QK } from "@/queryKeys";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type ChangeType = "INSERT" | "UPDATE" | "DELETE";
type OnChange = (e: { type: ChangeType; row: any }) => void;

export function useCarExtrasRealtime(
  carId: string | null,
  onChange?: OnChange
) {
  const qc = useQueryClient();

  // фиксируем колбэк в ref, чтобы эффект НЕ зависел от его идентичности
  const cbRef = useRef<OnChange | undefined>(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!carId) return;

    const topic = `car-extras-${carId}`;

    // убьём возможные дубли перед подпиской
    supabase.getChannels?.().forEach((c: any) => {
      if (c?.topic === topic) {
        void supabase.removeChannel(c);
      }
    });

    const ch = supabase
      .channel(topic)
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

          // локальный патч
          cbRef.current?.({ type, row });

          // и на всякий — инвалидация RQ
          qc.invalidateQueries({
            queryKey: QK.carExtras(carId),
            refetchType: "all",
          });
        }
      )
      .subscribe((status) => {
        console.log("[RT car_extras]", status, { carId });
      });

    return () => {
      // ВАЖНО: вызываем только removeChannel (НЕ дублировать unsubscribe())
      void supabase.removeChannel(ch);
    };
  }, [carId, qc]);
}
