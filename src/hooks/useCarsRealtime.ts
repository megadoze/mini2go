// src/realtime/useCarsRealtime.ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { QK } from "@/queryKeys";

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
  include_mileage?: number | null;
};

export function useCarsRealtime(
  onCarPatched?: (id: string, patch: any) => void
) {
  const qc = useQueryClient();

  useEffect(() => {
    const isCarsList = (q: any) =>
      Array.isArray(q.queryKey) &&
      (q.queryKey[0] === QK.cars[0] || q.queryKey[0] === QK.carsByHost("_")[0]); // "cars" | "carsByHost"

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

          if (payload.eventType === "DELETE") {
            // списки
            qc.setQueriesData(
              { predicate: isCarsList },
              (list: any[] | undefined) =>
                Array.isArray(list)
                  ? list.filter((c) => String(c.id) !== id)
                  : list
            );
            // карточка
            qc.invalidateQueries({ queryKey: QK.car(id) });
            return;
          }

          if (payload.eventType === "INSERT") {
            // проще и надёжнее: подтянуть свежий список(и)
            qc.invalidateQueries({ queryKey: QK.cars });
            qc.setQueriesData({ predicate: isCarsList }, (list: any) => list); // no-op, но триггерит subscribers
            return;
          }

          // UPDATE: точечно патчим
          const patch = newRow ?? {};

          // 👇 нормализация snake -> camel
          const normalized: any = { ...patch };

          if ("include_mileage" in patch)
            normalized.includeMileage = patch.include_mileage;

          if ("is_delivery" in patch) normalized.isDelivery = patch.is_delivery;
          if ("delivery_fee" in patch)
            normalized.deliveryFee = patch.delivery_fee;

          // if (Object.prototype.hasOwnProperty.call(patch, "is_delivery")) {
          //   normalized.isDelivery = (patch as any).is_delivery;
          // }
          // if (Object.prototype.hasOwnProperty.call(patch, "delivery_fee")) {
          //   normalized.deliveryFee = (patch as any).delivery_fee;
          // }
          // if ("license_plate" in patch)
          //   normalized.licensePlate = patch.license_plate;
          // if ("is_delivery" in patch) normalized.isDelivery = patch.is_delivery;
          // if ("delivery_fee" in patch)
          //   normalized.deliveryFee = patch.delivery_fee;

          // if (Object.prototype.hasOwnProperty.call(patch, "include_mileage")) {
          //   normalized.includeMileage = (patch as any).include_mileage;
          // }

          // карточка
          qc.setQueryData(QK.car(id), (prev: any) =>
            prev ? { ...prev, ...normalized } : prev
          );

          // списки
          qc.setQueriesData(
            { predicate: isCarsList },
            (list: any[] | undefined) =>
              Array.isArray(list)
                ? list.map((c) =>
                    String(c.id) === id ? { ...c, ...normalized } : c
                  )
                : list
          );

          onCarPatched?.(id, normalized);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
}
