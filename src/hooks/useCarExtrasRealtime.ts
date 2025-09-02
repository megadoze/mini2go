// // src/hooks/useCarExtrasRealtime.ts
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { QK } from "@/queryKeys";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";

type ChangeType = "INSERT" | "UPDATE" | "DELETE";
type OnChange = (e: { type: ChangeType; row: any }) => void;

// реюзаем один канал на topic, чтобы не плодить дубли при ремаунтах
const byTopic: Record<string, RealtimeChannel> = {};

export function useCarExtrasRealtime(
  carId: string | null,
  onChange?: OnChange
) {
  const qc = useQueryClient();
  const cbRef = useRef(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  const kickTs = useRef(0);

  useEffect(() => {
    if (!carId) return;

    const topic = `car-extras-${carId}`;

    // берём существующий или создаём
    const ch = byTopic[topic] ?? (byTopic[topic] = supabase.channel(topic));
    let wired = false;
    let joined = (ch as any).state === "joined";

    const isOnline = () =>
      typeof navigator === "undefined" ? true : navigator.onLine;

    const wireOnce = () => {
      if (wired) return;
      wired = true;

      // изменения из БД
      ch.on(
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
          qc.invalidateQueries({
            queryKey: QK.carExtras(carId),
            refetchType: "all",
          });
        }
      );

      // единый обработчик статусов
      ch.subscribe(async (status) => {
        console.log("[RT car_extras]", status, { carId });

        if (status === "SUBSCRIBED") {
          joined = true;
          await qc.invalidateQueries({
            queryKey: QK.carExtras(carId),
            refetchType: "all",
          });
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          // не отписываемся и не удаляем канал — даём Realtime самому реjoin'иться
          joined = false;
        }
      });
    };

    wireOnce();

    // лёгкий пинок: НИЧЕГО не делаем с сокетом здесь, только просим канал попробовать join и рефетчим
    const kick = () => {
      const now = Date.now();
      if (now - kickTs.current < 1500) return; // троттлинг
      kickTs.current = now;

      if (isOnline() && !joined) {
        // повторный join БЕЗ колбэка (чтобы не плодить обработчики)
        ch.subscribe();
      }
      qc.invalidateQueries({
        queryKey: QK.carExtras(carId),
        refetchType: "all",
      });
    };

    const onOnline = () => kick();
    const onVisibility = () => {
      if (document.visibilityState === "visible") kick();
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      // Канал не удаляем — он шарится по topic.
      // Если хочешь агрессивный cleanup: расскомментируй блок ниже, но тогда следи, чтобы других подписок на этот topic не было.
      // (async () => {
      //   try {
      //     await ch.unsubscribe();
      //   } catch {}
      //   try {
      //     supabase.removeChannel(ch);
      //   } catch {}
      //   delete byTopic[topic];
      // })();
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
