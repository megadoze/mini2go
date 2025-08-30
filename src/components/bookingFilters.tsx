import { NativeSelect } from "@mantine/core";
import { GlobeAltIcon, MapPinIcon, EyeIcon } from "@heroicons/react/24/outline";
import type { Country } from "@/types/country";
import type { Location as TLocation } from "@/types/location";

export type BookingStatus =
  | ""
  | "confirmed"
  | "rent"
  | "onapproval"
  | "finished"
  | "canceledhost"
  | "canceledguest"
  | "canceledtime";

type Props = {
  countries: Country[];
  locations: TLocation[];
  countryId: string | null;
  locationFilter: string;
  statusFilter: BookingStatus;

  onChangeCountry: (id: string | null) => void;
  onChangeLocation: (name: string) => void;
  onChangeStatus: (status: BookingStatus) => void;

  className?: string;
};

export default function BookingFilters({
  countries,
  locations,
  countryId,
  locationFilter,
  statusFilter,
  onChangeCountry,
  onChangeLocation,
  onChangeStatus,
  className,
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
            onChangeCountry(e.currentTarget.value || null);
            onChangeLocation("");
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
          className={`w-full sm:w-auto min-w-[150px] rounded-xl pl-9 pr-3 py-2 text-sm shadow-sm transition focus:ring-2 focus:ring-black/10 ${
            !countryId
              ? "bg-gray-100/80 text-zinc-400 cursor-not-allowed"
              : "bg-white/60 hover:bg-white/80"
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

      {/* Status */}
      <div className="relative w-full sm:w-auto sm:shrink-0">
        <EyeIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <NativeSelect
          value={statusFilter}
          onChange={(e) =>
            onChangeStatus(e.currentTarget.value as BookingStatus)
          }
          className="w-full sm:w-auto min-w-[150px] rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm transition hover:bg-white/80 focus:ring-2 focus:ring-black/10"
        >
          <option value="">Status</option>
          <option value="confirmed">confirmed</option>
          <option value="rent">rent</option>
          <option value="onapproval">onapproval</option>
          <option value="finished">finished</option>
          <option value="canceledhost">canceledhost</option>
          <option value="canceledguest">canceledguest</option>
          <option value="canceledtime">canceledtime</option>
        </NativeSelect>
      </div>
    </div>
  );
}
