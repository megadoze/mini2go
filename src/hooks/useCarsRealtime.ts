// src/realtime/useCarsRealtime.ts
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { QK } from "@/queryKeys";

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
  // остальные поля опустил для краткости
};

type OnCarPatched = (id: string, patch: any) => void;

export function useCarsRealtime(
  onCarPatched?: (id: string, patch: any) => void
) {
  const qc = useQueryClient();

  // 👇 держим актуальный колбэк в ref, чтобы НЕ попадать им в deps
  const cbRef = useRef<OnCarPatched | null>(null);
  cbRef.current = onCarPatched ?? null;

  const tabIdRef = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    const isCarsList = (q: any) =>
      Array.isArray(q.queryKey) &&
      (q.queryKey[0] === QK.cars[0] || q.queryKey[0] === QK.carsByHost("_")[0]);

    const applyPatch = (id: string, patch: any) => {
      qc.setQueryData(QK.car(id), (prev: any) =>
        prev ? { ...prev, ...patch } : prev
      );
      qc.setQueriesData({ predicate: isCarsList }, (list: any[] | undefined) =>
        Array.isArray(list)
          ? list.map((c) => (String(c.id) === id ? { ...c, ...patch } : c))
          : list
      );
      cbRef.current?.(id, patch);
    };

    // BroadcastChannel (единожды)
    const bc = new BroadcastChannel("cars");
    const onMsg = (ev: MessageEvent) => {
      const msg = ev.data as {
        id?: string;
        patch?: any;
        source?: string;
      } | null;
      if (!msg || !msg.id || !msg.patch) return;
      if (msg.source === tabIdRef.current) return; // игнорим свои
      applyPatch(String(msg.id), msg.patch);
    };
    bc.addEventListener("message", onMsg);

    // Supabase realtime (единожды)
    const ch = supabase
      .channel("cars-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cars" },
        (payload: RealtimePostgresChangesPayload<RTCar>) => {
          const newRow = payload.new ?? null;
          const oldRow = payload.old ?? null;
          const id = String((newRow as any)?.id ?? (oldRow as any)?.id ?? "");
          if (!id) return;

          if (payload.eventType === "DELETE") {
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

          if (payload.eventType === "INSERT") {
            qc.invalidateQueries({ queryKey: QK.cars });
            return;
          }

          // UPDATE
          const patch: any = { ...(newRow as any) };

          if ("include_mileage" in patch)
            patch.includeMileage = patch.include_mileage;
          if ("is_delivery" in patch) patch.isDelivery = patch.is_delivery;
          if ("delivery_fee" in patch) patch.deliveryFee = patch.delivery_fee;
          if ("license_plate" in patch)
            patch.licensePlate = patch.license_plate;
          if ("body_type" in patch) patch.bodyType = patch.body_type;
          if ("fuel_type" in patch) patch.fuelType = patch.fuel_type;
          if ("drive_type" in patch) patch.driveType = patch.drive_type;
          if ("engine_capacity" in patch)
            patch.engineCapacity = patch.engine_capacity;

          delete patch.include_mileage;
          delete patch.is_delivery;
          delete patch.delivery_fee;
          delete patch.license_plate;
          delete patch.body_type;
          delete patch.fuel_type;
          delete patch.drive_type;
          delete patch.engine_capacity;

          applyPatch(id, patch);

          // разошлём в другие вкладки (односторонне!)
          bc.postMessage({ id, patch, source: tabIdRef.current });
        }
      )
      .subscribe();

    return () => {
      bc.removeEventListener("message", onMsg);
      bc.close();
      supabase.removeChannel(ch);
    };
    // 👇 ВАЖНО: тут нет onCarPatched!
  }, [qc]);
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
