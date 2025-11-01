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
  Modal,
  NativeSelect,
  NumberInput,
  Select,
} from "@mantine/core";
import Editor from "./editor";
import type { Feature } from "@/types/feature";
import { useCarContext } from "@/context/carContext";
import type { CarUpdatePayload } from "@/types/сarUpdatePayload";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useCarCache } from "@/hooks/useCarCache";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

  const { patchCar } = useCarCache();

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

  const featuresIdsQ = useQuery({
    queryKey: QK.carFeatures(carId!),
    queryFn: () => fetchCarFeatures(carId!),
    enabled: !!carId,
  });

  useEffect(() => {
    const ids = featuresIdsQ.data;
    if (!ids) return;
    setSelectedFeatureIds(ids);
    if (initialFeatureIdsRef.current === null) {
      initialFeatureIdsRef.current = ids;
    }
  }, [featuresIdsQ.data]);

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

  const validateForm = () => {
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
      return false;
    else return true;
  };

  const STAT_PENDING = "pending_review" as const;

  const editableStatuses = statuses.filter((s) => s !== STAT_PENDING);

  const isPending = form.status === STAT_PENDING;
  const formIsValid = validateForm();

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
    if (!carId) return alert("No car ID");

    setConfirmDelete(false);
    setLoading(true);

    try {
      // 1) Оптимистично выкидываем из QK.cars (все распространённые формы)
      qc.setQueryData(QK.cars, (old: any) => {
        if (!old) return old;
        const idNE = (c: any) => String(c?.id) !== String(carId);

        if (Array.isArray(old)) return old.filter(idNE);
        if (Array.isArray(old?.items))
          return { ...old, items: old.items.filter(idNE) };
        if (Array.isArray(old?.data))
          return { ...old, data: old.data.filter(idNE) };
        if (Array.isArray(old?.rows))
          return { ...old, rows: old.rows.filter(idNE) };
        if (Array.isArray(old?.results))
          return { ...old, results: old.results.filter(idNE) };
        return old;
      });

      // 2) carsByHost (все ownerId)
      qc.setQueriesData(
        {
          predicate: ({ queryKey }) =>
            Array.isArray(queryKey) && String(queryKey[0]) === "carsByHost",
        },
        (old: any) => {
          if (!old) return old;
          const idNE = (c: any) => String(c?.id) !== String(carId);
          if (Array.isArray(old)) return old.filter(idNE);
          if (Array.isArray(old?.items))
            return { ...old, items: old.items.filter(idNE) };
          return old;
        }
      );

      // 3) carsInfinite (оба формата страниц: массив страниц и {items} на странице)
      qc.setQueriesData(
        {
          predicate: ({ queryKey }) =>
            Array.isArray(queryKey) && String(queryKey[0]) === "carsInfinite",
        },
        (old: any) => {
          if (!old?.pages) return old;
          const idNE = (c: any) => String(c?.id) !== String(carId);
          return {
            ...old,
            pages: old.pages.map((p: any) => {
              if (Array.isArray(p)) return p.filter(idNE);
              if (Array.isArray(p?.items))
                return { ...p, items: p.items.filter(idNE) };
              return p;
            }),
          };
        }
      );

      // 4) calendarWindow (если где-то используется)
      qc.setQueriesData(
        {
          predicate: ({ queryKey }) =>
            Array.isArray(queryKey) && String(queryKey[0]) === "calendarWindow",
        },
        (win: any) =>
          !win
            ? win
            : {
                ...win,
                cars: Array.isArray(win.cars)
                  ? win.cars.filter((c: any) => String(c?.id) !== String(carId))
                  : win.cars,
              }
      );

      // 5) детальку и связанные — удалить сразу
      qc.removeQueries({ queryKey: QK.car(carId), exact: true });
      qc.removeQueries({ queryKey: QK.carExtras(carId), exact: true });
      if (QK.carFeatures)
        qc.removeQueries({ queryKey: QK.carFeatures(carId), exact: true });
      qc.removeQueries({ queryKey: QK.bookingsByCarId(carId), exact: true });

      // 7) Бэкенд
      await deleteCar(carId);

      // 3) убиваем ВСЕ кэши carsByHost, чтобы список гарантированно заново фетчнулся
      qc.removeQueries({
        predicate: ({ queryKey }) =>
          Array.isArray(queryKey) && String(queryKey[0]) === "carsByHost",
      });

      // 4) на всякий — подсносим /cars и /carsInfinite (если где-то ещё смотрят)
      qc.removeQueries({ queryKey: QK.cars, exact: false });
      qc.removeQueries({
        predicate: ({ queryKey }) =>
          Array.isArray(queryKey) && String(queryKey[0]) === "carsInfinite",
      });

      // 5) мягкая синхронизация в фоне (необязательно)
      void qc.invalidateQueries({
        predicate: ({ queryKey }) => {
          const root = Array.isArray(queryKey) ? String(queryKey[0]) : "";
          return (
            root === QK.cars[0] ||
            root === "carsByHost" ||
            root === "carsInfinite" ||
            root === "calendarWindow"
          );
        },
      });

      toast.success("Car deleted");
      navigate("/cars");
    } catch (e) {
      console.error(e);
      toast.error("Failed to remove vehicle");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-4 w-full xl:max-w-2xl">
      <h1 className="font-roboto text-xl md:text-2xl font-medium">
        Car details
      </h1>
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
            { value: "", label: "Select num of doors" }, // пустое значение
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

      {/* <div className="mt-5 w-fit flex items-end gap-5">
        <NativeSelect
          label="Availability"
          value={form.status}
          onChange={(e) => handleChange("status", e.target.value)}
          data={statuses}
          disabled={!validateForm()}
        />
        {form.status === "unavailable" && validateForm() && (
          <p className=" rounded-md p-2 text-sm w-52 bg-green-50/80 text-green-700/70">
            Don't forget choose Available status to offer your car
          </p>
        )}
      </div> */}
      <div className="mt-5 w-fit flex items-end gap-5">
        {isPending ? (
          // режим: тачка ещё не прошла проверку
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-900 mb-1">
              Availability
            </label>

            <div className="px-3 py-2 rounded border text-sm bg-yellow-50 border-yellow-300 text-yellow-800 w-52">
              Pending review
            </div>

            <p className="text-xs text-yellow-700 mt-2 w-52">
              Your car is being reviewed. Once approved it can become available
              for booking.
            </p>
          </div>
        ) : (
          // нормальный режим: хост может управлять статусом
          <>
            <Select
              label="Availability"
              placeholder="Select status"
              value={form.status || null}
              onChange={(value) => handleChange("status", value ?? "")}
              data={editableStatuses}
              disabled={!formIsValid}
              maxDropdownHeight={200}
            />

            {form.status === "unavailable" && formIsValid && (
              <p className=" rounded-md p-2 text-sm w-52 bg-green-50/80 text-green-700/70">
                Don't forget to choose Available to start getting bookings
              </p>
            )}
          </>
        )}
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
