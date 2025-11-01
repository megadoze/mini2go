import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { QK } from "@/queryKeys";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type RTCar = {
  id: string;
  include_mileage?: number | null;
  is_delivery?: boolean | null;
  delivery_fee?: number | null;
  license_plate?: string | null;
  body_type?: string | null;
  fuel_type?: string | null;
  drive_type?: string | null;
  engine_capacity?: number | null;
  // ... остальное как у тебя
};

export function useCarsRealtime(
  onCarPatched?: (id: string, patch: any) => void
) {
  const qc = useQueryClient();

  useEffect(() => {
    const topic = "cars-realtime";

    for (const c of supabase.getChannels()) {
      if (c.topic === topic) supabase.removeChannel(c);
    }

    const isCarsList = (q: any) =>
      Array.isArray(q.queryKey) &&
      (q.queryKey[0] === QK.cars[0] || q.queryKey[0] === QK.carsByHost("_")[0]);

    const ch = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cars" },
        (payload: RealtimePostgresChangesPayload<RTCar>) => {
          const event = payload.eventType;

          if (event === "DELETE") {
            const row = payload.old as RTCar; // здесь old точно с id
            const id = String(row.id);

            qc.setQueriesData(
              { predicate: isCarsList },
              (list: any[] | undefined) =>
                Array.isArray(list)
                  ? list.filter((c) => String(c.id) !== id)
                  : list
            );
            qc.invalidateQueries({ queryKey: QK.car(id) });
            return;
          }

          if (event === "INSERT") {
            // new гарантированно есть
            // можно точечно воткнуть в список, но самый надёжный путь — рефетч
            qc.invalidateQueries({ queryKey: QK.cars });
            qc.setQueriesData({ predicate: isCarsList }, (list: any) => list);
            return;
          }

          if (event === "UPDATE") {
            const row = payload.new as RTCar; // здесь new точно с id
            const id = String(row.id);

            // нормализуем snake -> camel
            const patch: any = { ...row };
            if ("include_mileage" in row)
              patch.includeMileage = row.include_mileage;
            if ("is_delivery" in row) patch.isDelivery = row.is_delivery;
            if ("delivery_fee" in row) patch.deliveryFee = row.delivery_fee;
            if ("license_plate" in row) patch.licensePlate = row.license_plate;
            if ("body_type" in row) patch.bodyType = row.body_type;
            if ("fuel_type" in row) patch.fuelType = row.fuel_type;
            if ("drive_type" in row) patch.driveType = row.drive_type;
            if ("engine_capacity" in row)
              patch.engineCapacity = row.engine_capacity;

            qc.setQueryData(QK.car(id), (prev: any) =>
              prev ? { ...prev, ...patch } : prev
            );
            qc.setQueriesData(
              { predicate: isCarsList },
              (list: any[] | undefined) =>
                Array.isArray(list)
                  ? list.map((c) =>
                      String(c.id) === id ? { ...c, ...patch } : c
                    )
                  : list
            );

            onCarPatched?.(id, patch);
            return;
          }
        }
      )

      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          qc.invalidateQueries({ queryKey: QK.cars, refetchType: "all" });
        }
      });

    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc, onCarPatched]);
}

// // src/realtime/useCarsRealtime.ts
// import { useEffect } from "react";
// import { useQueryClient } from "@tanstack/react-query";
// import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
// import { supabase } from "@/lib/supabase";
// import { QK } from "@/queryKeys";

// type RTCar = {
//   id: string;
//   vin?: string | null;
//   year?: number | null;
//   fuelType?: string | null;
//   transmission?: string | null;
//   seats?: number | null;
//   licensePlate?: string | null;
//   engineCapacity?: number | null;
//   status?: string | null;
//   bodyType?: string | null;
//   driveType?: string | null;
//   color?: string | null;
//   doors?: number | null;
//   photos?: string[] | null;
//   content?: string | null;
//   include_mileage?: number | null;
// };

// export function useCarsRealtime(
//   onCarPatched?: (id: string, patch: any) => void
// ) {
//   const qc = useQueryClient();

//   useEffect(() => {
//     const isCarsList = (q: any) =>
//       Array.isArray(q.queryKey) &&
//       (q.queryKey[0] === QK.cars[0] || q.queryKey[0] === QK.carsByHost("_")[0]); // "cars" | "carsByHost"

//     const ch = supabase
//       .channel("cars-realtime")
//       .on(
//         "postgres_changes",
//         { event: "*", schema: "public", table: "cars" },
//         (payload: RealtimePostgresChangesPayload<RTCar>) => {
//           const newRow = (payload.new ?? null) as Partial<RTCar> | null;
//           const oldRow = (payload.old ?? null) as Partial<RTCar> | null;
//           const id = String(newRow?.id ?? oldRow?.id ?? "");
//           if (!id) return;

//           if (payload.eventType === "DELETE") {
//             // списки
//             qc.setQueriesData(
//               { predicate: isCarsList },
//               (list: any[] | undefined) =>
//                 Array.isArray(list)
//                   ? list.filter((c) => String(c.id) !== id)
//                   : list
//             );
//             // карточка
//             qc.invalidateQueries({ queryKey: QK.car(id) });
//             return;
//           }

//           if (payload.eventType === "INSERT") {
//             // проще и надёжнее: подтянуть свежий список(и)
//             qc.invalidateQueries({ queryKey: QK.cars });
//             qc.setQueriesData({ predicate: isCarsList }, (list: any) => list); // no-op, но триггерит subscribers
//             return;
//           }

//           // UPDATE: точечно патчим
//           const patch = newRow ?? {};

//           // 👇 нормализация snake -> camel
//           const normalized: any = { ...patch };

//           if ("include_mileage" in patch)
//             normalized.includeMileage = patch.include_mileage;

//           if ("is_delivery" in patch) normalized.isDelivery = patch.is_delivery;
//           if ("delivery_fee" in patch)
//             normalized.deliveryFee = patch.delivery_fee;

//           if ("license_plate" in patch)
//             normalized.licensePlate = patch.license_plate;

//           if ("body_type" in patch) normalized.bodyType = patch.body_type;
//           if ("fuel_type" in patch) normalized.fuelType = patch.fuel_type;
//           if ("drive_type" in patch) normalized.driveType = patch.drive_type;
//           if ("engine_capacity" in patch)
//             normalized.engineCapacity = patch.engine_capacity;

//           // карточка
//           qc.setQueryData(QK.car(id), (prev: any) =>
//             prev ? { ...prev, ...normalized } : prev
//           );

//           // списки
//           qc.setQueriesData(
//             { predicate: isCarsList },
//             (list: any[] | undefined) =>
//               Array.isArray(list)
//                 ? list.map((c) =>
//                     String(c.id) === id ? { ...c, ...normalized } : c
//                   )
//                 : list
//           );

//           onCarPatched?.(id, normalized);
//         }
//       )
//       .subscribe();

//     return () => {
//       supabase.removeChannel(ch);
//     };
//   }, [qc]);
// }
