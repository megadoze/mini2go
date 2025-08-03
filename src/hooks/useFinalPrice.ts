// useFinalPrice.ts
import { addDays, differenceInCalendarDays, isSameDay } from "date-fns";

export const calculateFinalPrice = ({
  startDate,
  endDate,
  basePrice,
  pricingRules,
  seasonalRates,
}: {
  startDate: Date;
  endDate: Date;
  basePrice: number;
  pricingRules: { min_days: number; discount_percent: number }[];
  seasonalRates: {
    start_date: string;
    end_date: string;
    adjustment_percent: number;
  }[];
}): number => {
  const days = differenceInCalendarDays(endDate, startDate);
  let total = 0;

  for (let i = 0; i < days; i++) {
    const currentDate = addDays(startDate, i);
    let price = basePrice;

    const seasonal = seasonalRates.find(
      (s) =>
        new Date(s.start_date) <= currentDate &&
        new Date(s.end_date) >= currentDate
    );

    if (seasonal) {
      price *= 1 + seasonal.adjustment_percent / 100;
    }

    total += price;
  }

  const rule = pricingRules
    .filter((r) => r.min_days <= days)
    .sort((a, b) => b.min_days - a.min_days)[0];

  if (rule) {
    total *= 1 + rule.discount_percent / 100;
  }

  return Math.round(total);
};
