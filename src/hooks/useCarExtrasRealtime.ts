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
          // аккуратно достаём old/new (на DELETE может быть только old)
          const row =
            payload?.new && Object.keys(payload.new).length
              ? payload.new
              : null;
          const old =
            payload?.old && Object.keys(payload.old).length
              ? payload.old
              : null;
          const extraId = String(row?.extra_id ?? old?.extra_id ?? "");
          if (!extraId) return;

          // 1) инвалидируем RQ-кэш (для списка на useQuery)
          qc.invalidateQueries({
            queryKey: QK.carExtras(carId),
            refetchType: "all",
          });

          // 2) патчим контекст extras (для твоего ExtraComponent)
          setExtras((prev) => {
            const allMeta = qc.getQueryData<any[]>(QK.extras) ?? [];
            const idx = prev.findIndex((e) => e.extra_id === extraId);

            if (payload.eventType === "DELETE") {
              // выключили extra → отмечаем как Off (цена 0)
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], is_available: false, price: 0 };
                return copy;
              }
              // если записи не было — оставляем как есть
              return prev;
            }

            // INSERT / UPDATE → включаем/обновляем цену
            const price = Number(row?.price ?? 0);
            const meta =
              (idx >= 0 ? prev[idx].meta : null) ??
              allMeta.find((m) => m.id === extraId) ??
              undefined;

            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], is_available: true, price, meta };
              return copy;
            }
            // если раньше было Off и в prev отсутствует — добавим строку
            return [
              ...prev,
              {
                extra_id: extraId,
                price,
                is_available: true,
                meta,
              } as CarExtraWithMeta,
            ];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [carId, qc, setExtras]);
}
