import type { Booking } from "@/types/booking";
import type { Profile } from "@/types/profile";

export type BookingWithUser = Booking & { user?: Profile | null };

export type BookingEditorSnapshot = {
  booking: BookingWithUser;
};
