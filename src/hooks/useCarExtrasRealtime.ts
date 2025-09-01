// src/hooks/useCarExtrasRealtime.ts
import { useEffect } from "react";
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

          // безопасно: если вдруг пусто — просто дёрнем рефетч
          if (!row) {
            qc.invalidateQueries({
              queryKey: QK.carExtras(carId),
              refetchType: "all",
            });
            return;
          }

          onChange?.({ type, row });
          qc.invalidateQueries({
            queryKey: QK.carExtras(carId),
            refetchType: "all",
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [carId, onChange, qc]);
}

// import { useEffect } from "react";
// import { useQueryClient } from "@tanstack/react-query";
// import { supabase } from "@/lib/supabase";
// import { QK } from "@/queryKeys";

// type ChangeType = "INSERT" | "UPDATE" | "DELETE";
// type OnChange = (e: { type: ChangeType; row: any }) => void;

// /**
//  * Слушает INSERT/UPDATE/DELETE по car_extras конкретной машины.
//  * На INSERT/UPDATE отдаёт row = payload.new, на DELETE — row = payload.old.
//  * Плюс дергает invalidateQueries(QK.carExtras(carId)).
//  */
// export function useCarExtrasRealtime(
//   carId: string | null,
//   onChange?: OnChange
// ) {
//   const qc = useQueryClient();

//   useEffect(() => {
//     if (!carId) return;

//     const channel = supabase
//       .channel(`car-extras-${carId}`)
//       .on(
//         "postgres_changes",
//         {
//           event: "INSERT",
//           schema: "public",
//           table: "car_extras",
//           filter: `car_id=eq.${carId}`,
//         },
//         (payload) => {
//           console.log("[RT car_extras]", payload);
//           const row = payload.new;
//           onChange?.({ type: "INSERT", row });
//           qc.invalidateQueries({
//             queryKey: QK.carExtras(carId),
//             refetchType: "all",
//           });
//         }
//       )
//       .on(
//         "postgres_changes",
//         {
//           event: "UPDATE",
//           schema: "public",
//           table: "car_extras",
//           filter: `car_id=eq.${carId}`,
//         },
//         (payload) => {
//           const row = payload.new;
//           onChange?.({ type: "UPDATE", row });
//           qc.invalidateQueries({
//             queryKey: QK.carExtras(carId),
//             refetchType: "all",
//           });
//         }
//       )
//       .on(
//         "postgres_changes",
//         {
//           event: "DELETE",
//           schema: "public",
//           table: "car_extras",
//           filter: `car_id=eq.${carId}`,
//         },
//         (payload) => {
//           console.log(payload);

//           const row = payload.old; // <-- ВАЖНО: на DELETE берём old
//           onChange?.({ type: "DELETE", row });
//           qc.invalidateQueries({
//             queryKey: QK.carExtras(carId),
//             refetchType: "all",
//           });
//         }
//       )
//       .subscribe();

//     return () => {
//       void supabase.removeChannel(channel);
//     };
//   }, [carId, qc, onChange]);
// }
