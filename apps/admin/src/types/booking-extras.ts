export type BookingExtraRow = {
  extra_id: string; // или number -> тогда приводи к string при использовании
  title: string;
  qty: number;
  price: number;
  price_type: "per_trip" | "per_day" | string;
};
