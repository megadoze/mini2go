export type Booking = {
  id: string;
  user_id?: string | null;
  car_id: string;
  start_at: string; // ISO-строка
  end_at: string; // ISO-строка
  price_per_day?: number | null;
  price_total?: number | null;
  deposit?: number | null;
  status?: string | null;
  mark: "booking" | "block";
  created_at?: string | null;
  delivery_fee?: number | null;
  delivery_type?: "car_address" | "by_address";
  currency?: string;
  delivery_address?: string | null;
  delivery_lat?: number | null;
  delivery_long?: number | null;
  location_id?: string | null;
  country_id?: string | null;
};
