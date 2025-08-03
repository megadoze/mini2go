// types/carExtra.ts
import type { Extra } from "./extra";

export type CarExtraWithMeta = {
  extra_id: string;
  price: number;
  is_available: boolean;
  meta: Extra; // 👈 данные из extra_services
};
