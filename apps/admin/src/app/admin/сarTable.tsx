import { NavLink } from "react-router-dom";
import type { CarWithRelations } from "@/types/carWithRelations";
import { highlightMatch } from "@/utils/highlightMatch";
import {
  MapPinIcon,
  IdentificationIcon,
  CircleStackIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@mantine/core";

// —— Props ——
type Props = {
  cars: CarWithRelations[];
  search: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// —— Component ——
export default function CarTable({ cars, search }: Props) {
  return (
    <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 max-w-5xl 2xl:max-w-7xl">
      {cars.map((car) => {
        const brand = car.models?.brands?.name ?? "";
        const model = car.models?.name ?? "";
        const title = `${brand} ${model}`.trim();
        const plate = car.licensePlate ?? "";
        const location = car.locations?.name ?? "";
        const vin = car.vin ?? "";
        const photo = car.coverPhotos?.[0];

        return (
          <NavLink
            key={car.id}
            to={`/admin/cars/${car.id}`}
            className={cn(
              "group relative block w-full overflow-hidden rounded-2xl",
              // Borderless, glassy card
              "bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/40",
              // Soft shadow + interactive elevation
              "shadow-[0_2px_10px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.10)]",
              // Animation
              "transition-all duration-300"
            )}
            aria-label={`${brand} ${model} ${plate}`}
          >
            {/* Top media */}
            <div className="relative overflow-hidden">
              {photo ? (
                <img
                  src={photo}
                  alt={`${brand} ${model}`}
                  loading="lazy"
                  className=" w-full object-cover aspect-video transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="h-48 w-full sm:h-52 md:h-56 bg-gradient-to-br from-zinc-100 to-zinc-200" />
              )}

              {/* Subtle gradient overlay for text legibility */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-gray-300/30 to-transparent" />

              {/* Status pill in the corner */}
              <div className="absolute left-3 top-3 ">
                <Badge
                  variant="gradient"
                  gradient={
                    car.status === "available"
                      ? { from: "teal", to: "cyan", deg: 90 }
                      : { from: "gray", to: "rgba(173, 173, 173, 1)", deg: 90 }
                  }
                  size="sm"
                >
                  {" "}
                  ◉ {car.status}
                </Badge>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-4">
              <div className="flex justify-between">
                {/* Title */}
                <h3 className="text-lg font-semibold leading-snug text-zinc-900 line-clamp-1">
                  {highlightMatch(title, search)}{" "}
                  <span className="text-gray-500">{car.year}</span>
                </h3>
                <p>
                  <span className=" font-semibold font-ptSans text-lg">
                    {car.price} {car.currency}/day
                  </span>
                </p>
              </div>

              {/* Meta */}
              <div className="mt-2 flex flex-wrap items-center gap-2.5 text-sm text-zinc-600">
                {plate && (
                  <span className="inline-flex items-center rounded-md bg-zinc-50 px-2 py-1 font-mono text-[12px] tracking-wide shadow-sm ring-1 ring-inset ring-black/5">
                    <IdentificationIcon
                      className="h-4 w-4 mr-1"
                      aria-hidden="true"
                    />
                    {highlightMatch(plate, search)}
                  </span>
                )}

                {location && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-zinc-50 px-2 py-1 shadow-sm ring-1 ring-inset ring-black/5">
                    <MapPinIcon className="h-4 w-4" aria-hidden="true" />
                    <span className="truncate max-w-[12rem]">{location}</span>
                  </span>
                )}

                {car.models?.brands?.name && (
                  <span className=" inline-flex items-center rounded-md bg-white/70 px-2 py-1 text-[12px] shadow-sm ring-1 ring-inset ring-black/5">
                    <span className="flex items-center mr-1">
                      <CircleStackIcon
                        className="h-4 w-4 mr-1"
                        aria-hidden="true"
                      />
                      VIN:
                    </span>
                    {highlightMatch(vin, search)}
                  </span>
                )}
              </div>
            </div>

            {/* Hover highlight strip */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-r from-transparent via-black/10 to-transparent" />
          </NavLink>
        );
      })}
    </div>
  );
}
