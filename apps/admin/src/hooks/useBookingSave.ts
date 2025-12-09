import { useState, useCallback } from "react";
import { toast } from "sonner";
import { differenceInMinutes, isAfter } from "date-fns";
import { updateBooking, createBooking } from "@/services/calendar.service";
import { upsertBookingExtras } from "@/services/booking-extras.service";
import { QK } from "@/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import type { Booking } from "@/types/booking";

// =============================
// types
// =============================

export type UseBookingSaveParams = {
  mode: "create" | "edit";
  mark: "booking" | "block";
  bookingId?: string | null;

  carId: string | null;

  startDateInp: string;
  endDateInp: string;

  delivery: "car_address" | "by_address";
  deliveryAddress: string;
  deliveryLat: number | null;
  deliveryLong: number | null;
  deliveryFee: number;

  pickedExtras: string[];
  extrasMap: any;

  // должен вернуть:
  //   - объект (payload) для гостя, если всё ок
  //   - null, если гостя не надо (block)
  //   - undefined, если уже показали ошибку и надо просто выйти
  guestPayloadBuilder: () => Promise<any | undefined | null>;

  effectiveCurrency: string;
  price_total: number;
  billableDaysForExtras: number;

  minRentMinutes: number;
  maxRentMinutes: number;
  effectiveMinRentPeriodDays: number;
  effectiveMaxRentPeriodDays: number;
  effectiveOpenTime: number;
  effectiveCloseTime: number;
  deposit: number;

  assertNoConflicts: (
    carId: string,
    startIso: string,
    endIso: string,
    selfId?: string
  ) => Promise<void>;
};

export type UseBookingSaveReturn = {
  saving: boolean;
  saved: boolean;
  savedBooking: Booking | null;
  error: string | null;

  handleSave: () => Promise<void>;
};

// ====================================
// HOOK
// ====================================

export function useBookingSave(
  params: UseBookingSaveParams
): UseBookingSaveReturn {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedBooking, setSavedBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    mode,
    mark,
    bookingId,
    carId,
    startDateInp,
    endDateInp,
    delivery,
    deliveryAddress,
    deliveryLat,
    deliveryLong,
    deliveryFee,
    pickedExtras,
    extrasMap,
    guestPayloadBuilder,
    effectiveCurrency,
    price_total,
    billableDaysForExtras,
    minRentMinutes,
    maxRentMinutes,
    effectiveMinRentPeriodDays,
    effectiveMaxRentPeriodDays,
    effectiveOpenTime,
    effectiveCloseTime,
    deposit,
    assertNoConflicts,
  } = params;

  // ======================================
  // VALIDATE INPUT
  // ======================================
  const validateInput = useCallback(() => {
    if (!carId) return "Car ID is missing";

    const now = new Date();
    const start = new Date(startDateInp);
    const end = new Date(endDateInp);

    if (isNaN(+start) || isNaN(+end)) {
      return "Select start and end time";
    }
    if (!isAfter(start, now)) {
      return "Start time must be in the future";
    }
    if (!isAfter(end, start)) {
      return "End time must be after start time";
    }

    const totalMinutes = differenceInMinutes(end, start);

    if (minRentMinutes > 0 && totalMinutes < minRentMinutes) {
      return `Too short: minimum duration is ${effectiveMinRentPeriodDays} day(s)`;
    }
    if (maxRentMinutes > 0 && totalMinutes > maxRentMinutes) {
      return `Too long: maximum duration is ${effectiveMaxRentPeriodDays} day(s)`;
    }

    // рабочее окно (open/close)
    if (
      Number.isFinite(effectiveOpenTime) &&
      Number.isFinite(effectiveCloseTime)
    ) {
      const minutesSinceDayStart = (d: Date) =>
        d.getHours() * 60 + d.getMinutes();

      const sTod = minutesSinceDayStart(start);
      const eTod = minutesSinceDayStart(end);

      const withinWindow = (startMin: number, endMin: number, x: number) => {
        // open < close обычный режим
        if (startMin <= endMin) return x >= startMin && x <= endMin;
        // режим через ночь
        return x >= startMin || x <= endMin;
      };

      const okStart = withinWindow(effectiveOpenTime, effectiveCloseTime, sTod);
      const okEnd = withinWindow(effectiveOpenTime, effectiveCloseTime, eTod);

      if (!okStart || !okEnd) {
        return "Booking must start and end within working hours";
      }
    }

    // доставка
    if (delivery === "by_address") {
      if (
        !deliveryAddress?.trim() ||
        deliveryLat == null ||
        deliveryLong == null
      ) {
        return "Please select a delivery address.";
      }
    }

    return null;
  }, [
    carId,
    startDateInp,
    endDateInp,
    minRentMinutes,
    maxRentMinutes,
    effectiveMinRentPeriodDays,
    effectiveMaxRentPeriodDays,
    effectiveOpenTime,
    effectiveCloseTime,
    delivery,
    deliveryAddress,
    deliveryLat,
    deliveryLong,
  ]);

  // =====================================================
  // helpers
  // =====================================================

  const buildExtrasPayload = useCallback(
    () =>
      pickedExtras.map((id) => {
        const ex = extrasMap.byId?.[id];
        const qty = ex?.price_type === "per_day" ? billableDaysForExtras : 1;

        return {
          extra_id: id,
          title: ex?.title ?? "Extra",
          qty,
          price: ex?.price ?? 0,
          price_type: ex?.price_type ?? "per_trip",
        };
      }),
    [pickedExtras, extrasMap, billableDaysForExtras]
  );

  // =====================================================
  // handleSave
  // =====================================================
  const handleSave = useCallback(async () => {
    if (saving) return;
    setError(null);

    // 1) validate
    const err = validateInput();
    if (err) {
      toast.warning(err);
      return;
    }

    if (!carId) {
      // на всякий случай, хотя validate уже вернул бы ошибку
      setError("Car ID is missing");
      return;
    }

    // 2) conflicts
    try {
      await assertNoConflicts(
        String(carId),
        new Date(startDateInp).toISOString(),
        new Date(endDateInp).toISOString(),
        mode === "edit" ? bookingId ?? undefined : undefined
      );
    } catch (e: any) {
      setError(e?.message ?? "Interval conflict");
      return;
    }

    // 3) guest payload (только для booking)
    let guestPayload: any = null;
    if (mark === "booking") {
      guestPayload = await guestPayloadBuilder();
      if (guestPayload === undefined) {
        // значит внутри уже показали ошибку / тост — выходим
        return;
      }
    }

    setSaving(true);

    try {
      setSaving(true);
      setSaved(false);
      setSavedBooking(null);

      if (mode === "create") {
        //
        // ============================
        // CREATE
        // ============================
        //

        if (mark === "block") {
          // блок дат: без гостя, без цены
          const payload: any = {
            car_id: carId,
            user_id: null,
            start_at: new Date(startDateInp).toISOString(),
            end_at: new Date(endDateInp).toISOString(),
            mark: "block",
            status: "block",
            price_per_day: null,
            price_total: null,
            deposit: null,
            delivery_type: delivery,
            delivery_fee: delivery === "by_address" ? Number(deliveryFee) : 0,
            currency: effectiveCurrency,
            delivery_address:
              delivery === "by_address" ? deliveryAddress : null,
            delivery_lat: delivery === "by_address" ? deliveryLat : null,
            delivery_long: delivery === "by_address" ? deliveryLong : null,
          };

          const saved = await createBooking(payload as any);

          setSavedBooking(saved);

          if (saved?.car_id) {
            qc.invalidateQueries({
              queryKey: QK.bookingsByCarId(String(saved.car_id)),
            });
          }
        } else {
          // обычная бронь
          const payload: any = {
            car_id: carId,
            user_id: guestPayload?.id ?? null,
            start_at: new Date(startDateInp).toISOString(),
            end_at: new Date(endDateInp).toISOString(),
            mark: "booking",
            status: "onApproval",
            price_total,
            deposit: mark === "booking" ? deposit : null,
            currency: effectiveCurrency,
            delivery_type: delivery,
            delivery_fee: delivery === "by_address" ? Number(deliveryFee) : 0,
            delivery_address:
              delivery === "by_address" ? deliveryAddress : null,
            delivery_lat: delivery === "by_address" ? deliveryLat : null,
            delivery_long: delivery === "by_address" ? deliveryLong : null,
          };

          const saved = await createBooking(payload as any);
          const newBookingId = saved?.id;
          if (!newBookingId) throw new Error("Booking created without ID");

          // extras только для booking
          if (pickedExtras.length > 0) {
            const extrasPayload = buildExtrasPayload();
            await upsertBookingExtras(newBookingId, extrasPayload);
          }

          setSavedBooking(saved);

          // инвалидации
          qc.invalidateQueries({ queryKey: QK.booking(newBookingId) });
        }

        // общие инвалидации для create
        if (carId) {
          qc.invalidateQueries({ queryKey: QK.car(carId) });
        }
        qc.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            (q.queryKey[0] === "bookingsIndex" ||
              q.queryKey[0] === "bookingsIndexInfinite" ||
              q.queryKey[0] === "bookingsUserInfinite"),
        });
      } else {
        //
        // ============================
        // EDIT
        // ============================
        //

        if (!bookingId) throw new Error("Missing booking ID for edit");

        const patch: any = {
          start_at: new Date(startDateInp).toISOString(),
          end_at: new Date(endDateInp).toISOString(),
          delivery_type: delivery,
          delivery_fee: delivery === "by_address" ? Number(deliveryFee) : 0,
          delivery_address: delivery === "by_address" ? deliveryAddress : null,
          delivery_lat: delivery === "by_address" ? deliveryLat : null,
          delivery_long: delivery === "by_address" ? deliveryLong : null,
          deposit: mark === "booking" ? deposit : null,
        };

        if (mark === "booking") {
          patch.price_total = price_total;
        } else {
          patch.price_total = null;
        }

        // await updateBooking(bookingId, patch as any);

        const saved = await updateBooking(bookingId, patch as any);

        // extras только для booking
        if (mark === "booking") {
          if (pickedExtras.length > 0) {
            const extrasPayload = buildExtrasPayload();
            await upsertBookingExtras(bookingId, extrasPayload);
          } else {
            await upsertBookingExtras(bookingId, []); // очистить
          }
          qc.invalidateQueries({ queryKey: QK.bookingExtras(bookingId) });
        }

        setSavedBooking(saved);

        // инвалидации для edit
        qc.invalidateQueries({ queryKey: QK.booking(bookingId) });
        if (carId) {
          qc.invalidateQueries({ queryKey: QK.car(carId) });
        }
        qc.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            (q.queryKey[0] === "bookingsIndex" ||
              q.queryKey[0] === "bookingsIndexInfinite" ||
              q.queryKey[0] === "bookingsUserInfinite"),
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      toast.success("Booking saved");
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Save error");
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    validateInput,
    carId,
    mark,
    assertNoConflicts,
    startDateInp,
    endDateInp,
    mode,
    bookingId,
    guestPayloadBuilder,
    qc,
    delivery,
    deliveryFee,
    effectiveCurrency,
    deliveryAddress,
    deliveryLat,
    deliveryLong,
    price_total,
    deposit,
    pickedExtras.length,
    buildExtrasPayload,
  ]);

  return {
    saving,
    saved,
    savedBooking,
    error,
    handleSave,
  };
}
