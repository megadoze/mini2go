import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { QK } from "@/queryKeys";

// Подмножество полей, которые реально приходят/нужны
type RTCar = {
  id: string;
  vin?: string | null;
  year?: number | null;
  fuelType?: string | null;
  transmission?: string | null;
  seats?: number | null;
  licensePlate?: string | null;
  engineCapacity?: number | null;
  status?: string | null;
  bodyType?: string | null;
  driveType?: string | null;
  color?: string | null;
  doors?: number | null;
  photos?: string[] | null;
  content?: string | null;
};

export function useCarsRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel("cars-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cars" },
        (payload: RealtimePostgresChangesPayload<RTCar>) => {
          const newRow = (payload.new ?? null) as Partial<RTCar> | null;
          const oldRow = (payload.old ?? null) as Partial<RTCar> | null;
          const id = String(newRow?.id ?? oldRow?.id ?? "");
          if (!id) return;

          // DELETE → убрать из списков и инвалиднуть деталь
          if (payload.eventType === "DELETE") {
            qc.setQueriesData(
              {
                predicate: (q) =>
                  Array.isArray(q.queryKey) && q.queryKey[0] === "carsList",
              },
              (list: any[] | undefined) =>
                list?.filter((c) => String(c.id) !== id)
            );
            qc.invalidateQueries({ queryKey: QK.car(id) });
            return;
          }

          // INSERT/UPDATE → точечно патчим кэш
          const patch = newRow ?? {};
          // 1) карточка
          qc.setQueryData(QK.car(id), (prev: any) =>
            prev ? { ...prev, ...patch } : prev
          );

          // 2) любые списки машин (если у вас ключ другой — поправьте predicate)
          qc.setQueriesData(
            {
              predicate: (q) =>
                Array.isArray(q.queryKey) && q.queryKey[0] === "carsList",
            },
            (list: any[] | undefined) =>
              Array.isArray(list)
                ? list.map((c) =>
                    String(c.id) === id ? { ...c, ...patch } : c
                  )
                : list
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
}
