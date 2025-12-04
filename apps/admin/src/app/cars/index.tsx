import { useEffect, useState, useMemo, useCallback } from "react";
import { useLocation, useNavigate, useLoaderData } from "react-router-dom";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { Badge, Loader, TextInput, Drawer } from "@mantine/core";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

import CarTable from "./сarTable"; // проверь, что тут не кириллическая `с`
import { fetchCarsPageByHost } from "@/services/car.service";
import {
  fetchCountries,
  fetchLocationsByCountry,
} from "@/services/geo.service";

import type { CarWithRelations } from "@/types/carWithRelations";
import type { Country } from "@/types/country";
import type { Location } from "@/types/location";
import type { CarStatus } from "@/components/carFilters";
import CarFilters from "@/components/carFilters";
import { supabase } from "@/lib/supabase";
import { QK } from "@/queryKeys";

const PAGE_SIZE = 10;
type Page = { items: CarWithRelations[]; count: number };

export default function CarsPage() {
  // ⭐️ ownerId приходит из loader (как в бронях)
  const { ownerId } = (useLoaderData() as { ownerId: string | null }) ?? {
    ownerId: null,
  };

  const navigate = useNavigate();
  const qc = useQueryClient();
  const loc = useLocation();

  // UI
  const [countryId, setCountryId] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<CarStatus>("");
  const [search, setSearch] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  /* -------- geo queries -------- */
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

  const locationsQ = useQuery<Location[], Error>({
    queryKey: ["locations", countryId],
    queryFn: () => fetchLocationsByCountry(countryId!),
    enabled: !!countryId,
    initialData: countryId
      ? qc.getQueryData<Location[]>(["locations", countryId])
      : [],
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    placeholderData: (prev) => prev ?? [],
  });

  /* -------- cars infinite query -------- */
  const currentKey = ["carsByHost", PAGE_SIZE, ownerId] as const;

  const carsQ = useInfiniteQuery<
    { items: CarWithRelations[]; count: number },
    Error
  >({
    queryKey: currentKey,
    enabled: !!ownerId, // ключ известен сразу, thanks to loader
    queryFn: async ({ pageParam }) => {
      const pageIndex = typeof pageParam === "number" ? pageParam : 0;
      const offset = pageIndex * PAGE_SIZE;
      return fetchCarsPageByHost({
        ownerId: ownerId as string,
        limit: PAGE_SIZE,
        offset,
      });
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.items.length, 0);
      const total = lastPage.count ?? loaded;
      return loaded < total ? allPages.length : undefined;
    },
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
    // забираем прогретый в loader кэш как initial
    initialData: ownerId
      ? () => qc.getQueryData<InfiniteData<Page>>(currentKey)
      : undefined,
    // и держим старые страницы на экране при перефетче
    placeholderData: (prev) => prev,
  });

  // ✂️ обрезка кэша до первой страницы при уходе со страницы
  const trimToFirstPage = () => {
    qc.setQueryData<InfiniteData<Page>>(currentKey, (old) => {
      if (!old?.pages?.length) return old;
      return { pages: [old.pages[0]], pageParams: [0] };
    });
  };

  // 👇 это надо ДО useEffect с каналом (лучше прямо в CarsPage сверху после типов)

  type CarsPageRow = CarWithRelations; // то, что реально лежит в таблице на экране

  function mapDbRowToCarRow(db: any): CarWithRelations {
    // db = payload.new / payload.old из realtime (сырая строка cars)
    // у неё snake_case, без relations.
    // Мы пытаемся собрать CarWithRelations настолько, насколько можем локально.
    const modelName = db.model_name ?? db.modelName ?? db.model ?? "";
    const brandName = db.brand_name ?? db.brandName ?? db.brand ?? "";
    const models = {
      name: String(modelName),
      brands: {
        name: String(brandName),
      },
    };
    return {
      // обязательные простые поля, которые таблица точно рендерит:
      id: db.id,
      vin: db.vin ?? null,
      modelId: db.model_id ?? null,
      year: db.year ?? null,
      fuelType: db.fuel_type ?? null,
      transmission: db.transmission ?? null,
      seats: db.seats ?? null,
      licensePlate: db.license_plate ?? null,
      engineCapacity: db.engine_capacity ?? null,
      status: db.status ?? null,
      bodyType: db.body_type ?? null,
      driveType: db.drive_type ?? null,
      color: db.color ?? null,
      doors: db.doors ?? null,
      coverPhotos: Array.isArray(db.coverPhotos) ? db.coverPhotos : [],
      price: db.price ?? null,
      address: db.address ?? null,
      pickupInfo: db.pickupInfo ?? null,
      returnInfo: db.returnInfo ?? null,
      isDelivery: db.isDelivery ?? null,
      deliveryFee: db.deliveryFee ?? null,
      includeMileage: db.includeMileage ?? null,
      deposit: db.deposit ?? null,
      // 👇 relations из realtime нам НЕ приходят.
      // попробуем частично восстановить марку/модель из кеша по model_id.
      models,
      locations: db.locations
        ? {
            name: db.locations.name ?? "",
            countries: {
              name: db.locations.countries?.name ?? "",
              id: String(db.locations.countries?.id ?? ""),
            },
          }
        : null,
    };
  }

  // достаём из кэша react-query модель и бренд (если уже фетчена страница машины)
  function enrichCarRowFromCache(
    qc: ReturnType<typeof useQueryClient>,
    row: CarsPageRow
  ): CarsPageRow {
    // пробуем поднять полные данные машины из кэша деталки
    const full = qc.getQueryData<any>(QK.car(String(row.id)));

    if (!full) {
      return row;
    }

    // соберём models (model + brand) если они есть в full
    const mergedModels = full.model
      ? {
          ...full.model,
          brands: full.model.brands ?? null,
        }
      : row.models ?? null;

    return {
      ...row,

      // relations, если есть
      models: mergedModels,
      locations: full.locations ?? row.locations ?? null,

      // простые поля – заполняем из row если есть, иначе из full
      licensePlate:
        row.licensePlate ?? full.licensePlate ?? full.license_plate ?? null,

      coverPhotos:
        (Array.isArray(row.coverPhotos) && row.coverPhotos.length > 0
          ? row.coverPhotos
          : Array.isArray(full.coverPhotos)
          ? full.coverPhotos
          : []) ?? [],

      status: row.status ?? full.status ?? null,

      price: row.price ?? full.price ?? null,
    };
  }

  // prepend новой машины в первую страницу кэша carsByHost
  function prependCarRow(qc: any, newRow: CarsPageRow) {
    qc.setQueriesData(
      {
        predicate: (q: any) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "carsByHost", // то же имя что в useInfiniteQuery
      },
      (old: any) => {
        if (!old?.pages?.length) {
          return {
            pageParams: [0],
            pages: [{ items: [newRow], count: 1 }],
          };
        }

        const pages = old.pages.slice();
        const first = pages[0];

        // защитимся от дублей
        const exists = Array.isArray(first?.items)
          ? first.items.some((x: any) => String(x.id) === String(newRow.id))
          : false;
        if (exists) return old;

        if (Array.isArray(first?.items)) {
          pages[0] = {
            ...first,
            items: [newRow, ...first.items],
            count: (first.count ?? first.items.length) + 1,
          };
        } else {
          // fallback на всякий
          pages[0] = {
            items: [newRow],
            count: 1,
          };
        }

        return { ...old, pages };
      }
    );
  }

  // удаляем машину из всех страниц кэша carsByHost
  function removeCarRow(qc: any, carId: string) {
    qc.setQueriesData(
      {
        predicate: (q: any) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "carsByHost",
      },
      (old: any) => {
        if (!old?.pages?.length) {
          return old;
        }

        const newPages = old.pages.map((p: any, idx: number) => {
          if (Array.isArray(p?.items)) {
            // формат { items, count }
            const before = p.items.length;
            const filtered = p.items.filter(
              (c: any) => String(c.id) !== String(carId)
            );
            return {
              ...p,
              items: filtered,
              count:
                idx === 0
                  ? (p.count ?? before) - (filtered.length < before ? 1 : 0)
                  : p.count,
            };
          } else if (Array.isArray(p)) {
            // формат просто массив

            const filtered = p.filter(
              (c: any) => String(c.id) !== String(carId)
            );

            return filtered;
          } else {
            return p;
          }
        });

        const nextCache = { ...old, pages: newPages };

        return nextCache;
      }
    );

    qc.removeQueries({ queryKey: QK.car(carId), exact: true });
  }

  // патчим существующую машину в кэше carsByHost (без refetch)
  function patchCarRow(qc: any, updatedRow: CarsPageRow) {
    qc.setQueriesData(
      {
        predicate: (q: any) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "carsByHost",
      },
      (old: any) => {
        if (!old?.pages?.length) return old;

        const pages = old.pages.map((p: any) => {
          if (!Array.isArray(p?.items)) return p;

          const nextItems = p.items.map((c: any) => {
            if (String(c.id) !== String(updatedRow.id)) return c;

            return {
              ...c,
              ...updatedRow,
              models: c.models ?? updatedRow.models ?? null,
              locations: c.locations ?? updatedRow.locations ?? null,
            };
          });

          return { ...p, items: nextItems };
        });

        return { ...old, pages };
      }
    );
  }

  useEffect(() => {
    return () => {
      trimToFirstPage();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  useEffect(() => {
    if (!ownerId) return;

    const ch = supabase
      .channel("cars-list-realtime-" + ownerId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cars",
        },
        (payload) => {
          const evt = payload.eventType as "INSERT" | "UPDATE" | "DELETE";

          const rowAfter = payload.new as any;
          const rowBefore = payload.old as any;

          // 💡 чтобы не ловить чужие машины:
          const ownerAfter = rowAfter?.owner_id ?? rowAfter?.ownerId;
          const ownerBefore = rowBefore?.owner_id ?? rowBefore?.ownerId;

          if (ownerAfter && ownerAfter !== ownerId && ownerBefore !== ownerId) {
            return;
          }

          if (evt === "DELETE") {
            const deletedId = rowBefore?.id;
            if (deletedId) {
              removeCarRow(qc, String(deletedId));
            }
            return;
          }

          let row = mapDbRowToCarRow(rowAfter);
          row = enrichCarRowFromCache(qc, row);

          if (evt === "INSERT") {
            prependCarRow(qc, row);
          } else if (evt === "UPDATE") {
            patchCarRow(qc, row);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          qc.invalidateQueries({
            queryKey: currentKey,
            refetchType: "all",
          });
        }
      });

    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc, ownerId]); // 👈 только эти зависят реально

  const countries = countriesQ.data ?? [];
  const locations = locationsQ.data ?? [];

  // данные для отображения (берём то, что уже в кэше/initialData)
  const displayData = carsQ.data;

  const cars: CarWithRelations[] =
    displayData?.pages.flatMap((p) => p.items) ?? [];

  const isFetchingNext = carsQ.isFetchingNextPage;
  const totalLoaded = cars.length;
  const totalAvailable = displayData?.pages?.[0]?.count ?? totalLoaded;
  const canLoadMore = totalLoaded < totalAvailable;

  /* -------- derived filters -------- */
  const filteredCars = useMemo(() => {
    const text = search.trim().toLowerCase();

    const byText = cars.filter((car) => {
      const t = `${car.models?.brands?.name ?? ""} ${car.models?.name ?? ""} ${
        car.licensePlate ?? ""
      } ${car.vin ?? ""}`.toLowerCase();
      return t.includes(text);
    });

    const byCountry = countryId
      ? byText.filter((car) => car.locations?.countries.id === countryId)
      : byText;

    const byStatus = statusFilter
      ? byCountry.filter((car) => car.status === statusFilter)
      : byCountry;

    return byStatus.filter((car) => {
      const loc = car.locations?.name?.toLowerCase() ?? "";
      return (
        locationFilter === "" ||
        loc.includes(locationFilter.trim().toLowerCase())
      );
    });
  }, [cars, search, countryId, locationFilter, statusFilter]);

  /* -------- flags -------- */
  const contentLoading =
    !!ownerId &&
    !displayData &&
    (carsQ.fetchStatus === "fetching" || carsQ.status === "pending");
  const showEmpty = carsQ.status === "success" && filteredCars.length === 0;

  /* -------- actions -------- */
  const addNewCar = useCallback(
    () =>
      navigate("/cars/add", {
        state: { from: loc.pathname + loc.search + loc.hash },
      }),
    [navigate, loc.pathname, loc.search, loc.hash]
  );

  const resetFilters = () => {
    setSearch("");
    setCountryId(null);
    setLocationFilter("");
    setStatusFilter("");
    trimToFirstPage();
  };

  /* -------- guests -------- */
  if (ownerId === null) {
    return (
      <p className="text-zinc-500 text-sm mt-10">Sign in to see your cars</p>
    );
  }

  /* -------- render -------- */
  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h1 className="font-roboto text-xl md:text-2xl font-medium md:font-bold">
            Cars
          </h1>
          {totalLoaded > 0 && <Badge color="black">{totalLoaded}</Badge>}
        </div>
        <button
          color="black"
          onClick={addNewCar}
          className="rounded-2xl md:rounded-3xl bg-black py-1 px-2 md:py-2 md:px-3 text-white text-sm hover:opacity-85"
        >
          + Add car
        </button>
      </div>

      {/* Filters */}
      <div className="hidden sm:flex flex-wrap gap-3 items-center w-full mb-6 max-w-5xl 2xl:max-w-7xl">
        <CarFilters
          countries={countries}
          locations={locations}
          countryId={countryId}
          locationFilter={locationFilter}
          statusFilter={statusFilter}
          onChangeCountry={setCountryId}
          onChangeLocation={setLocationFilter}
          onChangeStatus={setStatusFilter}
        />
        <div className="relative flex-1 min-w-[300px] items-center flex gap-3">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <TextInput
            placeholder="Search by make, model, vin or number"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            className="w-full rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm hover:bg-white/80 focus:ring-2 focus:ring-black/10"
          />
          <button
            type="button"
            onClick={resetFilters}
            className="p-2 rounded hover:bg-gray-100 active:bg-gray-200 transition"
            aria-label="Reset filters"
            title="Reset filters"
          >
            <XMarkIcon className="size-5 text-gray-800 stroke-1" />
          </button>
        </div>
      </div>

      {/* Mobile search + drawer — без изменений */}
      <div className="relative w-full mb-4 sm:hidden">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <TextInput
          placeholder="Search by make, model, vin or number"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          className="w-full rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm hover:bg-white/80 focus:ring-2 focus:ring-black/10"
        />
      </div>

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
            statusFilter={statusFilter}
            onChangeCountry={setCountryId}
            onChangeLocation={setLocationFilter}
            onChangeStatus={setStatusFilter}
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

      {/* Content */}
      {contentLoading ? (
        <div className="flex justify-center items-center gap-2 text-center text-zinc-500 mt-10">
          <Loader size="sm" /> Loading...
        </div>
      ) : showEmpty ? (
        <p className="text-zinc-500 text-sm mt-10">Cars not found</p>
      ) : (
        <>
          <CarTable cars={filteredCars} search={search} />
          <div className="w-full flex justify-center mt-6 mb-2">
            {canLoadMore ? (
              <button
                type="button"
                onClick={() => carsQ.fetchNextPage()}
                disabled={isFetchingNext}
                aria-busy={isFetchingNext}
                className="rounded-2xl bg-black text-white px-4 py-2 text-sm hover:opacity-85 disabled:opacity-60"
              >
                {isFetchingNext ? "Loading..." : "Show more"}
              </button>
            ) : (
              <div className="text-xs text-zinc-400">
                There are no more cars
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
