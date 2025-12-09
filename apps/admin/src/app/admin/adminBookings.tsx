import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useLoaderData,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  QueryClient,
  useQuery,
  useQueryClient,
  useInfiniteQuery,
  type InfiniteData,
} from "@tanstack/react-query";
import { Badge, Drawer, Loader, TextInput } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { format, parseISO } from "date-fns";
import {
  fetchCarById,
  fetchCarExtras,
  fetchExtras,
} from "@/services/car.service";
import {
  fetchBookingById,
  fetchBookingsByCarId,
} from "@/services/calendar.service";
import { fetchBookingExtras } from "@/services/booking-extras.service";
import {
  fetchCountriesForBookings,
  fetchLocationsByCountryBookings,
} from "@/services/geo.service";

import type { BookingCard } from "@/types/bookingCard";
import type { Country } from "@/types/country";
import type { Location as TLocation } from "@/types/location";
import { QK } from "@/queryKeys";
import { getGlobalSettings } from "@/services/settings.service";
import {
  fetchPricingRules,
  fetchSeasonalRates,
} from "../../services/pricing.service";

import {
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { highlightMatch } from "@/utils/highlightMatch";
import type { BookingStatus } from "@/components/bookingFilters";
import BookingFilters from "@/components/bookingFilters";

// постраничная загрузка
import {
  fetchAllBookings,
  mapIndexRowToBookingCard,
  type BookingsIndexRow,
} from "@/services/bookings.service";
import { getUserById } from "@/services/user.service";
import { supabase } from "@/lib/supabase";

type LoaderData = { ownerId: string };

const PAGE_SIZE = 10;

export default function AdminBookings() {
  const { ownerId } = useLoaderData() as LoaderData;

  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const rawUserId = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get("userId");
  }, [location.search]);

  const userIdFilter = useMemo(
    () => (rawUserId ? normalize(rawUserId) : ""),
    [rawUserId]
  );

  /* -------------------- filters state -------------------- */
  const [countryId, setCountryId] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus>("");

  const [search, setSearch] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  function uniqById<T extends { id?: string }>(arr: T[]) {
    const seen = new Set<string>();
    return arr.filter((x) => {
      const id = String(x.id ?? "");
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  /* -------------------- bookings: infinite query -------------------- */

  const filterKey = useMemo(
    () => ({
      status: statusFilter || null,
      countryId: countryId || null,
      q: normalize(search) || null,
      location: normalize(locationFilter) || null,
      userId: userIdFilter || null,
    }),
    [statusFilter, countryId, search, locationFilter, userIdFilter]
  );

  type Page = { items: BookingsIndexRow[]; count: number };

  const bookingsQ = useInfiniteQuery<
    Page,
    Error,
    InfiniteData<Page, number>,
    any,
    number
  >({
    queryKey: [...QK.bookingsIndexInfinite(ownerId, PAGE_SIZE), filterKey],
    initialPageParam: 0, // обязательно, иначе pageParam останется unknown
    queryFn: ({ pageParam }) => {
      const pageIndex = pageParam; // pageParam: number
      const offset = pageIndex * PAGE_SIZE;
      return fetchAllBookings({
        limit: PAGE_SIZE,
        offset,
        status: statusFilter || undefined,
        countryId: countryId || undefined,
        location: normalize(locationFilter) || undefined,
        userId: userIdFilter || undefined,
        q: normalize(search) || undefined,
      });
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.items.length, 0);
      const total = lastPage.count ?? loaded;
      return loaded < total ? allPages.length : undefined; // вернём индекс следующей страницы (number)
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // ✂️ хелпер — обрезать кэш до первой страницы (без сети)
  const trimToFirstPage = () => {
    const key = [
      ...QK.bookingsIndexInfinite(ownerId, PAGE_SIZE),
      filterKey,
    ] as const;
    qc.setQueryData<InfiniteData<Page, number>>(key, (old) => {
      if (!old?.pages?.length) return old;
      return { pages: [old.pages[0]], pageParams: [0] };
    });
  };

  // при уходе со страницы — всегда возвращаем к первым 10
  useEffect(() => {
    return () => {
      trimToFirstPage();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]); // привязан к конкретному владельцу

  useEffect(() => {
    const ch = supabase
      .channel("bookings-list-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        (payload) => {
          const evt = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
          const row = (payload.new ?? payload.old) as any;
          if (!row?.id) return;

          // добираем метаданные авто из локального кэша (бренд/модель/фото/номер)
          const carMeta = pickCarMetaFromCache(qc, row.car_id);

          if (evt === "INSERT") {
            // мгновенно положить запись в первую страницу infinite
            prependIndexRow(qc, { ...row, ...carMeta });
          } else if (evt === "UPDATE") {
            // быстрый локальный патч, если запись уже есть в кэше
            patchIndexRowQuick(qc, { ...row, ...carMeta });
          } else if (evt === "DELETE") {
            removeIndexRow(qc, row.id, row.car_id);
          }

          // универсальная подстраховка: подтянуть сервером, если фильтры/страницы меняются
          qc.invalidateQueries({
            predicate: (q) =>
              Array.isArray(q.queryKey) &&
              (q.queryKey[0] === "bookingsIndexInfinite" ||
                q.queryKey[0] === "bookingsByCarId" ||
                (q.queryKey[0] === "booking" && q.queryKey[1] === row.id)),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const EMPTY_PAGES: ReadonlyArray<Page> = [];

  const pages = useMemo(
    () => bookingsQ.data?.pages ?? EMPTY_PAGES,
    [bookingsQ.data]
  );

  const bookingRows = useMemo<BookingsIndexRow[]>(
    () => pages.flatMap((p) => p.items),
    [pages]
  );

  const items: BookingCard[] = useMemo(() => {
    const cards = bookingRows.map(mapIndexRowToBookingCard);
    return uniqById(cards);
  }, [bookingRows]);

  const usersById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of bookingRows) {
      const name = r.user_full_name ?? null;
      if (name && r.user_id) m.set(String(r.user_id), String(name));
    }
    return m;
  }, [bookingRows]);

  /* -------------------- geo queries -------------------- */
  const countriesQ = useQuery<Country[], Error>({
    queryKey: ["countries"],
    queryFn: fetchCountriesForBookings,
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
    queryFn: () => fetchLocationsByCountryBookings(countryId!),
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

  const list = items;

  /* -------------------- open editor helpers -------------------- */
  const [openingId, setOpeningId] = useState<string | null>(null);

  const openEditor = async (b: BookingCard) => {
    if (openingId) return;
    setOpeningId(b.id);

    const uId = b.userId ?? null; // ← сузили тип

    if (uId) {
      await qc.ensureQueryData({
        queryKey: QK.user(uId), // ← тот же ключ что и в префетче
        queryFn: () => getUserById(uId), // ← сюда идёт строго string
        staleTime: 5 * 60_000,
      });
    }

    const cachedBooking = qc.getQueryData<any>(QK.booking(b.id));
    const cachedExtras = qc.getQueryData<any[]>(QK.bookingExtras(b.id));
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

    navigate(`/admin/bookings/${b.id}`, {
      state: {
        snapshot: {
          booking: {
            ...base,
            ...(cachedBooking ?? {}),
            ...(cachedUser ? { user: cachedUser } : {}),
          },
          booking_extras: Array.isArray(cachedExtras)
            ? cachedExtras
            : undefined,
        },
        from: location.pathname + location.search,
      },
    });

    setOpeningId(null);
  };

  const clearUserFilter = () => {
    navigate({ pathname: location.pathname }, { replace: true });
  };

  async function prefetchBundle(
    qc: QueryClient,
    carId: string,
    bId: string,
    uId?: string
  ) {
    await Promise.all([
      qc.prefetchQuery({
        queryKey: QK.appSettingsByOwner(ownerId),
        queryFn: () => getGlobalSettings(ownerId),
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
            queryKey: QK.user(uId), // ← используем ОДИН и тот же ключ везде
            queryFn: () => getUserById(uId), // ← тянем email/phone из profiles
            staleTime: 5 * 60_000,
          })
        : Promise.resolve(),
    ]);
  }

  /* -------------------- pagination helpers -------------------- */
  const loadingInitial = bookingsQ.isLoading && !bookingsQ.data;
  const isFetchingNext = bookingsQ.isFetchingNextPage;
  const totalLoaded = items.length;
  const totalAvailable = bookingsQ.data?.pages[0]?.count ?? totalLoaded;
  const canLoadMore = totalLoaded < totalAvailable;

  /* -------------------- render -------------------- */
  return (
    <main className="w-full font-roboto">
      <header className="flex items-end justify-between mb-4">
        <h1 className="font-roboto text-xl md:text-2xl font-medium md:font-bold">
          Bookings
        </h1>
      </header>

      {/* Desktop filters row */}
      <div className="hidden lg:flex lg:flex-wrap items-center gap-3 w-full mb-4 overflow-x-auto">
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
            placeholder="Search by make, model, number, guest"
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
            clearUserFilter();
            trimToFirstPage(); // ⬅️ сброс локально к первым 10
          }}
          className="p-2 rounded hover:bg-gray-100 active:bg-gray-200 transition"
          aria-label="Reset filters"
          title="Reset filters"
        >
          <XMarkIcon className="size-5 text-gray-800 stroke-1" />
        </button>
      </div>

      {/* Mobile search */}
      <div className="relative w-full mb-4 lg:hidden">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <TextInput
          placeholder="Search by make, model, number, guest"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          className="w-full rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm hover:bg-white/80 focus:ring-2 focus:ring-black/10"
        />
      </div>

      {/* Mobile floating Filters button */}
      <div className="lg:hidden">
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
              clearUserFilter();
              trimToFirstPage();
            }}
            className="text-sm text-zinc-500 underline underline-offset-4"
          >
            Reset filters
          </button>
        </div>
      </Drawer>

      {/* Content */}
      <section id="bookings" className="mt-4 mb-10">
        {loadingInitial ? (
          <div className="flex justify-center items-center gap-2 text-center text-zinc-500 mt-10">
            <Loader size="sm" /> Loading...
          </div>
        ) : list.length === 0 ? (
          <div className="p-6 rounded-2xl border text-gray-600 text-sm">
            There are no bookings yet.
          </div>
        ) : (
          <>
            <div className="flex flex-col">
              {list.map((b) => {
                const fullName = b.userId ? usersById.get(b.userId) ?? "" : "";
                return (
                  <Link
                    key={b.id}
                    to={`/admin/bookings/${b.id}`}
                    className={`flex items-center bg-white hover:bg-emerald-50/40 transition ease-in-out duration-300 p-2 w-full rounded-2xl my-1 cursor-pointer border border-zinc-100 ${
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
                      void prefetchBundle(
                        qc,
                        b.carId,
                        b.id,
                        b.userId ?? undefined
                      );
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
                      <p className="font-medium font-roboto text-sm md:text-base truncate">
                        {highlightMatch(
                          `${b.car?.brand ?? ""} ${b.car?.model ?? ""}`,
                          search
                        )}
                      </p>
                      <div className="flex items-center gap-1">
                        {b.car?.licensePlate && (
                          <p className="text-sm text-gray-800 border border-gray-500 rounded-sm w-fit px-1">
                            {highlightMatch(b.car.licensePlate, search)}
                          </p>
                        )}
                        {fullName && (
                          <p className="text-sm text-gray-900 truncate">
                            {highlightMatch(fullName, search)}
                          </p>
                        )}
                      </div>

                      <div className="mt-1 text-sm sm:hidden">
                        <span>{format(parseISO(b.startAt), "d MMM")}</span>
                        {" → "}
                        <span>{format(parseISO(b.endAt), "d MMM")}</span>
                      </div>
                    </div>

                    <div className="sm:flex flex-col w-36 hidden">
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

                    <div className="items-end flex flex-col flex-1 justify-between sm:ml-auto mt-2 sm:mt-0 md:mr-auto md:text-base lg:flex-col lg:items-end gap-1">
                      <p className="sm:block text-sm md:text-base mr-2 text-gray-900">
                        {b.priceTotal} {b.currency}
                      </p>
                      <StatusPill status={b.status} />
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Load more */}
            <div className="w-full flex justify-center mt-6">
              {canLoadMore ? (
                <button
                  type="button"
                  onClick={() => bookingsQ.fetchNextPage()}
                  disabled={isFetchingNext}
                  aria-busy={isFetchingNext}
                  className="rounded-2xl bg-black text-white px-4 py-2 text-sm hover:opacity-85 disabled:opacity-60"
                >
                  {isFetchingNext ? "Loading..." : "Показать ещё"}
                </button>
              ) : (
                <div className="text-xs text-zinc-400">
                  There are no more bookings
                </div>
              )}
            </div>
          </>
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

function normalize(v?: string | null) {
  return (v ?? "").toString().trim().toLowerCase();
}

function mapDbRowToIndexRow(db: any) {
  return {
    id: db.id,
    car_id: String(db.car_id),
    user_id: db.user_id ?? null,
    start_at: db.start_at,
    end_at: db.end_at,
    created_at: db.created_at,
    status: db.status,
    mark: db.mark,
    price_total: db.price_total,
    currency: db.currency,
    // ВАЖНО: «правильные» поля для авто:
    brand_name: db.brand_name ?? db.car_brand ?? null, // на случай если денорм делаешь на сервере
    model_name: db.model_name ?? db.car_model ?? null,
    cover_photos: Array.isArray(db.cover_photos) ? db.cover_photos : null,
    license_plate: db.license_plate ?? db.car_license_plate ?? null,
    // имя гостя (если есть денорм/вьюшка)
    user_full_name: db.user_full_name ?? null,
  };
}

function patchIndexRowQuick(qc: any, dbRow: any) {
  if (!dbRow?.id) return;
  const draft = mapDbRowToIndexRow(dbRow);

  qc.setQueriesData(
    {
      predicate: (q: any) =>
        Array.isArray(q.queryKey) && q.queryKey[0] === "bookingsIndexInfinite",
    },
    (old: any) => {
      if (!old?.pages?.length) return old;
      const pages = old.pages.map((p: any) => {
        if (!p?.items) return p;
        const idx = p.items.findIndex(
          (x: any) => String(x.id) === String(draft.id)
        );
        if (idx === -1) return p;
        const nextItems = p.items.slice();
        nextItems[idx] = { ...nextItems[idx], ...draft };
        return { ...p, items: nextItems };
      });
      return { ...old, pages };
    }
  );
}

// добрать мету авто из кэша (без сети)
function pickCarMetaFromCache(qc: QueryClient, carId?: string) {
  if (!carId) return {};
  const car = qc.getQueryData<any>(QK.car(String(carId)));
  if (!car) return {};
  return {
    brand_name: car?.model?.brands?.name ?? null,
    model_name: car?.model?.name ?? null,
    cover_photos: Array.isArray(car?.cover_photos) ? car.cover_photos : null,
    license_plate: car?.licensePlate ?? null,
  };
}

// prepend новой записи в первую страницу infinite-списка
function prependIndexRow(qc: QueryClient, dbRow: any) {
  const row = mapDbRowToIndexRow(dbRow);
  qc.setQueriesData(
    {
      predicate: (q: any) =>
        Array.isArray(q.queryKey) && q.queryKey[0] === "bookingsIndexInfinite",
    },
    (old: any) => {
      if (!old?.pages?.length) {
        return { pageParams: [0], pages: [{ items: [row], count: 1 }] };
      }
      const pages = old.pages.slice();
      const first = pages[0];
      const exists = Array.isArray(first?.items)
        ? first.items.some((x: any) => String(x.id) === String(row.id))
        : Array.isArray(first)
        ? first.some((x: any) => String(x.id) === String(row.id))
        : false;
      if (exists) return old;

      if (Array.isArray(first?.items)) {
        pages[0] = {
          ...first,
          items: [row, ...first.items],
          count: (first.count ?? first.items.length) + 1,
        };
      } else if (Array.isArray(first)) {
        pages[0] = [row, ...first];
      } else {
        pages[0] = { items: [row], count: 1 };
      }
      return { ...old, pages };
    }
  );
}

function removeIndexRow(qc: QueryClient, bookingId: string, carId?: string) {
  // 1) Удаляем из всех бесконечных лент
  qc.setQueriesData(
    {
      predicate: (q: any) =>
        Array.isArray(q.queryKey) && q.queryKey[0] === "bookingsIndexInfinite",
    },
    (old: any) => {
      if (!old?.pages?.length) return old;
      const pages = old.pages.map((p: any) => {
        if (Array.isArray(p?.items)) {
          const nextItems = p.items.filter(
            (x: any) => String(x.id) !== String(bookingId)
          );
          return { ...p, items: nextItems };
        }
        if (Array.isArray(p)) {
          return p.filter((x: any) => String(x.id) !== String(bookingId));
        }
        return p;
      });
      return { ...old, pages };
    }
  );

  // 2) Удаляем из кеша «броней по машине»
  if (carId) {
    qc.setQueryData(
      QK.bookingsByCarId(String(carId)),
      (list: any[] | undefined) =>
        Array.isArray(list)
          ? list.filter((b) => String(b.id) !== String(bookingId))
          : list
    );
  }

  // 3) Чистим одиночную запись
  qc.removeQueries({ queryKey: QK.booking(bookingId), exact: true });
}
