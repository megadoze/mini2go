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
  fetchBookingsByUser,
  mapIndexRowToBookingCard,
  type BookingsIndexRow,
} from "@/services/bookings.service";
import { getUserById } from "@/services/user.service";
import { supabase } from "@/lib/supabase";
import { getGlobalSettings } from "@/services/settings.service";

type LoaderData = { userId: string };

const PAGE_SIZE = 10;
type Page = { items: BookingsIndexRow[]; count: number };

export default function UserBookings() {
  const { userId } = useLoaderData() as LoaderData;

  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

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
      userId: userId || null,
    }),
    [statusFilter, countryId, search, locationFilter, userId]
  );

  const key = [
    ...QK.bookingsUserInfinite(userId, PAGE_SIZE),
    filterKey,
  ] as const;

  const bookingsQ = useInfiniteQuery<
    Page,
    Error,
    InfiniteData<Page, number>,
    any,
    number
  >({
    queryKey: key, // ← используем тот же key
    enabled: !!userId,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const offset = pageParam * PAGE_SIZE;
      return fetchBookingsByUser({
        limit: PAGE_SIZE,
        offset,
        userId,
        status: statusFilter || undefined,
        countryId: countryId || undefined,
        location: normalize(locationFilter) || undefined,
        q: normalize(search) || undefined,
      });
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.items.length, 0);
      const total = lastPage.count ?? loaded;
      return loaded < total ? allPages.length : undefined;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    initialData: () => qc.getQueryData(key), // ← и тут тот же key
    placeholderData: (prev) => prev,
  });

  // ✂️ хелпер — обрезать кэш до первой страницы (без сети)
  const trimToFirstPage = () => {
    const key = [
      ...QK.bookingsUserInfinite(userId, PAGE_SIZE),
      filterKey,
    ] as const;
    qc.setQueryData<InfiniteData<Page, number>>(key, (old) => {
      if (!old?.pages?.length) return old;
      return { pages: [old.pages[0]], pageParams: [0] };
    });
  };

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`bookings_user_${userId}`).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "bookings",
        filter: `user_id=eq.${userId}`,
      },
      (payload: any) => {
        const id = payload?.new?.id ?? payload?.old?.id;

        // (1) Точечные кэши карточки и экстр
        if (id) {
          qc.invalidateQueries({ queryKey: QK.booking(id) });
          qc.invalidateQueries({ queryKey: QK.bookingExtras(id) });
        }

        // (2) Инвалидируем весь пользовательский индекс (все фильтры/страницы)
        qc.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            q.queryKey[0] === "bookingsUserInfinite",
        });

        // (3) ДОП: дергаем календарь по машине этой брони
        const carId = payload?.new?.car_id ?? payload?.old?.car_id;
        if (carId) {
          qc.invalidateQueries({
            queryKey: QK.bookingsByCarId(String(carId)),
          });
        }

        // (4) На удаление — подчистить точечные кэши
        if (payload.eventType === "DELETE" && id) {
          qc.removeQueries({ queryKey: QK.booking(id) });
          qc.removeQueries({ queryKey: QK.bookingExtras(id) });
        }
      }
    );

    channel.subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [userId, qc]);

  // при уходе со страницы — всегда возвращаем к первым 10
  useEffect(() => {
    return () => {
      trimToFirstPage();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // привязан к конкретному владельцу

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

  /* -------------------- apply filters, then sort -------------------- */

  const formattedItems = useMemo(() => {
    return items.map((b) => ({
      ...b,
      startLabel: format(parseISO(b.startAt), "d MMM"),
      endLabel: format(parseISO(b.endAt), "d MMM"),
      createdLabel: b.createdAt
        ? format(parseISO(b.createdAt), "d MMM y")
        : null,
    }));
  }, [items]);

  const list = formattedItems;

  /* -------------------- open editor helpers -------------------- */
  const [openingId, setOpeningId] = useState<string | null>(null);

  const openEditor = async (b: BookingCard) => {
    if (openingId) return;
    setOpeningId(b.id);

    // прогрев кэша — оставляем
    const uId = b.userId ?? null;
    if (uId) {
      await qc.ensureQueryData({
        queryKey: QK.user(uId),
        queryFn: () => getUserById(uId),
        staleTime: 5 * 60_000,
      });
    }
    void prefetchBundle(qc, b.carId, b.id, b.userId ?? undefined);

    navigate(`${b.id}?carId=${b.carId}`, {
      state: {
        from: location.pathname + location.search,
        snapshot: {
          booking: {
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
            // опционально: user из кэша
            ...(b.userId
              ? { user: qc.getQueryData<any>(["user", b.userId]) }
              : {}),
          },
          booking_extras:
            qc.getQueryData<any[]>(QK.bookingExtras(b.id)) || undefined,
        },
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
        queryKey: QK.appSettingsByOwner(userId),
        queryFn: () => getGlobalSettings(userId),
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
              trimToFirstPage(); // ⬅️ и здесь тоже
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
            Броней пока нет.
          </div>
        ) : (
          <>
            <div className="flex flex-col">
              {list.map((b) => {
                return (
                  <Link
                    key={b.id}
                    to={`${b.id}`}
                    className={`flex items-center bg-white hover:bg-emerald-50/40 transition ease-in-out duration-300 p-2 w-full rounded-2xl my-1 cursor-pointer border border-zinc-100 ${
                      openingId === b.id
                        ? "hover:bg-green-200/20 pointer-events-none"
                        : ""
                    }`}
                    onClick={(e) => {
                      // if (e.metaKey || e.ctrlKey) return;
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

                        <p className="text-sm text-gray-900 truncate">
                          {highlightMatch(b.ownerName ?? "", search)}
                        </p>
                      </div>

                      <div className="mt-1 text-sm sm:hidden">
                        <span>{b.startLabel}</span>
                        {" → "}
                        <span>{b.endLabel}</span>
                      </div>
                    </div>

                    <div className="sm:flex flex-col w-36 hidden">
                      <div className="flex flex-1 gap-1">
                        <span>{b.startLabel}</span>
                        {" → "}
                        <span>{b.endLabel}</span>
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
                <div className="text-xs text-zinc-400">Больше броней нет</div>
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
