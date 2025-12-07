"use client";

import { getSupabaseClient } from "@/lib/supabase";
import type { Brand } from "@/types/brand";
import type { Car } from "@/types/car";
import type { CarExtraWithMeta } from "@/types/carExtra";
import type { CarWithRelations } from "@/types/carWithRelations";
import type { Extra } from "@/types/extra";
import type { CarUpdatePayload } from "@/types/сarUpdatePayload";

// маленький хелпер, чтобы не копипастить
function requireSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "[car.service] Supabase client is not available (no NEXT_PUBLIC_SUPABASE_URL / KEY or called on server)"
    );
  }
  return supabase;
}

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
    year: car.year != null ? Number(car.year) : null,
    licensePlate: car.license_plate,
    modelId: car.model_id,

    bodyType: car.body_type,
    fuelType: car.fuel_type,
    transmission: car.transmission,
    status: car.status,

    // 🔥 медиа
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
    deposit: car.deposit || 0,
    currency: car.currency ?? null,

    openTime: car.open_time || null,
    closeTime: car.close_time || null,
    minRentPeriod: car.min_rent_period || null,
    maxRentPeriod: car.max_rent_period || null,
    intervalBetweenBookings: car.interval_between_bookings || null,

    owner: car.owner || "",
    ownerId: car.owner_id ?? null,

    models: {
      name: model?.name || "—",
      brands: {
        name: brand?.name || "—",
      },
    },
    locations: location
      ? {
          name: location?.name || "-",
          countries: {
            name: country?.name || "-",
            id: country?.id || "-",
          },
        }
      : null,
  };
}

/* ====================== ПУБЛИЧНЫЕ ФУНКЦИИ ====================== */

// марки
export async function fetchBrands(): Promise<Brand[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return []; // чтобы билд не падал
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// модели по марке
export async function fetchModelsByBrand(brandId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("models")
    .select("*")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// публичный каталог
export async function fetchCarsPage(opts: {
  limit: number;
  offset: number;
  countryId?: string | null;
  locationName?: string | null;
  brandOrModel?: string | null;
}): Promise<{ items: CarWithRelations[]; count: number }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { items: [], count: 0 };
  }

  const { limit, offset, countryId, locationName, brandOrModel } = opts;

  let q = supabase
    .from("cars")
    .select(
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
    )
    .eq("status", "available");

  if (countryId) {
    q = q.eq("locations.countries.id", countryId);
  }

  if (locationName) {
    q = q.ilike("locations.name", `%${locationName}%`);
  }

  if (brandOrModel) {
    const v = brandOrModel.trim();
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

export type NewCar = Omit<
  Car,
  "id" | "address" | "pickupInfo" | "returnInfo" | "created_at"
>;

// фичи авто
export async function fetchCarFeatures(carId: string): Promise<string[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("car_features")
    .select("feature_id")
    .eq("car_id", carId);

  if (error) throw error;

  return data.map((item) => item.feature_id);
}

// все extras
export async function fetchExtras(): Promise<Extra[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("extras").select("*");

  if (error) {
    console.error("Ошибка при загрузке extras:", error);
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

// extras конкретного авто
export async function fetchCarExtras(
  carId: string
): Promise<CarExtraWithMeta[]> {
  const supabase = requireSupabase();
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
