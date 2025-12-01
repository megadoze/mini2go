// useBookingPrice.ts
import { useMemo } from "react";
import { differenceInMinutes } from "date-fns";
import {
  calculateFinalPriceProRated,
  type PricingRule,
  type SeasonalRate,
} from "@/hooks/useFinalPriceHourly";

type PriceExtra = {
  id: string;
  title?: string;
  price: number;
  price_type: "per_trip" | "per_day" | string;
  inactive?: boolean;
};

type UseBookingPriceParams = {
  car: any;
  startDateIso: string;
  endDateIso: string;
  pricingRules: PricingRule[];
  seasonalRates: SeasonalRate[];

  // экстра
  pickedExtras: string[];
  extrasById: Record<string, PriceExtra>;

  // режим
  mark: "booking" | "block";

  // доставка
  delivery: "car_address" | "by_address";
  deliveryFeeValue: number;
};

export function useBookingPrice({
  car,
  startDateIso,
  endDateIso,
  pricingRules,
  seasonalRates,
  pickedExtras,
  extrasById,
  mark,
  delivery,
  deliveryFeeValue,
}: UseBookingPriceParams) {
  const result = useMemo(() => {
    const baseDailyPrice = Number(car?.price ?? 0);

    const start = startDateIso ? new Date(startDateIso) : null;
    const end = endDateIso ? new Date(endDateIso) : null;

    if (!start || !end || Number.isNaN(+start) || Number.isNaN(+end)) {
      return {
        baseDailyPrice,
        baseTotal: 0,
        avgPerDay: baseDailyPrice,
        discountApplied: 0,
        totalMinutes: 0,
        durationDays: 0,
        durationHours: 0,
        durationMinutes: 0,
        billableDaysForExtras: 0,
        extrasTotal: 0,
        deliveryFee: 0,
        price_total: 0,
      };
    }

    const minutes = Math.max(0, differenceInMinutes(end, start));

    const {
      total: baseTotal,
      avgPerDay,
      discountApplied,
      // days: totalDaysFloat,
    } = calculateFinalPriceProRated({
      startAt: start,
      endAt: end,
      baseDailyPrice,
      pricingRules,
      seasonalRates,
    });

    // разложим длительность для UI
    const durationDays = Math.floor(minutes / (24 * 60));
    const durationHours = Math.floor((minutes % (24 * 60)) / 60);
    const durationMinutes = minutes % 60;

    // для per_day экстр
    const billableDaysForExtras =
      minutes > 0 ? Math.max(1, Math.ceil(minutes / (24 * 60))) : 0;

    // экстра
    const extrasTotal = pickedExtras.reduce((sum, id) => {
      const ex = extrasById[id];
      if (!ex) return sum;
      const multiplier =
        ex.price_type === "per_day" ? billableDaysForExtras || 1 : 1;
      return sum + ex.price * multiplier;
    }, 0);

    const extrasTotalRounded = Math.round(extrasTotal * 100) / 100;

    // доставка
    const deliveryFee =
      delivery === "by_address" ? Number(deliveryFeeValue || 0) : 0;

    // финальная цена
    const addons = mark === "booking" ? extrasTotalRounded + deliveryFee : 0;
    const price_total =
      Math.round((baseTotal + addons) * 100) / 100 || baseTotal;

    return {
      baseDailyPrice,
      baseTotal,
      avgPerDay,
      discountApplied,
      totalMinutes: minutes,
      durationDays,
      durationHours,
      durationMinutes,
      billableDaysForExtras,
      extrasTotal: extrasTotalRounded,
      deliveryFee,
      price_total,
    };
  }, [
    car,
    startDateIso,
    endDateIso,
    pricingRules,
    seasonalRates,
    pickedExtras,
    extrasById,
    mark,
    delivery,
    deliveryFeeValue,
  ]);

  return result;
}
