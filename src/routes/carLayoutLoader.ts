import type { LoaderFunction, LoaderFunctionArgs } from "react-router";
import {
  fetchCarById,
  fetchExtras,
  fetchCarExtras,
} from "@/services/car.service";
import { getGlobalSettings } from "@/services/settings.service";
import {
  fetchPricingRules,
  fetchSeasonalRates,
} from "@/app/car/pricing/pricing.service";
import { fetchBookingsByCarId } from "@/app/car/calendar/calendar.service"; // ← NEW

const toCamelSettings = (raw: any) => ({
  currency: raw.currency,
  openTime: raw.open_time ?? raw.openTime,
  closeTime: raw.close_time ?? raw.closeTime,
  minRentPeriod: raw.min_rent_period ?? raw.minRentPeriod,
  maxRentPeriod: raw.max_rent_period ?? raw.maxRentPeriod,
  intervalBetweenBookings:
    raw.interval_between_bookings ?? raw.intervalBetweenBookings,
  ageRenters: raw.age_renters ?? raw.ageRenters,
  minDriverLicense: raw.min_driver_license ?? raw.minDriverLicense,
  isInstantBooking: raw.is_instant_booking ?? raw.isInstantBooking,
  isSmoking: raw.is_smoking ?? raw.isSmoking,
  isPets: raw.is_pets ?? raw.isPets,
  isAbroad: raw.is_abroad ?? raw.isAbroad,
});

export const carLayoutLoader: LoaderFunction = async ({
  params,
}: LoaderFunctionArgs) => {
  const carId = params.id as string | undefined;
  if (!carId) throw new Response("Car ID is required", { status: 400 });

  const [
    carBase,
    settingsRaw,
    allExtras,
    carExtras,
    pricingRules,
    seasonalRates,
    bookings, // ← NEW
  ] = await Promise.all([
    fetchCarById(carId), // camel
    getGlobalSettings(),
    fetchExtras(),
    fetchCarExtras(carId),
    fetchPricingRules(carId),
    fetchSeasonalRates(carId),
    fetchBookingsByCarId(carId), // ← NEW
  ]);

  const globalSettings = settingsRaw ? toCamelSettings(settingsRaw) : null;

  const extras = allExtras.map((extra: any) => {
    const match = carExtras.find((ce: any) => ce.extra_id === extra.id);
    return {
      extra_id: extra.id,
      price: match?.price ?? 0,
      is_available: !!match,
      meta: extra,
    };
  });

  // ВАЖНО: возвращаем car уже с bookings
  const car = { ...carBase, bookings };

  return { car, globalSettings, extras, pricingRules, seasonalRates };
};
