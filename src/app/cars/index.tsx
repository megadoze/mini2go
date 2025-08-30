import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Loader,
  NativeSelect,
  TextInput,
  Drawer,
} from "@mantine/core";
import {
  GlobeAltIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  XMarkIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

import CarTable from "./сarTable";

import type { CarWithRelations } from "@/types/carWithRelations";
import type { Country } from "@/types/country";
import type { Location } from "@/types/location";

import { fetchCars } from "@/services/car.service";
import {
  fetchCountries,
  fetchLocationsByCountry,
} from "@/services/geo.service";

export default function CarsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // UI state
  const [countryId, setCountryId] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState("");
  const [search, setSearch] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  /* -------------------- queries -------------------- */

  const carsQ = useQuery<CarWithRelations[], Error>({
    queryKey: ["cars"],
    queryFn: () => fetchCars(),
    initialData: qc.getQueryData<CarWithRelations[]>(["cars"]),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const countriesQ = useQuery<Country[], Error>({
    queryKey: ["countries"],
    queryFn: () => fetchCountries(),
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

  const cars = carsQ.data ?? [];
  const countries = countriesQ.data ?? [];
  const locations = locationsQ.data ?? [];

  /* -------------------- derived -------------------- */

  const filteredCars = useMemo(() => {
    const text = search.trim().toLowerCase();

    const byText = cars.filter((car) => {
      const t = `${car.models?.brands?.name ?? ""} ${car.models?.name ?? ""} ${
        car.licensePlate ?? ""
      }`.toLowerCase();
      return t.includes(text);
    });

    const byCountry = countryId
      ? byText.filter((car) => car.locations?.countries.id === countryId)
      : byText;

    return byCountry.filter((car) => {
      const loc = car.locations?.name?.toLowerCase() ?? "";
      return (
        locationFilter === "" ||
        loc.includes(locationFilter.trim().toLowerCase())
      );
    });
  }, [cars, search, countryId, locationFilter]);

  const loading = carsQ.isLoading || countriesQ.isLoading;

  const addNewCar = () => navigate("/cars/add");

  const resetFilters = () => {
    setSearch("");
    setCountryId(null);
    setLocationFilter("");
  };

  // shared filter fields (reused in desktop bar and mobile drawer)
  const FilterFields = (
    <>
      <div className="relative">
        <GlobeAltIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <NativeSelect
          value={countryId ?? ""}
          onChange={(e) => {
            setCountryId(e.currentTarget.value || null);
            setLocationFilter("");
          }}
          className="min-w-[150px] rounded-xl bg-white/60 backdrop-blur-sm shadow-sm pl-9 pr-3 py-2 text-sm transition hover:bg-white/80 focus:ring-2 focus:ring-black/10"
        >
          <option value="">Country</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="relative">
        <MapPinIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <NativeSelect
          value={locationFilter ?? ""}
          onChange={(e) => setLocationFilter(e.currentTarget.value)}
          disabled={!countryId}
          className={`min-w-[150px] rounded-xl pl-9 pr-3 py-2 text-sm shadow-sm transition focus:ring-2 focus:ring-black/10 ${
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
    </>
  );

  /* -------------------- render -------------------- */

  return (
    <>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h1 className="font-openSans font-bold text-2xl">Cars</h1>
          {cars.length > 0 && <Badge color="black">{cars.length}</Badge>}
        </div>
        <Button
          variant="filled"
          color="black"
          size="xs"
          radius="md"
          onClick={addNewCar}
        >
          + Add car
        </Button>
      </div>

      {/* Desktop / tablet filters (>= sm) — inline, immediate apply */}
      <div className="hidden sm:flex flex-wrap gap-3 items-center w-full mb-6">
        {FilterFields}

        {/* Search inline with filters */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <TextInput
            placeholder="Поиск по марке, модели или номеру"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            className="w-full rounded-xl bg-white/60 backdrop-blur-sm shadow-sm pl-9 pr-3 py-2 text-sm hover:bg-white/80 focus:ring-2 focus:ring-black/10"
          />
        </div>

        {/* Reset button */}
        <button
          type="button"
          onClick={resetFilters}
          className="p-2 rounded hover:bg-gray-100 active:bg-gray-200 transition"
          aria-label="Сбросить фильтры"
          title="Сбросить фильтры"
        >
          <XMarkIcon className="size-5 text-gray-800 stroke-1" />
        </button>
      </div>

      {/* Mobile search (separate, always visible above the list) */}
      <div className="relative w-full mb-4 sm:hidden">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <TextInput
          placeholder="Поиск по марке, модели или номеру"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          className="w-full rounded-xl bg-white/60 backdrop-blur-sm shadow-sm pl-9 pr-3 py-2 text-sm hover:bg-white/80 focus:ring-2 focus:ring-black/10"
        />
      </div>

      {/* Mobile floating Filters button (< sm) */}
      <div className="sm:hidden">
        {/* floating center-bottom button */}
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-md bg-black text-white active:opacity-80"
          aria-label="Открыть фильтры"
        >
          <FunnelIcon className="size-4" />
          Фильтры
        </button>
      </div>

      {/* Bottom sheet drawer for mobile — 1/3 screen height, immediate apply */}
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
        <div className="flex flex-col gap-3 mt-2">{FilterFields}</div>

        {/* Reset link */}
        <div className="mt-3 text-right">
          <button
            type="button"
            onClick={resetFilters}
            className="text-sm text-zinc-500 underline underline-offset-4"
          >
            Сбросить фильтры
          </button>
        </div>
      </Drawer>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center gap-2 text-center text-zinc-500 mt-10">
          <Loader size="sm" color="gray" /> Loading...
        </div>
      ) : filteredCars.length > 0 ? (
        <CarTable cars={filteredCars} search={search} />
      ) : (
        <p className="text-zinc-500 text-sm mt-10">Cars not found</p>
      )}
    </>
  );
}
