// // src/routes/carLayoutLoader.ts
// import type { LoaderFunctionArgs } from "react-router";
// import { queryClient } from "@/lib/queryClient";
// import { getGlobalSettings } from "@/services/settings.service";
// import {
//   fetchCarById,
//   fetchExtras,
//   fetchCarExtras,
// } from "@/services/car.service";
// import {
//   fetchPricingRules,
//   fetchSeasonalRates,
// } from "@/app/car/pricing/pricing.service";
// import { fetchBookingsByCarId } from "@/app/car/calendar/calendar.service";

// /** нормализуем настройки в camelCase только для возврата из loader */
// const toCamelSettings = (raw: any) => ({
//   currency: raw.currency,
//   openTime: raw.open_time ?? raw.openTime,
//   closeTime: raw.close_time ?? raw.closeTime,
//   minRentPeriod: raw.min_rent_period ?? raw.minRentPeriod,
//   maxRentPeriod: raw.max_rent_period ?? raw.maxRentPeriod,
//   intervalBetweenBookings:
//     raw.interval_between_bookings ?? raw.intervalBetweenBookings,
//   ageRenters: raw.age_renters ?? raw.ageRenters,
//   minDriverLicense: raw.min_driver_license ?? raw.minDriverLicense,
//   isInstantBooking: raw.is_instant_booking ?? raw.isInstantBooking,
//   isSmoking: raw.is_smoking ?? raw.isSmoking,
//   isPets: raw.is_pets ?? raw.isPets,
//   isAbroad: raw.is_abroad ?? raw.isAbroad,
// });

// /** helper: прогреваем только если в кэше пусто */
// async function warm<T>(key: any, fn: () => Promise<T>, staleTime = 5 * 60_000) {
//   if (queryClient.getQueryData<T>(key) != null) return;
//   await queryClient.prefetchQuery({ queryKey: key, queryFn: fn, staleTime });
// }

// export async function carLayoutLoader({ params }: LoaderFunctionArgs) {
//   const carId = String(params.carId);
//   if (!carId) throw new Response("Missing carId", { status: 400 });

//   // 1) Тихо прогреваем необходимые куски (если их ещё нет)
//   await Promise.all([
//     warm(["car", carId], () => fetchCarById(carId)),
//     warm(["appSettings"], getGlobalSettings),
//     warm(["extras"], fetchExtras),
//     warm(["carExtras", carId], () => fetchCarExtras(carId)),
//     warm(["pricingRules", carId], () => fetchPricingRules(carId)),
//     warm(["seasonalRates", carId], () => fetchSeasonalRates(carId)),
//     warm(["bookingsByCarId", carId], () => fetchBookingsByCarId(carId), 60_000),
//   ]);

//   // 2) Забираем всё из кэша (никаких сетевых запросов)
//   const car = queryClient.getQueryData<any>(["car", carId])!;
//   const appSettings = queryClient.getQueryData<any>(["appSettings"])!;
//   const allExtras = queryClient.getQueryData<any[]>(["extras"]) || [];
//   const carExtras = queryClient.getQueryData<any[]>(["carExtras", carId]) || [];
//   const pricingRules =
//     queryClient.getQueryData<any[]>(["pricingRules", carId]) || [];
//   const seasonalRates =
//     queryClient.getQueryData<any[]>(["seasonalRates", carId]) || [];
//   const bookings =
//     queryClient.getQueryData<any[]>(["bookingsByCarId", carId]) || [];

//   const globalSettings = appSettings ? toCamelSettings(appSettings) : null;

//   // 3) Собираем extras с флагом доступности
//   const extras = allExtras.map((extra: any) => {
//     const match = carExtras.find((ce: any) => ce.extra_id === extra.id);
//     return {
//       extra_id: extra.id,
//       price: match?.price ?? 0,
//       is_available: !!match,
//       meta: extra,
//     };
//   });

//   // Дополнительно кладём агрегированное представление в кэш (удобно в UI)
//   queryClient.setQueryData(["extras:withAvailability", carId], extras);

//   // 4) Возвращаем снапшот для useLoaderData
//   return {
//     car: { ...car, bookings },
//     globalSettings,
//     extras,
//     pricingRules,
//     seasonalRates,
//   };
// }

// src/routes/carLayoutLoader.ts
import type { LoaderFunctionArgs } from "react-router";
import { queryClient } from "@/lib/queryClient";
import { QK } from "@/queryKeys";
import { getGlobalSettings } from "@/services/settings.service";
import {
  fetchCarById,
  fetchExtras,
  fetchCarExtras,
} from "@/services/car.service";
import {
  fetchPricingRules,
  fetchSeasonalRates,
} from "@/app/car/pricing/pricing.service";
import { fetchBookingsByCarId } from "@/app/car/calendar/calendar.service";

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
    queryClient.ensureQueryData({
      queryKey: QK.appSettings,
      queryFn: getGlobalSettings,
    }),
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
