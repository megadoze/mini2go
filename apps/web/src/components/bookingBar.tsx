import { CarWithRelations } from "@/types/carWithRelations";

function ArrowRightMini() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12h13" />
      <path d="M14 6l6 6-6 6" />
    </svg>
  );
}

function declineDays(n: number) {
  const v = Math.abs(n) % 100;
  const v1 = v % 10;
  if (v > 10 && v < 20) return "days";
  if (v1 > 1 && v1 < 5) return "day";
  if (v1 === 1) return "day";
  return "days";
}

export function BookingBar({
  car,
  start,
  end,
  days,
  onProceed,
  changePickerStatus,
  openDrawer,
  pricingResult,
  currency,
  disabled,
}: {
  car: CarWithRelations;
  start: string;
  end: string;
  days: number;
  onProceed: () => void;
  changePickerStatus: () => void;
  openDrawer: () => void;
  pricingResult?: {
    total: number;
    days: number;
    hours: number;
    minutes: number;
    pricePerDay: number;
    avgPerDay?: number;
    discountApplied?: number;
  } | null;
  currency: string;
  disabled: boolean;
}) {
  return (
    <div
      id="booking"
      className="z-50 fixed inset-x-0 bottom-0 bg-white/70 backdrop-blur supports-backdrop-filter:bg-white/40 border-t border-gray-200/60"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-10 text-center font-semibold font-roboto-condensed">
          <div className="text-left">
            <div className="text-2xl md:text-4xl leading-none text-neutral-900">
              {pricingResult ? pricingResult?.total.toFixed(0) : car.price}
              {currency}
            </div>
            <div className="text-[11px] md:text-xs text-neutral-500 leading-snug">
              for {days} {declineDays(days)}
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-10 text-center">
            <div>
              <div className="text-2xl md:text-4xl leading-none text-neutral-900">
                {car.includeMileage}
              </div>
              <div className="text-[11px] md:text-xs text-neutral-500 leading-snug">
                incl. km/day
              </div>
            </div>

            <div className="">
              <div className="text-2xl md:text-4xl leading-none text-neutral-900">
                {days}
              </div>
              <div className="text-[11px] md:text-xs text-neutral-500 leading-snug">
                {declineDays(days)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 md:gap-3 font-roboto-condensed">
          <button
            onClick={changePickerStatus}
            className="rounded-xl px-3 h-10 md:px-5 md:h-12 text-sm font-medium text-neutral-600 bg-white/40 backdrop-blur border border-neutral-600/50 shadow transition-all duration-200 cursor-pointer"
          >
            Change
          </button>

          <button
            onClick={openDrawer}
            className="rounded-xl px-3 h-10 md:px-5 md:h-12 text-sm font-medium text-white bg-black/85 hover:bg-black/90 backdrop-blur border border-neutral-600/60 shadow transition-all duration-200 flex items-center gap-1 cursor-pointer"
            disabled={disabled}
          >
            <span>Book</span>
            <ArrowRightMini />
          </button>
        </div>
      </div>
    </div>
  );
}
