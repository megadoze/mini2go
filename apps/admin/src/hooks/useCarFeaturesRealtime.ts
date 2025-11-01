import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { QK } from "@/queryKeys";

export function useCarFeaturesRealtimeRQ(carId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!carId) return;

    const topic = `car-features-${carId}`;
    const key = QK.carFeatures(carId);

    for (const c of supabase.getChannels()) {
      if (c.topic === topic) supabase.removeChannel(c);
    }

    const ch = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "car_features",
          filter: `car_id=eq.${carId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: key, refetchType: "all" });
          qc.refetchQueries({ queryKey: key, type: "active" });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          qc.invalidateQueries({ queryKey: key, refetchType: "all" });
        }
      });

    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc, carId]);
}

// // src/realtime/useCarFeaturesRealtime.ts
// import { useEffect } from "react";
// import { useQueryClient } from "@tanstack/react-query";
// import { supabase } from "@/lib/supabase";
// import { QK } from "@/queryKeys";

// export function useCarFeaturesRealtimeRQ(carId: string | null) {
//   const qc = useQueryClient();

//   useEffect(() => {
//     if (!carId) return;

//     const ch = supabase
//       .channel(`car-features-${carId}`)
//       .on(
//         "postgres_changes",
//         {
//           event: "*",
//           schema: "public",
//           table: "car_features",
//           filter: `car_id=eq.${carId}`,
//         },
//         () => {
//           qc.invalidateQueries({
//             queryKey: QK.carFeatures(carId),
//             refetchType: "all",
//           });
//           qc.refetchQueries({
//             queryKey: QK.carFeatures(carId),
//             type: "active",
//           });
//         }
//       )
//       .subscribe();

//     // ВАЖНО: очистка должна вернуть void, а не Promise
//     return () => {
//       void supabase.removeChannel(ch); // или: void ch.unsubscribe();
//     };
//   }, [qc, carId]);
// }
