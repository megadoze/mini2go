import { useEffect, useState } from "react";
import { addCar, uploadCarPhotos } from "@/services/car.service";
import { supabase } from "@/lib/supabase";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  ensureCountryAndLocationExist,
  fetchAddressFromCoords,
} from "../../../services/geo.service";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Loader } from "@mantine/core";
import Step3 from "./step3";
import { useQueryClient } from "@tanstack/react-query";
import { QK } from "@/queryKeys";
import { XMarkIcon } from "@heroicons/react/24/outline";
import Step7 from "./step7";
import Step6 from "./step6";
import Step2 from "./step2";
import Step4 from "./step4";
import Step5 from "./step5";
import Step1 from "./step1";

type PhotoItem = {
  id: string;
  file?: File;
  url: string;
  isNew?: boolean;
};

export default function AddCarWizard() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const location = useLocation();
  const [searchParams] = useSearchParams();

  const qc = useQueryClient();

  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState({
    owner: "",
    vin: "",
    brandId: "",
    modelId: "",
    licensePlate: "",
    year: currentYear,
    fuelType: "",
    transmission: "",
    engine: "1.0",
    driveType: "",
    doors: "4",
    seats: "5",
    countryId: "",
    countryName: "",
    locationId: "",
    cityName: "",
    address: "",
    lat: null as number | null,
    long: null as number | null,
    price: "",
    photos: [] as File[],
    agreed: false,
  });

  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  // читаем возможный return из query или из state
  const returnToParam = searchParams.get("return");
  const returnFromState = (location.state as any)?.from as string | undefined;

  const handleCancel = async () => {
    // 1) явный return в URL или state
    const directReturn = returnToParam || returnFromState;
    if (directReturn) {
      navigate(directReturn, { replace: true });
      return;
    }
    // 2) если есть откуда вернуться — шагаем назад
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    // 3) умный фоллбэк по статусу хоста
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }
    const { count } = await supabase
      .from("cars")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);
    const isHost = (count ?? 0) > 0;
    navigate(isHost ? "/dashboard" : `/user/${user.id}/dashboard`, {
      replace: true,
    });
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, steps.length));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const handleChange = (field: keyof typeof form, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    const loadInitialAddress = async () => {
      if (!form.lat || !form.long) return;

      const res = await fetchAddressFromCoords(form.lat, form.long);
      if (!res) return;

      handleChange("address", res.address);
      handleChange("countryName", res.country);
      handleChange("cityName", res.city);
    };

    loadInitialAddress();
  }, [form.lat, form.long]);

  useEffect(() => {
    if (form.lat && form.long) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        handleChange("lat", latitude);
        handleChange("long", longitude);

        const addr = await fetchAddressFromCoords(latitude, longitude);
        if (!addr) return;

        handleChange("address", addr.address);
        handleChange("countryName", addr.country);
        handleChange("cityName", addr.city);
      },
      (err) => {
        console.warn("Geolocation error", err);
        toast.warning(
          "Unable to determine geolocation. Please select address manually."
        );
      },
      { enableHighAccuracy: true }
    );
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // 1) Проверяем и получаем locationId
      const locationId = await ensureCountryAndLocationExist(
        form.countryName,
        form.cityName
      );

      if (!locationId) {
        toast.error("Error while determining location");
        return;
      }

      // 2) Пользователь
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Not signed in");
        return;
      }

      const plausibleVin = isVinFormatPlausible(form.vin);
      const decodedOk = !!(form.brandId && form.modelId && form.year);

      let carStatus: string;

      if (plausibleVin && decodedOk) {
        carStatus = "unavailable"; // обычный флоу, как у тебя сейчас
      } else {
        carStatus = "pending_review"; // новый статус
      }

      // 3) Собираем payload с корректными типами (строки -> числа)
      const payload = {
        vin: form.vin,
        model_id: form.modelId,
        license_plate: form.licensePlate,
        year: form.year ? Number(form.year) : null,
        fuel_type: form.fuelType || null,
        transmission: form.transmission || null,
        engine_capacity: form.engine || null,
        drive_type: form.driveType || null,
        doors: form.doors ? Number(form.doors) : null,
        seats: form.seats ? Number(form.seats) : null,
        location_id: locationId,
        address: form.address,
        lat: form.lat,
        long: form.long,
        price: form.price ? Number(form.price) : 0,
        photos: [] as string[],
        status: carStatus,
        owner: form.owner,
        owner_id: user.id,
      };

      if (!form.modelId) {
        toast.error("Please select car model");
        setLoading(false);
        return;
      }

      // 4) Вставляем машину
      const inserted = await addCar(payload);
      const carId = inserted?.id;
      if (!inserted || !carId) {
        throw new Error("Error adding car");
      }

      // 5) Фото
      let uploadedUrls: string[] = [];
      if (photos.length) {
        const files = photos
          .filter((p) => p.isNew && p.file)
          .map((p) => p.file as File);

        if (files.length) {
          uploadedUrls = await uploadCarPhotos(files, carId);
        }
      }

      if (uploadedUrls.length) {
        await supabase
          .from("cars")
          .update({ photos: uploadedUrls })
          .eq("id", carId);
      }

      // 6) Финальный объект для кэша
      const carForCache = {
        ...inserted,
        photos: uploadedUrls.length ? uploadedUrls : [],
      };

      // 7) Моментально добавляем в кэш списков
      qc.setQueryData(QK.cars, (old: any) => {
        if (!old) return [carForCache];
        return Array.isArray(old) ? [carForCache, ...old] : old;
      });

      qc.setQueryData(QK.carsByHost(user.id), (old: any) => {
        if (!old) return [carForCache];
        return Array.isArray(old) ? [carForCache, ...old] : old;
      });

      // Для infinite-лент аккуратно кладём в первую страницу
      qc.setQueriesData(
        {
          predicate: ({ queryKey }) =>
            Array.isArray(queryKey) && String(queryKey[0]) === "carsInfinite",
        },
        (old: any) => {
          if (!old) return old;
          if (old.pages?.[0]?.items) {
            return {
              ...old,
              pages: [
                {
                  ...old.pages[0],
                  items: [carForCache, ...old.pages[0].items],
                },
                ...old.pages.slice(1),
              ],
            };
          }
          return old;
        }
      );

      // ➕ CalendarWindow: мгновенно добавить авто в все открытые окна календаря
      qc.setQueriesData(
        {
          predicate: ({ queryKey }) =>
            Array.isArray(queryKey) && String(queryKey[0]) === "calendarWindow",
        },
        (win: any) => {
          if (!win) return win;

          // Календарь ждёт CarWithBookings: { id, brand, model, license_plate, bookings: [] }
          const calCar = {
            id: carForCache.id as string,
            brand: null as string | null, // безопасно: пока нет имени — null
            model: null as string | null, // безопасно: пока нет имени — null
            license_plate: form.licensePlate || null, // берём из формы (есть всегда на шаге 2)
            bookings: [] as any[],
          };

          const exists = Array.isArray(win.cars)
            ? win.cars.some((c: any) => String(c.id) === String(calCar.id))
            : false;

          if (exists) return win;

          return {
            ...win,
            cars: [calCar, ...(win.cars ?? [])],
          };
        }
      );

      // мягкая инвалидция календарей — подтянет точные данные с бэка
      void qc.invalidateQueries({
        predicate: ({ queryKey }) =>
          Array.isArray(queryKey) && String(queryKey[0]) === "calendarWindow",
      });

      // 8) Инвалидируем остальные списки
      await qc.invalidateQueries({
        predicate: ({ queryKey }) => {
          const root = Array.isArray(queryKey) ? String(queryKey[0]) : "";
          return (
            root === QK.cars[0] ||
            root === "carsInfinite" ||
            root === "carsByHost"
          );
        },
      });

      // (необязательно) сразу перезапросить
      await qc.refetchQueries({
        predicate: ({ queryKey }) => {
          const root = Array.isArray(queryKey) ? String(queryKey[0]) : "";
          return (
            root === QK.cars[0] ||
            root === "carsInfinite" ||
            root === "carsByHost"
          );
        },
      });

      // 9) Финал
      toast.success("Car is added!");
      navigate("/cars");
    } catch (e) {
      console.error(e);
      alert("Error while saving");
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = (s: number) => {
    switch (s) {
      case 1:
        return !!form.owner;
      case 2:
        return isValidEuPlate(form.licensePlate);

      case 3:
        return !!form.vin && !!form.brandId && !!form.modelId && !!form.year;
      case 4:
        return !!form.address && !!form.lat && !!form.long;
      case 5:
        return !!form.price && Number(form.price) > 0;
      case 6:
        return photos.length > 0;
      case 7:
        return form.agreed;
      default:
        return false;
    }
  };

  const steps = [
    { title: "Владелец", key: "owner" },
    { title: "Госномер", key: "licensePlate" },
    { title: "VIN и авто", key: "vin" },
    { title: "Адрес", key: "address" },
    { title: "Цена", key: "price" },
    { title: "Фото", key: "photos" },
    { title: "Согласие", key: "agreed" },
  ];

  const effectiveStep = form.owner ? step : 0;

  const progressPct = (effectiveStep / steps.length) * 100;

  const euPlateRegex =
    /^[A-Z]{1,3}[- ]?[A-Z]{1,2}[- ]?\d{1,4}$|^[A-Z]{2}[- ]?\d{3}[- ]?[A-Z]{2}$|^\d{4}[- ]?[A-Z]{3}$/i;

  function isValidEuPlate(plate: string) {
    return euPlateRegex.test(plate.trim().toUpperCase());
  }

  return (
    <div className="mx-auto max-w-xl min-h-[100dvh] flex flex-col mt-20 p-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-roboto text-2xl font-bold">List your car</h1>
        <button
          type="button"
          onClick={handleCancel}
          className=" rounded-full p-2 text-gray-600 hover:bg-gray-100"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="bg-slate-100 h-2 rounded shadow-inner overflow-hidden mt-10">
        <div
          className="h-full bg-fuchsia-600 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="text-right font-bold mt-4 mb-4">Step {step} / 7</div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.2 }}
        >
          {step === 1 && (
            <Step1
              owner={form.owner}
              onChangeOwner={(value) => handleChange("owner", value)}
            />
          )}

          {step === 2 && (
            <Step2
              licensePlate={form.licensePlate}
              onChange={(val: string) => handleChange("licensePlate", val)}
              isValidPlate={isValidEuPlate}
            />
          )}

          {step === 3 && <Step3 form={form} handleChange={handleChange} />}

          {step === 4 && (
            <Step4
              lat={form.lat}
              long={form.long}
              address={form.address}
              countryName={form.countryName}
              cityName={form.cityName}
              onChangeField={(field, value) =>
                handleChange(field as any, value)
              }
              fetchAddressFromCoords={fetchAddressFromCoords}
              mapboxToken={import.meta.env.VITE_MAPBOX_TOKEN}
            />
          )}

          {step === 5 && (
            <Step5
              price={form.price}
              onChangePrice={(value) => handleChange("price", value)}
            />
          )}

          {step === 6 && (
            <Step6
              photos={photos}
              setPhotos={setPhotos}
              setForm={setForm}
              loading={loading}
            />
          )}

          {step === 7 && (
            <Step7 agreed={form.agreed as boolean} onChange={handleChange} />
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between mt-6">
        {step > 1 ? (
          <button
            onClick={prevStep}
            className="bg-gray-100 px-4 py-3 rounded-2xl w-20"
          >
            Prev
          </button>
        ) : (
          <div />
        )}
        {step < 7 ? (
          <button
            onClick={nextStep}
            disabled={!isStepValid(step)}
            className={`w-20 py-3 rounded-2xl ${
              isStepValid(step)
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-500 cursor-not-allowed"
            }`}
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className={`min-w-20 py-3 px-2 rounded-2xl ${
              isStepValid(step)
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-500 cursor-not-allowed"
            }`}
            disabled={!form.agreed || loading}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader size={16} color="white" />
                Adding...
              </div>
            ) : (
              "Add"
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function isVinFormatPlausible(vin: string) {
  const v = vin.trim().toUpperCase();
  if (v.length !== 17) return false;
  // VIN не должен содержать I, O, Q
  if (/[IOQ]/.test(v)) return false;
  // только буквы и цифры
  if (!/^[A-Z0-9]+$/.test(v)) return false;
  return true;
}
