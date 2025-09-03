import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Loader, TextInput, Drawer } from "@mantine/core";
import {
  MagnifyingGlassIcon,
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
import type { CarStatus } from "@/components/carFilters";
import CarFilters from "@/components/carFilters";
import { QK } from "@/queryKeys";

export default function CarsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // UI state
  const [countryId, setCountryId] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<CarStatus>("");
  const [search, setSearch] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  /* -------------------- queries -------------------- */

  const carsQ = useQuery<CarWithRelations[], Error>({
    queryKey: QK.cars,
    queryFn: () => fetchCars(),
    initialData: qc.getQueryData(QK.cars),
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

  const loading = carsQ.isLoading || countriesQ.isLoading;

  const addNewCar = () => navigate("/cars/add");

  const resetFilters = () => {
    setSearch("");
    setCountryId(null);
    setLocationFilter("");
    setStatusFilter("");
  };

  /* -------------------- render -------------------- */

  return (
    <>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h1 className="font-roboto text-2xl font-bold">Cars</h1>
          {cars.length > 0 && <Badge color="black">{cars.length}</Badge>}
        </div>
        <button
          color="black"
          onClick={addNewCar}
          className=" rounded-xl bg-black py-2 px-3 text-white text-sm hover:opacity-85"
        >
          + Add car
        </button>
      </div>

      {/* Desktop / tablet filters (>= sm) — inline, immediate apply */}
      <div className="hidden sm:flex flex-wrap gap-3 items-center w-full mb-6">
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

        {/* Search inline */}
        <div className="relative flex-1 min-w-[300px]">
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
          className="w-full rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm hover:bg-white/80 focus:ring-2 focus:ring-black/10"
        />
      </div>

      {/* Mobile floating Filters button (< sm) */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-md bg-black text-white active:opacity-80"
          aria-label="Открыть фильтры"
        >
          <FunnelIcon className="size-4" />
          Filters
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
