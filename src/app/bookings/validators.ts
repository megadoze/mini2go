import {
  addMinutes,
  differenceInMinutes,
  isBefore,
  isWithinInterval,
} from "date-fns";
import type { Booking } from "@/types/booking";

export function validateOpenClose(
  startAt: Date,
  endAt: Date,
  openTime?: number,
  closeTime?: number
) {
  if (openTime == null || closeTime == null) return null;
  // openTime/closeTime как HHMM (на манер твоих Select'ов)
  const toHM = (t: number) => ({ h: Math.floor(t / 100), m: t % 100 });
  const o = toHM(openTime),
    c = toHM(closeTime);

  const inWindow = (d: Date) => {
    const h = d.getHours(),
      m = d.getMinutes();
    const afterOpen = h > o.h || (h === o.h && m >= o.m);
    const beforeClose = h < c.h || (h === c.h && m <= c.m);
    return afterOpen && beforeClose;
  };

  if (!inWindow(startAt)) return "Pickup time is outside of working hours";
  if (!inWindow(endAt)) return "Return time is outside of working hours";
  return null;
}

export function validateMinMaxDays(
  minutes: number,
  minDays?: number,
  maxDays?: number
) {
  const days = minutes / 1440;
  if (minDays != null && days < minDays)
    return `Minimum rental is ${minDays} day(s)`;
  if (maxDays != null && days > maxDays)
    return `Maximum rental is ${maxDays} day(s)`;
  return null;
}

export function validateGapWithExisting({
  startAt,
  endAt,
  existing,
  gapMinutes = 0,
}: {
  startAt: Date;
  endAt: Date;
  existing: Booking[]; // и 'booking', и 'block' считаем занятостью
  gapMinutes?: number; // effectiveIntervalBetweenBookings
}) {
  const expand = (s: Date, e: Date) => ({
    start: addMinutes(s, -gapMinutes),
    end: addMinutes(e, +gapMinutes),
  });

  for (const b of existing) {
    const s = new Date(b.start_at);
    const e = new Date(b.end_at);
    const ex = expand(s, e);

    const overlap =
      isWithinInterval(startAt, ex) ||
      isWithinInterval(endAt, ex) ||
      isWithinInterval(s, { start: startAt, end: endAt }) ||
      isWithinInterval(e, { start: startAt, end: endAt }) ||
      // граничные случаи (равно началу/концу)
      differenceInMinutes(startAt, ex.end) === 0 ||
      differenceInMinutes(endAt, ex.start) === 0;

    if (overlap)
      return "Selected period overlaps existing booking or violates gap rule";
    if (isBefore(endAt, startAt)) return "End time must be after start time";
  }
  return null;
}

export function validateCustomerEligibility({
  age,
  licenseYears,
  effectiveAgeRenters,
  effectiveMinDriverLicense,
  hasDocs,
}: {
  age?: number;
  licenseYears?: number;
  effectiveAgeRenters?: number;
  effectiveMinDriverLicense?: number;
  hasDocs?: boolean;
}) {
  if (effectiveAgeRenters != null && (age ?? 0) < effectiveAgeRenters)
    return `Minimum driver age is ${effectiveAgeRenters}`;
  if (
    effectiveMinDriverLicense != null &&
    (licenseYears ?? 0) < effectiveMinDriverLicense
  )
    return `Minimum license years is ${effectiveMinDriverLicense}`;
  if (hasDocs === false) return "Customer documents are not verified";
  return null;
}
