import { useEffect, useState } from "react";
import {
  fetchBrands,
  fetchModelsByBrand,
  addCar,
} from "../../services/car.service";
import type { Brand } from "@/types/brand";
import type { Model } from "@/types/model";
import type { CarWithRelations } from "@/types/carWithRelations";
import type { Country } from "@/types/country";
import type { Location } from "@/types/location";
import type { Address } from "@/types/address";
import {
  fuelTypes,
  transmissions,
  seatOptions,
  statuses,
  colors,
  bodyTypes,
  driveTypes,
  doorOptions,
  yesNoOptions,
} from "@/constants/carOptions";
import {
  fetchCountries,
  fetchLocationsByCountry,
  fetchAddressByLocation,
} from "../locations/location.service";

type CarFormProps = {
  onClose: () => void;
  onAdded: (newCar: CarWithRelations) => void;
};

type CarFormData = {
  model_id: string;
  year: string;
  fuel_type: string;
  transmission: string;
  seats: string;
  license_plate: string;
  location_id: string;
  address_id: string;
  engine_capacity: string;
  status: string;
  body_type: string;
  drive_type: string;
  color: string;
  doors: string;
  has_ac: string;
  has_bluetooth: string;
  has_carplay: string;
};

export default function CarForm({ onClose, onAdded }: CarFormProps) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);

  const [countryId, setCountryId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<CarFormData>({
    model_id: "",
    year: "",
    fuel_type: "",
    transmission: "",
    seats: "",
    license_plate: "",
    location_id: "",
    address_id: "",
    engine_capacity: "",
    status: "",
    body_type: "",
    drive_type: "",
    color: "",
    doors: "",
    has_ac: "",
    has_bluetooth: "",
    has_carplay: "",
  });

  useEffect(() => {
    fetchBrands().then(setBrands).catch(console.error);
    fetchCountries().then(setCountries).catch(console.error);
  }, []);

  useEffect(() => {
    if (brandId) {
      fetchModelsByBrand(brandId).then(setModels).catch(console.error);
    } else {
      setModels([]);
    }
    setForm((prev) => ({ ...prev, model_id: "" }));
  }, [brandId]);

  useEffect(() => {
    if (countryId) {
      fetchLocationsByCountry(countryId)
        .then(setLocations)
        .catch(console.error);
    } else {
      setLocations([]);
    }
    setForm((prev) => ({ ...prev, location_id: "" }));
  }, [countryId]);

  useEffect(() => {
    if (locationId) {
      fetchAddressByLocation(locationId)
        .then(setAddresses)
        .catch(console.error);
    } else {
      setAddresses([]);
    }
    setForm((prev) => ({ ...prev, address_id: "" }));
  }, [locationId]);

  const handleChange = (field: keyof CarFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.model_id || !form.location_id || !form.address_id) {
      alert("Пожалуйста, заполните все обязательные поля");
      return;
    }
    setLoading(true);
    try {
      const result = await addCar({
        model_id: form.model_id,
        year: form.year ? Number(form.year) : null,
        fuel_type: form.fuel_type || null,
        transmission: form.transmission || null,
        seats: form.seats ? Number(form.seats) : null,
        license_plate: form.license_plate || null,
        location_id: form.location_id || null,
        address_id: form.address_id || null,
        engine_capacity: form.engine_capacity
          ? Number(form.engine_capacity)
          : null,
        status: form.status || null,
        body_type: form.body_type || null,
        drive_type: form.drive_type || null,
        color: form.color || null,
        doors: form.doors ? Number(form.doors) : null,
        has_ac: form.has_ac === "true",
        has_bluetooth: form.has_bluetooth === "true",
        has_carplay: form.has_carplay === "true",
      });

      if (!result || result.length === 0)
        throw new Error("Не удалось добавить авто");

      onAdded(result[0]);
      onClose();
    } catch (e) {
      console.error(e);
      alert("Ошибка при добавлении");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded mb-6 w-full max-w-md">
      <h3 className="text-lg font-semibold mb-4">Добавить автомобиль</h3>
      <div className="flex flex-col gap-3">
        <select
          value={countryId ?? ""}
          onChange={(e) => setCountryId(e.target.value || null)}
          className="border p-2 rounded"
        >
          <option value="">Выберите страну</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={form.location_id}
          onChange={(e) => {
            const value = e.target.value;
            handleChange("location_id", value); // ✅ обновляем форму
            setLocationId(value || null); // ✅ и триггерим загрузку адресов
          }}
          disabled={!countryId}
          className="border p-2 rounded"
        >
          <option value="">Выберите локацию</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>

        <select
          value={form.address_id}
          onChange={(e) => handleChange("address_id", e.target.value)} // ✅ просто адрес
          disabled={!locationId}
          className="border p-2 rounded"
        >
          <option value="">Выберите адрес</option>
          {addresses.map((adr) => (
            <option key={adr.id} value={adr.id}>
              {adr.name}
            </option>
          ))}
        </select>

        <select
          value={brandId ?? ""}
          onChange={(e) => setBrandId(e.target.value || null)}
          className="border p-2 rounded"
        >
          <option value="">Выберите бренд</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          value={form.model_id}
          onChange={(e) => handleChange("model_id", e.target.value)}
          disabled={!brandId}
          className="border p-2 rounded"
        >
          <option value="">Выберите модель</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Год выпуска"
          value={form.year}
          onChange={(e) => handleChange("year", e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Номер авто"
          value={form.license_plate}
          onChange={(e) => handleChange("license_plate", e.target.value)}
          className="border p-2 rounded"
        />

        <select
          value={form.fuel_type}
          onChange={(e) => handleChange("fuel_type", e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Тип топлива</option>
          {fuelTypes.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        <select
          value={form.transmission}
          onChange={(e) => handleChange("transmission", e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Коробка передач</option>
          {transmissions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          value={form.seats}
          onChange={(e) => handleChange("seats", e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Количество мест</option>
          {seatOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Объём двигателя"
          value={form.engine_capacity}
          onChange={(e) => handleChange("engine_capacity", e.target.value)}
          className="border p-2 rounded"
        />

        <select
          value={form.status}
          onChange={(e) => handleChange("status", e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Статус</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={form.body_type}
          onChange={(e) => handleChange("body_type", e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Тип кузова</option>
          {bodyTypes.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <select
          value={form.drive_type}
          onChange={(e) => handleChange("drive_type", e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Привод</option>
          {driveTypes.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          value={form.color}
          onChange={(e) => handleChange("color", e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Цвет</option>
          {colors.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={form.doors}
          onChange={(e) => handleChange("doors", e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Количество дверей</option>
          {doorOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          value={form.has_ac}
          onChange={(e) => handleChange("has_ac", e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Кондиционер</option>
          {yesNoOptions.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={form.has_bluetooth}
          onChange={(e) => handleChange("has_bluetooth", e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Bluetooth</option>
          {yesNoOptions.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={form.has_carplay}
          onChange={(e) => handleChange("has_carplay", e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">CarPlay</option>
          {yesNoOptions.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !form.model_id}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Сохраняю..." : "Добавить"}
        </button>
      </div>
    </div>
  );
}
