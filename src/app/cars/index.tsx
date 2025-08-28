import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Loader, NativeSelect, TextInput } from "@mantine/core";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";

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

  // фильтры / контролы UI
  const [countryId, setCountryId] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState("");
  const [search, setSearch] = useState("");

  /* -------------------- queries -------------------- */

  const carsQ = useQuery<CarWithRelations[], Error>({
    queryKey: ["cars"],
    queryFn: () => fetchCars(),
    initialData: qc.getQueryData<CarWithRelations[]>(["cars"]),
    staleTime: 24 * 60 * 60 * 1000, // 1 день данные считаются свежими
    gcTime: 7 * 24 * 60 * 60 * 1000, // держим в кэше 7 дней
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

  /* -------------------- render -------------------- */

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h1 className="font-openSans font-bold text-2xl">Cars</h1>
          {cars.length > 0 && <Badge color="black">{cars.length}</Badge>}
        </div>
        <Button
          variant="filled"
          color="black"
          size="xs"
          radius="xs"
          onClick={addNewCar}
        >
          + Add car
        </Button>
      </div>

      <div className="flex gap-2 items-center w-full mb-6">
        <NativeSelect
          variant="unstyled"
          value={countryId ?? ""}
          onChange={(e) => {
            setCountryId(e.currentTarget.value || null);
            // сбрасываем локацию при смене страны
            setLocationFilter("");
          }}
          radius="xs"
          className="pl-2 border border-gray-600"
        >
          <option value="">Country</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          value={locationFilter ?? ""}
          onChange={(e) => setLocationFilter(e.currentTarget.value)}
          radius="none"
          disabled={!countryId}
          className="border border-gray-600"
          styles={{
            input: {
              backgroundColor: !countryId ? "#f3f4f6" : undefined,
              color: "black",
              border: "0px",
            },
          }}
        >
          <option value="">Location</option>
          {locations.map((l) => (
            <option key={l.id} value={l.name}>
              {l.name}
            </option>
          ))}
        </NativeSelect>

        <TextInput
          variant="unstyled"
          placeholder="Поиск по марке, модели или номеру"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          radius="xs"
          className="flex-1 md:flex-none w-80 border border-gray-600"
          leftSection={<MagnifyingGlassIcon className="size-4" />}
        />

        <Button
          p={8}
          variant="white"
          color="black"
          onClick={() => {
            setSearch("");
            setCountryId(null);
            setLocationFilter("");
          }}
        >
          <XMarkIcon className="size-5 stroke-1" />
        </Button>
      </div>

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

// import { useState, useEffect, useMemo } from "react";
// import { fetchCars } from "../../services/car.service";
// import CarTable from "./сarTable";
// import type { CarWithRelations } from "@/types/carWithRelations";
// import { Badge, Button, Loader, NativeSelect, TextInput } from "@mantine/core";
// import { useNavigate } from "react-router-dom";
// import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
// import type { Country } from "@/types/country";
// import type { Location } from "@/types/location";
// import {
//   fetchCountries,
//   fetchLocationsByCountry,
// } from "@/services/geo.service";

// export default function CarsPage() {
//   const navigate = useNavigate();

//   const [cars, setCars] = useState<CarWithRelations[]>([]);
//   const [countries, setCountries] = useState<Country[]>([]);
//   const [countryId, setCountryId] = useState<string | null>(null);

//   const [locations, setLocations] = useState<Location[]>([]);
//   const [locationFilter, setLocationFilter] = useState("");

//   const [search, setSearch] = useState("");
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const load = async () => {
//       const [cars, countries]: [CarWithRelations[], Country[]] =
//         await Promise.all([fetchCars(), fetchCountries()]);
//       setCars(cars);
//       setCountries(countries);
//       setLoading(false);
//     };
//     load();
//   }, []);

//   useEffect(() => {
//     if (!countryId) {
//       setLocations([]);
//       return;
//     }

//     const load = async () => {
//       const locations = await fetchLocationsByCountry(countryId);
//       setLocations(locations);
//     };
//     load();
//   }, [countryId]);

//   const filteredCars = useMemo(() => {
//     const textFiltered = cars.filter((car) => {
//       const text = `${car.models?.brands?.name ?? ""} ${
//         car.models?.name ?? ""
//       } ${car.licensePlate}`.toLowerCase();
//       return text.includes(search.toLowerCase());
//     });

//     const countryFilter = countryId
//       ? textFiltered.filter((car) => car.locations?.countries.id === countryId)
//       : textFiltered;

//     return countryFilter.filter((car) => {
//       const location = car.locations?.name?.toLowerCase() ?? "";
//       return (
//         locationFilter === "" || location.includes(locationFilter.toLowerCase())
//       );
//     });
//   }, [cars, search, countryId, locationFilter]);

//   const addNewCar = () => {
//     navigate("/cars/add");
//   };

//   return (
//     <>
//       <div className="flex justify-between items-center mb-4">
//         <div className="flex items-center gap-2">
//           <h1 className="font-openSans font-bold text-2xl">Cars</h1>
//           {cars.length > 0 && <Badge color="black">{cars.length}</Badge>}
//         </div>
//         <Button
//           variant="filled"
//           color="black"
//           size="xs"
//           radius="xs"
//           onClick={addNewCar}
//         >
//           + Add car
//         </Button>
//       </div>
//       <div className="flex gap-2 items-center w-full mb-6">
//         <NativeSelect
//           variant="unstyled"
//           value={countryId ?? ""}
//           onChange={(e) => setCountryId(e.target.value || null)}
//           radius="xs"
//           className=" pl-2  border  border-gray-600"
//         >
//           <option value="">Country</option>
//           {countries.map((c) => (
//             <option key={c.id} value={c.id}>
//               {c.name}
//             </option>
//           ))}
//         </NativeSelect>

//         <NativeSelect
//           value={locationFilter ?? ""}
//           onChange={(e) => setLocationFilter(e.currentTarget.value)}
//           radius="none"
//           disabled={!countryId}
//           className="   border border-gray-600"
//           styles={{
//             input: {
//               backgroundColor: !countryId ? "#f3f4f6" : undefined,
//               color: "black",
//               border: "0px",
//             },
//           }}
//         >
//           <option value="">Location</option>
//           {locations.map((l) => (
//             <option key={l.id} value={l.name}>
//               {l.name}
//             </option>
//           ))}
//         </NativeSelect>

//         <TextInput
//           variant="unstyled"
//           placeholder="Поиск по марке, модели или номеру"
//           value={search}
//           onChange={(e) => setSearch(e.currentTarget.value)}
//           radius="xs"
//           className="flex-1 md:flex-none w-80 border border-gray-600"
//           leftSection={<MagnifyingGlassIcon className="size-4" />}
//         />
//         <Button
//           p={8}
//           variant="white"
//           color="black"
//           onClick={() => {
//             setSearch("");
//             setCountryId(null);
//             setLocationFilter("");
//           }}
//         >
//           <XMarkIcon className="size-5 stroke-1" />
//         </Button>
//       </div>

//       {loading ? (
//         <div className="flex justify-center items-center gap-2 text-center text-zinc-500 mt-10">
//           <Loader size="sm" color="gray" /> Loading...
//         </div>
//       ) : filteredCars.length > 0 ? (
//         <CarTable cars={filteredCars} search={search} />
//       ) : (
//         <p className="text-zinc-500 text-sm mt-10">Cars not found</p>
//       )}
//     </>
//   );
// }
