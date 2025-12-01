import { PercentBadgeIcon } from "@heroicons/react/24/outline";

type BookingPriceCardProps = {
  baseDailyPrice: number;
  effectiveCurrency: string;
  avgPerDay?: number;
  discountApplied?: number;
  baseTotal: number;
  deliveryFee: number;
  extrasTotal: number;
  priceTotal: number;
  deposit: number;
};

export function BookingPriceCard({
  baseDailyPrice,
  effectiveCurrency,
  avgPerDay,
  discountApplied,
  baseTotal,
  deliveryFee,
  extrasTotal,
  priceTotal,
  deposit,
}: BookingPriceCardProps) {
  const safeAvgPerDay = avgPerDay ?? baseDailyPrice;
  const safeDiscount = discountApplied ?? 0;

  return (
    <section className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-4 sm:p-5 text-sm">
      <div className="mb-4">
        <p className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">
          Trip summary
        </p>
      </div>

      <div className="space-y-3 text-gray-800">
        {/* Price per day */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-gray-800 text-sm">Price per day</span>

            {safeDiscount !== 0 && (
              <span className="mt-1 flex items-center gap-1 text-[11px] leading-tight text-green-600">
                <PercentBadgeIcon className="size-3" />
                {safeAvgPerDay.toFixed(2)} {effectiveCurrency} with discount
              </span>
            )}
          </div>

          <div className="text-right">
            <span className="block text-gray-900">
              {baseDailyPrice.toFixed(2)} {effectiveCurrency}
            </span>
            {safeDiscount !== 0 && (
              <span className="text-[11px] font-medium leading-tight text-green-600">
                {safeDiscount.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {/* Rental subtotal */}
        <div className="flex items-start justify-between">
          <span className="text-gray-900 text-sm">Rental subtotal</span>
          <span className=" text-gray-900">
            {baseTotal.toFixed(2)} {effectiveCurrency}
          </span>
        </div>

        {/* Delivery */}
        {deliveryFee > 0 && (
          <div className="flex items-start justify-between">
            <span className="text-gray-800 text-sm">Delivery</span>
            <span className=" text-gray-800">
              {deliveryFee.toFixed(2)} {effectiveCurrency}
            </span>
          </div>
        )}

        {/* Extras */}
        {extrasTotal > 0 && (
          <div className="flex items-start justify-between">
            <span className="text-gray-800 text-sm">Extras</span>
            <span className=" text-gray-800">
              {extrasTotal.toFixed(2)} {effectiveCurrency}
            </span>
          </div>
        )}

        <div className="border-t border-dashed border-gray-300 pt-3" />

        {/* Total */}
        <div className="flex items-start justify-between font-semibold text-gray-900">
          <span>Total</span>
          <span>
            {priceTotal.toFixed(2)} {effectiveCurrency}
          </span>
        </div>

        {/* Deposit */}
        <div className="flex items-start justify-between text-gray-600">
          <span>Deposit</span>
          <span>
            {Number(deposit ?? 0).toFixed(2)} {effectiveCurrency}
          </span>
        </div>
      </div>
    </section>
  );
}
