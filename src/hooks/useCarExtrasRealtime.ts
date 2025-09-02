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

  // 1) Храним последний колбэк, не ломая подписку
  const cbRef = useRef<OnChange | undefined>(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  // 2) Подписка зависит ТОЛЬКО от carId (и qc)
  useEffect(() => {
    if (!carId) return;

    const ch = supabase
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

          // вызываем актуальный onChange из ref
          cbRef.current?.({ type, row });

          // и дергаем рефетч для бэкапа
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
      void supabase.removeChannel(ch);
    };
  }, [carId, qc]); // <-- без onChange!
}
