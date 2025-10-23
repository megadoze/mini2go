import {
  addDays,
  differenceInMinutes,
  isWithinInterval,
  startOfDay,
} from "date-fns";

export type PricingRule = { min_days: number; discount_percent: number };
export type SeasonalRate = {
  start_date: string;
  end_date: string;
  adjustment_percent: number;
};

export function calculateFinalPriceProRated({
  startAt,
  endAt,
  baseDailyPrice,
  pricingRules,
  seasonalRates,
}: {
  startAt: Date;
  endAt: Date;
  baseDailyPrice: number;
  pricingRules: PricingRule[];
  seasonalRates: SeasonalRate[];
}) {
  const minutes = Math.max(0, differenceInMinutes(endAt, startAt));
  if (minutes === 0 || baseDailyPrice <= 0) {
    return {
      total: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      pricePerDay: baseDailyPrice,
    };
  }

  const totalDaysFloat = minutes / 1440;
  const fullDays = Math.floor(minutes / 1440);
  const remainderMin = minutes % 1440;

  const dayPriceWithSeason = (d: Date) => {
    const season = seasonalRates.find((s) =>
      isWithinInterval(d, {
        start: new Date(s.start_date),
        end: new Date(s.end_date),
      })
    );
    const factor = season ? 1 + sToNum(season.adjustment_percent) / 100 : 1;
    return baseDailyPrice * factor;
  };

  let total = 0;

  // Полные дни
  for (let i = 0; i < fullDays; i++) {
    const day = startOfDay(addDays(startAt, i));
    total += dayPriceWithSeason(day);
  }

  // Остаток по часам
  if (remainderMin > 0) {
    const remStartDay = startOfDay(addDays(startAt, fullDays));
    const dayPrice = dayPriceWithSeason(remStartDay);
    total += dayPrice * (remainderMin / 1440);
  }

  // Скидка (хранится со знаком минус)
  const rule = pricingRules
    .filter((r) => r.min_days <= totalDaysFloat)
    .sort((a, b) => b.min_days - a.min_days)[0];

  let discountApplied = 0;

   if (rule) {
    discountApplied = sToNum(rule.discount_percent);
    total *= 1 + discountApplied / 100;
  }

  // if (rule) {
  //   total *= 1 + sToNum(rule.discount_percent) / 100;
  // }

  total = Math.round(total * 100) / 100;

  const avgPerDay = totalDaysFloat > 0 ? total / totalDaysFloat : baseDailyPrice;

  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  return {
    total,
    days: totalDaysFloat,
    hours,
    minutes: mins,
    pricePerDay: baseDailyPrice,
    avgPerDay,
    discountApplied,
  };
}

function sToNum(n: number | string) {
  return typeof n === "string" ? parseFloat(n) : n;
}
