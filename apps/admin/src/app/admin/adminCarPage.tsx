import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useRouteLoaderData } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Loader, Badge } from "@mantine/core";

import {
  Map,
  Marker,
  NavigationControl,
  ScaleControl,
  FullscreenControl,
} from "react-map-gl/mapbox";
import type { MapRef, ViewState } from "react-map-gl/mapbox";

import { QK } from "@/queryKeys";
import { fetchCarById } from "@/services/car.service";
import { getGlobalSettings } from "@/services/settings.service";
import Pin from "@/components/pin";
import type { AppSettings } from "@/types/setting";
import { fetchCountries } from "@/services/geo.service";
import type { Country } from "@/types/country";

type CarDetails = Awaited<ReturnType<typeof fetchCarById>>;

const cardCls =
  "rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 px-4 py-4 sm:px-5 sm:py-5";

const AdminCarPage = () => {
  const { carId } = useParams<{ carId: string }>();
  const navigate = useNavigate();

  // ⚙️ текущий владелец (ownerId из rootLoader'a)
  const rootData = useRouteLoaderData("rootAuth") as
    | { ownerId: string }
    | undefined;
  const rootOwnerId = rootData?.ownerId ?? null;

  // 🚗 сам автомобиль
  const {
    data: car,
    isLoading,
    isError,
    error,
  } = useQuery<CarDetails, Error>({
    queryKey: QK.car(String(carId)),
    enabled: !!carId,
    queryFn: () => fetchCarById(String(carId)),
  });

  const settingsOwnerId: string | null =
    (car as any)?.ownerId ?? (car as any)?.owner_id ?? rootOwnerId ?? null;

  // 🌍 глобальные настройки владельца — как fallback
  const { data: appSettings } = useQuery<AppSettings | null, Error>({
    queryKey: settingsOwnerId
      ? QK.appSettingsByOwner(settingsOwnerId)
      : ["appSettings", "noop"],
    queryFn: () => getGlobalSettings(settingsOwnerId!),
    enabled: !!settingsOwnerId,
    staleTime: 5 * 60_000,
    refetchOnMount: false,
  });

  // 🌎 список стран (чтобы по countryId достать название)
  const { data: countries = [] } = useQuery<Country[], Error>({
    queryKey: ["countries"],
    queryFn: fetchCountries,
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // 🗺 карта (всегда один и тот же порядок хуков!)
  const [mapView, setMapView] = useState<ViewState>({
    latitude: 50.45,
    longitude: 30.52,
    zoom: 4,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  const mapRef = useRef<MapRef | null>(null);

  useEffect(() => {
    if (!car) return;
    if (car.lat != null && car.long != null) {
      const lat = Number(car.lat);
      const lng = Number(car.long);
      setMapView((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        zoom: 13,
      }));
    }
  }, [car]);

  /* ---------- guard-рендеры ПОСЛЕ хуков ---------- */

  if (!carId) {
    return (
      <div className="mt-6 text-sm text-red-500">No carId in route params</div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 mt-10 text-zinc-500">
        <Loader size="sm" /> Loading car...
      </div>
    );
  }

  if (isError || !car) {
    return (
      <div className="mt-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back
        </button>

        <p className="mt-4 text-sm text-red-500">
          Failed to load car: {error?.message || "Unknown error"}
        </p>
      </div>
    );
  }

  /* ---------- вычисления без хуков ---------- */

  const brand = car.model?.brands?.name ?? "—";
  const model = car.model?.name ?? "—";
  const plate = car.licensePlate ?? "—";

  // город + страна
  // город + страна (страна из справочника countries по country_id)
  const rawLoc = car.location as any;
  let city: string | null = null;
  let countryName: string | null = null;

  if (rawLoc) {
    const locObj = Array.isArray(rawLoc) ? rawLoc[0] : rawLoc;

    city = locObj?.name ?? null;

    const countryId =
      locObj?.country_id ??
      locObj?.countryId ??
      (locObj?.countries && locObj.countries.id);

    if (countryId && countries.length > 0) {
      const found = countries.find((c) => String(c.id) === String(countryId));
      countryName = found?.name ?? null;
    }
  }

  const locationDisplay =
    city && countryName
      ? `${city}, ${countryName}`
      : city || countryName || "—";

  const status = car.status ?? "—";

  const ownerProfile = car.owner as any;
  const ownerName =
    ownerProfile?.full_name || ownerProfile?.email || car.ownerId || "—";
  const ownerEmail = ownerProfile?.email ?? null;

  const mainPhoto =
    car.coverPhotos?.[0] ?? car.photos?.[0] ?? car.galleryPhotos?.[0] ?? null;

  const statusTone =
    status === "available"
      ? "green"
      : status === "blocked" || status === "inactive"
      ? "red"
      : "gray";

  // --- effective settings: сначала из car, потом из global, потом дефолт ---

  console.log(appSettings);

  const effectiveCurrency = car.currency ?? appSettings?.currency ?? "EUR";

  const effectiveMinRentPeriodDays =
    car.minRentPeriod ?? appSettings?.minRentPeriod ?? null;

  const effectiveMaxRentPeriodDays =
    car.maxRentPeriod ?? appSettings?.maxRentPeriod ?? null;

  const effectiveIntervalBetweenBookings =
    car.intervalBetweenBookings ?? appSettings?.intervalBetweenBookings ?? null;

  const effectiveAgeRenters = car.ageRenters ?? appSettings?.ageRenters ?? null;

  const effectiveMinDriverLicense =
    car.minDriverLicense ?? appSettings?.minDriverLicense ?? null;

  const effectiveIsInstantBooking =
    car.isInstantBooking ?? appSettings?.isInstantBooking ?? false;

  const effectiveIsSmoking = car.isSmoking ?? appSettings?.isSmoking ?? false;

  const effectiveIsPets = car.isPets ?? appSettings?.isPets ?? false;

  const effectiveIsAbroad = car.isAbroad ?? appSettings?.isAbroad ?? false;

  const priceText =
    car.price != null ? `${car.price} ${effectiveCurrency}`.trim() : "Not set";

  return (
    <div className="w-full max-w-4xl text-gray-800">
      {/* back */}
      <div className="mb-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      {/* HEADER — в стиле брони */}
      <header className={cardCls}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          {/* left: title + meta */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg md:text-xl font-semibold text-gray-900">
                {brand} {model}
              </h1>

              {plate !== "—" && (
                <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-mono text-gray-800">
                  {plate}
                </span>
              )}

              <Badge color={statusTone} radius="xl" variant="gradient" fw={500}>
                {status}
              </Badge>
            </div>

            <div className="flex flex-wrap items-end gap-6">
              <div className="flex flex-wrap gap-2 text-xs text-gray-700">
                {car.year && (
                  <Pill>
                    Year: <b>{car.year}</b>
                  </Pill>
                )}
                {car.fuelType && (
                  <Pill>
                    Fuel: <b>{car.fuelType}</b>
                  </Pill>
                )}
                {car.transmission && (
                  <Pill>
                    Transmission: <b>{car.transmission}</b>
                  </Pill>
                )}
                {car.bodyType && (
                  <Pill>
                    Body: <b>{car.bodyType}</b>
                  </Pill>
                )}
              </div>
            </div>
          </div>

          {/* right: price */}
          <div className="w-full md:w-56">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500">
                Price per day
              </div>
              <div className="text-2xl font-semibold text-gray-900">
                {priceText}
              </div>
              <div className="mt-1 text-[11px] text-gray-400">
                Min:{" "}
                {effectiveMinRentPeriodDays != null
                  ? `${effectiveMinRentPeriodDays} day(s)`
                  : "—"}
                {" · "}
                Max:{" "}
                {effectiveMaxRentPeriodDays != null
                  ? `${effectiveMaxRentPeriodDays} day(s)`
                  : "—"}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE PHOTO CARD (сразу после header) */}
      <section className={`${cardCls} lg:hidden mt-4`}>
        <div className="overflow-hidden rounded-xl bg-gray-50 aspect-video md:aspect-[16/9]">
          {mainPhoto ? (
            <img
              src={mainPhoto}
              alt={`${brand} ${model}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full grid place-items-center text-6xl text-gray-300">
              🚗
            </div>
          )}
        </div>
      </section>

      {/* 2 колонки */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* TECH SPECS */}
          <section className={cardCls}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Technical specs
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Basic configuration & body
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <KVP label="Year" value={car.year} />
                <KVP label="Body type" value={car.bodyType} />
                <KVP label="Seats" value={car.seats} />
              </div>

              <div className="space-y-2">
                <KVP label="Fuel" value={car.fuelType} />
                <KVP label="Transmission" value={car.transmission} />
                <KVP label="Drive" value={car.driveType} />
              </div>

              <div className="space-y-2">
                <KVP label="Color" value={car.color} />
                <KVP label="Doors" value={car.doors} />
                <KVP label="Engine capacity" value={car.engineCapacity} />
              </div>
            </div>
          </section>

          {/* PRICING & POLICY */}
          <section className={cardCls}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Pricing & policy
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Price, deposit and rental rules
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <KVP label="Price per day" value={priceText} />
                <KVP
                  label="Deposit"
                  value={car.deposit != null ? car.deposit : null}
                />
                <KVP
                  label="Included mileage"
                  value={
                    car.includeMileage != null ? car.includeMileage : undefined
                  }
                />
              </div>

              <div className="space-y-2">
                <KVP
                  label="Delivery"
                  value={
                    car.isDelivery
                      ? car.deliveryFee != null
                        ? `Yes (${car.deliveryFee})`
                        : "Yes"
                      : "No"
                  }
                />
                <KVP
                  label="Interval between bookings (min)"
                  value={effectiveIntervalBetweenBookings}
                />
              </div>

              <div className="space-y-2">
                <KVP label="Age of renters" value={effectiveAgeRenters} />
                <KVP
                  label="Min driver license (years)"
                  value={effectiveMinDriverLicense}
                />
              </div>
            </div>

            {/* флаги в виде pill'ов */}
            <div className="mt-4 flex flex-wrap gap-2">
              <FlagPill
                label="Instant booking"
                value={effectiveIsInstantBooking}
              />
              <FlagPill label="Smoking allowed" value={effectiveIsSmoking} />
              <FlagPill label="Pets allowed" value={effectiveIsPets} />
              <FlagPill label="Abroad allowed" value={effectiveIsAbroad} />
            </div>
          </section>

          {/* LOCATION + MAP */}
          <section className={cardCls}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Location
                </h2>
                <p className="mt-1 text-xs text-gray-500">Car pickup point</p>
              </div>
            </div>

            <div className="mt-3 space-y-1  text-gray-800">
              <div className="flex items-center gap-1">
                <span className="text-base">📍</span>
                <span>
                  {locationDisplay !== "—"
                    ? locationDisplay
                    : "Location not set"}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {car.address || "No detailed address provided"}
              </div>
            </div>

            <div className="mt-4">
              <div className="relative z-0 h-60 overflow-hidden rounded-xl border border-gray-100  ">
                <Map
                  ref={mapRef}
                  {...mapView}
                  onMove={(e) => setMapView(e.viewState as ViewState)}
                  style={{ width: "100%", height: "100%" }}
                  mapStyle="mapbox://styles/megadoze/cldamjew5003701p5mbqrrwkc"
                  mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
                  scrollZoom={true}
                  dragPan={true}
                  dragRotate={false}
                  touchZoomRotate={true}
                >
                  <Marker
                    longitude={
                      car.long != null ? Number(car.long) : mapView.longitude
                    }
                    latitude={
                      car.lat != null ? Number(car.lat) : mapView.latitude
                    }
                  >
                    <Pin />
                  </Marker>

                  <NavigationControl position="top-left" />
                  <ScaleControl />
                  <FullscreenControl position="top-right" />
                </Map>
              </div>
            </div>
          </section>

          {/* DESCRIPTION */}
          {car.content && (
            <section className={cardCls}>
              <h2 className="text-base font-semibold text-gray-900">
                Description
              </h2>

              <div
                className="mt-3 text-sm md:text-base text-gray-800 leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: car.content }}
              />
            </section>
          )}
        </div>

        {/* RIGHT (1/3) — Host + Technical */}
        <aside className="lg:col-span-1 space-y-4">
          {/* photo — только на десктопе */}
          <section className={`${cardCls} hidden lg:block`}>
            <div className="overflow-hidden rounded-xl bg-gray-50 aspect-video md:aspect-[16/9]">
              {mainPhoto ? (
                <img
                  src={mainPhoto}
                  alt={`${brand} ${model}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full grid place-items-center text-6xl text-gray-300">
                  🚗
                </div>
              )}
            </div>
          </section>

          {/* host */}
          <section className={cardCls}>
            <h2 className="text-base font-semibold text-gray-900">Host</h2>
            <p className="mt-1 text-xs text-gray-500">
              Owner of this car in the system
            </p>

            <div className="mt-3 space-y-1 text-sm text-gray-900">
              <div className="font-medium">{ownerName}</div>
              {ownerEmail && (
                <div className="text-xs text-gray-500">{ownerEmail}</div>
              )}
              {car.ownerId && (
                <div className="mt-1 text-[11px] text-gray-400 break-all">
                  Host ID: {car.ownerId}
                </div>
              )}
            </div>
          </section>

          {/* technical */}
          <section className={cardCls}>
            <h2 className="text-base font-semibold text-gray-900">
              Technical details
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Identifiers and media counts
            </p>

            <div className="mt-3 space-y-1 text-xs text-gray-700 break-all">
              <div>
                <span className="font-semibold">Car ID: </span>
                {car.id}
              </div>
              {car.vin && (
                <div>
                  <span className="font-semibold">VIN: </span>
                  {car.vin}
                </div>
              )}
              {Array.isArray(car.coverPhotos) && car.coverPhotos.length > 0 && (
                <div>
                  <span className="font-semibold">Cover photos: </span>
                  {car.coverPhotos.length}
                </div>
              )}
              {Array.isArray(car.galleryPhotos) &&
                car.galleryPhotos.length > 0 && (
                  <div>
                    <span className="font-semibold">Gallery photos: </span>
                    {car.galleryPhotos.length}
                  </div>
                )}
              {car.videoUrl && (
                <div>
                  <span className="font-semibold">Video URL: </span>
                  {car.videoUrl}
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default AdminCarPage;

/* ========= helpers ========= */

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] text-gray-700">
      {children}
    </span>
  );
}

function KVP({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  const empty =
    value === null || value === undefined || value === "" ? "—" : value;

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-gray-900">{empty}</div>
    </div>
  );
}

function FlagPill({ label, value }: { label: string; value?: boolean | null }) {
  let text = "—";
  let tone = "bg-gray-50 text-gray-700 border-gray-200";

  if (value === true) {
    text = "Yes";
    tone = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (value === false) {
    text = "No";
    tone = "bg-red-50 text-red-700 border-red-200";
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${tone}`}
    >
      <span>{label}</span>
      <span className="text-[10px] uppercase tracking-wide opacity-80">
        {text}
      </span>
    </span>
  );
}
