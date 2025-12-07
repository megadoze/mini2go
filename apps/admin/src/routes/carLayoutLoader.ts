// src/routes/carLayoutLoader.ts
import { redirect, type LoaderFunctionArgs } from "react-router";
import { queryClient } from "@/lib/queryClient";
import { QK } from "@/queryKeys";
import { supabase } from "@/lib/supabase"; // ← добавили
import { getGlobalSettings } from "@/services/settings.service";
import {
  fetchCarById,
  fetchExtras,
  fetchCarExtras,
} from "@/services/car.service";
import {
  fetchPricingRules,
  fetchSeasonalRates,
} from "@/services/pricing.service";
import { fetchBookingsByCarId } from "@/services/calendar.service";

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

export async function carLayoutLoader({ params }: LoaderFunctionArgs) {
  const carId = String(params.carId);
  if (!carId) throw new Response("Missing carId", { status: 400 });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw redirect("/auth");
  }

  // ← берём userId один раз
  const { data } = await supabase.auth.getUser();
  const ownerId = data.user?.id ?? null;

  // если юзер не залогинен — настроек нет
  const appSettingsPromise = ownerId
    ? queryClient.ensureQueryData({
        queryKey: QK.appSettingsByOwner(ownerId), // ключ привязан к юзеру
        queryFn: () => getGlobalSettings(ownerId), // ← ПЕРЕДАЁМ ownerId
      })
    : Promise.resolve(null);

  const [
    car,
    appSettings,
    extrasAll,
    carExtras,
    pricingRules,
    seasonalRates,
    bookings,
  ] = await Promise.all([
    queryClient.ensureQueryData({
      queryKey: QK.car(carId),
      queryFn: () => fetchCarById(carId),
    }),
    appSettingsPromise, // ← тут промис из блока выше
    queryClient.ensureQueryData({ queryKey: QK.extras, queryFn: fetchExtras }),
    queryClient.ensureQueryData({
      queryKey: QK.carExtras(carId),
      queryFn: () => fetchCarExtras(carId),
    }),
    queryClient.ensureQueryData({
      queryKey: QK.pricingRules(carId),
      queryFn: () => fetchPricingRules(carId),
    }),
    queryClient.ensureQueryData({
      queryKey: QK.seasonalRates(carId),
      queryFn: () => fetchSeasonalRates(carId),
    }),
    queryClient.ensureQueryData({
      queryKey: QK.bookingsByCarId(carId),
      queryFn: () => fetchBookingsByCarId(carId),
    }),
  ]);

  if (!car || car.ownerId !== ownerId) {
    throw new Response("Not found", { status: 404 });
  }

  const globalSettings = appSettings ? toCamelSettings(appSettings) : null;

  const extras = extrasAll.map((extra: any) => {
    const match = carExtras.find((ce: any) => ce.extra_id === extra.id);
    return {
      extra_id: extra.id,
      price: match?.price ?? 0,
      is_available: !!match,
      meta: extra,
    };
  });

  queryClient.setQueryData(["extras:withAvailability", carId], extras);

  return {
    car: { ...car, bookings },
    globalSettings,
    extras,
    pricingRules,
    seasonalRates,
  };
}
