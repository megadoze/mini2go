import type { Booking } from "@/types/booking";

export type BookingCard = {
  id: string;
  startAt: string;
  endAt: string;
  status?: string | null;
  mark: Booking["mark"]; // "booking" | "block"
  carId: string;
  userId?: string | null;
  createdAt?: string;
  ownerName?: string | null;
  car?: {
    id: string;
    brand?: string | null;
    model?: string | null;
    year?: number | null;
    licensePlate?: string | null;
    photo?: string | null;
    deposit?: number | null;
  } | null;
  priceTotal: number | null;
  currency?: string | null;
};
