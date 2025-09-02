import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { QK } from "@/queryKeys";
import type { Booking } from "@/types/booking";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export function useBookingsRealtimeRQ(carId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!carId) return;

    const topic = `bookings-${carId}`;
    const listKey = QK.bookingsByCarId(carId);

    // 0) снести старые каналы этого же topic (защита от HMR/утечек)
    for (const c of supabase.getChannels()) {
      if (c.topic === topic) supabase.removeChannel(c);
    }

    // 1) создать и один раз подписаться
    const ch = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `car_id=eq.${carId}`,
        },
        (payload: RealtimePostgresChangesPayload<Booking>) => {
          const bNew = payload.new as Booking | null;
          const bOld = payload.old as Booking | null;
          const id = String(bNew?.id ?? bOld?.id ?? "");
          if (!id) return;

          if (payload.eventType === "INSERT" && bNew) {
            qc.setQueryData<Booking[]>(listKey, (prev) => [
              bNew,
              ...(prev ?? []),
            ]);
            qc.invalidateQueries({
              predicate: (q) =>
                Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
              refetchType: "all",
            });
            return;
          }
          if (payload.eventType === "UPDATE" && bNew) {
            qc.setQueryData<Booking[]>(listKey, (prev) =>
              (prev ?? []).map((b) => (b.id === id ? { ...b, ...bNew } : b))
            );
            qc.invalidateQueries({
              predicate: (q) =>
                Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
              refetchType: "all",
            });
            return;
          }
          if (payload.eventType === "DELETE" && bOld) {
            qc.setQueryData<Booking[]>(listKey, (prev) =>
              (prev ?? []).filter((b) => b.id !== id)
            );
            qc.removeQueries({ queryKey: QK.booking(id) });
            qc.removeQueries({ queryKey: QK.bookingExtras(id) });
            qc.invalidateQueries({
              predicate: (q) =>
                Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
              refetchType: "all",
            });
            return;
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // мягкий ресинк при первом джойне и при ре-джойне после онлайна
          qc.invalidateQueries({ queryKey: listKey, refetchType: "all" });
        }
      });

    // 2) синхронная очистка
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc, carId]);
}

// // src/realtime/useBookingsRealtime.ts
// import { useEffect } from "react";
// import { useQueryClient } from "@tanstack/react-query";
// import { supabase } from "@/lib/supabase";
// import { QK } from "@/queryKeys";
// import type { Booking } from "@/types/booking";

// export function useBookingsRealtimeRQ(carId: string | null) {
//   const qc = useQueryClient();

//   useEffect(() => {
//     if (!carId) return;

//     const listKey = QK.bookingsByCarId(carId);

//     const ch = supabase
//       .channel(`bookings-${carId}`)
//       .on(
//         "postgres_changes",
//         {
//           event: "*",
//           schema: "public",
//           table: "bookings",
//           filter: `car_id=eq.${carId}`,
//         },
//         (payload) => {
//           const bNew = payload.new as Booking | null;
//           const bOld = payload.old as Booking | null;
//           const id = String(bNew?.id ?? bOld?.id ?? "");
//           if (!id) return;

//           if (payload.eventType === "INSERT" && bNew) {
//             // CHANGE: добавляем запись в список броней этой машины
//             qc.setQueryData<Booking[]>(listKey, (prev) => [bNew, ...(prev ?? [])]);
//             // На всякий случай дёрнем большие окна календаря
//             qc.invalidateQueries({
//               predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
//               refetchType: "all",
//             });
//             return;
//           }

//           if (payload.eventType === "UPDATE" && bNew) {
//             // CHANGE: точечный патч списка броней
//             qc.setQueryData<Booking[]>(listKey, (prev) =>
//               (prev ?? []).map((b) => (b.id === id ? { ...b, ...bNew } as Booking : b))
//             );
//             qc.invalidateQueries({
//               predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
//               refetchType: "all",
//             });
//             return;
//           }

//           if (payload.eventType === "DELETE" && bOld) {
//             // CHANGE: удаляем из списка
//             qc.setQueryData<Booking[]>(listKey, (prev) =>
//               (prev ?? []).filter((b) => b.id !== id)
//             );
//             // Сносим точечные кэши (если есть)
//             qc.removeQueries({ queryKey: QK.booking(id) });
//             qc.removeQueries({ queryKey: QK.bookingExtras(id) });
//             qc.invalidateQueries({
//               predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
//               refetchType: "all",
//             });
//             return;
//           }
//         }
//       )
//       .subscribe();

//     // ВАЖНО: очистка — синхронно
//     return () => {
//       void supabase.removeChannel(ch);
//     };
//   }, [qc, carId]);
// }
