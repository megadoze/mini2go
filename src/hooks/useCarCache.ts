import { useQueryClient } from "@tanstack/react-query";
import {
  patchCarCaches,
  invalidateCarEverywhere,
  type CarPatch,
} from "@/utils/cache/car-cache";

export function useCarCache() {
  const qc = useQueryClient();
  return {
    patchCar: (id: string, patch: CarPatch) => patchCarCaches(qc, id, patch),
    invalidateCar: (id: string) => invalidateCarEverywhere(qc, id),
  };
}
