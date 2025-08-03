// types/carUpdate.ts
export type CarUpdatePayload = {
  currency?: "EUR" | "USD" | "GBP" | null;
  open_time?: number | null;
  close_time?: number | null;
  min_rent_period?: number | null;
  max_rent_period?: number | null;
  interval_between_bookings?: number | null;
  age_renters?: number | null;
  min_driver_license?: number | null;
  is_instant_booking?: boolean | null;
  is_smoking?: boolean | null;
  is_pets?: boolean | null;
  is_abroad?: boolean | null;
};
