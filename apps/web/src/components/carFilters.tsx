import { NativeSelect } from "@mantine/core";
import { EyeIcon, GlobeAltIcon, MapPinIcon } from "@heroicons/react/24/outline";
import type { Country } from "@/types/country";
import type { Location } from "@/types/location";

export type CarStatus = "" | "available" | "unavailable";

type Props = {
  countries: Country[];
  locations: Location[];
  countryId: string | null;
  locationFilter: string;
  // ↓↓↓ делаем опциональными
  statusFilter?: CarStatus;
  onChangeCountry: (id: string | null) => void;
  onChangeLocation: (name: string) => void;
  onChangeStatus?: (status: CarStatus) => void;
  className?: string;
  // ↓↓↓ новый проп
  hideStatus?: boolean;
};

export default function CarFilters({
  countries,
  locations,
  countryId,
  locationFilter,
  statusFilter = "",
  onChangeCountry,
  onChangeLocation,
  onChangeStatus,
  className,
  hideStatus = false,
}: Props) {
  return (
    <div
      className={[
        "flex flex-col sm:flex-row sm:flex-nowrap",
        "items-stretch sm:items-center gap-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Country */}
      <div className="relative w-full sm:w-auto sm:shrink-0">
        <GlobeAltIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <NativeSelect
          value={countryId ?? ""}
          onChange={(e) => {
            const raw = e.currentTarget.value;
            const next = raw === "" ? null : raw;

            // guard: если выбранное значение равно текущему — ничего не делаем
            if (next === countryId) return;

            // оптимистично обновляем страну
            onChangeCountry(next);

            // если страна стала пустой (сброс) — очищаем location
            if (!next) {
              onChangeLocation("");
            } else {
              // при смене страны логично очистить фильтр локации,
              // но если у тебя нужен другой UX — адаптируй.
              onChangeLocation("");
            }
          }}
          className="w-full sm:w-auto min-w-[150px] rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm transition hover:bg-white/80 focus:ring-2 focus:ring-black/10"
        >
          <option value="">Country</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      {/* Location */}
      <div className="relative w-full sm:w-auto sm:shrink-0">
        <MapPinIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <NativeSelect
          value={locationFilter}
          onChange={(e) => onChangeLocation(e.currentTarget.value)}
          disabled={!countryId}
          className={`w-full sm:w-auto min-w-[200px] rounded-xl pl-9 pr-3 py-2 text-sm shadow-sm transition focus:ring-2 focus:ring-black/10 ${
            !countryId
              ? "bg-gray-100/80 text-zinc-400 cursor-not-allowed"
              : "bg-white/60 backdrop-blur-sm hover:bg-white/80"
          }`}
        >
          <option value="">Location</option>
          {locations.map((l) => (
            <option key={l.id} value={l.name}>
              {l.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      {/* Status (опционально) */}
      {!hideStatus && (
        <div className="relative w-full sm:w-auto sm:shrink-0">
          <EyeIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <NativeSelect
            value={statusFilter}
            onChange={(e) =>
              onChangeStatus?.(e.currentTarget.value as CarStatus)
            }
            className="w-full sm:w-auto min-w-[150px] rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm transition hover:bg-white/80 focus:ring-2 focus:ring-black/10"
          >
            <option value="">Status</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </NativeSelect>
        </div>
      )}
    </div>
  );
}
