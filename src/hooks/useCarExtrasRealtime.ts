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

  // держим onChange стабильным между рендерами
  const cbRef = useRef<OnChange | undefined>(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  // троттлинг "пинков"
  const lastKickRef = useRef(0);

  useEffect(() => {
    if (!carId) return;

    const topic = `car-extras-${carId}`;
    let cancelled = false;
    let ch: RealtimeChannel | null = null;
    let wired = false; // чтобы не навешивать обработчики повторно
    let attempt = 0; // экспоненциальный бэкофф

    const isOnline = () =>
      typeof navigator === "undefined" ? true : navigator.onLine;

    const getOrCreateChannel = (): RealtimeChannel => {
      const existing = supabase
        .getChannels?.()
        .find((c: any) => c?.topic === topic) as RealtimeChannel | undefined;
      return existing ?? supabase.channel(topic);
    };

    const ensureSubscribed = () => {
      if (cancelled || !ch) return;
      if (!isOnline()) return;

      const state = (ch as any)?.state; // "closed" | "joining" | "joined" | ...
      if (state === "joined" || state === "joining") return;

      ch.subscribe((s) => {
        // статусы: "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR"
        console.log("[RT car_extras] ensureSubscribed →", s, { carId });
      });
    };

    const wireHandlers = () => {
      if (wired || !ch) return;
      wired = true;

      // 1) Слушаем сами изменения
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

          // отдадим наружу
          cbRef.current?.({ type, row });

          // и на всякий случай дернём refetch
          qc.invalidateQueries({
            queryKey: QK.carExtras(carId),
            refetchType: "all",
          });
        }
      );

      // 2) Жизненный цикл канала
      ch.subscribe(async (status) => {
        console.log("[RT car_extras]", status, { carId });

        if (status === "SUBSCRIBED") {
          attempt = 0;
          // сразу синхронизируем UI
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
          if (cancelled) return;

          // офлайн? просто ждём online
          if (!isOnline()) return;

          // мягко отцепимся и попробуем через бэкофф
          try {
            await ch?.unsubscribe();
          } catch {}

          const base = 1200;
          const delay =
            Math.min(base * Math.pow(2, attempt), 20_000) +
            Math.floor(Math.random() * 500);
          attempt = Math.min(attempt + 1, 8);

          setTimeout(() => {
            if (cancelled) return;
            ch = getOrCreateChannel();
            wired = false;
            wireHandlers();
            ensureSubscribed();
          }, delay);

          // если есть auth — можно освежить (не критично)
          try {
            await supabase.auth.refreshSession();
          } catch {}
        }
      });
    };

    // первый запуск
    ch = getOrCreateChannel();
    wireHandlers();
    ensureSubscribed();

    // "пинок" при онлайне/возврате во вкладку
    const kick = async (source: "network" | "visibility") => {
      const now = Date.now();
      if (now - lastKickRef.current < 1500) return; // троттлинг
      lastKickRef.current = now;

      console.log(
        source === "network"
          ? "[RT car_extras] browser ONLINE — reconnect socket & rejoin"
          : "[RT car_extras] tab visible — recheck subscription",
        { carId }
      );

      try {
        supabase.realtime.connect(); // поднимем сокет, если спит
      } catch {}

      // если канал спит — подпишемся
      ensureSubscribed();

      // и сразу подтянем свежие данные
      await qc.invalidateQueries({
        queryKey: QK.carExtras(carId),
        refetchType: "all",
      });
    };

    const onOnline = () => kick("network");
    const onVisibility = () => {
      if (document.visibilityState === "visible") kick("visibility");
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      // Чистый выход: отписка и удаление канала
      (async () => {
        try {
          await ch?.unsubscribe();
        } catch {}
        try {
          if (ch) supabase.removeChannel?.(ch);
        } catch {}
      })();
    };
  }, [carId, qc]);
}

// // src/hooks/useCarExtrasRealtime.ts
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
