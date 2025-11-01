import type { Car } from "@/types/car";

export type CarWithRelations = Car & {
  models: {
    name: string;
    brands: {
      name: string;
    };
  };
  locations?: {
    name: string;
    countries: {
      name: string;
      id: string;
    };
  } | null;
};
