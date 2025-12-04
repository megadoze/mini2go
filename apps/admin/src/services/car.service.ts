import { supabase } from "@/lib/supabase";
import type { Brand } from "@/types/brand";
import type { Car } from "@/types/car";
import type { CarExtraWithMeta } from "@/types/carExtra";
import type { CarWithRelations } from "@/types/carWithRelations";
import type { Extra } from "@/types/extra";
import type { Feature } from "@/types/feature";
import type { CarUpdatePayload } from "@/types/сarUpdatePayload";

const carCache = new Map<string, any>();

function toCamelCar(raw: any) {
  const model = Array.isArray(raw.model) ? raw.model[0] : raw.model;
  const brands = model
    ? Array.isArray(model.brands)
      ? model.brands[0]
      : model.brands
    : null;

  const location = Array.isArray(raw.location) ? raw.location[0] : raw.location;

  const ownerProfileRaw = Array.isArray(raw.owner_profile)
    ? raw.owner_profile[0]
    : raw.owner_profile;

  return {
    id: raw.id,
    vin: raw.vin ?? null,
    year: raw.year != null ? Number(raw.year) : null,

    licensePlate: raw.license_plate ?? raw.licensePlate ?? null,
    fuelType: raw.fuel_type ?? raw.fuelType ?? null,
    transmission: raw.transmission ?? null,
    seats: raw.seats != null ? Number(raw.seats) : null,
    engineCapacity: raw.engine_capacity ?? raw.engineCapacity ?? null,
    bodyType: raw.body_type ?? raw.bodyType ?? null,
    driveType: raw.drive_type ?? raw.driveType ?? null,
    color: raw.color ?? null,
    doors: raw.doors != null ? Number(raw.doors) : null,

    model: model
      ? { id: model.id, name: model.name, brand_id: model.brand_id, brands }
      : null,
    location: location ?? null,

    address: raw.address ?? "",
    lat: raw.lat ?? raw.latitude ?? null,
    long: raw.long ?? raw.longitude ?? null,
    pickupInfo: raw.pickupInfo ?? raw.pickup_info ?? "",
    returnInfo: raw.returnInfo ?? raw.return_info ?? "",

    isDelivery: raw.isDelivery ?? raw.is_delivery ?? false,
    deliveryFee: raw.deliveryFee ?? raw.delivery_fee ?? 0,
    includeMileage: raw.includeMileage ?? raw.include_mileage ?? 0,

    price: raw.price ?? null,
    deposit: raw.deposit ?? null,

    currency: raw.currency ?? null,
    openTime: raw.open_time ?? raw.openTime ?? undefined,
    closeTime: raw.close_time ?? raw.closeTime ?? undefined,
    minRentPeriod: raw.min_rent_period ?? raw.minRentPeriod ?? undefined,
    maxRentPeriod: raw.max_rent_period ?? raw.maxRentPeriod ?? undefined,
    intervalBetweenBookings:
      raw.interval_between_bookings ?? raw.intervalBetweenBookings ?? undefined,
    ageRenters: raw.age_renters ?? raw.ageRenters ?? undefined,
    minDriverLicense:
      raw.min_driver_license ?? raw.minDriverLicense ?? undefined,
    isInstantBooking:
      raw.is_instant_booking ?? raw.isInstantBooking ?? undefined,
    isSmoking: raw.is_smoking ?? raw.isSmoking ?? undefined,
    isPets: raw.is_pets ?? raw.isPets ?? undefined,
    isAbroad: raw.is_abroad ?? raw.isAbroad ?? undefined,

    photos: raw.photos ?? [],
    coverPhotos: raw.cover_photos ?? raw.coverPhotos ?? [],
    galleryPhotos: raw.gallery_photos ?? raw.galleryPhotos ?? [],
    videoPoster: raw.video_poster ?? raw.videoPoster ?? null,
    videoUrl: raw.video_url ?? raw.videoUrl ?? null,

    content: raw.content ?? "",
    status: raw.status ?? "",

    // хозяин
    ownerLabel: raw.owner ?? null,
    ownerId: raw.owner_id ?? null,
    ownerProfile: ownerProfileRaw ?? null,
  };
}

function carCamelToSnake(input: CarUpdatePayload) {
  return {
    vin: input.vin,
    model_id: input.modelId,
    year: input.year,
    fuel_type: input.fuelType,
    transmission: input.transmission,
    seats: input.seats,
    license_plate: input.licensePlate,
    engine_capacity: input.engineCapacity,
    status: input.status,
    body_type: input.bodyType,
    drive_type: input.driveType,
    color: input.color,
    doors: input.doors,
    photos: input.photos,

    cover_photos: input.coverPhotos,
    gallery_photos: input.galleryPhotos,
    video_poster: input.videoPoster,
    video_url: input.videoUrl,

    content: input.content,
    location_id: input.locationId,
    lat: input.lat,
    long: input.long,
    address: input.address,
    pickup_info: input.pickupInfo,
    return_info: input.returnInfo,
    is_delivery: input.isDelivery,
    delivery_fee: input.deliveryFee,
    include_mileage: input.includeMileage,
    price: input.price,
    deposit: input.deposit,
    currency: input.currency,
    open_time: input.openTime,
    close_time: input.closeTime,
    min_rent_period: input.minRentPeriod,
    max_rent_period: input.maxRentPeriod,
    interval_between_bookings: input.intervalBetweenBookings,
    age_renters: input.ageRenters,
    min_driver_license: input.minDriverLicense,
    is_instant_booking: input.isInstantBooking,
    is_smoking: input.isSmoking,
    is_pets: input.isPets,
    is_abroad: input.isAbroad,
  };
}

const CARS_BASE_SELECT = `
  id,
  vin,
  model_id,
  year,
  license_plate,
  created_at,
  location_id,
  models(name, brands(name)),
  body_type,
  fuel_type,
  transmission,
  locations(name, countries(id, name)),
  status,
  photos,
  cover_photos,
  gallery_photos,
  video_poster,
  video_url,
  address,
  lat,
  long,
  pickup_info,
  return_info,
  is_delivery, 
  delivery_fee, 
  include_mileage, 
  price, 
  deposit,
  owner,
  owner_id 
`;

function mapCarRow(car: any): CarWithRelations {
  const modelArray = car.models;
  const model = Array.isArray(modelArray) ? modelArray[0] : modelArray;

  const brandArray = model?.brands;
  const brand = Array.isArray(brandArray) ? brandArray[0] : brandArray;

  const locationArr = car.locations;
  const location = Array.isArray(locationArr) ? locationArr[0] : locationArr;

  const countryArr = location?.countries;
  const country = Array.isArray(countryArr)
    ? countryArr[0]
    : locationArr?.countries;

  return {
    id: car.id,
    vin: car.vin,
    year: Number(car.year),
    licensePlate: car.license_plate,
    modelId: car.model_id,
    models: {
      name: model?.name || "—",
      brands: {
        name: brand?.name || "—",
      },
    },
    locations: {
      name: location?.name || "-",
      countries: {
        name: country?.name || "-",
        id: country?.id || "-",
      },
    },
    bodyType: car.body_type,
    fuelType: car.fuel_type,
    transmission: car.transmission,
    status: car.status,
    photos: car.photos || [],
    coverPhotos: car.cover_photos || [],
    galleryPhotos: car.gallery_photos || [],
    videoPoster: car.video_poster || null,
    videoUrl: car.video_url || null,
    address: car.address || "",
    lat: car.lat ?? null,
    long: car.long ?? null,
    pickupInfo: car.pickup_info || "",
    returnInfo: car.return_info || "",
    isDelivery: car.is_delivery || false,
    deliveryFee: car.delivery_fee || 0,
    includeMileage: car.include_mileage || 100,
    price: car.price || 0,
    currency: car.currency || "",
    deposit: car.deposit || 0,
    owner: car.owner || "",
    ownerId: car.owner_id ?? null,
    openTime: car.open_time || null,
    closeTime: car.close_time || null,
    minRentPeriod: car.min_rent_period || null,
    maxRentPeriod: car.max_rent_period || null,
    intervalBetweenBookings: car.interval_between_bookings || null,
  };
}

// Получение списка марок авто
export async function fetchBrands(): Promise<Brand[]> {
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

// Получение списка моделей конкретной марки авто
export async function fetchModelsByBrand(brandId: string) {
  const { data, error } = await supabase
    .from("models")
    .select("*")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchCarsPage(opts: {
  limit: number;
  offset: number;
  countryId?: string | null;
  locationName?: string | null;
  brandOrModel?: string | null;
}): Promise<{ items: CarWithRelations[]; count: number }> {
  const { limit, offset, countryId, locationName, brandOrModel } = opts;

  let q = supabase.from("cars").select(
    `
        id,
        vin,
        model_id,
        year,
        license_plate,
        created_at,
        location_id,
        models(name, brands(name)),
        body_type,
        fuel_type,
        transmission,
        locations(name, countries(id, name)),
        status,
        photos,
        cover_photos,
        gallery_photos,
        video_poster,
        video_url,
        address,
        lat,
        long,
        pickup_info,
        return_info,
        is_delivery,
        delivery_fee,
        include_mileage,
        price,
        currency,
        open_time,
        close_time,
        min_rent_period,
        max_rent_period,
        interval_between_bookings,
        deposit,
        owner,
        owner_id
      `,
    { count: "exact", head: false }
  );

  // фильтр по стране
  if (countryId) {
    // у тебя страна лежит в locations.countries.id
    // в supabase через RPC это проще, но можно и так:
    // если у тебя в таблице cars уже есть country_id — используй .eq("country_id", countryId)
    q = q.eq("locations.countries.id", countryId);
  }

  // фильтр по локации (по имени)
  if (locationName) {
    q = q.ilike("locations.name", `%${locationName}%`);
  }

  // фильтр по марке/модели
  if (brandOrModel) {
    const v = brandOrModel.trim();
    // supabase не умеет OR по json-реляциям в одной строке красиво,
    // поэтому чаще делают view или отдельный rpc.
    // Сделаем самый простой вариант: по модели
    q = q.or(`models.name.ilike.%${v}%,models.brands.name.ilike.%${v}%`, {
      foreignTable: "models",
    });
  }

  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const items = (data ?? []).map(mapCarRow);

  return { items, count: count ?? items.length };
}

// Получение авто хоста (постранично)
export async function fetchCarsPageByHost(opts: {
  ownerId: string;
  limit: number;
  offset: number;
}): Promise<{ items: CarWithRelations[]; count: number }> {
  const { ownerId, limit, offset } = opts;

  const { data, error, count } = await supabase
    .from("cars")
    .select(CARS_BASE_SELECT, { count: "exact", head: false })
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const items = (data ?? []).map(mapCarRow);
  return { items, count: count ?? items.length };
}

// Получение авто хоста
export async function fetchCarsByHost(
  ownerId: string
): Promise<CarWithRelations[]> {
  const { data, error } = await supabase
    .from("cars")
    .select(CARS_BASE_SELECT)
    .eq("owner_id", ownerId)
    .throwOnError();

  if (error) throw error;
  if (!data) return [];
  return data.map(mapCarRow);
}

export type NewCar = Omit<
  Car,
  "id" | "address" | "pickupInfo" | "returnInfo" | "created_at"
>;

// Добавление нового авто
export async function addCar(car: Partial<NewCar>): Promise<{
  id: string;
}> {
  const { data, error } = await supabase
    .from("cars")
    .insert(car)
    .select("id") // минимально
    .single(); // ожидаем 1 строку

  if (error) throw error;

  const { error: refreshError } = await supabase.rpc(
    "refresh_locations_is_active"
  );

  if (refreshError) {
    console.error("Failed to refresh locations.is_active", refreshError);
  }
  return data!;
}

export async function fetchCarById(id: string) {
  if (carCache.has(id)) return carCache.get(id);

  const { data, error } = await supabase
    .from("cars")
    .select(
      `
      *,
      model:models(id, name, brand_id, brands(*)),
      owner_profile:profiles(id, full_name, email),
      location:locations(*, country_id)
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  const camel = toCamelCar(data);
  carCache.set(id, camel);
  return camel;
}

//Удаление авто
export async function deleteCar(carId: string) {
  const { error } = await supabase.from("cars").delete().eq("id", carId);

  if (error) {
    throw new Error("Ошибка при удалении автомобиля: " + error.message);
  }

  const { error: refreshError } = await supabase.rpc(
    "refresh_locations_is_active"
  );

  if (refreshError) {
    console.error("Failed to refresh locations.is_active", refreshError);
  }
}

// Обновление данных авто
export async function updateCar(id: string, data: CarUpdatePayload) {
  const snakeData = carCamelToSnake(data);

  const { error } = await supabase.from("cars").update(snakeData).eq("id", id);

  if (error) throw error;

  const { error: refreshError } = await supabase.rpc(
    "refresh_locations_is_active"
  );

  if (refreshError) {
    console.error("Failed to refresh locations.is_active", refreshError);
  }

  carCache.delete(id);
}

// Загрузка фото авто
export async function uploadCarPhotos(files: File[], carId: string) {
  const uploadedUrls: string[] = [];

  for (const file of files) {
    if (!file || !(file instanceof File)) {
      console.error("Некорректный файл:", file);
      throw new Error("Некорректный файл для загрузки");
    }

    const fileExt = file.name.split(".").pop();
    const filePath = `cars/${carId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}.${fileExt}`;

    const { error } = await supabase.storage
      .from("car-photos")
      .upload(filePath, file);

    if (error) {
      console.error("Ошибка Supabase Storage:", error);
      throw new Error("Ошибка при загрузке изображения");
    }

    const { data: publicUrlData } = supabase.storage
      .from("car-photos")
      .getPublicUrl(filePath);

    if (publicUrlData?.publicUrl) {
      uploadedUrls.push(publicUrlData.publicUrl);
    }
  }

  return uploadedUrls;
}

// Загрузка видео авто
export async function uploadCarVideo(file: File, carId: string) {
  if (!file || !(file instanceof File)) {
    console.error("Некорректный файл видео:", file);
    throw new Error("Некорректный файл для загрузки видео");
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `cars/${carId}/video-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.${fileExt}`;

  const { error } = await supabase.storage
    .from("car-videos")
    .upload(filePath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Ошибка Supabase Storage (video):", error);
    throw new Error("Ошибка при загрузке видео");
  }

  const { data: publicUrlData } = supabase.storage
    .from("car-videos")
    .getPublicUrl(filePath);

  if (!publicUrlData?.publicUrl) {
    throw new Error("Не удалось получить public URL для видео");
  }

  return publicUrlData.publicUrl as string;
}

export function extractStoragePath(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);

    const match = url.pathname.match(/\/object\/public\/car-videos\/(.+)$/);

    if (!match || !match[1]) {
      console.warn("extractStoragePath: no match for", url.pathname);
      return null;
    }

    // на всякий случай декодируем (если было car-videos%2F...)
    return decodeURIComponent(match[1]);
  } catch (e) {
    console.error("extractStoragePath error:", e);
    return null;
  }
}

export async function deleteCarVideoByUrl(publicUrl: string) {
  if (!publicUrl || !publicUrl.startsWith("http")) {
    console.warn("[deleteCarVideoByUrl] expected full URL, got:", publicUrl);
    return;
  }

  const path = extractStoragePath(publicUrl);
  // console.log("[deleteCarVideoByUrl] path =", path);

  if (!path) return;

  const { error } = await supabase.storage.from("car-videos").remove([path]);

  // console.log("[deleteCarVideoByUrl] remove result:", { path, data, error });

  if (error) {
    console.error("Ошибка удаления видео:", error);
  }
}

// Обновление медиа у авто
export async function updateCarPhotos(
  carId: string,
  media: {
    coverPhotos: string[];
    galleryPhotos: string[];
    videoPoster: string | null;
    videoUrl?: string | null;
  }
) {
  const { error } = await supabase
    .from("cars")
    .update({
      cover_photos: media.coverPhotos,
      gallery_photos: media.galleryPhotos,
      video_poster: media.videoPoster,
      video_url: media.videoUrl ?? null,
    })
    .eq("id", carId);

  if (error) throw error;
  carCache.delete(carId);
}

// Получение всех доступных опций авто
export async function fetchFeatures(): Promise<Feature[]> {
  const { data, error } = await supabase.from("features").select("*");

  if (error) {
    console.error("Ошибка при загрузке фич:", error);
    throw error;
  }

  return data ?? [];
}

// Загрузка опций конретного авто
export async function fetchCarFeatures(carId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("car_features")
    .select("feature_id")
    .eq("car_id", carId);

  if (error) throw error;

  return data.map((item) => item.feature_id);
}

// Обновление опций авто
export async function updateCarFeatures(carId: string, featureIds: string[]) {
  // Удаляем все старые связи
  const { error: deleteError } = await supabase
    .from("car_features")
    .delete()
    .eq("car_id", carId);

  if (deleteError) throw deleteError;

  // Добавляем новые связи
  const inserts = featureIds.map((featureId) => ({
    car_id: carId,
    feature_id: featureId,
  }));

  const { error: insertError } = await supabase
    .from("car_features")
    .insert(inserts);

  if (insertError) throw insertError;
}

// Получение всех extras
export async function fetchExtras(): Promise<Extra[]> {
  const { data, error } = await supabase.from("extras").select("*");

  if (error) {
    console.error("Ошибка при загрузке фич:", error);
    throw error;
  }

  return data ?? [];
}

type ExtraDetails = {
  id: string;
  name: string;
  description: string;
  price_type: "per_day" | "per_rental" | "per_unit";
  is_active: boolean;
};

// Получение extras авто
export async function fetchCarExtras(
  carId: string
): Promise<CarExtraWithMeta[]> {
  const { data, error } = await supabase
    .from("car_extras")
    .select(
      `
      extra_id,
      price,
      extras (
        id,
        name,
        description,
        price_type,
        is_active
      )
    `
    )
    .eq("car_id", carId);

  if (error || !data) throw error ?? new Error("No data");

  const result: CarExtraWithMeta[] = data.map((item) => {
    const extra: ExtraDetails = Array.isArray(item.extras)
      ? (item.extras[0] as ExtraDetails)
      : (item.extras as ExtraDetails);

    return {
      extra_id: item.extra_id as string,
      price: Number(item.price),
      is_available: true,
      meta: {
        id: extra.id,
        name: extra.name,
        description: extra.description,
        price_type: extra.price_type,
        is_active: extra.is_active,
      },
    };
  });

  return result;
}

// Обновляем авто с extras
export async function upsertCarExtra({
  car_id,
  extra_id,
  price,
  is_available,
}: {
  car_id: string;
  extra_id: string;
  price: number;
  is_available: boolean;
}) {
  if (!is_available) {
    const { error } = await supabase
      .from("car_extras")
      .delete()
      .eq("car_id", car_id)
      .eq("extra_id", extra_id);
    if (error) throw error;
    carCache.delete(car_id); // ♻️
    return;
  }
  const { error } = await supabase
    .from("car_extras")
    .upsert({ car_id, extra_id, price }, { onConflict: "car_id,extra_id" });
  if (error) throw error;
  carCache.delete(car_id); // ♻️
}

// 👉 Изменение статуса (available | unavailable)
// car.service.ts
export async function updateCarStatus(
  id: string,
  status: "available" | "blocked"
) {
  const { error } = await supabase.from("cars").update({ status }).eq("id", id);

  if (error) throw error;

  carCache.delete(id);

  return { id, status };
}
