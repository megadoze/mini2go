import type { Booking } from "./booking";
import type { Car } from "./car";

export type CarWithModelRelations = Car & {
  model: {
    name: string;
    brand_id: string;
    brands: {
      name: string;
    };
  };
  location?: {
    name: string;
    countries?: {
      name: string;
    };
  } | null;
  address?: {
    name: string;
  } | null;
  bookings?: Booking[];
};
