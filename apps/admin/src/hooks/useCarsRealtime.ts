import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { QK } from "@/queryKeys";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

// тип строки из таблицы "cars" в realtime (snake_case как в БД)
export type RTCar = {
  id: string;
  created_at: string | null;

  vin: string | null;
  model_id: string | null;
  year: number | null;

  fuel_type: string | null;
  transmission: string | null;
  seats: number | null;
  license_plate: string | null;
  engine_capacity: number | null;

  status: string | null;
  body_type: string | null;
  drive_type: string | null;
  color: string | null;
  doors: number | null;

  photos: string[] | null;
  cover_photos: string[] | null;
  gallery_photos: string[] | null;
  video_poster: string | null;
  video_url: string | null;

  content: string | null;

  location_id: string | null;
  lat: number | null;
  long: number | null;
  address: string | null;
  pickup_info: string | null;
  return_info: string | null;

  is_delivery: boolean | null;
  delivery_fee: number | null;
  include_mileage: number | null;

  price: number | null;
  deposit: number | null;
  currency: string | null;

  open_time: string | null;
  close_time: string | null;
  min_rent_period: number | null;
  max_rent_period: number | null;
  interval_between_bookings: number | null;

  age_renters: number | null;
  min_driver_license: number | null;

  is_instant_booking: boolean | null;
  is_smoking: boolean | null;
  is_pets: boolean | null;
  is_abroad: boolean | null;

  owner: string | null;
  owner_id: string | null;
};

export function useCarsRealtime(
  onCarPatched?: (id: string, patch: any) => void
) {
  const qc = useQueryClient();

  useEffect(() => {
    const topic = "cars-realtime";

    // подчистим старый канал с тем же именем
    for (const c of supabase.getChannels()) {
      if (c.topic === topic) supabase.removeChannel(c);
    }

    const isCarsList = (q: any) =>
      Array.isArray(q.queryKey) &&
      (q.queryKey[0] === QK.cars[0] || q.queryKey[0] === QK.carsByHost("_")[0]);

    const ch = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cars" },
        (payload: RealtimePostgresChangesPayload<RTCar>) => {
          const event = payload.eventType;

          // ---------- DELETE ----------
          if (event === "DELETE") {
            const row = payload.old as RTCar;
            const id = String(row.id);

            // списки машин — фильтруем по id
            qc.setQueriesData(
              { predicate: isCarsList },
              (list: any[] | undefined) =>
                Array.isArray(list)
                  ? list.filter((c) => String(c.id) !== id)
                  : list
            );

            // деталку просто инвалидируем
            qc.invalidateQueries({ queryKey: QK.car(id) });
            return;
          }

          // ---------- INSERT ----------
          if (event === "INSERT") {
            const row = payload.new as RTCar;
            const id = String(row.id);

            // самый честный путь — рефетч списка
            qc.invalidateQueries({ queryKey: QK.cars });
            // можно вообще ничего не делать с setQueriesData — оставляем как есть
            qc.setQueriesData({ predicate: isCarsList }, (list: any) => list);

            onCarPatched?.(id, {}); // если нужно — можно пробросить
            return;
          }

          // ---------- UPDATE ----------
          if (event === "UPDATE") {
            const row = payload.new as RTCar;
            const id = String(row.id);

            // 👇 ВАЖНО: НЕ {...row} !
            const patch: any = {};

            // простые поля, которые точно есть/могут пригодиться
            if (row.status !== undefined) patch.status = row.status;
            if (row.price !== undefined && row.price !== null)
              patch.price = row.price;
            if (row.deposit !== undefined && row.deposit !== null)
              patch.deposit = row.deposit;
            if (row.currency !== undefined && row.currency !== null)
              patch.currency = row.currency;

            if (row.include_mileage !== undefined)
              patch.includeMileage = row.include_mileage;

            if (row.is_delivery !== undefined)
              patch.isDelivery = row.is_delivery;
            if (row.delivery_fee !== undefined)
              patch.deliveryFee = row.delivery_fee;

            if (row.license_plate !== undefined)
              patch.licensePlate = row.license_plate;
            if (row.body_type !== undefined) patch.bodyType = row.body_type;
            if (row.fuel_type !== undefined) patch.fuelType = row.fuel_type;
            if (row.drive_type !== undefined) patch.driveType = row.drive_type;
            if (row.engine_capacity !== undefined)
              patch.engineCapacity = row.engine_capacity;

            if (row.open_time !== undefined) patch.openTime = row.open_time;
            if (row.close_time !== undefined) patch.closeTime = row.close_time;

            if (row.min_rent_period !== undefined)
              patch.minRentPeriod = row.min_rent_period;
            if (row.max_rent_period !== undefined)
              patch.maxRentPeriod = row.max_rent_period;
            if (row.interval_between_bookings !== undefined)
              patch.intervalBetweenBookings = row.interval_between_bookings;

            if (row.age_renters !== undefined)
              patch.ageRenters = row.age_renters;
            if (row.min_driver_license !== undefined)
              patch.minDriverLicense = row.min_driver_license;

            if (row.is_instant_booking !== undefined)
              patch.isInstantBooking = row.is_instant_booking;
            if (row.is_smoking !== undefined) patch.isSmoking = row.is_smoking;
            if (row.is_pets !== undefined) patch.isPets = row.is_pets;
            if (row.is_abroad !== undefined) patch.isAbroad = row.is_abroad;

            if (row.photos !== undefined && row.photos !== null)
              patch.photos = row.photos;
            if (row.cover_photos !== undefined && row.cover_photos !== null)
              patch.coverPhotos = row.cover_photos;
            if (row.gallery_photos !== undefined && row.gallery_photos !== null)
              patch.galleryPhotos = row.gallery_photos;
            if (row.video_poster !== undefined)
              patch.videoPoster = row.video_poster;
            if (row.video_url !== undefined) patch.videoUrl = row.video_url;

            if (row.address !== undefined) patch.address = row.address;
            if (row.pickup_info !== undefined)
              patch.pickupInfo = row.pickup_info;
            if (row.return_info !== undefined)
              patch.returnInfo = row.return_info;

            if (row.lat !== undefined) patch.lat = row.lat;
            if (row.long !== undefined) patch.long = row.long;

            if (row.owner !== undefined) patch.owner = row.owner;
            if (row.owner_id !== undefined) patch.ownerId = row.owner_id;

            // детальная машина
            qc.setQueryData(QK.car(id), (prev: any) =>
              prev ? { ...prev, ...patch } : prev
            );

            // списки машин (простые массивы, как в твоём useCarsRealtime)
            qc.setQueriesData(
              { predicate: isCarsList },
              (list: any[] | undefined) =>
                Array.isArray(list)
                  ? list.map((c) =>
                      String(c.id) === id ? { ...c, ...patch } : c
                    )
                  : list
            );

            onCarPatched?.(id, patch);
            return;
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // можно прогреть список
          qc.invalidateQueries({ queryKey: QK.cars, refetchType: "all" });
        }
      });

    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc, onCarPatched]);
}
