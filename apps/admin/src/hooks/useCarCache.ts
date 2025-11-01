// useCarCache.ts
import { useQueryClient } from "@tanstack/react-query";
import {
  patchCarCaches,
  invalidateCarEverywhere,
  removeCarEverywhere,
  type CarPatch,
} from "@/utils/cache/car-cache";

export function useCarCache() {
  const qc = useQueryClient();
  return {
    patchCar: (id: string, patch: CarPatch) => patchCarCaches(qc, id, patch),
    removeCar: (id: string) => removeCarEverywhere(qc, id),
    invalidateCar: (id: string) => invalidateCarEverywhere(qc, id),
  };
}
