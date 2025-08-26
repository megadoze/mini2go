import type { Booking } from "@/types/booking";
import type { Profile } from "@/types/profile";
import type { BookingExtraRow } from "./booking-extras";

export type BookingWithUser = Booking & { user?: Profile | null };

export type BookingEditorSnapshot = {
  // startAt(startAt: any): Date | null;
  booking: BookingWithUser;
  booking_extras?: BookingExtraRow[];
};
