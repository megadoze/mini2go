import { useMemo, useState } from "react";
import {
  Link,
  useLoaderData,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Drawer, TextInput } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { format, parseISO } from "date-fns";
import {
  fetchCarById,
  fetchCarExtras,
  fetchCarsByHost,
  fetchExtras,
} from "@/services/car.service";
import {
  fetchBookingById,
  fetchBookingsByCarId,
} from "@/app/car/calendar/calendar.service";
import { fetchBookingExtras } from "@/services/booking-extras.service";
import { getUserById } from "@/services/user.service";
import {
  fetchCountries,
  fetchLocationsByCountry,
} from "@/services/geo.service";

import type { BookingCard } from "@/types/bookingCard";
import type { Country } from "@/types/country";
import type { Location as TLocation } from "@/types/location";
import { QK } from "@/queryKeys";
import { getGlobalSettings } from "@/services/settings.service";
import {
  fetchPricingRules,
  fetchSeasonalRates,
} from "../car/pricing/pricing.service";

import {
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { highlightMatch } from "@/utils/highlightMatch";
import type { BookingStatus } from "@/components/bookingFilters";
import BookingFilters from "@/components/bookingFilters";

/* -------------------- types from loader -------------------- */
type BookingRow = {
  id: string;
  start_at: string;
  end_at: string;
  mark: string;
  status: string | null;
  car_id: string;
  user_id: string | null;
  price_total: number | null;
  currency: string | null;
  created_at: string;
};

type LoaderData = { ownerId: string };

/* -------------------- row -> card -------------------- */
function toCard(row: BookingRow, carsById: Map<string, any>): BookingCard {
  const carBrief = carsById.get(row.car_id) || {};
  const mark: BookingCard["mark"] = row.mark === "block" ? "block" : "booking";

  return {
    id: row.id,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status ?? null,
    mark,
    carId: row.car_id,
    userId: row.user_id,
    priceTotal: row.price_total,
    currency: row.currency,
    createdAt: row.created_at,
    car: {
      id: row.car_id,
      brand: carBrief?.models?.brands?.name ?? null,
      model: carBrief?.models?.name ?? null,
      year: carBrief?.year ?? null,
      photo: carBrief?.photos?.[0] ?? null,
      licensePlate: carBrief?.licensePlate ?? null,
      deposit: carBrief?.deposit ?? null,
      locationName: carBrief?.locations?.name ?? null,
      countryId:
        carBrief?.locations?.countries?.id != null
          ? String(carBrief.locations.countries.id)
          : null,
      countryName: carBrief?.locations?.countries?.name ?? null,
    } as any,
  };
}

export default function BookingsList() {
  const { ownerId } = useLoaderData() as LoaderData;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  /* -------------------- queries: bookings + cars -------------------- */
  const bookingsKey = ["bookingsIndex", ownerId];
  const initialRows = qc.getQueryData<BookingRow[]>(bookingsKey);

  const { data: bookingRows = [] } = useQuery({
    queryKey: bookingsKey,
    // Никаких сетевых вызовов — читаем текущее содержимое кэша.
    queryFn: async () => initialRows ?? [],
    initialData: initialRows,
    enabled: true, // всегда «подписаны» на кэш
    refetchOnMount: false, // т.к. мы оффлайн от кэша
    refetchOnWindowFocus: false,
    staleTime: Infinity, // чтобы ничего не триггерило фетч
    gcTime: 7 * 24 * 60 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const carsKey = ["carsByHost", ownerId];
  const initialCars = qc.getQueryData<any[]>(carsKey);

  const { data: cars = [] } = useQuery({
    queryKey: carsKey,
    queryFn: () => fetchCarsByHost(ownerId),
    initialData: initialCars,
    enabled: !initialCars,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60_000,
  });

  const carsById = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of cars) m.set(String(c.id), c);
    return m;
  }, [cars]);

  const items: BookingCard[] = useMemo(
    () => bookingRows.map((r) => toCard(r, carsById)),
    [bookingRows, carsById]
  );

  /* -------------------- filters state -------------------- */
  const [countryId, setCountryId] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus>("");
  const [search, setSearch] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  /* -------------------- geo queries (как в CarsPage) -------------------- */
  const countriesQ = useQuery<Country[], Error>({
    queryKey: ["countries"],
    queryFn: fetchCountries,
    initialData: qc.getQueryData<Country[]>(["countries"]),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const locationsQ = useQuery<TLocation[], Error>({
    queryKey: ["locations", countryId],
    queryFn: () => fetchLocationsByCountry(countryId!),
    enabled: !!countryId,
    initialData: countryId
      ? qc.getQueryData<TLocation[]>(["locations", countryId])
      : [],
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    placeholderData: (prev) => prev ?? [],
  });

  const countries = countriesQ.data ?? [];
  const locations = locationsQ.data ?? [];

  /* -------------------- apply filters, then sort -------------------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const byText = items.filter((b) => {
      const t = `${b.car?.brand ?? ""} ${b.car?.model ?? ""} ${
        b.car?.licensePlate ?? ""
      }`.toLowerCase();
      return q === "" || t.includes(q);
    });

    const byCountry = countryId
      ? byText.filter((b) => (b.car as any)?.countryId === countryId)
      : byText;

    const byStatus = statusFilter
      ? byCountry.filter(
          (b) => (b.status ?? "").toLowerCase() === statusFilter.toLowerCase()
        )
      : byCountry;

    const byLocation = byStatus.filter((b) => {
      const loc = ((b.car as any)?.locationName ?? "").toLowerCase();
      return (
        locationFilter === "" ||
        loc.includes(locationFilter.trim().toLowerCase())
      );
    });

    return byLocation.sort((a, b) => (a.startAt < b.startAt ? 1 : -1));
  }, [items, search, countryId, statusFilter, locationFilter]);

  /* -------------------- open editor helpers -------------------- */
  const [openingId, setOpeningId] = useState<string | null>(null);

  const openEditor = (b: BookingCard) => {
    if (openingId) return;
    setOpeningId(b.id);

    const cachedBooking = qc.getQueryData<any>(["booking", b.id]);
    const cachedExtras = qc.getQueryData<any[]>(["bookingExtras", b.id]);
    const cachedUser = b.userId
      ? qc.getQueryData<any>(["user", b.userId])
      : null;

    const base = {
      id: b.id,
      car_id: b.carId,
      user_id: b.userId,
      start_at: b.startAt,
      end_at: b.endAt,
      mark: b.mark,
      status: b.status,
      price_total: b.priceTotal,
      currency: b.currency,
      created_at: b.createdAt,
    };

    void prefetchBundle(qc, b.carId, b.id, b.userId ?? undefined);

    navigate(`/cars/${b.carId}/bookings/${b.id}/edit`, {
      state: {
        snapshot: {
          booking: {
            ...base,
            ...(cachedBooking ?? {}),
            ...(cachedUser ? { user: cachedUser } : {}),
          },
          booking_extras: Array.isArray(cachedExtras) ? cachedExtras : [],
        },
        from: location.pathname + location.search,
      },
    });

    setOpeningId(null);
  };

  async function prefetchBundle(
    qc: QueryClient,
    carId: string,
    bId: string,
    uId?: string
  ) {
    await Promise.all([
      qc.prefetchQuery({
        queryKey: QK.appSettings,
        queryFn: getGlobalSettings,
        staleTime: 5 * 60_000,
      }),
      qc.prefetchQuery({
        queryKey: QK.extras,
        queryFn: fetchExtras,
        staleTime: 5 * 60_000,
      }),
      qc.prefetchQuery({
        queryKey: QK.car(carId),
        queryFn: () => fetchCarById(carId),
        staleTime: 5 * 60_000,
      }),
      qc.prefetchQuery({
        queryKey: QK.carExtras(carId),
        queryFn: () => fetchCarExtras(carId),
        staleTime: 5 * 60_000,
      }),
      qc.prefetchQuery({
        queryKey: QK.pricingRules(carId),
        queryFn: () => fetchPricingRules(carId),
        staleTime: 5 * 60_000,
      }),
      qc.prefetchQuery({
        queryKey: QK.seasonalRates(carId),
        queryFn: () => fetchSeasonalRates(carId),
        staleTime: 5 * 60_000,
      }),
      qc.prefetchQuery({
        queryKey: QK.bookingsByCarId(carId),
        queryFn: () => fetchBookingsByCarId(carId),
        staleTime: 60_000,
      }),
      qc.prefetchQuery({
        queryKey: QK.booking(bId),
        queryFn: () => fetchBookingById(bId),
        staleTime: 60_000,
      }),
      qc.prefetchQuery({
        queryKey: QK.bookingExtras(bId),
        queryFn: () => fetchBookingExtras(bId),
        staleTime: 60_000,
      }),
      uId
        ? qc.prefetchQuery({
            queryKey: QK.user(uId),
            queryFn: () => getUserById(uId),
            staleTime: 5 * 60_000,
          })
        : Promise.resolve(),
    ]);
  }

  /* -------------------- render -------------------- */
  return (
    <main className="w-full font-roboto">
      <header className="flex items-end justify-between mb-4">
        <h1 className="font-roboto text-2xl font-bold">Bookings</h1>
      </header>

      {/* Desktop filters row */}
      <div className="hidden sm:flex sm:flex-nowrap items-center gap-3 w-full mb-4 overflow-x-auto">
        <BookingFilters
          countries={countries}
          locations={locations}
          countryId={countryId}
          locationFilter={locationFilter}
          statusFilter={statusFilter}
          onChangeCountry={setCountryId}
          onChangeLocation={setLocationFilter}
          onChangeStatus={setStatusFilter}
        />

        {/* Search inline */}
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <TextInput
            placeholder="Поиск по марке, модели или номеру"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            className="w-full rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm hover:bg-white/80 focus:ring-2 focus:ring-black/10"
          />
        </div>

        {/* Reset */}
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setCountryId(null);
            setLocationFilter("");
            setStatusFilter("");
          }}
          className="p-2 rounded hover:bg-gray-100 active:bg-gray-200 transition"
          aria-label="Reset filters"
          title="Reset filters"
        >
          <XMarkIcon className="size-5 text-gray-800 stroke-1" />
        </button>
      </div>

      {/* Mobile search */}
      <div className="relative w-full mb-4 sm:hidden">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <TextInput
          placeholder="Поиск по марке, модели или номеру"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          className="w-full rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm hover:bg-white/80 focus:ring-2 focus:ring-black/10"
        />
      </div>

      {/* Mobile floating Filters button */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-md bg-black text-white active:opacity-80"
          aria-label="Open filters"
        >
          <FunnelIcon className="size-4" />
          Filters
        </button>
      </div>

      {/* Bottom sheet for mobile filters */}
      <Drawer
        opened={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        position="bottom"
        withinPortal
        size="35%"
        padding="md"
        keepMounted
        withCloseButton={false}
        overlayProps={{ opacity: 0.2, blur: 2 }}
        styles={{
          content: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
        }}
      >
        <div className="flex flex-col gap-3 mt-2">
          <BookingFilters
            countries={countries}
            locations={locations}
            countryId={countryId}
            locationFilter={locationFilter}
            statusFilter={statusFilter}
            onChangeCountry={setCountryId}
            onChangeLocation={setLocationFilter}
            onChangeStatus={setStatusFilter}
          />
        </div>
        <div className="mt-3 text-right">
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCountryId(null);
              setLocationFilter("");
              setStatusFilter("");
            }}
            className="text-sm text-zinc-500 underline underline-offset-4"
          >
            Reset filters
          </button>
        </div>
      </Drawer>

      {/* Content */}
      <section id="bookings" className="mt-4 mb-10">
        {filtered.length === 0 ? (
          <div className="p-6 rounded-2xl border text-gray-600 text-sm">
            Броней пока нет.
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((b) => (
              <Link
                key={b.id}
                to={`/cars/${b.carId}/bookings/${b.id}/edit`}
                className={`flex items-center bg-gradient-to-r from-zinc-100/60 to-zinc-50/60 hover:from-green-800/10 opacity-90 hover:opacity-100 transition ease-in-out duration-300 p-2 w-full rounded-2xl my-1 cursor-pointer ${
                  openingId === b.id
                    ? "hover:bg-green-200/20 pointer-events-none"
                    : ""
                }`}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) return;
                  e.preventDefault();
                  openEditor(b);
                }}
                onMouseEnter={() => {
                  void prefetchBundle(qc, b.carId, b.id, b.userId ?? undefined);
                }}
                aria-busy={openingId === b.id}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {b.car?.photo ? (
                    <img
                      src={b.car.photo as string}
                      alt=""
                      className="w-24 h-16 sm:w-28 sm:h-[70px] object-cover rounded-xl"
                    />
                  ) : (
                    <div className="w-24 h-16 sm:w-28 sm:h-[70px] rounded-xl bg-gray-100" />
                  )}
                </div>

                <div className="flex-1 min-w-0 pl-4 pr-2">
                  {/* brand + model with highlight */}
                  <p className="font-medium font-robotoCondensed text-sm md:text-base truncate">
                    {highlightMatch(
                      `${b.car?.brand ?? ""} ${b.car?.model ?? ""}`,
                      search
                    )}
                  </p>

                  {/* license plate with highlight */}
                  {b.car?.licensePlate && (
                    <p className="text-sm text-gray-800 border border-gray-500 rounded-sm w-fit px-1">
                      {highlightMatch(b.car.licensePlate, search)}
                    </p>
                  )}

                  <div className="mt-1 text-sm sm:hidden">
                    <span>{format(parseISO(b.startAt), "d MMM")}</span>
                    {" → "}
                    <span>{format(parseISO(b.endAt), "d MMM")}</span>
                  </div>
                </div>

                <div className=" sm:flex flex-col w-36 hidden">
                  <div className="flex flex-1 gap-1">
                    <span>{format(parseISO(b.startAt), "d MMM")}</span>
                    {" → "}
                    <span>{format(parseISO(b.endAt), "d MMM")}</span>
                  </div>

                  {b.createdAt ? (
                    <p className="text-sm font-light text-zinc-600">
                      <span>Booked</span>{" "}
                      {format(parseISO(b.createdAt), "d MMM y")}
                    </p>
                  ) : (
                    "Booked —"
                  )}
                </div>

                <div className=" items-end flex flex-col flex-1 justify-between sm:ml-auto mt-2 sm:mt-0  md:mr-auto md:text-base lg:flex-col lg:items-end gap-1">
                  <p className=" sm:block text-sm md:text-base mr-2 text-gray-900">
                    {b.priceTotal} {b.currency}
                  </p>
                  <StatusPill status={b.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function StatusPill({ status }: { status: BookingCard["status"] }) {
  const matches = useMediaQuery("(max-width: 425px)");
  const s = (status || "").toLowerCase();
  const map: Record<string, { label: string; cls: any }> = {
    confirmed: { label: "confirmed", cls: "orange" },
    rent: { label: "rent", cls: "lime" },
    canceledhost: { label: "canceledhost", cls: "red" },
    canceledguest: { label: "canceledguest", cls: "red" },
    canceledtime: { label: "canceledtime", cls: "red" },
    onapproval: { label: "onapproval", cls: "blue" },
    finished: { label: "finished", cls: "dark" },
  };
  const { label, cls } = map[s] ?? { label: status || "—", cls: "gray" };
  return (
    <Badge
      fw={400}
      variant="dot"
      color={cls as any}
      size={matches ? "sm" : "md"}
    >
      {label}
    </Badge>
  );
}
