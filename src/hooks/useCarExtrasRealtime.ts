// src/realtime/useCarFeaturesRealtime.ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { QK } from "@/queryKeys";

export function useCarExtrasRealtime(carId: string | null) {
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
        () => {
          qc.invalidateQueries({
            queryKey: QK.carExtras(carId),
            refetchType: "all",
          });
          qc.refetchQueries({
            queryKey: QK.carExtras(carId),
            type: "active",
          });
        }
      )
      .subscribe();

    // ВАЖНО: очистка должна вернуть void, а не Promise
    return () => {
      void supabase.removeChannel(ch); // или: void ch.unsubscribe();
    };
  }, [qc, carId]);
}



// import { useEffect } from "react";
// import { supabase } from "@/lib/supabase";

// type CarExtraRow = {
//   car_id: string;
//   extra_id: string;
//   price: number;
// };

// type ExtraVM = {
//   extra_id: string;
//   price: number;
//   is_available: boolean;
//   meta: {
//     id: string;
//     name: string;
//     description: string;
//     price_type: "per_day" | "per_rental" | "per_unit";
//     is_active: boolean;
//   };
// };

// // onPatch — как обновить CarContext.extras
// export function useCarExtrasRealtime(
//   carId: string | null,
//   onPatch: (updater: (prev: ExtraVM[]) => ExtraVM[]) => void
// ) {
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
//         (payload) => {
//           const rowNew = payload.new as CarExtraRow | null;
//           const rowOld = payload.old as CarExtraRow | null;

//           if (payload.eventType === "DELETE" && rowOld) {
//             const eid = rowOld.extra_id;
//             onPatch((prev) =>
//               (prev ?? []).map((e) =>
//                 e.extra_id === eid ? { ...e, is_available: false, price: 0 } : e
//               )
//             );
//             return;
//           }

//           if (
//             (payload.eventType === "INSERT" ||
//               payload.eventType === "UPDATE") &&
//             rowNew
//           ) {
//             const { extra_id, price } = rowNew;
//             onPatch((prev) =>
//               (prev ?? []).map((e) =>
//                 e.extra_id === extra_id
//                   ? { ...e, is_available: true, price: Number(price) }
//                   : e
//               )
//             );
//             return;
//           }
//         }
//       )
//       .subscribe();

//     // важный момент: синхронная очистка
//     return () => {
//       void supabase.removeChannel(ch);
//     };
//   }, [carId, onPatch]);
// }
