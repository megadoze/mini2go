// src/realtime/useCarExtrasRealtimeRQ.ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { QK } from "@/queryKeys";

export function useCarExtrasRealtimeRQ(carId: string | null) {
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
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc, carId]);
}
