// src/routes/calendarLoader.ts
import { startOfMonth } from "date-fns";

export async function calendarLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const param = url.searchParams.get("month");
  const paramDate = param ? new Date(param) : null;
  const baseDate = paramDate && !Number.isNaN(+paramDate) ? paramDate : new Date();
  const monthISO = startOfMonth(baseDate).toISOString();
  return { monthISO };
}
