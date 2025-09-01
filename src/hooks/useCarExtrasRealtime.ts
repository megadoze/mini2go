// src/realtime/useCarExtrasRealtimeCTX.ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { QK } from "@/queryKeys";
import type { CarExtraWithMeta } from "@/types/carExtra";

type SetExtras = React.Dispatch<React.SetStateAction<CarExtraWithMeta[]>>;

export function useCarExtrasRealtime(
  carId: string | null,
  setExtras: SetExtras
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
        (payload: any) => {
          // CHANGED: аккуратно достаём данные с учётом DELETE
          const row =
            payload?.eventType === "DELETE" ? payload?.old : payload?.new;
          if (!row) return; // всё ещё пусто — игнор
          const { car_id, extra_id, price } = row;
          if (String(car_id) !== String(carId)) return;

          // CHANGED: инвалидируем RQ-список
          qc.invalidateQueries({
            queryKey: QK.carExtras(carId),
            refetchType: "all",
          });

          // CHANGED: патчим контекст для твоего ExtraComponent
          setExtras((prev) => {
            const idx = prev.findIndex((e) => e.extra_id === extra_id);
            if (payload.eventType === "DELETE") {
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], is_available: false, price: 0 };
                return copy;
              }
              return prev;
            }
            // INSERT/UPDATE
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = {
                ...copy[idx],
                is_available: true,
                price: Number(price ?? 0),
              };
              return copy;
            }
            // если строки раньше не было в контексте
            const metaList = qc.getQueryData<any[]>(QK.extras) ?? [];
            const meta = metaList.find((m) => m.id === extra_id);
            return [
              ...prev,
              {
                extra_id,
                price: Number(price ?? 0),
                is_available: true,
                meta: meta
                  ? {
                      id: meta.id,
                      name: meta.name,
                      description: meta.description,
                      price_type: meta.price_type,
                      is_active: meta.is_active,
                    }
                  : prev[0]?.meta ?? undefined,
              } as CarExtraWithMeta,
            ];
          });
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "CLOSED") {
          // не паникуем — supabase сам переподключится
          // можно залогировать при отладке
          // console.warn("[RT car_extras]", status, carId);
        }
      });

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [carId, qc, setExtras]);
}
