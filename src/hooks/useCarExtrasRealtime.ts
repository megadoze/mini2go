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
    let wired = false; // чтобы не навешивать handlers повторно
    let attempt = 0;

    const isOnline = () =>
      typeof navigator === "undefined" ? true : navigator.onLine;

    // берём существующий канал или создаём новый (без removeChannel)
    const getOrCreateChannel = () => {
      const existing = supabase
        .getChannels?.()
        .find((c: any) => c.topic === topic);
      return (
        (existing as RealtimeChannel | undefined) ?? supabase.channel(topic)
      );
    };

    const ensureSubscribed = () => {
      if (cancelled) return;
      if (!isOnline()) {
        // ждём события online — не трогаем канал оффлайн
        return;
      }

      const st = (ch as any)?.state;
      if (st === "joined" || st === "joining") return;

      ch!.subscribe((s) => {
        console.log("[RT car_extras] ensureSubscribed →", s, { carId });
        if (s === "SUBSCRIBED") attempt = 0;
      });
    };

    const wireHandlers = () => {
      if (wired || !ch) return;
      wired = true;

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

      ch.subscribe((status) => {
        console.log("[RT car_extras]", status, { carId });

        if (status === "SUBSCRIBED") {
          attempt = 0;
          return;
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          // НЕ делаем unsubscribe/removeChannel здесь.
          // Если оффлайн — просто ждём online.
          if (!isOnline()) return;

          // мягкий бэкофф на повторную подписку
          const base = 1200;
          const delay =
            Math.min(base * Math.pow(2, attempt), 20_000) +
            Math.floor(Math.random() * 500);
          attempt = Math.min(attempt + 1, 8);
          setTimeout(() => ensureSubscribed(), delay);
        }
      });
    };

    ch = getOrCreateChannel();
    wireHandlers();
    ensureSubscribed();

    // когда сеть вернулась — дёргаем socket и просим канал ре-джойниться
    const onOnline = () => {
      console.log(
        "[RT car_extras] browser ONLINE — reconnect socket & rejoin",
        { carId }
      );
      supabase.realtime.connect?.();
      ensureSubscribed();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") ensureSubscribed();
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      try {
        void ch?.unsubscribe();
      } catch {}
      try {
        void supabase.removeChannel?.(ch!);
      } catch {}
    };
  }, [carId, qc]);
}
