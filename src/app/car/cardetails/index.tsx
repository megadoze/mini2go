import { useEffect, useMemo, useRef, useState } from "react";
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
  // Loader,
  Modal,
  NativeSelect,
  NumberInput,
} from "@mantine/core";
import Editor from "./editor";
import type { Feature } from "@/types/feature";
import { useCarContext } from "@/context/carContext";
import type { CarUpdatePayload } from "@/types/сarUpdatePayload";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useCarCache } from "@/hooks/useCarCache";
import { useQueryClient } from "@tanstack/react-query";
import { QK } from "@/queryKeys";

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
  const qc = useQueryClient();

  const navigate = useNavigate();

  const { patchCar, removeCar } = useCarCache();

  const { car, setCar } = useCarContext();
  const carId = car?.id;

  const [features, setFeatures] = useState<Feature[]>([]);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState(false);

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

  const initialFeatureIdsRef = useRef<string[] | null>(null);

  useEffect(() => {
    const loadCarFeatures = async (id: string) => {
      if (!carId) return;
      const featureIds = await fetchCarFeatures(id);
      setSelectedFeatureIds(featureIds);
      if (initialFeatureIdsRef.current === null) {
        initialFeatureIdsRef.current = featureIds;
      }
    };

    if (carId) loadCarFeatures(carId);
  }, [carId]);

  const isChanged = useMemo(() => {
    if (!car) return false;

    const formFromCar = toFormFromCar(car);
    const baseForm = JSON.stringify(formFromCar);
    const currentForm = JSON.stringify(form);

    const originalFeatureIds = (initialFeatureIdsRef.current ?? [])
      .slice()
      .sort();
    const currentFeatureIds = selectedFeatureIds.slice().sort();

    const featuresChanged =
      JSON.stringify(currentFeatureIds) !== JSON.stringify(originalFeatureIds);
    const formChanged = baseForm !== currentForm;

    return formChanged || featuresChanged;
  }, [car, form, selectedFeatureIds]);

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

  // const validateForm = () => {
  //   console.log(form);

  //   if (
  // !form.licensePlate ||
  //   !form.bodyType ||
  //   !form.transmission ||
  //   !form.modelId ||
  //   !form.driveType ||
  //   !form.fuelType ||
  //   !form.engineCapacity ||
  //   !form.seats ||
  //   !form.color ||
  //   !form.doors
  //   )
  //     return;
  // };

  const handleSubmit = async () => {
    if (!isChanged) return;
    if (
      !form.licensePlate ||
      !form.bodyType ||
      !form.transmission ||
      !form.modelId ||
      !form.driveType ||
      !form.fuelType ||
      !form.engineCapacity ||
      !form.seats ||
      !form.color ||
      !form.doors
    )
      // validateForm();
      return toast.warning("Please fill in all required fields");
    if (!form.licensePlate?.trim())
      return toast.error("Please enter the vehicle registration number");
    if (!carId) return alert("Car ID not found");

    setLoading(true);
    try {
      const payload = toApiPayload(form);

      const patch = {
        vin: form.vin,
        year: form.year ? Number(form.year) : undefined,
        fuelType: form.fuelType,
        transmission: form.transmission,
        seats: form.seats ? Number(form.seats) : undefined,
        licensePlate: form.licensePlate,
        engineCapacity: form.engineCapacity,
        status: form.status,
        bodyType: form.bodyType,
        driveType: form.driveType,
        color: form.color,
        doors: form.doors ? Number(form.doors) : undefined,
        photos: form.photos,
        content: form.content,
      } as const;

      await Promise.all([
        updateCar(carId, payload),
        updateCarFeatures(carId, selectedFeatureIds),
      ]);

      qc.setQueryData(QK.carFeatures(carId), selectedFeatureIds);

      // локально обновили контекст
      setCar?.((prev: any) => ({ ...prev, ...patch }));

      // единая точка синка кэша + инвалидаций
      patchCar(carId, patch); // <-- утилита сама инвалидаит что нужно

      // сброс "грязности"
      initialFeatureIdsRef.current = [...selectedFeatureIds];

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Car saved successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Error while saving");
    } finally {
      setLoading(false);
    }
  };

  async function handleDelete() {
    setLoading(true);

    try {
      if (!carId) throw new Error("No car ID");

      await deleteCar(carId);
      removeCar(carId);
      toast.success("Car deleted");
      navigate("/cars");
    } catch (error) {
      console.error(error);
      alert("Failed to remove vehicle");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-4 w-full xl:max-w-2xl">
      <h1 className="font-openSans text-2xl font-bold">Car details</h1>
      <div className="border-b border-gray-100 mt-5 shadow-sm"></div>
      <div className="flex justify-between items-center mt-5">
        <p className="text-lg font-medium text-gray-800">Your car</p>
        <p className="text-sm text-neutral-500">VIN: {form.vin}</p>
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
          onChange={(v) => handleChange("year", v === null ? "" : String(v))}
          disabled
          styles={{ input: { backgroundColor: "#f3f4f6", color: "black" } }}
        />

        <Input.Wrapper label="License plate number" withAsterisk>
          <Input
            value={form.licensePlate}
            onChange={(e) => handleChange("licensePlate", e.target.value)}
            // styles={{ input: { backgroundColor: "#f3f4f6", color: "black" } }}
          />
        </Input.Wrapper>

        <NativeSelect
          label="Type"
          value={form.bodyType}
          onChange={(e) => handleChange("bodyType", e.target.value)}
          data={[
            { value: "", label: "Select body type" }, // пустое значение
            ...bodyTypes.map((b) => ({ value: b, label: b })),
          ]}
          withAsterisk
        />

        <NativeSelect
          label="Transmission"
          value={form.transmission}
          onChange={(e) => handleChange("transmission", e.target.value)}
          data={[
            { value: "", label: "Select transmission type" }, // пустое значение
            ...transmissions.map((t) => ({ value: t, label: t })),
          ]}
          withAsterisk
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
          data={[
            { value: "", label: "Select fuel type" }, // пустое значение
            ...fuelTypes.map((d) => ({ value: d, label: d })),
          ]}
          withAsterisk
        />

        <NativeSelect
          label="Drive type"
          value={form.driveType}
          onChange={(e) => handleChange("driveType", e.target.value)}
          data={[
            { value: "", label: "Select drive type" }, // пустое значение
            ...driveTypes.map((d) => ({ value: d, label: d })),
          ]}
          withAsterisk
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
          withAsterisk
        />

        <NativeSelect
          label="Color"
          value={form.color}
          onChange={(e) => handleChange("color", e.target.value)}
          data={[
            { value: "", label: "Select color" }, // пустое значение
            ...colors.map((d) => ({ value: d, label: d })),
          ]}
          withAsterisk
        />

        <NativeSelect
          label="Number of seats"
          value={form.seats}
          onChange={(e) => handleChange("seats", e.target.value)}
          data={[
            { value: "", label: "Select num of seats" }, // пустое значение
            ...seatOptions.map((s) => ({ value: s, label: s })),
          ]}
          withAsterisk
        />

        <NativeSelect
          label="Number of doors"
          value={form.doors}
          onChange={(e) => handleChange("doors", e.target.value)}
          data={[
            { value: "", label: "Select num of seats" }, // пустое значение
            ...doorOptions.map((d) => ({ value: d, label: d })),
          ]}
          withAsterisk
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
          className="border rounded-md px-4 text-neutral-500 py-2 "
        >
          Удалить
        </button>
        <div className="">
          <span
            className={`text-green-500 font-medium text-sm transition-opacity duration-500 mr-2 ${
              saved ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            ✓ Saved
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isChanged || loading || !form.modelId}
            className={`border rounded-md px-8 py-2 transition-opacity duration-500 ${
              isChanged
                ? "border-black text-gray-700 opacity-100"
                : "border-gray-300 text-gray-400  cursor-not-allowed"
            }`}
          >
            Save
          </button>
        </div>
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
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader size={16} color="white" />
                Удаление...
              </div>
            ) : (
              "Удалить"
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
}
