/* eslint-disable @next/next/no-img-element */

"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay } from "date-fns";
import { TextInput, Drawer } from "@mantine/core";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import RentalDateTimePicker from "@/components/RentalDateTimePicker";
import CarFilters from "@/components/carFilters";
import {
  fetchCountries,
  fetchLocationsByCountry,
} from "@/services/geo.service";
import { fetchCarsPage } from "@/services/car.service";
import { fetchBookingsForCarsInRange } from "@/services/catalog-availability.service";
import {
  fetchPricingRules,
  fetchSeasonalRates,
  type PricingRule,
  type SeasonalRate,
} from "@/services/pricing.service";
import { getGlobalSettings } from "@/services/settings.service";
import { highlightMatch } from "@/utils/highlightMatch";
import { calculateFinalPriceProRated } from "@/hooks/useFinalPriceHourly";
import type { CarWithRelations } from "@/types/carWithRelations";
import type { Booking } from "@/types/booking";
import type { Country } from "@/types/country";
import type { Location } from "@/types/location";
import { HeaderSection } from "@/components/header";
import { getSupabaseClient } from "@/lib/supabase";
import { enUS } from "date-fns/locale";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "");
}

const BLOCKING_BOOKING_STATUSES = new Set(["onapproval", "confirmed", "rent"]);
function isBlockingBooking(b: any) {
  if (b.mark === "block") return true;
  if (b.mark === "booking") {
    const st = String(b.status || "").toLowerCase();
    return BLOCKING_BOOKING_STATUSES.has(st);
  }
  return false;
}

const PAGE_SIZE = 10;

const TRACE =
  typeof window !== "undefined" &&
  localStorage.getItem("TRACE_CATALOG") === "1";

type OwnerSettings = {
  openTime: number | null;
  closeTime: number | null;
  minRentPeriod: number | null;
  maxRentPeriod: number | null;
  intervalBetweenBookings: number | null;
  currency: string | null;
  ageRenters?: number | null;
  minDriverLicense?: number | null;
  isInstantBooking?: boolean;
  isSmoking?: boolean;
  isPets?: boolean;
  isAbroad?: boolean;
};

function minutesSinceMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

function isInDailyWindow(
  dt: Date,
  openMin: number | null,
  closeMin: number | null,
  inclusiveEnd = false
) {
  if (openMin == null || closeMin == null) return true;
  if (openMin === closeMin) return true; // 24/7
  const t = minutesSinceMidnight(dt);
  if (closeMin > openMin) {
    // обычное окно
    return t >= openMin && (inclusiveEnd ? t <= closeMin : t < closeMin);
  } else {
    // окно через полночь
    return t >= openMin || (inclusiveEnd ? t <= closeMin : t < closeMin);
  }
}

function diffMinutes(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 60000);
}

function overlaps(aS: Date, aE: Date, bS: Date, bE: Date) {
  return aS < bE && bS < aE;
}

export default function CatalogClient() {
  const searchParams = useSearchParams();

  const router = useRouter();
  const qc = useQueryClient();

  const updateQuery = useSyncQuery();

  const countryChangeDebounceRef = useRef<number | null>(null);
  const pendingCountryRef = useRef<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);

  // даты
  const [start, setStart] = useState(searchParams.get("start") ?? "");
  const [end, setEnd] = useState(searchParams.get("end") ?? "");

  // показ календаря
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  // десктоп/мобила
  const [isMobile, setIsMobile] = useState(false);

  // фильтры
  const [countryId, setCountryId] = useState<string | null>(
    searchParams.get("country") ?? null
  );
  const [locationFilter, setLocationFilter] = useState(
    searchParams.get("location") ?? ""
  );
  const [search, setSearch] = useState("");

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // словари
  const [countries, setCountries] = useState<Country[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // carId -> pricing
  const [pricingMeta, setPricingMeta] = useState<
    Record<
      string,
      {
        pricingRules: PricingRule[];
        seasonalRates: SeasonalRate[];
        effectiveCurrency: string | null;
        baseDailyPrice: number | null;
      }
    >
  >({});

  // ownerId -> settings
  const [settingsByOwner, setSettingsByOwner] = useState<
    Record<string, OwnerSettings>
  >({});

  // ========== availability state ==========
  const [availabilityState, setAvailabilityState] = useState<{
    key: string | null;
    loading: boolean;
    bookings: Booking[];
    requestId: number | null;
  }>({ key: null, loading: false, bookings: [], requestId: null });

  // debounce ref and request counter
  const availabilityDebounceRef = useRef<number | null>(null);
  const availabilityCounterRef = useRef(0);

  // страны
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchCountries();
        setCountries(data);
      } catch {
        setCountries([]);
      }
    })();
  }, []);

  // мобилка
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // локации по стране
  useEffect(() => {
    if (!countryId) {
      setLocations([]);
      return;
    }
    (async () => {
      try {
        const data = await fetchLocationsByCountry(countryId);
        setLocations(data);
      } catch {
        setLocations([]);
      }
    })();
  }, [countryId]);

  // ключ кэша
  const publicCarsQueryKey = useMemo(() => ["public-cars", PAGE_SIZE], []);

  // infinite cars
  const carsQ = useInfiniteQuery<
    { items: CarWithRelations[]; count: number },
    Error
  >({
    queryKey: publicCarsQueryKey,
    queryFn: async ({ pageParam }) => {
      const pageIndex = typeof pageParam === "number" ? pageParam : 0;
      const offset = pageIndex * PAGE_SIZE;
      return fetchCarsPage({ limit: PAGE_SIZE, offset });
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.items.length, 0);
      const total = lastPage.count ?? loaded;
      return loaded < total ? allPages.length : undefined;
    },
    initialPageParam: 0,
    initialData: () => qc.getQueryData(publicCarsQueryKey) as any,
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  // обрезать при размонтировании
  useEffect(() => {
    return () => {
      qc.setQueryData(publicCarsQueryKey, (old: any) => {
        if (!old?.pages?.length) return old;
        return { pages: [old.pages[0]], pageParams: [0] };
      });
    };
  }, [qc, publicCarsQueryKey]);

  const pages = useMemo(() => carsQ.data?.pages ?? [], [carsQ.data?.pages]);
  const cars: CarWithRelations[] = useMemo(
    () => pages.flatMap((p) => p.items ?? []),
    [pages]
  );
  const totalAvailable = pages[0]?.count ?? cars.length;
  const canLoadMore = cars.length < totalAvailable;

  // react-query flags
  const isFetching = carsQ.isFetching;
  const isError = Boolean(carsQ.isError);
  const isFetchingNext = carsQ.isFetchingNextPage;

  // pricing для новых машин
  useEffect(() => {
    if (!cars.length) return;
    const missingIds = cars.map((c) => c.id).filter((id) => !pricingMeta[id]);
    if (!missingIds.length) return;

    let alive = true;
    (async () => {
      try {
        const results = await Promise.all(
          missingIds.map(async (carId) => {
            const [rules, seasonal] = await Promise.all([
              fetchPricingRules(carId),
              fetchSeasonalRates(carId),
            ]);
            return { carId, rules: rules ?? [], seasonal: seasonal ?? [] };
          })
        );
        if (!alive) return;
        setPricingMeta((prev) => {
          const next = { ...prev };
          for (const item of results) {
            const car = cars.find((c) => c.id === item.carId);
            next[item.carId] = {
              pricingRules: item.rules,
              seasonalRates: item.seasonal,
              effectiveCurrency: (car as any)?.currency ?? null,
              baseDailyPrice: car?.price ?? null,
            };
          }
          return next;
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [cars, pricingMeta]);

  // настройки по ownerId
  useEffect(() => {
    if (!cars.length) return;
    const ownerIds = Array.from(
      new Set(
        cars
          .map((c) => c.ownerId)
          .filter(Boolean)
          .map(String)
      )
    );
    const missing = ownerIds.filter((oid) => !settingsByOwner[oid]);
    if (!missing.length) return;

    let alive = true;
    (async () => {
      try {
        const results = await Promise.all(
          missing.map(async (oid) => {
            const s = await getGlobalSettings(oid);
            return { ownerId: oid, settings: s };
          })
        );
        if (!alive) return;
        setSettingsByOwner((prev) => {
          const next = { ...prev };
          for (const r of results) {
            next[r.ownerId] =
              r.settings ??
              ({
                openTime: null,
                closeTime: null,
                minRentPeriod: null,
                maxRentPeriod: null,
                intervalBetweenBookings: null,
                currency: null,
              } satisfies OwnerSettings);
          }
          return next;
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [cars, settingsByOwner]);

  // realtime
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const ch = supabase
      .channel("public-cars-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cars" },
        () => {
          qc.invalidateQueries({ queryKey: publicCarsQueryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc, publicCarsQueryKey]);

  const pickerDisabledIntervals = useMemo(() => {
    return []; // никаких disabled intervals на уровне списка
  }, []);

  // базовая фильтрация
  const filteredCars = useMemo(() => {
    const text = search.trim().toLowerCase();

    const byText = cars.filter((car) => {
      const t = `${car.models?.brands?.name ?? ""} ${
        car.models?.name ?? ""
      }`.toLowerCase();
      return t.includes(text);
    });

    const byCountry = countryId
      ? byText.filter((car) => car.locations?.countries?.id === countryId)
      : byText;

    return byCountry.filter((car) => {
      const loc = car.locations?.name?.toLowerCase() ?? "";
      return (
        locationFilter === "" ||
        loc.includes(locationFilter.trim().toLowerCase())
      );
    });
  }, [cars, search, countryId, locationFilter]);

  // брони по диапазону — группируем машины по bufferMinutes
  const bookingsGroupsKey = useMemo(() => {
    if (!filteredCars.length) return null;
    if (!start || !end) return null;

    const carBuffers = filteredCars.map((car) => {
      const ownerId = car.ownerId ? String(car.ownerId) : null;
      const ownerSt = ownerId ? settingsByOwner[ownerId] : null;

      const carBuf =
        (car as any).intervalBetweenBookings ??
        (car as any).interval_between_bookings ??
        ownerSt?.intervalBetweenBookings ??
        0;

      const buf = Math.max(0, Number(carBuf) || 0);
      return { carId: car.id, bufferMinutes: buf };
    });

    const groups = new Map<number, string[]>();
    for (const { carId, bufferMinutes } of carBuffers) {
      if (!groups.has(bufferMinutes)) groups.set(bufferMinutes, []);
      groups.get(bufferMinutes)!.push(carId);
    }

    const entries = Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
    return JSON.stringify({ start, end, groups: entries });
  }, [filteredCars, start, end, settingsByOwner]);

  // debounced grouped fetch
  useEffect(() => {
    if (availabilityDebounceRef.current) {
      window.clearTimeout(availabilityDebounceRef.current);
      availabilityDebounceRef.current = null;
    }

    if (!filteredCars.length || !start || !end || !bookingsGroupsKey) {
      if (TRACE)
        console.debug("[availability] no bookingsGroupsKey -> clearing state", {
          bookingsGroupsKey,
          filteredCount: filteredCars.length,
          time: Date.now(),
        });
      setAvailabilityState((prev) => {
        const isEmpty =
          prev.key === null &&
          prev.loading === false &&
          (!prev.bookings || prev.bookings.length === 0) &&
          prev.requestId === null;

        if (isEmpty) return prev;

        return { key: null, loading: false, bookings: [], requestId: null };
      });

      return;
    }

    if (
      availabilityState.key === bookingsGroupsKey &&
      !availabilityState.loading
    ) {
      if (TRACE)
        console.debug("[availability] same key already applied -> skip", {
          bookingsGroupsKey,
          filteredCount: filteredCars.length,
          time: Date.now(),
        });
      return;
    }

    let alive = true;

    availabilityDebounceRef.current = window.setTimeout(() => {
      const reqId = ++availabilityCounterRef.current;

      setAvailabilityState((s) => ({ ...s, loading: true, requestId: reqId }));

      if (TRACE)
        console.debug("[availability] start grouped fetch (debounced)", {
          bookingsGroupsKey,
          reqId,
          filteredCount: filteredCars.length,
          start,
          end,
          time: Date.now(),
        });

      (async () => {
        try {
          const carBuffers = filteredCars.map((car) => {
            const ownerId = car.ownerId ? String(car.ownerId) : null;
            const ownerSt = ownerId ? settingsByOwner[ownerId] : null;
            const carBuf =
              (car as any).intervalBetweenBookings ??
              (car as any).interval_between_bookings ??
              ownerSt?.intervalBetweenBookings ??
              0;
            return {
              carId: car.id,
              bufferMinutes: Math.max(0, Number(carBuf) || 0),
            };
          });

          const groups = new Map<number, string[]>();
          for (const { carId, bufferMinutes } of carBuffers) {
            if (!groups.has(bufferMinutes)) groups.set(bufferMinutes, []);
            groups.get(bufferMinutes)!.push(carId);
          }

          const promises: Promise<any[]>[] = [];
          for (const [bufferMinutes, carIds] of groups.entries()) {
            if (!carIds.length) continue;
            promises.push(
              (async () => {
                try {
                  const data = await fetchBookingsForCarsInRange({
                    carIds,
                    start,
                    end,
                    bufferMinutes,
                  });
                  return data ?? [];
                } catch (err) {
                  if (process.env.NODE_ENV !== "production") {
                    console.warn(
                      `[catalog-availability] group fetch failed (buffer=${bufferMinutes}):`,
                      err
                    );
                  }
                  return [];
                }
              })()
            );
          }

          const results = await Promise.all(promises);
          if (!alive) return;

          setAvailabilityState((prev) => {
            if (prev.requestId !== reqId) {
              if (TRACE)
                console.debug("[availability] discard stale response", {
                  reqId,
                  currentRequestId: prev.requestId,
                  bookingsGroupsKey,
                  time: Date.now(),
                });
              return prev;
            }

            const allBookings = results.flat();
            const blocking = (allBookings ?? []).filter(isBlockingBooking);

            if (TRACE)
              console.debug("[availability] fetched bookings", {
                bookingsCount: blocking.length,
                bookingsGroupsKey,
                reqId,
                time: Date.now(),
              });

            return {
              key: bookingsGroupsKey,
              loading: false,
              bookings: blocking,
              requestId: reqId,
            };
          });
        } catch (err) {
          if (!alive) return;
          setAvailabilityState((prev) => {
            if (prev.requestId !== reqId) return prev;
            if (process.env.NODE_ENV !== "production") {
              console.error(
                "[catalog-availability] grouped fetch failed:",
                err
              );
            }
            if (TRACE)
              console.error("[availability] fetch error", {
                err,
                reqId,
                time: Date.now(),
              });
            return { key: null, loading: false, bookings: [], requestId: null };
          });
        }
      })();

      return () => {
        alive = false;
        if (availabilityDebounceRef.current) {
          window.clearTimeout(availabilityDebounceRef.current);
          availabilityDebounceRef.current = null;
        }
      };
    }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingsGroupsKey, filteredCars, start, end, settingsByOwner]);

  // финальная фильтрация с учётом настроек owner’а
  const availableCars = useMemo(() => {
    if (!start || !end) return filteredCars;

    if (!bookingsGroupsKey) {
      if (TRACE)
        console.debug("[availableCars] no bookingsGroupsKey -> returning []", {
          bookingsGroupsKey,
          filteredCount: filteredCars.length,
          time: Date.now(),
        });
      return [];
    }

    const bookingsReady =
      availabilityState.key === bookingsGroupsKey && !availabilityState.loading;
    if (!bookingsReady) {
      if (TRACE)
        console.debug("[availableCars] bookings not ready -> returning []", {
          bookingsGroupsKey,
          lastBookingsKey: availabilityState.key,
          rangeLoading: availabilityState.loading,
          time: Date.now(),
        });
      return [];
    }

    const startDt = new Date(start);
    const endDt = new Date(end);
    if (Number.isNaN(startDt.getTime()) || Number.isNaN(endDt.getTime())) {
      return filteredCars;
    }

    const blocking = (availabilityState.bookings ?? []).filter(
      isBlockingBooking
    );
    const byCar: Record<string, Booking[]> = {};
    for (const b of blocking) {
      const key = String(b.car_id);
      if (!byCar[key]) byCar[key] = [];
      byCar[key].push(b);
    }

    const result: CarWithRelations[] = [];

    for (const car of filteredCars) {
      const blocks = byCar[car.id];
      if (blocks?.length) {
        const clash = blocks.some((b) =>
          overlaps(startDt, endDt, new Date(b.start_at), new Date(b.end_at))
        );
        if (clash) continue;
      }

      const ownerId = car.ownerId ? String(car.ownerId) : null;
      const ownerSt = ownerId ? settingsByOwner[ownerId] : null;

      if (ownerId && !ownerSt) continue;

      const openTime =
        (car as any).openTime ??
        (car as any).open_time ??
        ownerSt?.openTime ??
        null;

      const closeTime =
        (car as any).closeTime ??
        (car as any).close_time ??
        ownerSt?.closeTime ??
        null;

      const minRentPeriod =
        (car as any).minRentPeriod ??
        (car as any).min_rent_period ??
        ownerSt?.minRentPeriod ??
        null;

      const maxRentPeriod =
        (car as any).maxRentPeriod ??
        (car as any).max_rent_period ??
        ownerSt?.maxRentPeriod ??
        null;

      const intervalBetweenBookings =
        (car as any).intervalBetweenBookings ??
        (car as any).interval_between_bookings ??
        ownerSt?.intervalBetweenBookings ??
        null;

      if (
        !isInDailyWindow(startDt, openTime, closeTime, false) ||
        !isInDailyWindow(endDt, openTime, closeTime, true)
      ) {
        continue;
      }

      const durMin = diffMinutes(startDt, endDt);

      if (minRentPeriod && minRentPeriod > 0) {
        const minAllowed = minRentPeriod * 24 * 60;
        if (durMin < minAllowed) continue;
      }

      if (maxRentPeriod && maxRentPeriod > 0) {
        const maxAllowed = maxRentPeriod * 24 * 60;
        if (durMin > maxAllowed) continue;
      }

      if (intervalBetweenBookings && intervalBetweenBookings > 0) {
        const gap = intervalBetweenBookings;
        const carBlocks = byCar[car.id] ?? [];
        const tooClose = carBlocks.some((b) => {
          const bs = new Date(b.start_at);
          const be = new Date(b.end_at);
          if (be <= startDt) {
            return diffMinutes(be, startDt) < gap;
          }
          if (endDt <= bs) {
            return diffMinutes(endDt, bs) < gap;
          }
          return false;
        });
        if (tooClose) continue;
      }

      result.push(car);
    }

    if (TRACE)
      console.debug("[availableCars] computed", {
        resultCount: result.length,
        filteredCount: filteredCars.length,
        bookingsForCars: (availabilityState.bookings || []).length,
        bookingsReady:
          availabilityState.key === bookingsGroupsKey &&
          !availabilityState.loading,
        bookingsGroupsKey,
        time: Date.now(),
      });

    return result;
  }, [
    filteredCars,
    start,
    end,
    availabilityState,
    settingsByOwner,
    bookingsGroupsKey,
  ]);

  const bookingsReady = useMemo(() => {
    return (
      bookingsGroupsKey !== null &&
      availabilityState.key === bookingsGroupsKey &&
      !availabilityState.loading
    );
  }, [bookingsGroupsKey, availabilityState]);

  // === единый флаг для скелетона ===
  const needsAvailability = Boolean(start && end && filteredCars.length > 0);

  const availabilityReady = !needsAvailability || bookingsReady;

  const carsReady = !carsQ.isLoading && carsQ.isFetched;

  const showSkeleton = !carsReady || !availabilityReady;

  // тост — только если реально что-то скрыли
  useEffect(() => {
    if (!start || !end) return;
    if (!filteredCars.length) return;
    if (availableCars.length >= filteredCars.length) return;
    toast.info(
      "Часть машин скрыта — выбранное время не попадает в рабочие часы/правила владельца."
    );
  }, [start, end, filteredCars.length, availableCars.length]);

  // блок скролла на пикере
  useEffect(() => {
    if (pickerOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [pickerOpen]);

  // календарь - синк с query
  const handleCalendarChange = (next: {
    startAt: Date | null;
    endAt: Date | null;
  }) => {
    const startIso = next.startAt ? next.startAt.toISOString() : "";
    const endIso = next.endAt ? next.endAt.toISOString() : "";

    setStart(startIso);
    setEnd(endIso);

    updateQuery({ start: startIso || null, end: endIso || null });
  };

  const handleChangeCountry = useCallback(
    (nextCountryId: string | null) => {
      setCountryId(nextCountryId);

      if (!nextCountryId) {
        setLocations([]);
        setLocationFilter("");
      }

      if (countryChangeDebounceRef.current) {
        window.clearTimeout(countryChangeDebounceRef.current);
        countryChangeDebounceRef.current = null;
      }

      pendingCountryRef.current = nextCountryId;

      countryChangeDebounceRef.current = window.setTimeout(() => {
        const toApply = pendingCountryRef.current;
        pendingCountryRef.current = null;
        countryChangeDebounceRef.current = null;

        if (!toApply) {
          setLocations([]);
          setLocationFilter("");
          updateQuery({ country: null, location: null });
          console.debug("[debug] apply country -> null (cleared)");
          return;
        }

        setLocationFilter("");
        updateQuery({ country: String(toApply), location: null });
        console.debug("[debug] apply country ->", toApply);
      }, 120);
    },
    [updateQuery]
  );

  const handleChangeLocation = useCallback(
    (nextLocation: string) => {
      setLocationFilter(nextLocation ?? "");
      updateQuery({ location: nextLocation ? String(nextLocation) : null });
    },
    [updateQuery]
  );

  const goToCar = useCallback(
    (brand: string, model: string, carId: string) => {
      const brandSlug = slugify(brand || "car");
      const modelSlug = slugify(model || carId.slice(0, 6));
      router.push(
        `/cars/${brandSlug}/${modelSlug}/${carId}?start=${encodeURIComponent(
          start
        )}&end=${encodeURIComponent(
          end
        )}&location=${locationFilter}&country=${countryId}`
      );
    },
    [router, start, end, locationFilter, countryId]
  );

  const resetFilters = () => {
    setSearch("");
    setCountryId(null);
    setLocationFilter("");
    updateQuery({ search: null, country: null, location: null });
  };

  // длительность для бара
  const rentalTiming = useMemo(() => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (Number.isNaN(s) || Number.isNaN(e) || e <= s) {
      return { ms: 0, hours: 0, days: 0, restHours: 0, billableDays: 1 };
    }
    const diffMs = e - s;
    const hours = diffMs / (1000 * 60 * 60);
    const fullHours = Math.floor(hours);
    const days = Math.floor(hours / 24);
    const restHours = fullHours - days * 24;
    const billableDays = Math.max(1, Math.ceil(hours / 24));
    return { ms: diffMs, hours: fullHours, days, restHours, billableDays };
  }, [start, end]);

  const closePicker = () => {
    setPickerOpen(false);
    setTimeout(() => {
      setPickerVisible(false);
    }, 200);
  };

  return (
    <>
      <div className="min-h-screen bg-white text-neutral-900 flex flex-col">
        <HeaderSection
          menuOpen={menuOpen}
          handleMenuOpen={setMenuOpen}
          color="black"
        />

        <main className="flex-1 pb-24 pt-24 md:pt-32">
          {/* desktop filters */}
          <div className="hidden sm:flex flex-wrap gap-3 items-center w-full px-4 max-w-5xl mx-auto">
            <CarFilters
              countries={countries}
              locations={locations}
              countryId={countryId}
              locationFilter={locationFilter}
              onChangeCountry={handleChangeCountry}
              onChangeLocation={handleChangeLocation}
              hideStatus
            />

            <div className="relative flex-1 min-w-[300px]">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
              <TextInput
                placeholder="Search by brand, model"
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                className="w-full rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 hover:bg-white/80 focus:ring-2 focus:ring-black/10"
              />
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="p-2 rounded hover:bg-gray-100 active:bg-gray-200 transition cursor-pointer"
              aria-label="Сбросить фильтры"
              title="Сбросить фильтры"
            >
              <XMarkIcon className="size-5 text-gray-800 stroke-1" />
            </button>
          </div>

          {/* mobile search + filters */}
          <div className="sm:hidden px-4 mb-4 flex items-center gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <TextInput
                placeholder="Search by brand, model"
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                className="w-full rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 hover:bg-white/80 focus:ring-2 focus:ring-black/10"
              />
            </div>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="inline-flex items-center justify-center rounded-xl bg-white/70 shadow-sm p-2.5 active:bg-zinc-100"
              aria-label="Фильтры"
            >
              <FunnelIcon className="size-5 text-zinc-700" />
            </button>
          </div>

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
            <div className="w-full flex flex-col gap-3 mt-2">
              <CarFilters
                countries={countries}
                locations={locations}
                countryId={countryId}
                locationFilter={locationFilter}
                onChangeCountry={handleChangeCountry}
                onChangeLocation={handleChangeLocation}
                hideStatus
              />
            </div>
            <div className="mt-3 text-right">
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm text-zinc-500 underline underline-offset-4"
              >
                Reset filters
              </button>
            </div>
          </Drawer>

          {/* list */}
          <section className="mx-auto max-w-5xl w-full px-4 pb-10 pt-4 md:pt-10">
            {(() => {
              if (isError) {
                return (
                  <InlineError
                    message={carsQ.error?.message || "Failed to load cars"}
                  />
                );
              }

              if (showSkeleton) {
                const skeletonCount = Math.min(
                  Math.max(filteredCars.length || cars.length || 4, 4),
                  8
                );

                return (
                  <>
                    <div className="mt-4 mb-6 flex flex-col items-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5 text-zinc-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        />
                      </svg>
                      <p className="text-xs text-zinc-400">Loading cars…</p>
                    </div>

                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                      {Array.from({ length: skeletonCount }).map((_, i) => (
                        <li
                          key={i}
                          className="relative flex flex-col overflow-hidden rounded-2xl bg-white/60 backdrop-blur supports-backdrop-filter:bg-white/40 shadow-[0_2px_10px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition-all duration-300 animate-pulse"
                        >
                          <div className="h-48 w-full sm:h-52 md:h-56 bg-linear-to-br from-zinc-100 to-zinc-200" />
                          <div className="p-5 space-y-3">
                            <div className="h-4 bg-gray-100 rounded w-2/3" />
                            <div className="h-3 bg-gray-100 rounded w-1/3" />
                            <div className="h-3 bg-gray-100 rounded w-1/2" />
                            <div className="h-10 bg-gray-100 rounded-xl" />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                );
              }

              // когда есть даты, данные по availability готовы и ничего не подошло
              if (
                start &&
                end &&
                bookingsReady &&
                availableCars.length === 0 &&
                filteredCars.length > 0
              ) {
                return (
                  <EmptyState
                    title="No car was found matching these filters."
                    description="Try removing some filters or changing the time."
                  />
                );
              }

              // когда вообще нет машин после фильтров, даже без дат
              if (!start && !end && filteredCars.length === 0 && !isFetching) {
                return (
                  <EmptyState
                    title="No car was found."
                    description="Try changing filters."
                  />
                );
              }

              // нормальный список
              return (
                <>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                    {availableCars.map((car) => (
                      <CatalogCardGlass
                        key={car.id}
                        car={car}
                        start={start}
                        end={end}
                        location={locationFilter}
                        country={countryId || ""}
                        ownerSettings={settingsByOwner[car.ownerId!] ?? null}
                        onBook={() =>
                          goToCar(
                            car.models?.brands?.name ?? "car",
                            car.models?.name ?? car.id,
                            car.id
                          )
                        }
                        highlight={search}
                        pricingMeta={pricingMeta[car.id]}
                      />
                    ))}
                  </ul>

                  {canLoadMore && (
                    <div className="w-full flex justify-center mt-8">
                      <button
                        onClick={() => carsQ.fetchNextPage()}
                        disabled={isFetchingNext}
                        className="px-5 py-2 rounded-2xl bg-black text-white text-sm hover:opacity-90 disabled:opacity-50"
                      >
                        {isFetchingNext ? "Loading..." : "Show more"}
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </section>
        </main>

        <BottomStickyBar
          start={start}
          end={end}
          timing={rentalTiming}
          changePickerStatus={() => {
            setPickerVisible(true);
            requestAnimationFrame(() => {
              setPickerOpen(true);
            });
          }}
        />
      </div>

      {pickerVisible && (
        <div
          className={cn(
            "fixed inset-0 flex items-center justify-center z-999 transition-opacity duration-200",
            isMobile ? "bg-transparent" : "bg-black/40",
            pickerOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={isMobile ? undefined : closePicker}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={cn(
              isMobile
                ? "w-full h-full flex flex-col justify-end"
                : "bg-white sm:rounded-2xl overflow-hidden rounded-none shadow-xl w-full h-full sm:w-[680px] sm:h-fit flex flex-col",
              "transform transition-transform duration-200",
              pickerOpen ? "translate-y-0" : "translate-y-3"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <RentalDateTimePicker
              value={{
                startAt: start ? new Date(start) : null,
                endAt: end ? new Date(end) : null,
              }}
              onChange={(next) => {
                handleCalendarChange(next);
                closePicker();
              }}
              minuteStep={30}
              minDate={startOfDay(new Date())}
              disabledIntervals={pickerDisabledIntervals}
              mobileStartOpen
            />
          </div>
        </div>
      )}
    </>
  );
}

/* === КАРТОЧКА === */
function CatalogCardGlass({
  car,
  start,
  end,
  location,
  country,
  ownerSettings,
  onBook,
  highlight = "",
  pricingMeta,
}: {
  car: CarWithRelations;
  start: string;
  end: string;
  location: string;
  country: string;
  ownerSettings: OwnerSettings | null;
  onBook: () => void;
  highlight?: string;
  pricingMeta?: {
    pricingRules: PricingRule[];
    seasonalRates: SeasonalRate[];
    effectiveCurrency: string | null;
    baseDailyPrice: number | null;
  };
}) {
  const brand = car.models?.brands?.name ?? "—";
  const model = car.models?.name ?? "—";
  const year = car.year ?? "";
  const photo = car.coverPhotos?.[0];
  const title = `${brand} ${model} ${year || ""}`.trim();

  const baseDailyPrice = pricingMeta?.baseDailyPrice ?? car.price ?? 0;

  const currency =
    (car as any).currency ||
    ownerSettings?.currency ||
    pricingMeta?.effectiveCurrency ||
    "EUR";

  const haveDates = Boolean(start && end && baseDailyPrice > 0);

  let displayDayPrice = baseDailyPrice;
  let displayTotal = 0;
  let appliedDiscount = 0;

  if (haveDates) {
    const calc = calculateFinalPriceProRated({
      startAt: new Date(start),
      endAt: new Date(end),
      baseDailyPrice,
      pricingRules: pricingMeta?.pricingRules ?? [],
      seasonalRates: pricingMeta?.seasonalRates ?? [],
    });

    displayTotal = calc.total;
    displayDayPrice =
      Math.round((calc.avgPerDay ?? baseDailyPrice) * 100) / 100;
    appliedDiscount = calc.discountApplied ?? 0;
  }

  const brandSlug = slugify(brand);
  const modelSlug = slugify(model);
  const href = `/cars/${brandSlug}/${modelSlug}/${
    car.id
  }?start=${encodeURIComponent(start)}&end=${encodeURIComponent(
    end
  )}&location=${location}&country=${country}`;

  return (
    <li
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl",
        "bg-white/60 backdrop-blur supports-backdrop-filter:bg-white/40",
        "ring-1 ring-black/5",
        "shadow-[0_2px_10px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.10)]",
        "transition-all duration-300"
      )}
    >
      <Link href={href} className="relative block overflow-hidden">
        {photo ? (
          <img
            src={photo}
            alt={title}
            loading="lazy"
            className="h-52 w-full object-cover lg:h-72 transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-48 w-full sm:h-52 md:h-72 bg-linear-to-br from-zinc-100 to-zinc-200" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-gray-200/30 to-transparent" />
      </Link>

      <div className="p-4 sm:p-5 flex flex-col gap-4 flex-1">
        <Link href={href} className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-roboto-condensed font-semibold leading-snug text-zinc-900 line-clamp-1">
              {highlight ? highlightMatch(title, highlight) : title}
            </h2>
            <div className="text-xs text-zinc-600 line-clamp-1">
              {(car.bodyType || "—") +
                " · " +
                (car.transmission || "—") +
                " · " +
                (car.fuelType || "—")}
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-zinc-900 text-xl font-boogaloo font-semibold leading-none">
              {displayDayPrice.toFixed(0)} {currency}
              <span className="text-zinc-500 font-normal text-[20px]">
                /day
              </span>
            </div>

            {haveDates && displayTotal > 0 ? (
              <div className="text-[14px] font-roboto-condensed text-zinc-500 leading-snug mt-1">
                ≈ {displayTotal.toFixed(0)} {currency} /{" "}
                {(() => {
                  const s = new Date(start);
                  const e = new Date(end);
                  const diffMs = e.getTime() - s.getTime();
                  if (diffMs <= 0) return "0h";
                  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
                  const days = Math.floor(totalHours / 24);
                  const restHours = totalHours - days * 24;
                  if (days > 0) {
                    return `${days}d${restHours ? ` ${restHours}h` : ""}`;
                  }
                  return `${restHours}h`;
                })()}
                {appliedDiscount ? (
                  <span className="ml-1 text-emerald-600">
                    ({appliedDiscount}%)
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="text-[11px] text-zinc-400 leading-snug mt-1">
                base price
              </div>
            )}
          </div>
        </Link>

        <button
          onClick={onBook}
          className={cn(
            "w-full rounded-xl bg-white/40 backdrop-blur supports-backdrop-filter:bg-white/20 cursor-pointer",
            "px-4 py-3 md:py-4 text-center",
            "border border-neutral-500",
            "shadow-[0_12px_24px_rgba(0,0,0,0.06)]",
            "hover:border-neutral-900 hover:bg-white/60 hover:shadow-[0_20px_40px_rgba(0,0,0,0.10)]",
            "transition-all duration-200",
            "font-medium text-neutral-900 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-offset-1 focus:ring-offset-white"
          )}
        >
          <span className="inline-flex items-center gap-1 font-roboto-condensed text-black">
            <span>Book</span>
            <ArrowRightMini />
          </span>
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-linear-to-r from-transparent via-black/10 to-transparent" />
      </div>
    </li>
  );
}

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

/* === ЛИПКАЯ НИЖНЯЯ ПАНЕЛЬ === */
function BottomStickyBar({
  start,
  end,
  timing,
  changePickerStatus,
}: {
  start: string;
  end: string;
  timing: {
    ms: number;
    hours: number;
    days: number;
    restHours: number;
    billableDays: number;
  };
  changePickerStatus: () => void;
}) {
  const durationLabel =
    timing.days > 0
      ? `${timing.days}d${timing.restHours ? ` ${timing.restHours}h` : ""}`
      : `${timing.hours}h`;
  return (
    <div className=" fixed inset-x-0 bottom-0 bg-white/70 backdrop-blur supports-backdrop-filter:bg-white/40 border-t border-gray-200/60">
      <div className="h-20 font-roboto-condensed! mx-auto max-w-7xl px-4 md:px-6 py-0 flex items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0 max-w-[68vw] sm:max-w-none text-sm sm:text-lg md:text-xl font-semibold">
          {!start ? (
            <p>Select dates</p>
          ) : (
            <div className="flex items-center leading-tight truncate">
              <div className="flex items-center gap-2">
                <p>
                  {format(new Date(start), "d MMM, HH:mm", { locale: enUS })}
                </p>
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center h-5 w-5 text-sm text-neutral-900 pb-1"
                >
                  →
                </span>
                <p>{format(new Date(end), "d MMM, HH:mm", { locale: enUS })}</p>
              </div>

              <span className="text-neutral-600 shrink-0 ml-2">
                <span className="inline"> • </span>
                {durationLabel}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={changePickerStatus}
          className=" rounded-xl px-3 h-10 md:px-5 md:h-12 text-sm font-medium text-neutral-800 backdrop-blur supports-backdrop-filter:bg-white/20 border border-neutral-600/50 shadow-[0_8px_20px_rgba(0,0,0,0.05)] hover:bg-white/60 hover:border-neutral-900 hover:shadow-[0_16px_32px_rgba(0,0,0,0.08)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-offset-1 focus:ring-offset-white cursor-pointer"
        >
          Change
        </button>
      </div>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="rounded-xl border border-red-100 bg-red-50 text-red-700 p-3 text-sm">
        {message}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 text-center">
      <p className="mt-2 text-sm font-medium text-gray-900">{title}</p>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}

function useSyncQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const base =
        typeof window !== "undefined"
          ? searchParams?.toString()
            ? searchParams.toString()
            : window.location.search.replace(/^\?/, "")
          : searchParams?.toString() ?? "";

      const params = new URLSearchParams(base);

      Object.entries(patch).forEach(([k, v]) => {
        if (v == null || v === "") params.delete(k);
        else params.set(k, v);
      });

      const qs = params.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;

      try {
        router.replace(href);
      } catch (err) {
        console.warn("[updateQuery] router.replace failed:", err);
      }

      setTimeout(() => {
        if (typeof window === "undefined") return;
        const current =
          window.location.pathname + (window.location.search || "");
        if (current !== href) {
          console.debug("[updateQuery] fallback history.replaceState ->", {
            from: current,
            to: href,
          });
          window.history.replaceState({}, "", href);
        } else {
          console.debug("[updateQuery] router already applied href");
        }
      }, 50);
    },
    [router, pathname, searchParams]
  );

  return updateQuery;
}
