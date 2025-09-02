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

  // держим onChange стабильным
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
    let reopening = false; // чтобы не ловить повторные CLOSED от нас же

    const ensureNoDuplicates = () => {
      // удалим все старые каналы с таким же topic (если остались после hot-reload и т.п.)
      const channels = (supabase.getChannels?.() ?? []).slice();
      for (const c of channels) {
        // @ts-ignore — у канала есть topic
        if (c?.topic === topic) {
          try {
            void supabase.removeChannel(c);
          } catch {}
        }
      }
    };

    const open = () => {
      if (cancelled) return;

      ensureNoDuplicates();

      ch = supabase
        .channel(topic)
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

            cbRef.current?.({ type, row });

            // подстраховочный рефетч
            qc.invalidateQueries({
              queryKey: QK.carExtras(carId),
              refetchType: "all",
            });
          }
        )
        .subscribe(async (status) => {
          console.log("[RT car_extras]", status, { carId });

          if (status === "SUBSCRIBED") {
            attempt = 0;
            reopening = false;
            return;
          }

          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            if (cancelled || reopening) return;

            reopening = true;

            // попробуем освежить сессию (если есть auth)
            try {
              await supabase.auth.refreshSession();
            } catch {}

            // аккуратно закроем текущий канал (без removeChannel в этом же колбэке)
            try {
              await ch?.unsubscribe();
            } catch {}

            const base = 1500;
            const delay =
              Math.min(base * Math.pow(2, attempt), 20000) +
              Math.round(Math.random() * 500);
            attempt = Math.min(attempt + 1, 8);

            setTimeout(() => {
              if (!cancelled) {
                open();
              }
            }, delay);
          }
        });
    };

    open();

    // переподписка при возврате вкладки
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        // лёгкая “тычка”: реоткроем канал, если он умер
        setTimeout(() => {
          if (!cancelled) {
            // если подписка не активна — откроем заново
            // не вызываем removeChannel тут — просто пробуем заново
            open();
          }
        }, 200);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      try {
        void ch?.unsubscribe();
      } catch {}
    };
  }, [carId, qc]);
}

// // src/hooks/useCarExtrasRealtime.ts
// import { useEffect, useRef } from "react";
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

//   // фиксируем колбэк
//   const cbRef = useRef<OnChange | undefined>(onChange);
//   useEffect(() => {
//     cbRef.current = onChange;
//   }, [onChange]);

//   useEffect(() => {
//     if (!carId) return;

//     const topic = `car-extras-${carId}`;
//     let cancelled = false;
//     let attempt = 0;

//     const ensureOneChannel = () => {
//       supabase.getChannels?.().forEach((c: any) => {
//         if (c?.topic === topic) {
//           void supabase.removeChannel(c);
//         }
//       });
//     };

//     const subscribe = () => {
//       if (cancelled) return;

//       ensureOneChannel();

//       const ch = supabase
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

//             // локальный патч
//             cbRef.current?.({ type, row });

//             // и подстраховка — RQ-инвалидация
//             qc.invalidateQueries({
//               queryKey: QK.carExtras(carId),
//               refetchType: "all",
//             });
//           }
//         )
//         .subscribe(async (status) => {
//           console.log("[RT car_extras]", status, { carId });

//           if (status === "SUBSCRIBED") {
//             attempt = 0; // успех — сбрасываем счётчик
//             return;
//           }

//           // Ошибки/таймауты/закрытия — пробуем восстановиться
//           if (
//             status === "CHANNEL_ERROR" ||
//             status === "TIMED_OUT" ||
//             status === "CLOSED"
//           ) {
//             if (cancelled) return;

//             // пробуем обновить сессию (если есть авторизация)
//             try {
//               await supabase.auth.refreshSession();
//             } catch {}

//             try {
//               await supabase.removeChannel(ch);
//             } catch {}

//             // экспоненциальный бэкофф с джиттером (до ~20с)
//             const base = 1500;
//             const delay =
//               Math.min(base * Math.pow(2, attempt), 20000) +
//               Math.round(Math.random() * 500);
//             attempt = Math.min(attempt + 1, 8);

//             setTimeout(() => {
//               if (!cancelled) subscribe();
//             }, delay);
//           }
//         });

//       return ch;
//     };

//     const ch = subscribe();

//     return () => {
//       cancelled = true;
//       try {
//         if (ch) void supabase.removeChannel(ch);
//       } catch {}
//     };
//   }, [carId, qc]);
// }
