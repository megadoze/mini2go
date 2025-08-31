import React, { useEffect, useState } from "react";
import { addCar, uploadCarPhotos } from "@/services/car.service";
import { supabase } from "@/lib/supabase";
import { optionsOwnerCar } from "@/constants/carOptions";
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
import {
  ensureCountryAndLocationExist,
  fetchAddressFromCoords,
} from "../../services/geo.service";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Anchor,
  Checkbox,
  Image,
  Loader,
  Radio,
  SimpleGrid,
  Stack,
  TextInput,
} from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import Step3 from "./step3";
import { useQueryClient } from "@tanstack/react-query";
import { QK } from "@/queryKeys";

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

type PhotoItem = {
  id: string;
  file?: File;
  url: string;
  isNew?: boolean;
};

export default function AddCarWizard() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const qc = useQueryClient();

  const [form, setForm] = useState({
    owner: "",
    vin: "",
    brandId: "",
    modelId: "",
    licensePlate: "",
    year: "",
    fuelType: "",
    transmission: "",
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
      const locationId = await ensureCountryAndLocationExist(
        form.countryName,
        form.cityName
      );

      if (!locationId) {
        toast.error("Ошибка при определении локации");
        return;
      }

      const payload = {
        vin: form.vin,
        model_id: form.modelId,
        license_plate: form.licensePlate,
        year: form.year ? Number(form.year) : null,
        fuel_type: form.fuelType || null,
        transmission: form.transmission || null,
        location_id: locationId,
        address: form.address,
        lat: form.lat,
        long: form.long,
        price: form.price ? Number(form.price) : 0,
        photos: [],
        status: "available",
        owner: form.owner,
      };

      const result = await addCar(payload);
      if (!result || !result[0]?.id) {
        throw new Error("Ошибка добавления авто");
      }

      const carId = result[0].id;

      let uploadedUrls: string[] = [];
      if (photos.length) {
        const files = photos
          .filter((p) => p.isNew && p.file)
          .map((p) => p.file as File);

        uploadedUrls = await uploadCarPhotos(files, carId);
      }

      if (uploadedUrls.length) {
        await supabase
          .from("cars")
          .update({ photos: uploadedUrls })
          .eq("id", carId);
      }

      await qc.invalidateQueries({ queryKey: QK.cars, refetchType: "all" });

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

  const cards = optionsOwnerCar.map((item) => (
    <Radio.Card
      radius="md"
      value={item.name}
      key={item.name}
      className="overflow-hidden radio-card"
    >
      <div className="p-4 flex gap-4 items-center hover:bg-gray-50 transition ease-in-out">
        <Radio.Indicator color="black" />
        <div>
          <p className=" font-medium">{item.label}</p>
          <p className=" text-sm text-gray-700">{item.description}</p>
        </div>
      </div>
    </Radio.Card>
  ));

  const MAX_PHOTOS = 3;

  const handleDropzone = (files: File[]) => {
    const availableSlots = MAX_PHOTOS - photos.length;

    if (availableSlots <= 0) {
      toast.error(`You can upload up to ${MAX_PHOTOS} photos`);
      return;
    }

    const slicedFiles = files.slice(0, availableSlots);

    const newItems: PhotoItem[] = slicedFiles.map((file, idx) => ({
      id: `new-${Date.now()}-${idx}`,
      file,
      url: URL.createObjectURL(file),
      isNew: true,
    }));

    setPhotos((prev) => [...prev, ...newItems]);
    setForm((prev) => ({
      ...prev,
      photos: [...prev.photos, ...slicedFiles],
    }));
  };

  const euPlateRegex =
    /^[A-Z]{1,3}[- ]?[A-Z]{1,2}[- ]?\d{1,4}$|^[A-Z]{2}[- ]?\d{3}[- ]?[A-Z]{2}$|^\d{4}[- ]?[A-Z]{3}$/i;

  function isValidEuPlate(plate: string) {
    return euPlateRegex.test(plate.trim().toUpperCase());
  }

  return (
    <div className="max-w-xl mx-auto p-0">
      <h1 className="text-2xl font-semibold text-gray-900">List your car</h1>
      <div className="bg-slate-100 h-2 rounded shadow-inner overflow-hidden mt-10">
        <div
          className="h-full bg-fuchsia-600 transition-all duration-300"
          style={{
            width: `${(step / steps.length) * 100}%`,
          }}
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
            <div>
              <p className="font-bold text-lg">Who owns the car?</p>
              <Radio.Group
                value={form.owner}
                onChange={(e) => handleChange("owner", e)}
              >
                <Stack pt="md" gap="xs">
                  {cards}
                </Stack>
              </Radio.Group>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="font-bold text-lg mb-2">
                Enter your license plate number
              </p>

              <TextInput
                autoFocus
                label="License Plate"
                placeholder="e.g. AB-123-CD or 1234 ABC"
                value={form.licensePlate}
                radius={0}
                onChange={(e) =>
                  handleChange(
                    "licensePlate",
                    e.currentTarget.value.toLocaleUpperCase()
                  )
                }
                error={
                  form.licensePlate && !isValidEuPlate(form.licensePlate)
                    ? "Invalid EU plate format"
                    : undefined
                }
                classNames={{
                  input:
                    "placeholder:text-gray-400, placeholder:text-base focus:border-gray-600",
                }}
                styles={{
                  input: { textAlign: "center", fontSize: "18px" },
                }}
              />

              <p className="text-sm text-gray-500 mt-2">
                The license number will be used for moderation and cannot be
                changed after publication.
              </p>
            </div>
          )}

          {step === 3 && <Step3 form={form} handleChange={handleChange} />}

          {step === 4 && (
            <div className="space-y-4">
              <p className="font-bold text-lg">
                Where is your car normally parked?
              </p>

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

                      // console.log("📍 New coords:", lat, lng);

                      handleChange("lat", lat);
                      handleChange("long", lng);

                      const addr = await fetchAddressFromCoords(lat, lng);
                      if (!addr) return;

                      handleChange("address", addr.address);
                      handleChange("countryName", addr.country);
                      handleChange("cityName", addr.city);
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

                      const addr = await fetchAddressFromCoords(lat, lng);
                      if (!addr) return;

                      handleChange("address", addr.address);
                      handleChange("countryName", addr.country);
                      handleChange("cityName", addr.city);
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
                  className=" w-full p-2 mt-2 outline-none border border-gray-300 focus:border-gray-600"
                />
              </AddressAutofillWrapper>

              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  Country:{" "}
                  <span className="font-semibold">
                    {form.countryName || "—"}
                  </span>
                </p>
                <p>
                  City:{" "}
                  <span className="font-semibold">{form.cityName || "—"}</span>
                </p>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <p className="font-bold text-lg mt-5">
                This will be your daily price
              </p>
              <p className=" text-gray-700 mt-4 mb-3">
                Our price suggestion is based on checking your specific car
                model against current market prices and demand.
              </p>
              <TextInput
                placeholder="Price per day ($)"
                type="number"
                value={form.price}
                onChange={(e) => handleChange("price", e.target.value)}
                size="md"
                radius={0}
                leftSectionPointerEvents="none"
                rightSection="EUR"
                // className=" font-semibold"
                classNames={{
                  input:
                    "placeholder:text-gray-400 placeholder:font-normal, placeholder:text-base focus:border-gray-600",
                }}
                styles={{
                  section: { color: "black", paddingRight: "10px" },
                  input: { textAlign: "center", fontSize: "18px" },
                }}
              />
              <p className=" text-gray-700 mt-5">
                We recommend that you use this price to maximize your earnings,
                but if you want to change it you can do so once you're
                successfully listed your car.
              </p>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-2">
              <p className="font-bold text-lg mt-5 mb-5">
                Upload up to 3 photos of your car
              </p>
              <Dropzone
                onDrop={handleDropzone}
                onReject={() => {
                  toast.error(`You can upload up to ${MAX_PHOTOS} photos`);
                }}
                accept={IMAGE_MIME_TYPE}
                loading={loading}
                loaderProps={{ color: "gray", type: "oval", size: "sm" }}
                multiple
                maxFiles={Math.max(0, MAX_PHOTOS - photos.length)}
                disabled={photos.length >= MAX_PHOTOS}
                className="mt-4"
              >
                <p className=" text-center">
                  {photos.length >= MAX_PHOTOS
                    ? `Max ${MAX_PHOTOS} photos uploaded`
                    : "Drag and drop images or click to select"}
                </p>
              </Dropzone>

              <SimpleGrid
                cols={{ base: 2, sm: 3 }}
                spacing="md"
                mt={photos.length > 0 ? "md" : 0}
              >
                {photos.map((item, index) => {
                  const imageUrl =
                    item.isNew && item.file
                      ? URL.createObjectURL(item.file)
                      : item.url;

                  return (
                    <div
                      key={item.id}
                      className="relative rounded overflow-hidden"
                    >
                      <Image
                        src={imageUrl}
                        alt={`preview-${index}`}
                        className="object-cover w-full h-32"
                        onLoad={() => {
                          if (item.isNew && item.file) {
                            URL.revokeObjectURL(imageUrl);
                          }
                        }}
                      />
                      <button
                        onClick={() =>
                          setPhotos((prev) =>
                            prev.filter((_, idx) => idx !== index)
                          )
                        }
                        className="absolute top-1 right-1 bg-white text-black rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-gray-100"
                        title="Удалить"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </SimpleGrid>
            </div>
          )}

          {step === 7 && (
            <>
              <p className="font-bold text-lg">One last thing!</p>
              <p className=" text-gray-600 pt-3">
                Before you can share your car with others we need you to accept
                our terms below.
              </p>
              <div className="mt-5">
                <Checkbox
                  checked={form.agreed}
                  // label={
                  //   <p className="text-gray-800">
                  //     I accept the{" "}
                  //     <span className=" text-green-500">
                  //       <Link to={""}>car rental terms</Link>{" "}
                  //     </span>{" "}
                  //     on MINI2go.
                  //   </p>
                  // }
                  label={
                    <>
                      I accept{" "}
                      <Anchor
                        href="https://mini2go.rent"
                        target="_blank"
                        inherit
                      >
                        terms and conditions
                      </Anchor>
                      on MINI2go.
                    </>
                  }
                  onChange={(e) =>
                    handleChange("agreed", e.currentTarget.checked)
                  }
                  size="md"
                  color="black"
                  radius="md"
                />
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-between mt-6">
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
