import { useState, useEffect } from "react";
import { fetchCars } from "../../services/car.service";
import CarTable from "./сarTable";
import type { CarWithRelations } from "@/types/carWithRelations";
import { Badge, Button, Loader, NativeSelect, TextInput } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Country } from "@/types/country";
import { fetchCountries } from "../locations/location.service";

export default function CarsPage() {
  const navigate = useNavigate();

  const [cars, setCars] = useState<CarWithRelations[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryId, setCountryId] = useState<string | null>(null);

  const [filtered, setFiltered] = useState<CarWithRelations[]>([]);
  const [locationFilter, setLocationFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const cars = await fetchCars();
      const countries = await fetchCountries();
      setCars(cars);
      setCountries(countries);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const textFiltered = cars.filter((car) => {
      const text = `${car.models?.brands?.name ?? ""} ${
        car.models?.name ?? ""
      } ${car.licensePlate}`.toLowerCase();
      return text.includes(search.toLowerCase());
    });

    const finalFilter = textFiltered.filter((car) => {
      const location = car.locations?.name?.toLowerCase() ?? "";
      return (
        locationFilter === "" || location.includes(locationFilter.toLowerCase())
      );
    });

    setFiltered(finalFilter);
  }, [search, locationFilter, cars]);

  const addNewCar = () => {
    navigate("/cars/add");
  };

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
          onChange={(e) => setCountryId(e.target.value || null)}
          radius="xs"
          className=" pl-2  border  border-gray-800"
        >
          <option>Country</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          // variant="unstyled"
          data={[
            { label: "Location", value: "" },
            { label: "Santander", value: "Santander" },
            { label: "Sitges", value: "Sitges" },
          ]}
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.currentTarget.value)}
          radius="none"
          disabled={!countryId}
          className="   border border-gray-800"
          styles={
            !countryId
              ? {
                  input: {
                    backgroundColor: "#f3f4f6",
                    color: "black",
                    border: "0px",
                  },
                }
              : {
                  input: { border: "0px" },
                }
          }
        />

        <TextInput
          variant="unstyled"
          placeholder="Поиск по марке, модели или номеру"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          radius="xs"
          className="flex-1 md:flex-none w-80 border border-gray-800"
          leftSection={<MagnifyingGlassIcon className="size-4" />}
        />
        <Button
          p={8}
          variant="white"
          color="black"
          onClick={() => {
            setSearch("");
            setCountryId("");
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
      ) : filtered.length > 0 ? (
        <CarTable cars={filtered} search={search} />
      ) : (
        <p className="text-zinc-500 text-sm mt-10">Cars not found</p>
      )}
    </>
  );
}
