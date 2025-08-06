import { useEffect, useState } from "react";
import {
  fetchBrands,
  fetchModelsByBrand,
  addCar,
  fetchCarById,
  uploadCarPhotos,
} from "../../services/car.service";
import type { Brand } from "@/types/brand";
import type { Model } from "@/types/model";
import type { Country } from "@/types/country";
import type { Location } from "@/types/location";
import {
  fuelTypes,
  transmissions,
  seatOptions,
  statuses,
  colors,
  bodyTypes,
  driveTypes,
  doorOptions,
} from "@/constants/carOptions";
import {
  fetchCountries,
  fetchLocationsByCountry,
} from "../locations/location.service";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type CarFormData = {
  vin: string;
  model_id: string;
  year: string;
  fuel_type: string;
  transmission: string;
  seats: string;
  license_plate: string;
  location_id: string;
  engine_capacity: string;
  status: string;
  body_type: string;
  drive_type: string;
  color: string;
  doors: string;
  photos: string[];
};

export default function AddCarPage() {
  const navigate = useNavigate();

  const { id } = useParams();
  const carId = id;

  const isEditMode = Boolean(id);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  // const [addresses, setAddresses] = useState<Address[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);

  const [countryId, setCountryId] = useState<string | null>(null);
  // const [locationId, setLocationId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getDefForm = () => {
    return {
      vin: "",
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
      photos: [],
    };
  };

  const [form, setForm] = useState<CarFormData>(getDefForm());

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
    if (!isEditMode || !id) return;
    setPhotos([]);

    (async () => {
      setLoading(true);
      try {
        const car = await fetchCarById(id);
        setPhotos([]);

        // Установим нужные зависимости для select'ов
        setCountryId(car.location.country_id);
        // setLocationId(car.location_id);
        setBrandId(car.model.brand_id);

        // Заполняем форму
        setForm({
          vin: car.vin ?? "",
          model_id: car.model_id,
          year: String(car.year ?? ""),
          fuel_type: car.fuel_type ?? "",
          transmission: car.transmission ?? "",
          seats: car.seats ? String(car.seats) : "",
          license_plate: car.license_plate ?? "",
          location_id: car.location_id ?? "",
          engine_capacity: car.engine_capacity
            ? String(car.engine_capacity)
            : "",
          status: car.status ?? "",
          body_type: car.body_type ?? "",
          drive_type: car.drive_type ?? "",
          color: car.color ?? "",
          doors: car.doors ? String(car.doors) : "",
          photos: car.photos ?? [],
        });
      } catch (e) {
        console.error("Ошибка при загрузке авто", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEditMode]);

  const handleChange = (field: keyof CarFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.model_id || !form.location_id) {
      alert("Пожалуйста, заполните все обязательные поля");
      return;
    }

    setLoading(true);

    try {
      const carPayload = {
        vin: form.vin,
        model_id: form.model_id,
        year: form.year ? Number(form.year) : null,
        fuel_type: form.fuel_type || null,
        transmission: form.transmission || null,
        seats: form.seats ? Number(form.seats) : null,
        license_plate: form.license_plate || null,
        location_id: form.location_id || null,
        engine_capacity: form.engine_capacity || null,
        status: form.status || null,
        body_type: form.body_type || null,
        drive_type: form.drive_type || null,
        doors: form.doors ? Number(form.doors) : null,
        photos: [], // Пока не загружаем — сначала файл, потом URL
      };

      const result = await addCar(carPayload);
      if (!result || !result[0]?.id) {
        throw new Error("Не удалось добавить авто");
      }

      if (!carId) return null;
      // 1. Загружаем новые фото, если есть
      let uploadedUrls: string[] = [];
      if (photos.length) {
        uploadedUrls = await uploadCarPhotos(photos, carId);
      }

      // 2. Объединяем старые (из form.photos) и новые
      const existingPhotos = Array.isArray(form.photos)
        ? form.photos.filter((url): url is string => typeof url === "string")
        : [];

      const allPhotos = [...existingPhotos, ...uploadedUrls];

      // 3. Обновляем поле photos
      await supabase.from("cars").update({ photos: allPhotos }).eq("id", carId);

      navigate("/cars");
    } catch (e) {
      console.error(e);
      alert("Ошибка при сохранении");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded mb-6 w-full max-w-md">
      <h3 className="text-lg font-semibold mb-4">
        {isEditMode ? "Редактировать автомобиль" : "Добавить автомобиль"}
      </h3>
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
            // setLocationId(value || null); // ✅ и триггерим загрузку адресов
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

        <input
          type="text"
          placeholder="VIN"
          value={form.vin}
          onChange={(e) => handleChange("vin", e.target.value)}
          className="border p-2 rounded"
        />

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

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            const files = e.target.files;
            if (files) {
              setPhotos((prev) => [...prev, ...Array.from(files)]);
            }
          }}
        />

        {photos.map((file, idx) => (
          <img
            key={idx}
            src={URL.createObjectURL(file)}
            className="h-32 object-cover"
          />
        ))}

        {Array.isArray(form.photos) &&
          form.photos.map(
            (url, idx) =>
              typeof url === "string" && (
                <img
                  key={`existing-${idx}`}
                  src={url}
                  alt={`car-photo-${idx}`}
                  className="h-32 object-cover rounded"
                />
              )
          )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !form.model_id}
          className="bg-black text-white px-4 py-2 rounded hover:bg-gray-900 disabled:opacity-50"
        >
          {loading
            ? "Сохраняю..."
            : isEditMode
            ? "Сохранить изменения"
            : "Добавить"}
        </button>
      </div>
    </div>
  );
}
