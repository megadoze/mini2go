import type { AppSettings } from "./setting";

export type AppSettingsUpdatePayload = Partial<
  Omit<AppSettings, "id" | "updated_at" | "scope">
>;
