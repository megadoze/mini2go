// src/queryKeys.ts
export const QK = {
  extras: ["extras"] as const,
  appSettingsBase: ["appSettings"] as const,
  appSettingsByOwner(ownerId: string) {
    return ["appSettings", ownerId] as const;
  },
  car: (id: string) => ["car", id] as const,
  cars: ["cars"] as const,
  carsInfinite: (limit: number) => ["carsInfinite", { limit }] as const,
  carFeatures: (id: string) => ["carFeatures", id] as const,
  carExtras: (id: string) => ["carExtras", id] as const,
  pricingRules: (id: string) => ["pricingRules", id] as const,
  seasonalRates: (id: string) => ["seasonalRates", id] as const,
  bookingsByCarId: (id: string) => ["bookingsByCarId", id] as const,
  bookingsIndexInfinite: (ownerId: string | null, limit: number) =>
    ["bookingsIndexInfinite", { ownerId, limit }] as const,
  bookingsUserInfinite: (userId: string | null, limit: number) =>
    ["bookingsUserInfinite", { userId, limit }] as const,
  usersByHostInfinite: (
    ownerId: string | null,
    pageSize: number,
    category?: string | null
  ) => ["usersByHostInfinite", pageSize, ownerId, category ?? null] as const,
  usersInfinite: (
    pageSize: number,
    q?: string | null,
    status?: string | null,
    sort?: string | null,
    dir?: "asc" | "desc" | null,
    excludeUserId?: string | null
  ) =>
    [
      "users",
      "infinite",
      { pageSize, q, status, sort, dir, excludeUserId },
    ] as const,
  booking: (id: string) => ["booking", id] as const,
  bookingExtras: (id: string) => ["bookingExtras", id] as const,
  user: (id: string) => ["user", id] as const,
  carsByHost: (ownerId: string) => ["carsByHost", ownerId] as const,
  bookingsIndex: (ownerId: string) => ["bookingsIndex", ownerId] as const,
  calendarWindow: (monthISO: string) => ["calendarWindow", monthISO] as const,
};
