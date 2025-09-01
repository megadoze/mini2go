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
  const cbRef = useRef<OnChange | null>(null);
  cbRef.current = onChange ?? null;

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

          // если что-то пошло не так — хотя бы перерендерим список
          if (!row) {
            qc.invalidateQueries({
              queryKey: QK.carExtras(carId),
              refetchType: "all",
            });
            return;
          }

          cbRef.current?.({ type, row });
          qc.invalidateQueries({
            queryKey: QK.carExtras(carId),
            refetchType: "all",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // 👇 только carId и qc!
  }, [carId, qc]);
}

// import { useEffect } from "react";
// import { useQueryClient } from "@tanstack/react-query";
// import { supabase } from "@/lib/supabase";
// import { QK } from "@/queryKeys";
// import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

// type ChangeType = "INSERT" | "UPDATE" | "DELETE";
// type OnChange = (e: { type: ChangeType; row: any }) => void;

// export function useCarExtrasRealtime(
//   carId: string | null,
//   onChange?: OnChange
// ) {
//   const qc = useQueryClient();

//   useEffect(() => {
//     if (!carId) return;

//     const ch = supabase
//       .channel(`car-extras-${carId}`)
//       .on(
//         "postgres_changes",
//         {
//           event: "*",
//           schema: "public",
//           table: "car_extras",
//           filter: `car_id=eq.${carId}`,
//         },
//         (payload: RealtimePostgresChangesPayload<any>) => {
//           const type = payload.eventType as ChangeType;
//           const row = type === "DELETE" ? payload.old : payload.new;

//           // безопасно: если вдруг пусто — просто дёрнем рефетч
//           if (!row) {
//             qc.invalidateQueries({
//               queryKey: QK.carExtras(carId),
//               refetchType: "all",
//             });
//             return;
//           }

//           onChange?.({ type, row });
//           qc.invalidateQueries({
//             queryKey: QK.carExtras(carId),
//             refetchType: "all",
//           });
//         }
//       )
//       .subscribe();

//     return () => {
//       void supabase.removeChannel(ch);
//     };
//   }, [carId, onChange, qc]);
// }
