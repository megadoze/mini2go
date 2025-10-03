// src/hooks/useCarExtrasRealtime.ts
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { QK } from "@/queryKeys";
import type {
  RealtimePostgresChangesPayload,
  RealtimeChannel,
} from "@supabase/supabase-js";

type ChangeType = "INSERT" | "UPDATE" | "DELETE";
type OnChange = (e: { type: ChangeType; row: any }) => void;

export function useCarExtrasRealtime(
  carId: string | null,
  onChange?: OnChange
) {
  const qc = useQueryClient();

  const cbRef = useRef<OnChange | undefined>(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!carId) return;

    const topic = `car-extras-${carId}`;
    let ch: RealtimeChannel | null = null;
    let cancelled = false;
    let attempt = 0;
    let reopening = false;

    const backoff = () =>
      Math.min(1500 * Math.pow(2, attempt++), 10_000) +
      Math.floor(Math.random() * 300);

    const wire = (channel: RealtimeChannel) => {
      channel.on(
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
          cbRef.current?.({ type, row });

          // страховочный рефетч
          qc.invalidateQueries({
            queryKey: QK.carExtras(carId),
            refetchType: "all",
          });
        }
      );

      channel.subscribe(async (status) => {
        // console.log("[RT car_extras]", status, { carId });

        if (status === "SUBSCRIBED") {
          attempt = 0;
          reopening = false;
          await qc.invalidateQueries({
            queryKey: QK.carExtras(carId),
            refetchType: "all",
          });
          return;
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          if (cancelled || reopening) return;
          reopening = true;

          const delay = backoff();
          setTimeout(async () => {
            if (cancelled) return;
            try {
              await ch?.unsubscribe();
            } catch {}
            try {
              supabase.removeChannel(ch!);
            } catch {}

            ch = supabase.channel(topic);
            wire(ch);
          }, delay);
        }
      });
    };

    // первый запуск
    ch = supabase.channel(topic);
    wire(ch);

    // «пинок» когда вкладка снова видима или сеть вернулась
    const kick = () => {
      if (cancelled) return;
      const st = (ch as any)?.state; // private, но другого нет
      if (st === "joined" || st === "joining") return;

      try {
        supabase.removeChannel(ch!);
      } catch {}
      ch = supabase.channel(topic);
      wire(ch);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") kick();
    };
    const onOnline = () => kick();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      try {
        ch?.unsubscribe();
      } catch {}
      try {
        supabase.removeChannel(ch!);
      } catch {}
    };
  }, [carId, qc]);
}

// src/hooks/useCarExtrasRealtime.ts
// import { useEffect, useRef } from "react";
// import { useQueryClient } from "@tanstack/react-query";
// import { supabase } from "@/lib/supabase";
// import { QK } from "@/queryKeys";
// import type {
//   RealtimePostgresChangesPayload,
//   RealtimeChannel,
// } from "@supabase/supabase-js";

// type ChangeType = "INSERT" | "UPDATE" | "DELETE";
// type OnChange = (e: { type: ChangeType; row: any }) => void;

// export function useCarExtrasRealtime(
//   carId: string | null,
//   onChange?: OnChange
// ) {
//   const qc = useQueryClient();

//   // стабильный колбэк
//   const cbRef = useRef<OnChange | undefined>(onChange);
//   useEffect(() => {
//     cbRef.current = onChange;
//   }, [onChange]);

//   useEffect(() => {
//     if (!carId) return;

//     let cancelled = false;
//     let attempt = 0;
//     let ch: RealtimeChannel | null = null;
//     const topic = `car-extras-${carId}`;
//     const isOnline = () =>
//       typeof navigator === "undefined" ? true : navigator.onLine;

//     const open = () => {
//       if (cancelled || !isOnline()) return;

//       // убираем возможные дубликаты канала (hot-reload/быстрые переходы)
//       (supabase.getChannels?.() ?? []).forEach((c: any) => {
//         if (c?.topic === topic) {
//           try {
//             supabase.removeChannel(c);
//           } catch {}
//         }
//       });

//       ch = supabase
//         .channel(topic)
//         .on(
//           "postgres_changes",
//           {
//             event: "*",
//             schema: "public",
//             table: "car_extras",
//             filter: `car_id=eq.${carId}`,
//           },
//           (payload: RealtimePostgresChangesPayload<any>) => {
//             const type = payload.eventType as ChangeType;
//             const row = type === "DELETE" ? payload.old : payload.new;
//             cbRef.current?.({ type, row });

//             // подстраховка: держим UI в синхронизации
//             qc.invalidateQueries({
//               queryKey: QK.carExtras(carId),
//               refetchType: "all",
//             });
//           }
//         )
//         .subscribe(async (status) => {
//           console.log("[RT car_extras]", status, { carId });

//           if (status === "SUBSCRIBED") {
//             attempt = 0;
//             // моментально тянем актуальные данные после (ре)подключения
//             await qc.invalidateQueries({
//               queryKey: QK.carExtras(carId),
//               refetchType: "all",
//             });
//             return;
//           }

//           if (
//             status === "CHANNEL_ERROR" ||
//             status === "TIMED_OUT" ||
//             status === "CLOSED"
//           ) {
//             if (cancelled) return;
//             if (!isOnline()) return; // оффлайн — ждём событие online

//             try {
//               await ch?.unsubscribe();
//             } catch {}
//             const base = 1200;
//             const delay =
//               Math.min(base * 2 ** attempt, 20_000) +
//               Math.round(Math.random() * 500);
//             attempt = Math.min(attempt + 1, 8);

//             setTimeout(() => {
//               if (!cancelled) open();
//             }, delay);
//           }
//         });
//     };

//     open();

//     // когда сеть вернулась — поднимем сокет и мгновенно подтянем состояние
//     const onOnline = async () => {
//       console.log(
//         "[RT car_extras] browser ONLINE — reconnect socket & rejoin",
//         { carId }
//       );
//       try {
//         supabase.realtime.connect();
//       } catch {}
//       await qc.invalidateQueries({
//         queryKey: QK.carExtras(carId),
//         refetchType: "all",
//       });
//       if (!cancelled && (!ch || (ch as any).state !== "joined")) open();
//     };

//     // при возврате во вкладку тоже «пнуть» соединение
//     const onVisibility = () => {
//       if (document.visibilityState === "visible") onOnline();
//     };

//     window.addEventListener("online", onOnline);
//     document.addEventListener("visibilitychange", onVisibility);

//     return () => {
//       cancelled = true;
//       window.removeEventListener("online", onOnline);
//       document.removeEventListener("visibilitychange", onVisibility);
//       try {
//         ch?.unsubscribe();
//       } catch {}
//       try {
//         if (ch) supabase.removeChannel(ch);
//       } catch {}
//     };
//   }, [carId, qc]);
// }
