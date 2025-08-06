import { useEffect, useState } from "react";
import {
  fetchBrands,
  fetchModelsByBrand,
  addCar,
  uploadCarPhotos,
} from "@/services/car.service";
import { supabase } from "@/lib/supabase";
import {
  fuelTypes,
  transmissions,
  bodyTypes,
  optionsOwnerCar,
} from "@/constants/carOptions";
import type { Brand } from "@/types/brand";
import type { Model } from "@/types/model";
import { useNavigate } from "react-router-dom";
import {
  Map,
  Marker,
  FullscreenControl,
  ScaleControl,
  NavigationControl,
  GeolocateControl,
} from "react-map-gl/mapbox";
import Pin from "@/components/pin";
import { AddressAutofill } from "@mapbox/search-js-react";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchAddressFromCoords } from "../car/location/geo.service";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Checkbox } from "@mantine/core";

type MapboxFeature = {
  place_type?: string[];
  place_name?: string;
  geometry: {
    coordinates: [number, number];
  };
  properties: {
    [key: string]: any;
    full_address?: string;
  };
};

type AddressAutofillWrapperProps = {
  accessToken: string;
  onRetrieve?: (event: { features: MapboxFeature[]; query: string }) => void;
  browserAutofillEnabled?: boolean;
  children?: React.ReactNode;
};

const AddressAutofillWrapper =
  AddressAutofill as React.FC<AddressAutofillWrapperProps>;

export default function AddCarWizard() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    owner: "",
    vin: "",
    brandId: "",
    modelId: "",
    year: "",
    fuelType: "",
    bodyType: "",
    transmission: "",
    licensePlate: "",
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

  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);

  const [loading, setLoading] = useState(false);

  const nextStep = () => setStep((s) => Math.min(s + 1, 6));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const handleChange = (field: keyof typeof form, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    fetchBrands().then(setBrands).catch(console.error);
  }, []);

  useEffect(() => {
    if (form.brandId) {
      fetchModelsByBrand(form.brandId).then(setModels).catch(console.error);
    } else {
      setModels([]);
    }
  }, [form.brandId]);

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
      },
      (err) => {
        console.warn("Geolocation error", err);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        vin: form.vin,
        model_id: form.modelId,
        year: form.year ? Number(form.year) : null,
        fuel_type: form.fuelType || null,
        transmission: form.transmission || null,
        license_plate: form.licensePlate || null,
        location_id: form.locationId || null,
        address: form.address,
        lat: form.lat,
        long: form.long,
        body_type: form.bodyType || null,
        price: form.price ? Number(form.price) : 0,
        photos: [],
        status: "available",
      };

      const result = await addCar(payload);

      if (!result || !result[0]?.id) {
        throw new Error("Ошибка добавления авто");
      }

      const carId = result[0].id;

      let uploadedUrls: string[] = [];
      if (form.photos.length) {
        uploadedUrls = await uploadCarPhotos(form.photos, carId);
      }

      if (uploadedUrls.length) {
        await supabase
          .from("cars")
          .update({ photos: uploadedUrls })
          .eq("id", carId);
      }

      toast.success("Car is added!");
      navigate("/cars");
    } catch (e) {
      console.error(e);
      alert("Ошибка при сохранении");
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = (s: number) => {
    switch (s) {
      case 1:
        return !!form.owner;
      case 2:
        return (
          !!form.vin &&
          !!form.brandId &&
          !!form.modelId &&
          !!form.year &&
          !!form.licensePlate
        );
      case 3:
        return !!form.address && !!form.lat && !!form.long;
      case 4:
        return !!form.price && Number(form.price) > 0;
      case 5:
        return form.photos.length > 0;
      case 6:
        return form.agreed;
      default:
        return false;
    }
  };

  const steps = [
    { title: "Владелец", key: "owner" },
    { title: "Тех. данные", key: "vin" },
    { title: "Адрес", key: "address" },
    { title: "Цена", key: "price" },
    { title: "Фото", key: "photos" },
    { title: "Согласие", key: "agreed" },
  ];

  return (
    <div className="max-w-xl mx-auto p-0">
      <h1 className="text-2xl font-semibold text-gray-900">List your car</h1>
      <div className="bg-slate-100 h-2 rounded shadow-inner overflow-hidden mt-10">
        <div
          className="h-full bg-violet-600 transition-all duration-300"
          style={{
            width: `${(step / steps.length) * 100}%`,
          }}
        />
      </div>

      {/* <div className="flex items-center justify-between gap-2 mb-6">
        {steps.map((s, index) => (
          <div
            key={index}
            className={`flex-1 text-center py-1 px-2 rounded text-xs font-medium border ${
              step === index + 1
                ? "bg-violet-600 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {index + 1}. {s.title}
          </div>
        ))}
      </div> */}

      <div className="text-right font-bold mt-4 mb-4">Step {step} / 6</div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.2 }}
        >
          {step === 1 && (
            <div>
              <p className="font-bold text-lg">Who owns the car?</p>
              {optionsOwnerCar.map((v) => (
                <label key={v.name} className="block mt-2 cursor-pointer">
                  <input
                    type="radio"
                    name={v.name}
                    value={v.value}
                    checked={form.owner === v.value}
                    onChange={(e) => handleChange("owner", e.target.value)}
                    className="mr-3"
                  />
                  {v.label}
                </label>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <input
                placeholder="VIN"
                className="border p-2 w-full"
                value={form.vin}
                onChange={(e) => handleChange("vin", e.target.value)}
              />
              <select
                className="border p-2 w-full"
                value={form.brandId}
                onChange={(e) => handleChange("brandId", e.target.value)}
              >
                <option value="">Выбери бренд</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <select
                className="border p-2 w-full"
                value={form.modelId}
                onChange={(e) => handleChange("modelId", e.target.value)}
                disabled={!form.brandId}
              >
                <option value="">Выбери модель</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Год выпуска"
                className="border p-2 w-full"
                value={form.year}
                onChange={(e) => handleChange("year", e.target.value)}
                type="number"
              />
              <select
                className="border p-2 w-full"
                value={form.fuelType}
                onChange={(e) => handleChange("fuelType", e.target.value)}
              >
                <option value="">Тип топлива</option>
                {fuelTypes.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <select
                className="border p-2 w-full"
                value={form.bodyType}
                onChange={(e) => handleChange("bodyType", e.target.value)}
              >
                <option value="">Тип авто</option>
                {bodyTypes.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <select
                className="border p-2 w-full"
                value={form.transmission}
                onChange={(e) => handleChange("transmission", e.target.value)}
              >
                <option value="">Коробка</option>
                {transmissions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                placeholder="Гос. номер"
                className="border p-2 w-full"
                value={form.licensePlate}
                onChange={(e) => handleChange("licensePlate", e.target.value)}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="font-bold text-lg">Местоположение авто</p>

              <div className="h-60 rounded-xl overflow-hidden">
                <Map
                  initialViewState={{
                    latitude: form.lat ?? 50.45,
                    longitude: form.long ?? 30.52,
                    zoom: 12,
                  }}
                  style={{ width: "100%", height: "100%" }}
                  mapStyle="mapbox://styles/megadoze/cldamjew5003701p5mbqrrwkc"
                  mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
                >
                  <Marker
                    longitude={form.long ?? 30.52}
                    latitude={form.lat ?? 50.45}
                    draggable
                    onDragEnd={async (e) => {
                      const { lat, lng } = e.lngLat;

                      console.log("📍 New coords:", lat, lng);

                      handleChange("lat", lat);
                      handleChange("long", lng);

                      const res = await fetchAddressFromCoords(lat, lng);
                      console.log("🌍 Address result:", res);

                      if (!res) return;

                      handleChange("address", res.address);
                      handleChange("countryName", res.country);
                      handleChange("cityName", res.city);
                    }}
                  >
                    <Pin />
                  </Marker>

                  <GeolocateControl
                    trackUserLocation
                    showUserHeading
                    onGeolocate={async (pos) => {
                      const lat = pos.coords.latitude;
                      const lng = pos.coords.longitude;

                      handleChange("lat", lat);
                      handleChange("long", lng);

                      const res = await fetchAddressFromCoords(lat, lng);
                      if (!res) return;

                      handleChange("address", res.address);
                      handleChange("countryName", res.country);
                      handleChange("cityName", res.city);
                    }}
                  />

                  <NavigationControl />
                  <ScaleControl />
                  <FullscreenControl />
                </Map>
              </div>

              <AddressAutofillWrapper
                accessToken={import.meta.env.VITE_MAPBOX_TOKEN}
                onRetrieve={async (res) => {
                  const f = res.features?.[0];
                  if (!f?.geometry?.coordinates) return;

                  const [lng, lat] = f.geometry.coordinates;

                  handleChange("lat", lat);
                  handleChange("long", lng);

                  const addr = await fetchAddressFromCoords(lat, lng);
                  if (!addr) return;

                  handleChange("address", addr.address);
                  handleChange("countryName", addr.country);
                  handleChange("cityName", addr.city);
                }}
              >
                <input
                  name="address"
                  id="address"
                  type="text"
                  value={form.address || ""}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="Введите адрес"
                  autoComplete="address-line1"
                  className="border w-full p-2 mt-2"
                />
              </AddressAutofillWrapper>

              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  Страна:{" "}
                  <span className="font-semibold">
                    {form.countryName || "—"}
                  </span>
                </p>
                <p>
                  Город:{" "}
                  <span className="font-semibold">{form.cityName || "—"}</span>
                </p>
                {/* <p>
                  Координаты:{" "}
                  <span className="font-mono">
                    {form.lat?.toFixed(5) || "—"},{" "}
                    {form.long?.toFixed(5) || "—"}
                  </span>
                </p> */}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <input
                placeholder="Цена за сутки ($)"
                type="number"
                className="border p-2 w-full"
                value={form.price}
                onChange={(e) => handleChange("price", e.target.value)}
              />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) {
                    handleChange("photos", [
                      ...form.photos,
                      ...Array.from(files),
                    ]);
                  }
                }}
              />
              {form.photos.map((file, i) => (
                <img
                  key={i}
                  src={URL.createObjectURL(file)}
                  className="h-32 object-cover rounded"
                  alt="preview"
                />
              ))}
            </div>
          )}

          {step === 6 && (
            <div>
              <Checkbox
                checked={form.agreed}
                label="Я соглашаюсь с условиями размещения"
                onChange={(e) =>
                  handleChange("agreed", e.currentTarget.checked)
                }
                size="md"
                color="black"
                radius="md"
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-between pt-6">
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
        {step < 6 ? (
          <button
            onClick={nextStep}
            disabled={!isStepValid(step)}
            className={`w-20 py-3 rounded-2xl ${
              isStepValid(step)
                ? "bg-violet-500 text-white"
                : "bg-gray-100 text-gray-500 cursor-not-allowed"
            }`}
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="bg-violet-600 text-white px-4 py-3 rounded-2xl w-20"
            disabled={!form.agreed || loading}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}
