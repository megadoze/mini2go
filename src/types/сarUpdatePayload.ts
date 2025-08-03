import type { Car } from "./car";

export type CarUpdatePayload = Partial<Omit<Car, "id" | "created_at">>;
