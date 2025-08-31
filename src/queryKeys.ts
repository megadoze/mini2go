// src/queryKeys.ts
export const QK = {
  extras: ["extras"] as const,
  appSettings: ["appSettings"] as const,
  car: (id: string) => ["car", id] as const,
  cars: ["cars"] as const,
  carExtras: (id: string) => ["carExtras", id] as const,
  pricingRules: (id: string) => ["pricingRules", id] as const,
  seasonalRates: (id: string) => ["seasonalRates", id] as const,
  bookingsByCarId: (id: string) => ["bookingsByCarId", id] as const,
  booking: (id: string) => ["booking", id] as const,
  bookingExtras: (id: string) => ["bookingExtras", id] as const,
  user: (id: string) => ["user", id] as const,
  carsByHost: (ownerId: string) => ["carsByHost", ownerId] as const,
  bookingsIndex: (ownerId: string) => ["bookingsIndex", ownerId] as const,
  calendarWindow: (monthISO: string) => ["calendarWindow", monthISO] as const,
};
