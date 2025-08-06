import { useEffect, useState } from "react";
import {
  updateCar,
  fetchFeatures,
  fetchCarFeatures,
  updateCarFeatures,
  deleteCar,
} from "@/services/car.service";
import {
  fuelTypes,
  transmissions,
  seatOptions,
  colors,
  bodyTypes,
  driveTypes,
  doorOptions,
  statuses,
} from "@/constants/carOptions";
import {
  Checkbox,
  Input,
  Loader,
  Modal,
  NativeSelect,
  NumberInput,
} from "@mantine/core";
import Editor from "./editor";
import type { Feature } from "@/types/feature";
import { useCarContext } from "@/context/carContext";
import type { CarUpdatePayload } from "@/types/сarUpdatePayload";
import { useNavigate } from "react-router";

/** ВНУТРЕННИЙ формат формы — CAMEL */
type CarFormData = {
  vin: string;
  modelId: string;
  year: string; // храню как string для удобства инпутов
  fuelType: string;
  transmission: string;
  seats: string; // string в UI, конвертим при сабмите
  licensePlate: string;
  engineCapacity: number;
  status: string;
  bodyType: string;
  driveType: string;
  color: string;
  doors: string; // string в UI, конвертим при сабмите
  photos: string[];
  content: string;
};

/** Адаптер: car (camel) -> форма (camel) */
function toFormFromCar(car: any): CarFormData {
  if (!car) {
    return {
      vin: "",
      modelId: "",
      year: "",
      fuelType: "",
      transmission: "",
      seats: "",
      licensePlate: "",
      engineCapacity: 0,
      status: "",
      bodyType: "",
      driveType: "",
      color: "",
      doors: "",
      photos: [],
      content: "",
    };
  }

  return {
    vin: car.vin ?? "",
    // 👇 поле modelId в camel-объекте берём из связанного model.id
    modelId: String(car.model?.id ?? ""),
    year: car.year != null ? String(car.year) : "",
    fuelType: car.fuelType ?? "",
    transmission: car.transmission ?? "",
    seats: car.seats != null ? String(car.seats) : "",
    licensePlate: car.licensePlate ?? "",
    engineCapacity: car.engineCapacity ?? 0,
    status: car.status ?? "",
    bodyType: car.bodyType ?? "",
    driveType: car.driveType ?? "",
    color: car.color ?? "",
    doors: car.doors != null ? String(car.doors) : "",
    photos: car.photos ?? [],
    content: car.content ?? "",
  };
}

/** Адаптер: форма (camel) -> payload для API (snake) */
function toApiPayload(form: CarFormData): CarUpdatePayload {
  return {
    vin: form.vin || undefined,
    modelId: form.modelId || undefined,
    year: form.year ? Number(form.year) : undefined,
    fuelType: form.fuelType || undefined,
    transmission: form.transmission || undefined,
    seats: form.seats ? Number(form.seats) : undefined,
    licensePlate: form.licensePlate || undefined,
    engineCapacity: form.engineCapacity ?? undefined,
    status: form.status || undefined,
    bodyType: form.bodyType || undefined,
    driveType: form.driveType || undefined,
    color: form.color || undefined,
    doors: form.doors ? Number(form.doors) : undefined,
    photos: form.photos ?? [],
    content: form.content ?? "",
  };
}

export default function CarDetails() {
  const navigate = useNavigate();

  const { car, setCar } = useCarContext();
  const carId = car?.id;

  const [features, setFeatures] = useState<Feature[]>([]);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState<CarFormData>(() =>
    car
      ? toFormFromCar(car)
      : {
          vin: "",
          modelId: "",
          year: "",
          fuelType: "",
          transmission: "",
          seats: "",
          licensePlate: "",
          locationId: "",
          engineCapacity: 0,
          status: "",
          bodyType: "",
          driveType: "",
          color: "",
          doors: "",
          photos: [],
          content: "",
        }
  );

  // Синхронизируем форму, если в контексте пришёл новый car (сменили :id или обновили лоадером)
  useEffect(() => {
    if (car) setForm(toFormFromCar(car));
  }, [car]);

  // Загружаем справочник всех фич
  useEffect(() => {
    const loadFeatures = async () => {
      const data = await fetchFeatures();
      setFeatures(data);
    };
    loadFeatures();
  }, []);

  // Загружаем текущие фичи авто
  useEffect(() => {
    const loadCarFeatures = async (id: string) => {
      try {
        if (!carId) return;
        const featureIds = await fetchCarFeatures(id);
        setSelectedFeatureIds(featureIds);
      } catch (err) {
        console.error("Ошибка при загрузке фич:", err);
      }
    };

    if (carId) loadCarFeatures(carId);
  }, [carId]);

  // Универсальный апдейтер полей формы
  const handleChange = (
    field: keyof CarFormData,
    value: string | number | null
  ) => {
    // Mantine NumberInput может отдавать number | string | null
    setForm((prev) => ({
      ...prev,
      [field]:
        typeof value === "number" || value === null
          ? (value as any)
          : String(value),
    }));
  };

  const handleSubmit = async () => {
    if (!form.modelId) {
      alert("Пожалуйста, заполните все обязательные поля");
      return;
    }
    if (!carId) {
      alert("Не найден ID авто");
      return;
    }

    setLoading(true);
    try {
      const payload = toApiPayload(form);
      await updateCar(carId, payload);
      await updateCarFeatures(carId, selectedFeatureIds);

      // Обновляем локальный контекст (минимально и аккуратно)
      if (setCar) {
        setCar((prev: any) => ({
          ...prev,
          vin: form.vin,
          year: form.year ? Number(form.year) : prev?.year,
          fuelType: form.fuelType,
          transmission: form.transmission,
          seats: form.seats ? Number(form.seats) : prev?.seats,
          licensePlate: form.licensePlate,
          engineCapacity: form.engineCapacity,
          status: form.status,
          bodyType: form.bodyType,
          driveType: form.driveType,
          color: form.color,
          doors: form.doors ? Number(form.doors) : prev?.doors,
          photos: form.photos,
          content: form.content,
        }));
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка при сохранении");
    } finally {
      setLoading(false);
    }
  };

  async function handleDelete() {
    try {
      if (!carId) return null;
      await deleteCar(carId);
      setTimeout(() => {
        navigate("/cars");
      }, 2000);
    } catch (error) {
      console.error(error);
      alert("Не удалось удалить автомобиль");
    }
  }

  return (
    <div className="mb-4 w-full xl:max-w-2xl">
      <h1 className="font-openSans text-2xl font-bold">Car details</h1>
      <div className="border-b border-gray-100 mt-5 shadow-sm"></div>
      <div className="flex justify-between items-center mt-5">
        <p className="text-lg font-medium text-gray-800">Your car</p>
        <p className=" text-sm text-gray-500">{form.vin}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 md:gap-x-5 gap-y-4 mt-5">
        <Input.Wrapper label="Mark">
          <Input
            value={car?.model?.brands?.name ?? ""}
            disabled
            styles={{ input: { backgroundColor: "#f3f4f6", color: "black" } }}
          />
        </Input.Wrapper>

        <Input.Wrapper label="Model">
          <Input
            value={car?.model?.name ?? ""}
            disabled
            styles={{ input: { backgroundColor: "#f3f4f6", color: "black" } }}
          />
        </Input.Wrapper>

        <NumberInput
          label="Year"
          value={form.year}
          // Mantine NumberInput onChange может вернуть number | string | null
          onChange={(v) => handleChange("year", v === null ? "" : String(v))}
          disabled
          styles={{ input: { backgroundColor: "#f3f4f6", color: "black" } }}
        />

        <Input.Wrapper label="License plate number">
          <Input
            value={form.licensePlate}
            onChange={(e) => handleChange("licensePlate", e.target.value)}
            disabled
            styles={{ input: { backgroundColor: "#f3f4f6", color: "black" } }}
          />
        </Input.Wrapper>

        <NativeSelect
          label="Type"
          value={form.bodyType}
          onChange={(e) => handleChange("bodyType", e.target.value)}
          data={bodyTypes}
        />

        <NativeSelect
          label="Transmission"
          value={form.transmission}
          onChange={(e) => handleChange("transmission", e.target.value)}
          data={transmissions}
        />
      </div>

      <p className="text-lg font-medium text-gray-800 mt-10">
        Basic car details
      </p>
      <div className="grid grid-cols-2 gap-x-4 md:gap-x-5 gap-y-4 mt-5">
        <NativeSelect
          label="Fuel type"
          value={form.fuelType}
          onChange={(e) => handleChange("fuelType", e.target.value)}
          data={fuelTypes}
        />

        <NativeSelect
          label="Drive type"
          value={form.driveType}
          onChange={(e) => handleChange("driveType", e.target.value)}
          data={driveTypes}
        />

        <NumberInput
          label="Engine capacity"
          value={form.engineCapacity}
          onChange={(v) =>
            handleChange(
              "engineCapacity",
              typeof v === "number" ? v : Number(v ?? 0)
            )
          }
          step={0.1}
          decimalScale={1}
          fixedDecimalScale
          defaultValue={1.0}
          min={1}
          max={5}
        />

        <NativeSelect
          label="Color"
          value={form.color}
          onChange={(e) => handleChange("color", e.target.value)}
          data={colors}
        />

        <NativeSelect
          label="Number of seats"
          value={form.seats}
          onChange={(e) => handleChange("seats", e.target.value)}
          data={seatOptions.map((s) => ({
            value: String(s),
            label: String(s),
          }))}
        />

        <NativeSelect
          label="Number of doors"
          value={form.doors}
          onChange={(e) => handleChange("doors", e.target.value)}
          data={doorOptions.map((d) => ({
            value: String(d),
            label: String(d),
          }))}
        />
      </div>

      <p className="text-lg font-medium text-gray-800 mt-10">Features</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5">
        {features.map((feature) => (
          <Checkbox
            key={feature.id}
            label={feature.name}
            value={feature.id}
            checked={selectedFeatureIds.includes(feature.id)}
            onChange={() =>
              setSelectedFeatureIds((prev) =>
                prev.includes(feature.id)
                  ? prev.filter((id) => id !== feature.id)
                  : [...prev, feature.id]
              )
            }
            className="mb-2"
            color="black"
          />
        ))}
      </div>

      <p className="text-lg font-medium text-gray-800 mt-8 mb-2">Description</p>
      <p className="mb-5">
        Tell guests what makes your car unique and why they'll love driving it.
      </p>

      <Editor
        value={form.content}
        onChange={(e: string | number) => handleChange("content", e)}
      />

      <div className="mt-5 w-fit">
        <NativeSelect
          label="Availability"
          value={form.status}
          onChange={(e) => handleChange("status", e.target.value)}
          data={statuses}
        />
      </div>

      <div className="mt-5 flex items-center justify-between text-right w-full">
        <button
          onClick={(e) => {
            e.preventDefault(); // отменяет переход
            e.stopPropagation(); // останавливает всплытие
            setConfirmDelete(true);
          }}
          className=" h-10 px-4 py-2 border rounded cursor-pointer"
        >
          Удалить
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !form.modelId}
          className="w-32 h-10 bg-black text-white px-4 py-2 rounded hover:bg-gray-900 disabled:opacity-50 cursor-pointer"
        >
          <p className="flex justify-center">
            {loading ? <Loader type="dots" size="sm" /> : "Save"}
          </p>
        </button>
      </div>
      <Modal
        opened={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Удаление автомобиля"
        centered
      >
        <p className="mb-4">Вы уверены, что хотите удалить этот автомобиль?</p>
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 border border-zinc-300 hover:bg-zinc-100 transition"
            onClick={() => setConfirmDelete(false)}
          >
            Отмена
          </button>
          <button
            className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 transition"
            onClick={handleDelete}
          >
            Удалить
          </button>
        </div>
      </Modal>
    </div>
  );
}
