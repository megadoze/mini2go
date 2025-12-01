// bookingExtras.tsx
import React from "react";

type ExtraItem = {
  id: string;
  title: string;
  price: number;
  price_type: "per_trip" | "per_day" | string;
  inactive: boolean;
};

type ExtrasMap = {
  list: ExtraItem[];
  byId: Record<string, ExtraItem>;
};

type BookingExtrasProps = {
  extras: ExtrasMap;
  pickedExtras: string[];
  currency: string;
  isLocked: boolean;
  setPickedExtras: React.Dispatch<React.SetStateAction<string[]>>;
};

export const BookingExtras: React.FC<BookingExtrasProps> = ({
  extras,
  pickedExtras,
  currency,
  isLocked,
  setPickedExtras,
}) => {
  const toggleExtra = (id: string, disabled: boolean) => {
    if (disabled) return;
    setPickedExtras((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (!extras?.list?.length) {
    return (
      <section className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-4 sm:p-5 text-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">
            Extras
          </p>
        </div>
        <p className="text-xs text-gray-500">
          No extras configured for this car.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-4 sm:p-5 text-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">
          Extras
        </p>
        {isLocked && (
          <span className="text-[11px] text-gray-400">
            Booking is locked — extras read only
          </span>
        )}
      </div>

      <div className="space-y-2">
        {extras.list.map((ex) => {
          const checked = pickedExtras.includes(ex.id);
          const disabled = isLocked || ex.inactive;
          const priceLabel =
            ex.price_type === "per_day"
              ? `${ex.price.toFixed(2)} ${currency} / day`
              : `${ex.price.toFixed(2)} ${currency} / trip`;

          return (
            <button
              key={ex.id}
              type="button"
              onClick={() => toggleExtra(ex.id, disabled)}
              className={[
                "w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                checked && !disabled
                  ? "border-green-400 bg-green-50"
                  : "border-gray-200 bg-white",
                disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-50",
              ].join(" ")}
            >
              <div className="flex gap-4 items-center">
                <p
                  className={[
                    "inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold",
                    checked && !disabled
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-gray-300 text-gray-400",
                  ].join(" ")}
                >
                  {checked ? "✓" : ""}
                </p>
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900">{ex.title}</span>
                  <span className="text-xs text-gray-500">{priceLabel}</span>
                </div>

                {ex.inactive && (
                  <span className="mt-0.5 text-[11px] text-amber-600">
                    No longer available in car settings, but kept for this
                    booking
                  </span>
                )}
              </div>

              <div className="ml-3 flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {ex.price.toFixed(2)} {currency}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
