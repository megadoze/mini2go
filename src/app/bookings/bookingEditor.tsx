import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import type { Booking } from "@/types/booking";
import { CarContext } from "@/context/carContext";
import {
  createBooking,
  updateBooking,
  fetchBookingsByCarId,
  fetchBookingById,
} from "@/app/car/calendar/calendar.service";
import {
  fetchBookingExtras,
  upsertBookingExtras,
} from "@/services/booking-extras.service";
import { calculateFinalPriceProRated } from "@/hooks/useFinalPriceHourly";
import { differenceInMinutes, isAfter, parseISO } from "date-fns";
import { Select, Checkbox, Badge } from "@mantine/core";
import {
  searchUsers,
  createUserProfile,
  getUserById,
} from "@/services/user.service";
import type { BookingEditorSnapshot } from "@/types/booking-ui";
import { ShareIcon } from "@heroicons/react/24/outline";
import { updateBookingCard } from "@/services/bookings.service";

/* ===================== УТИЛИТЫ ===================== */

function toLocalDT(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
function fromLocalDT(local: string) {
  return new Date(local).toISOString();
}
function minutesSinceMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}
// inclusiveEnd=true позволяет окончание в точное время закрытия (<= close)
function isWithinDailyWindow(
  startMin: number,
  endMin: number,
  timeMin: number,
  inclusiveEnd = false
) {
  if (endMin === startMin) return true; // 24/7
  if (endMin > startMin) {
    return (
      timeMin >= startMin &&
      (inclusiveEnd ? timeMin <= endMin : timeMin < endMin)
    );
  } else {
    // окно через полночь (например 22:00–06:00)
    return (
      timeMin >= startMin ||
      (inclusiveEnd ? timeMin <= endMin : timeMin < endMin)
    );
  }
}
function mmToHHMM(m: number) {
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* ===================== КОМПОНЕНТ ===================== */

export default function BookingEditor() {
  const location = useLocation() as any;
  const snapshot = location.state?.snapshot as
    | BookingEditorSnapshot
    | undefined;

  // контекст
  const carCtx = useContext(CarContext);
  const carFromCtx = carCtx?.car as any | undefined;
  const setCar = carCtx?.setCar;
  const pricingRules = carCtx?.pricingRules ?? [];
  const seasonalRates = carCtx?.seasonalRates ?? [];
  const extras = carCtx?.extras ?? [];
  const effectiveCurrency = (carCtx as any)?.effectiveCurrency ?? "EUR";

  // Эффективные политики
  const effectiveOpenTime: number = Number(
    (carCtx as any)?.effectiveOpenTime ?? 0
  );
  const effectiveCloseTime: number = Number(
    (carCtx as any)?.effectiveCloseTime ?? 0
  );
  const effectiveMinRentPeriodDays: number = Number(
    (carCtx as any)?.effectiveMinRentPeriod ?? 0
  );
  const effectiveMaxRentPeriodDays: number = Number(
    (carCtx as any)?.effectiveMaxRentPeriod ?? 0
  );
  const effectiveIntervalBetweenBookings: number = Number(
    (carCtx as any)?.effectiveIntervalBetweenBookings ?? 0
  );
  const effectiveAgeRenters: number = Number(
    (carCtx as any)?.effectiveAgeRenters ?? 0
  );
  const effectiveMinDriverLicense: number = Number(
    (carCtx as any)?.effectiveMinDriverLicense ?? 0
  );

  // конвертация дней в минуты
  const minRentMinutes =
    effectiveMinRentPeriodDays > 0 ? effectiveMinRentPeriodDays * 24 * 60 : 0;
  const maxRentMinutes =
    effectiveMaxRentPeriodDays > 0 ? effectiveMaxRentPeriodDays * 24 * 60 : 0;

  const lastBookingUserRef = useRef<string | null>(null);

  // из URL
  const { id: carIdFromCarsRoute, bookingId } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  const carId =
    (carFromCtx as any)?.id ?? carIdFromCarsRoute ?? sp.get("carId") ?? null;

  // режим
  const isUUID = (s?: string) =>
    !!s &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s
    );
  const mode: "create" | "edit" = isUUID(bookingId) ? "edit" : "create";

  // форма
  const [loading, setLoading] = useState(true);
  const [mark, setMark] = useState<"booking" | "block">("booking");
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [startAt, setStartAt] = useState<string>(
    snapshot?.booking.start_at || ""
  );
  const [endAt, setEndAt] = useState<string>(snapshot?.booking.end_at || "");

  const [startDateInp, setStartDateInp] = useState<string>(
    snapshot?.booking.start_at || ""
  );
  const [endDateInp, setEndDateInp] = useState<string>(
    snapshot?.booking.end_at || ""
  );

  // депозит — берём из авто при создании, показываем в карточке всегда
  const [deposit, setDeposit] = useState<number>(
    Number((carFromCtx as any)?.deposit ?? 0)
  );

  // Extras UI state (id-шники того, что выбрано)
  const [pickedExtras, setPickedExtras] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // user picker (только create-режим)
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<any[]>([]);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState<{
    full_name: string;
    email: string;
    phone: string;
    age?: number | "";
    driver_license_issue?: string | "";
  }>({
    full_name: "",
    email: "",
    phone: "",
    age: "",
    driver_license_issue: "",
  });

  // Delivery
  type DeliveryOption = "car_address" | "by_address";
  const deliveryEnabled = Boolean((carFromCtx as any)?.isDelivery);
  const [delivery, setDelivery] = useState<DeliveryOption>("car_address");

  // QR
  const [qrOpen, setQrOpen] = useState(false);
  const [qrSrc, setQrSrc] = useState<string | null>(null);

  // статус / кнопки подтверждения
  const [status, setStatus] = useState<string>("onApproval");

  // Лайв-тик раз в 30 сек
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const now = useMemo(() => new Date(), [tick]);

  // ранний префилл перед загрузкой (snapshot)
  useEffect(() => {
    if (!loading) return;
    if (!snapshot?.booking) return;

    if (snapshot.booking.id && snapshot.booking.id === bookingId) {
      const b = snapshot.booking;
      if (b.mark) setMark(b.mark as any);
      if ("user_id" in b) setUserId(b.user_id ?? null);
      if (b.start_at) setStartAt(b.start_at);
      if (b.end_at) setEndAt(b.end_at);
      if (b.start_at) setStartDateInp(b.start_at);
      if (b.end_at) setEndDateInp(b.end_at);
      if (b.status) setStatus(b.status);
      if (typeof b.deposit === "number") setDeposit(b.deposit);

      if (snapshot.booking.user) {
        setSelectedUser(snapshot.booking.user);
      } else if (b.user_id) {
        const cached = carCtx?.getCachedUser?.(b.user_id);
        if (cached) setSelectedUser(cached);
      }
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, snapshot]);

  const isISO = (s?: string | null) => !!s && !Number.isNaN(Date.parse(s));

  // основная загрузка/гидратация
  useEffect(() => {
    (async () => {
      try {
        if (mode === "edit" && bookingId) {
          let found: Booking | null = null;

          // сначала из контекста
          const fromCtx =
            (carFromCtx?.bookings as Booking[] | undefined)?.find(
              (b) => b.id === bookingId
            ) ?? null;
          if (fromCtx) {
            found = fromCtx;
          } else if (carId) {
            const all = await fetchBookingsByCarId(carId);
            found = all.find((b) => b.id === bookingId) ?? null;
            if (found) setCar?.((prev) => ({ ...prev, bookings: all }));
          } else {
            found = await fetchBookingById(bookingId);
          }

          if (!found) throw new Error("Booking not found");

          // обновим форму (если snapshot уже не сделал)
          setMark(found.mark);
          setUserId(found.user_id ?? null);
          setStartAt(found.start_at);
          setEndAt(found.end_at);
          setStartDateInp(found.start_at);
          setEndDateInp(found.end_at);
          setStatus(found.status ?? "onApproval");
          setDeposit(Number((found as any)?.deposit));
          setDelivery(found.delivery_type ?? "car_address");

          // профиль юзера (если нет в snapshot и нет в кэше)
          if (!snapshot?.booking.user && found.user_id) {
            try {
              const cached = carCtx?.getCachedUser?.(found.user_id);
              if (cached) setSelectedUser(cached);
              else {
                const u = await getUserById(found.user_id);
                setSelectedUser(u);
                carCtx?.setCachedUser?.(found.user_id, u);
              }
            } catch {}
          }

          // гидратация экстр из БД при редактировании (если есть API)
          try {
            const rows = await fetchBookingExtras(bookingId);
            const ids = rows?.map((r: any) => String(r.extra_id)) ?? [];
            setPickedExtras(ids);
          } catch {}
        } else {
          const qStart = sp.get("start");
          const qEnd = sp.get("end");
          if (isISO(qStart)) setStartAt(qStart!);
          if (isISO(qEnd)) setEndAt(qEnd!);
          if (isISO(qStart)) setStartDateInp(qStart!);
          if (isISO(qEnd)) setEndDateInp(qEnd!);
          setMark(sp.get("mark") === "block" ? "block" : "booking");
          setStatus("onApproval");
          setDeposit(Number((carFromCtx as any)?.deposit ?? 0));
          setDelivery("car_address");
        }
      } catch (e: any) {
        setError(e?.message ?? "Load error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bookingId, carId, sp]);

  // не позволяем менять юзера в edit-режиме
  const allowUserPick = mode === "create" && mark === "booking";

  useEffect(() => {
    if (mark === "booking" && !userId && lastBookingUserRef.current)
      setUserId(lastBookingUserRef.current);
    if (mark === "booking" && userId) lastBookingUserRef.current = userId;
  }, [mark, userId]);

  // поиск юзеров (только create)
  useEffect(() => {
    if (!allowUserPick) return;
    let ignore = false;
    (async () => {
      try {
        if (userSearch.trim().length < 2) {
          setUserResults([]);
          return;
        }
        const rows = await searchUsers(userSearch.trim());
        if (!ignore) setUserResults(rows);
      } catch {}
    })();
    return () => {
      ignore = true;
    };
  }, [userSearch, allowUserPick]);

  const baseDailyPrice = Number((carFromCtx as any)?.price ?? 0);

  const { total: baseTotal } = useMemo(
    () =>
      calculateFinalPriceProRated({
        startAt: new Date(startDateInp),
        endAt: new Date(endDateInp),
        baseDailyPrice,
        pricingRules,
        seasonalRates,
      }),
    [startDateInp, endDateInp, baseDailyPrice, pricingRules, seasonalRates]
  );

  const rawMinutes = differenceInMinutes(
    new Date(endDateInp),
    new Date(startDateInp)
  );
  const totalMinutes = Math.max(0, rawMinutes);
  const durationDays = Math.floor(totalMinutes / (24 * 60));
  const durationHours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const durationMinutes = totalMinutes % 60;

  // map экстр (только доступные)
  const extrasMap = useMemo(() => {
    const pick = (obj: any, ...paths: string[]) => {
      for (const p of paths) {
        const v = p.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
        if (v !== undefined) return v;
      }
      return undefined;
    };

    const list = (extras ?? [])
      .filter((ex: any) => {
        const avail =
          pick(ex, "is_available", "meta.is_available") ??
          pick(ex, "isAvailable", "meta.isAvailable");
        return avail === true;
      })
      .map((ex: any) => {
        const id = String(ex.extra_id ?? ex.meta?.id ?? ex.id);
        const title = ex.meta?.title ?? ex.meta?.name ?? "Extra";
        const price = Number(ex.price ?? ex.meta?.price ?? 0);
        const price_type =
          (pick(ex, "price_type", "meta.price_type") as string) ??
          (pick(ex, "priceType", "meta.priceType") as string) ??
          "per_trip";
        return { id, title, price, price_type };
      });
    const byId: Record<
      string,
      {
        id: string;
        title: string;
        price: number;
        price_type: "per_trip" | "per_day" | string;
      }
    > = {};
    list.forEach((x) => (byId[x.id] = x));
    return { list, byId };
  }, [extras]);

  // дни для экстр «per_day»
  const billableDaysForExtras = useMemo(() => {
    const minutes = Math.max(
      0,
      differenceInMinutes(new Date(endDateInp), new Date(startDateInp))
    );
    return Math.max(1, Math.ceil(minutes / (24 * 60)));
  }, [startDateInp, endDateInp]);

  const extrasTotal = useMemo(() => {
    const sum = pickedExtras.reduce((s, id) => {
      const ex = extrasMap.byId[id];
      if (!ex) return s;
      const multiplier =
        ex.price_type === "per_day" ? billableDaysForExtras : 1;
      return s + ex.price * multiplier;
    }, 0);
    return Math.round(sum * 100) / 100;
  }, [pickedExtras, extrasMap, billableDaysForExtras]);

  const deliveryFee = useMemo(() => {
    if (!deliveryEnabled) return 0;
    return delivery === "by_address"
      ? Number((carFromCtx as any)?.deliveryFee ?? 0)
      : 0;
  }, [deliveryEnabled, delivery, carFromCtx]);

  const price_total = useMemo(() => {
    const addons = mark === "booking" ? extrasTotal + deliveryFee : 0;
    return Math.round((baseTotal + addons) * 100) / 100;
  }, [baseTotal, extrasTotal, deliveryFee, mark]);

  function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return aStart < bEnd && bStart < aEnd;
  }
  async function assertNoConflicts(
    carId: string,
    startIso: string,
    endIso: string,
    selfId?: string
  ) {
    const list = await fetchBookingsByCarId(carId);
    const s = new Date(startIso),
      e = new Date(endIso);

    // 1) Пересечения
    const clash = list.find(
      (b) =>
        b.id !== selfId &&
        b.status !== "canceled" &&
        overlaps(s, e, new Date(b.start_at), new Date(b.end_at))
    );
    if (clash)
      throw new Error("This period overlaps with another booking/block");

    // 2) Интервал между бронями
    if (effectiveIntervalBetweenBookings > 0) {
      const gapMin = effectiveIntervalBetweenBookings;

      const tooClose = list.find((b) => {
        if (b.id === selfId || b.status === "canceled") return false;
        const bs = new Date(b.start_at),
          be = new Date(b.end_at);

        // новый старт слишком близко к окончанию существующего (be ... s)
        if (be <= s) {
          const gap = differenceInMinutes(s, be);
          if (gap < gapMin) return true;
        }

        // новый конец слишком близко к началу существующего (e ... bs)
        if (e <= bs) {
          const gap = differenceInMinutes(bs, e);
          if (gap < gapMin) return true;
        }

        return false;
      });

      if (tooClose)
        throw new Error("Too little time between bookings per policy");
    }
  }

  function yearsBetween(dateFrom?: string | null) {
    if (!dateFrom) return null;
    const d = new Date(dateFrom);
    if (isNaN(+d)) return null;
    const now = new Date();
    let years = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years--;
    return years;
  }

  async function handleSave() {
    setError(null);
    if (!carId) {
      setError("Car ID is missing");
      return;
    }

    if (mark === "booking") {
      if (!userId) {
        setError("Select customer to create a booking");
        return;
      }
      const u =
        selectedUser ??
        (userId ? await getUserById(userId).catch(() => null) : null);
      if (!u) {
        setError("Cannot validate customer profile");
        return;
      }
      if (
        effectiveAgeRenters > 0 &&
        typeof u.age === "number" &&
        u.age < effectiveAgeRenters
      ) {
        setError(`Customer must be at least ${effectiveAgeRenters} years old`);
        return;
      }
      if (effectiveMinDriverLicense > 0) {
        const yrs = yearsBetween(u.driver_license_issue);
        if (yrs !== null && yrs < effectiveMinDriverLicense) {
          setError(
            `Driver's license must be at least ${effectiveMinDriverLicense} year(s) old`
          );
          return;
        }
      }
    }

    if (!isAfter(new Date(endDateInp), new Date(startDateInp))) {
      setError("End time must be after start time");
      return;
    }

    if (minRentMinutes > 0 && totalMinutes < minRentMinutes) {
      setError(
        `Too short: minimum duration is ${effectiveMinRentPeriodDays} day(s)`
      );
      return;
    }
    if (maxRentMinutes > 0 && totalMinutes > maxRentMinutes) {
      setError(
        `Too long: maximum duration is ${effectiveMaxRentPeriodDays} day(s)`
      );
      return;
    }

    if (
      Number.isFinite(effectiveOpenTime) &&
      Number.isFinite(effectiveCloseTime)
    ) {
      const sTod = minutesSinceMidnight(new Date(startDateInp));
      const eTod = minutesSinceMidnight(new Date(endDateInp));
      const startOk = isWithinDailyWindow(
        effectiveOpenTime,
        effectiveCloseTime,
        sTod,
        false
      );
      const endOk = isWithinDailyWindow(
        effectiveOpenTime,
        effectiveCloseTime,
        eTod,
        true
      );
      if (!startOk || !endOk) {
        setError("Booking must start and end within working hours");
        return;
      }
    }

    try {
      await assertNoConflicts(
        String(carId),
        new Date(startDateInp).toISOString(),
        new Date(endDateInp).toISOString(),
        mode === "edit" ? bookingId! : undefined
      );
    } catch (e: any) {
      setError(e?.message ?? "Interval policy violation");
      return;
    }

    const payload: Omit<Booking, "id"> & { deposit?: number } = {
      car_id: carId,
      user_id: mark === "booking" ? userId : null,
      start_at: new Date(startDateInp).toISOString(),
      end_at: new Date(endDateInp).toISOString(),
      mark,
      status: mark === "booking" ? "onApproval" : "block",
      price_per_day: baseDailyPrice,
      price_total,
      deposit,
      delivery_type: delivery,
      delivery_fee: deliveryFee,
      // mark === "booking" ? (delivery === "by_address" ? deliveryFee : 0) : 0,
    };

    try {
      let saved: Booking;
      if (mode === "create") saved = await createBooking(payload);
      else saved = await updateBooking(bookingId!, payload);

      // Сохраняем экстра-услуги
      if (mark === "booking") {
        await upsertBookingExtras(
          saved.id,
          pickedExtras.map((id) => {
            const ex = extrasMap.byId[id];
            const multiplier =
              ex?.price_type === "per_day" ? billableDaysForExtras : 1;
            return {
              extra_id: id,
              title: ex?.title ?? "Extra",
              qty: multiplier, // чтобы в сумме было корректно
              price: ex?.price ?? 0,
              price_type: ex?.price_type ?? "per_trip",
            };
          })
        );
      }

      // Обновим контекстные брони и возвращаемся на календарь (или назад)
      if ((carFromCtx as any)?.id === saved.car_id) {
        const fresh = await fetchBookingsByCarId(saved.car_id!);
        setCar?.((prev: any) => ({ ...prev, bookings: fresh }));
        navigate(location.state?.from ?? `/cars/${saved.car_id}/calendar`);
      } else {
        navigate(location.state?.from ?? -1);
      }
    } catch (e: any) {
      setError(e?.message ?? "Save error");
    }
  }

  // подтверждение / отмена (без автопереходов в rent/finished!)
  const canConfirm = mark === "booking" && status === "onApproval";
  const canCancel =
    mark === "booking" && (status === "onApproval" || status === "confirmed");

  const handleConfirm = async () => {
    if (!bookingId) return;
    try {
      const next = await updateBooking(bookingId, {
        status: "confirmed",
      } as any);
      setStatus(next.status ?? "confirmed");
      // обновим список
      if (next.car_id) {
        const fresh = await fetchBookingsByCarId(next.car_id);
        setCar?.((prev: any) => ({ ...prev, bookings: fresh }));
      }
    } catch (e: any) {
      setError(e?.message ?? "Confirm error");
    }
  };

  const handleCancel = async () => {
    if (!bookingId) return;
    try {
      const next = await updateBooking(bookingId, {
        status: "canceledHost",
      } as any);
      setStatus(next.status ?? "canceledHost");
      if (next.car_id) {
        const fresh = await fetchBookingsByCarId(next.car_id);
        setCar?.((prev: any) => ({ ...prev, bookings: fresh }));
      }
    } catch (e: any) {
      setError(e?.message ?? "Cancel error");
    }
  };

  // QR подготовка (локально через qrcode)
  const displayId = useMemo(
    () => (bookingId ? bookingId.slice(0, 8).toUpperCase() : ""),
    [bookingId]
  );

  const shareUrl = useMemo(() => {
    if (!bookingId) return "";
    try {
      const { origin } = window.location;
      return `${origin}/booking/${bookingId}`;
    } catch {
      return String(bookingId);
    }
  }, [bookingId]);

  useEffect(() => {
    if (!qrOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const url = await QRCode.toDataURL(shareUrl || bookingId || "", {
          width: 480,
          margin: 1,
          errorCorrectionLevel: "M",
        });
        if (!cancelled) setQrSrc(url);
      } catch {
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&data=${encodeURIComponent(
          shareUrl || bookingId || ""
        )}`;
        if (!cancelled) setQrSrc(url);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [qrOpen, shareUrl, bookingId]);

  // форматтеры
  const fmt = (s: string) =>
    new Date(s).toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  const invalidTime = !isAfter(new Date(endDateInp), new Date(startDateInp));

  // вычисления для прогресса/таймеров
  const startDate = useMemo(() => parseISO(startAt), [startAt]);
  const endDate = useMemo(() => parseISO(endAt), [endAt]);
  const totalMs = Math.max(0, endDate.getTime() - startDate.getTime());
  const elapsedMs = Math.max(0, now.getTime() - startDate.getTime());

  //   const tripProgress = useMemo(() => {
  //     if (!startDate || !endDate) return null as number | null;
  //     const total = endDate.getTime() - startDate.getTime();
  //     if (total <= 0) return 0;
  //     const elapsed = now.getTime() - startDate.getTime();
  //     if (elapsed <= 0) return 0;
  //     if (elapsed >= total) return 100;
  //     return Math.round((elapsed / total) * 100);
  //   }, [startDate, endDate, now]);

  const tripProgress =
    totalMs > 0
      ? Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)))
      : 0;

  const countdownParts = (target?: Date | null) => {
    if (!target) return null as any;
    const diffMs = Math.max(0, target.getTime() - now.getTime());
    const totalMin = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const minutes = totalMin % 60;
    return { days, hours, minutes };
  };

  const cdStart = useMemo(() => countdownParts(startDate), [startDate, now]);

  // ---------- mutations (via service) ------------------------------------
  async function mutateBooking(id: string, payload: Partial<Booking>) {
    const next = await updateBookingCard(id, payload);
    // qc.setQueryData(["booking", id], next);
    // qc.setQueryData<BookingCardType[]>(["bookingsByUser"], (prev = []) =>
    //   prev.map((b) => (b.id === id ? next : b))
    // );
    return next;
  }

  // автопрогрессия статусов (rent/finished)
  useEffect(() => {
    if (!bookingId || !startDate || !endDate) return;

    const started = now >= startDate && now < endDate;
    const finished = now >= endDate;

    const goRent = async () => {
      setStatus("rent");
      await mutateBooking(bookingId, { status: "rent" });
    };

    const goFinished = async () => {
      setStatus("finished");
      await mutateBooking(bookingId, { status: "finished" });
    };

    if (started && status !== "rent") void goRent();
    else if (finished && status !== "finished") void goFinished();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bookingId,
    status,
    startDate?.getTime?.(),
    endDate?.getTime?.(),
    now.getTime(),
  ]);

  // статус UI
  const statusView = useMemo(() => {
    const s = status;
    if (s === "rent") return { text: s, cls: "lime" };
    if (s === "confirmed") return { text: s, cls: "orange" };
    if (s === "onApproval") return { text: s, cls: "blue" };
    if (s === "finished") return { text: s, cls: "dark" };
    if (s?.startsWith("canceled")) return { text: s, cls: "red" };
    return { text: "unknown", cls: "gray" };
  }, [status]);

  // плавающая мобильная панель
  const showMobileActionBar =
    status &&
    (status === "confirmed" ||
      status === "canceled" ||
      status === "onApproval");

  const containerPad = showMobileActionBar ? "pb-24 lg:pb-0" : "";

  if (loading) return <div className="p-4">Loading…</div>;

  return (
    <div className={`text-gray-600 max-w-4xl ${containerPad}`}>
      {/* Header */}
      <div className="flex flex-wrap flex-col md:flex-row justify-between md:items-center">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-xl md:text-2xl text-gray-800">
            {mode === "create" && mark === "booking" ? (
              "New Booking"
            ) : mark === "block" ? (
              "New Block"
            ) : (
              <>
                Booking #
                <span className=" font-normal text-lime-500">{displayId}</span>
              </>
            )}
          </h1>
          {mode === "edit" && (
            <div className="flex gap-2 h-fit">
              <button
                onClick={() => setQrOpen(true)}
                className=" inline-flex items-center rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 active:scale-[.98]"
              >
                QR
              </button>
              <button
                onClick={async () => {
                  try {
                    if (navigator.share && shareUrl) {
                      await navigator.share({
                        title: `Booking #${displayId}`,
                        text: `Booking for ${
                          carFromCtx?.model?.brands?.name ?? ""
                        } ${carFromCtx?.model?.name ?? ""}`,
                        url: shareUrl,
                      });
                    } else {
                      await navigator.clipboard.writeText(shareUrl);
                    }
                  } catch {}
                }}
                className=" inline-flex items-center rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-700 active:scale-[.98] gap-1"
              >
                <ShareIcon className="w-4 h-4" />
                Share
              </button>
            </div>
          )}
        </div>

        {/* Статус */}
        {mode === "edit" && mark === "booking" && (
          <Badge
            variant="dot"
            color={statusView.cls as any}
            className="mt-2 md:mt-0"
          >
            {statusView.text}
          </Badge>
        )}
      </div>

      {/* тип записи */}
      {mode !== "edit" && (
        <fieldset className="mt-4">
          <legend className="sr-only">Record type</legend>
          <label className="mr-3">
            <input
              type="radio"
              name="mark"
              checked={mark === "booking"}
              onChange={() => setMark("booking")}
              // disabled={mode === "edit"} // не меняем тип у существующей
            />{" "}
            Booking
          </label>
          <label>
            <input
              type="radio"
              name="mark"
              checked={mark === "block"}
              onChange={() => setMark("block")}
              // disabled={mode === "edit"}
            />{" "}
            Block
          </label>
        </fieldset>
      )}

      {/* LEFT — форма */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 ">
          {/* Фото */}
          <section className=" lg:hidden flex gap-3 mb-5">
            <div id="photo" className={`${!status ? "opacity-40" : ""} flex-1`}>
              {carFromCtx?.photos?.[0] ? (
                <div className="aspect-[3/2] w-full overflow-hidden rounded-2xl">
                  <img
                    src={carFromCtx.photos[0]}
                    className="h-full w-full object-cover"
                    alt="Car"
                  />
                </div>
              ) : (
                <div className="w-full rounded-2xl bg-gray-100 aspect-video flex items-center justify-center text-sm text-gray-400">
                  no photo
                </div>
              )}
            </div>

            {/* Name */}
            <div id="name" className={`${!status ? "opacity-60" : ""} flex-1`}>
              <p className="font-semibold text-lg text-gray-800">
                {carFromCtx?.model?.brands?.name} {carFromCtx?.model?.name}{" "}
                {carFromCtx?.year}
              </p>
              {carFromCtx?.licensePlate ? (
                <p className="w-fit border border-gray-600 rounded-sm p-1 text-gray-700 text-sm">
                  {carFromCtx.licensePlate}
                </p>
              ) : null}
            </div>
          </section>

          {/* даты/время */}
          <section id="dates">
            <p className="font-medium text-base sm:text-lg text-gray-800">
              Dates of trip
            </p>
            <div className="flex flex-col md:flex-row md:items-center gap-4 mt-2">
              <div>
                <label className="block text-sm mb-1">Start</label>
                <input
                  type="datetime-local"
                  step={60}
                  className="w-full border rounded px-2 py-1 disabled:bg-white"
                  value={toLocalDT(startDateInp)}
                  onChange={(e) => setStartDateInp(fromLocalDT(e.target.value))}
                  disabled={status === "rent"}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">End</label>
                <input
                  type="datetime-local"
                  step={60}
                  className="w-full border rounded px-2 py-1 disabled:bg-white"
                  value={toLocalDT(endDateInp)}
                  min={toLocalDT(endDateInp)}
                  onChange={(e) => setEndDateInp(fromLocalDT(e.target.value))}
                  disabled={status === "rent"}
                />
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Working hours: {mmToHHMM(effectiveOpenTime)} –{" "}
              {mmToHHMM(effectiveCloseTime)}
            </div>
          </section>

          {/* Клиент: только в create-режиме */}
          {mark === "booking" && allowUserPick && (
            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium">Customer</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 border rounded px-2 py-1"
                  placeholder="Search by name/email/phone…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onBlur={() => setTimeout(() => setUserResults([]), 100)}
                />
                <button
                  className="px-3 py-1 border rounded text-sm"
                  onClick={() => setCreatingUser((v) => !v)}
                >
                  {creatingUser ? "Cancel" : "New user"}
                </button>
              </div>
              {userResults.length > 0 && (
                <div className="border rounded">
                  {userResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 hover:bg-zinc-50 ${
                        userId === u.id ? "bg-zinc-100" : ""
                      }`}
                      onClick={() => {
                        setUserId(u.id);
                        setSelectedUser(u);
                        setUserSearch("");
                        setUserResults([]);
                      }}
                    >
                      <div className="text-sm font-medium">
                        {u.full_name ?? "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {u.email ?? "—"} {u.phone ? `• ${u.phone}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {creatingUser && (
                <div className="border rounded p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      className="border rounded px-2 py-1 col-span-3 sm:col-span-1"
                      placeholder="Full name"
                      value={newUser.full_name}
                      onChange={(e) =>
                        setNewUser({ ...newUser, full_name: e.target.value })
                      }
                    />
                    <input
                      className="border rounded px-2 py-1 col-span-3 sm:col-span-1"
                      placeholder="Email"
                      value={newUser.email}
                      onChange={(e) =>
                        setNewUser({ ...newUser, email: e.target.value })
                      }
                    />
                    <input
                      className="border rounded px-2 py-1 col-span-3 sm:col-span-1"
                      placeholder="Phone"
                      value={newUser.phone}
                      onChange={(e) =>
                        setNewUser({ ...newUser, phone: e.target.value })
                      }
                    />
                    <input
                      className="border rounded px-2 py-1 col-span-3 sm:col-span-1"
                      placeholder="Age (optional)"
                      type="number"
                      value={newUser.age ?? ""}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          age:
                            e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                    />
                    <input
                      className="border rounded px-2 py-1 col-span-3 sm:col-span-2"
                      placeholder="Driver license issue date (YYYY-MM-DD)"
                      value={newUser.driver_license_issue ?? ""}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          driver_license_issue: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      className="px-3 py-1 border rounded text-sm"
                      onClick={async () => {
                        try {
                          if (!newUser.email || !newUser.phone)
                            throw new Error("Email and phone are required");
                          const created = await createUserProfile({
                            full_name: newUser.full_name,
                            email: newUser.email,
                            phone: newUser.phone,
                            age:
                              newUser.age === ""
                                ? undefined
                                : Number(newUser.age),
                            driver_license_issue:
                              newUser.driver_license_issue || undefined,
                          });
                          setUserId(created.id);
                          setSelectedUser(created);
                          setCreatingUser(false);
                          setUserSearch("");
                          setUserResults([]);
                        } catch (e: any) {
                          setError(e?.message ?? "Create user error");
                        }
                      }}
                      disabled={
                        !newUser.full_name.trim() ||
                        !newUser.email.trim() ||
                        !newUser.phone.trim()
                      }
                    >
                      Create user
                    </button>
                  </div>
                  <div className="text-xs text-gray-500">
                    * Email и phone обязательны по схеме profiles.
                  </div>
                </div>
              )}
              {userId && selectedUser && (
                <div className="mt-2 border border-lime-400 rounded p-2 text-sm flex items-start gap-2">
                  <div className="grow">
                    <div className="font-medium">
                      {selectedUser.full_name ?? "—"}
                    </div>
                    <div className="text-xs text-gray-600">
                      {selectedUser.email ?? "—"}
                      {selectedUser.phone ? ` • ${selectedUser.phone}` : ""}
                    </div>
                  </div>
                  <button
                    className="text-xs underline"
                    onClick={() => {
                      setUserId(null);
                      setSelectedUser(null);
                    }}
                  >
                    Change
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Delivery */}
          {mark === "booking" && (
            <div className="mt-4">
              <label className="font-medium text-base sm:text-lg text-gray-800">
                Delivery
              </label>
              <Select
                // checkIconPosition="right"
                value={delivery}
                onChange={(v: any) =>
                  setDelivery((v ?? "car_address") as DeliveryOption)
                }
                className={
                  status === "rent" ? "opacity-60" : ""
                }
                classNames={{
                  input:
                    status === "rent"
                      ? "!cursor-not-allowed focus:border-gray-300"
                      : "",
                }}
                data={[
                  {
                    value: "car_address",
                    label: `Pickup at car address${
                      (carFromCtx as any)?.address
                        ? ` (${(carFromCtx as any).address})`
                        : ""
                    }`,
                  },
                  ...(deliveryEnabled
                    ? [
                        {
                          value: "by_address",
                          label: "Delivery to customer's address",
                        },
                      ]
                    : []),
                ]}
                readOnly={status === "rent"}
              />
              <div className="text-xs text-gray-600 mt-1">
                Delivery fee:{" "}
                <b>
                  {deliveryFee.toFixed(2)} {effectiveCurrency}
                </b>
              </div>
            </div>
          )}

          {/* Extras */}
          {mark === "booking" && (
            <div className="mt-4">
              {/* <p className="text-sm font-medium mb-2">Extras</p> */}
              <p className="font-medium text-base sm:text-lg text-gray-800 mb-2">
                Extras
              </p>
              <div className="space-y-1">
                {extrasMap.list.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between"
                  >
                    <Checkbox
                      color="dark"
                      label={`${ex.title} (${ex.price} ${effectiveCurrency}${
                        ex.price_type === "per_day" ? " / day" : ""
                      })`}
                      checked={pickedExtras.includes(ex.id)}
                      onChange={(e) => {
                        const checked = e.currentTarget.checked;
                        if (status === "rent") return;
                        setPickedExtras((prev) =>
                          checked
                            ? [...prev, ex.id]
                            : prev.filter((x) => x !== ex.id)
                        );
                      }}
                      className={status === "rent" ? "opacity-80" : ""}
                      classNames={{
                        root: status === "rent" ? "!cursor-not-allowed" : "",
                        input: status === "rent" ? "!cursor-not-allowed" : "",
                        label: status === "rent" ? "!cursor-not-allowed" : "",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Итоги */}
          <div className="mt-4 text-sm space-y-1">
            <div>
              Period: <b>{fmt(startDateInp)}</b> → <b>{fmt(endDateInp)}</b>
            </div>
            <div>
              Duration:{" "}
              <b>
                {durationDays}d {durationHours}h {durationMinutes}m
              </b>
            </div>
            <div>
              Base:{" "}
              <b>
                {baseTotal.toFixed(2)} {effectiveCurrency}
              </b>
            </div>
            {mark === "booking" && (
              <div>
                Extras:{" "}
                <b>
                  {extrasTotal.toFixed(2)} {effectiveCurrency}
                </b>
              </div>
            )}
            {mark === "booking" && deliveryEnabled && (
              <div>
                Delivery:{" "}
                <b>
                  {deliveryFee.toFixed(2)} {effectiveCurrency}
                </b>
              </div>
            )}
            {mark === "booking" && (
              <div>
                Deposit:{" "}
                <b>
                  {Number(deposit ?? 0).toFixed(2)} {effectiveCurrency}
                </b>
              </div>
            )}
            <div className="mt-1">
              Total:{" "}
              <b>
                {price_total.toFixed(2)} {effectiveCurrency}
              </b>
            </div>
          </div>

          {error && <div className="mt-3 text-red-600 text-sm">{error}</div>}

          {/* Кнопки сохранения */}
          {(mode === "create" ||
            status === "onApproval" ||
            status === "confirmed") && (
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-1 border rounded text-sm"
                onClick={() => navigate(-1)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 border rounded text-sm"
                onClick={handleSave}
                disabled={loading || invalidTime}
              >
                {mode === "create" ? "Create" : "Save"}
              </button>
            </div>
          )}
          {/* <div className=" lg:hidden border-b border-gray-100 mt-4 sm:mt-5 shadow-sm" /> */}
        </div>

        {/* RIGHT — сводка/действия как в карточке */}
        <aside className="lg:col-span-1 lg:sticky lg:top-6">
          {/* Фото */}
          <section className=" hidden lg:block">
            <div id="photo">
              {carFromCtx?.photos?.[0] ? (
                <div className="aspect-video w-full overflow-hidden rounded-2xl">
                  <img
                    src={carFromCtx.photos[0]}
                    className="h-full w-full object-cover"
                    alt="Car"
                  />
                </div>
              ) : (
                <div className="w-full rounded-2xl bg-gray-100 aspect-video flex items-center justify-center text-sm text-gray-400">
                  no photo
                </div>
              )}
            </div>

            {/* Name */}
            <div id="name" className="mt-3">
              <p className="font-semibold text-lg text-gray-800">
                {carFromCtx?.model?.brands?.name} {carFromCtx?.model?.name}{" "}
                {carFromCtx?.year}
              </p>
              {carFromCtx?.licensePlate ? (
                <p className="w-fit border border-gray-600 rounded-sm p-1 text-gray-700 text-sm">
                  {carFromCtx.licensePlate}
                </p>
              ) : null}
            </div>
          </section>

          {/* Даты справа */}
          {/* <section id="datesRight" className="mt-4 text-sm"> */}
          {/* <div className="flex justify-between">
            <span className="text-gray-600">Start</span>
            <span className="text-gray-900">
              {format(parseISO(startAt), "dd MMM yyyy, HH:mm")}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-gray-600">End</span>
            <span className="text-gray-900">
              {format(parseISO(endAt), "dd MMM yyyy, HH:mm")}
            </span>
          </div> */}

          {/* Прогресс: только UI, статус НЕ меняем автоматически */}
          {/* <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-800">
                  {status === "rent" ? "Trip in progress" : "Trip progress"}
                </span>
                <span className="text-sm font-medium text-gray-800">
                  {tripProgress}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    status === "rent" ? "bg-lime-400" : "bg-gray-400"
                  }`}
                  style={{ width: `${tripProgress}%` }}
                />
              </div>
            </div> */}
          {/* </section> */}

          {/* Итоги справа */}
          {/* <section className="mt-4 text-sm">
          <div className="flex justify-between">
            <span>Total</span>
            <b>
              {price_total.toFixed(2)} {effectiveCurrency}
            </b>
          </div>
          <div className="flex justify-between mt-1">
            <span>Deposit</span>
            <b>
              {Number(deposit ?? 0).toFixed(2)} {effectiveCurrency}
            </b>
          </div>
        </section> */}

          {/* Даты + прогресс + отсчёт */}
          {mode === "edit" && mark === "booking" && (
            <>
              <section id="dates" className="md:mt-6">
                {status === "rent" && typeof tripProgress === "number" && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-800">
                        Trip progress
                      </span>
                      <span className="text-sm font-medium text-gray-800">
                        {tripProgress}%
                      </span>
                    </div>
                    <div
                      className="h-2 w-full rounded-full bg-gray-100 overflow-hidden"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={tripProgress}
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-500 bg-lime-400"
                        style={{ width: `${tripProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {status === "confirmed" ? (
                  <p className=" border rounded-md px-4 py-2">
                    Trip starts in:&nbsp;
                    {cdStart &&
                    (cdStart.days || cdStart.hours || cdStart.minutes) ? (
                      <>
                        {cdStart.days ? `${cdStart.days} d ` : ""}
                        {cdStart.hours} h {cdStart.minutes} m
                      </>
                    ) : (
                      <span>less than a minute</span>
                    )}
                  </p>
                ) : (
                  status === "onApproval" && (
                    <p className="border rounded-md px-4 py-2">
                      Confirm the guest's booking request as soon as possible.
                    </p>
                  )
                )}
              </section>
              <div className="hidden mt-6 space-y-2 lg:block">
                <button
                  className="w-full border rounded-md border-lime-400 text-lime-500 py-2 text-sm disabled:border-gray-300 disabled:text-gray-400"
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                >
                  Confirm booking
                </button>
                <button
                  className="w-full border rounded-md border-gray-300 text-gray-700 py-2 text-sm disabled:border-gray-300 disabled:text-gray-400"
                  onClick={handleCancel}
                  disabled={!canCancel}
                >
                  Cancel booking
                </button>
              </div>
            </>
          )}

          {/* Modal QR */}
          {qrOpen && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Booking QR code"
              onClick={() => setQrOpen(false)}
            >
              <div
                className="w-full max-w-sm sm:max-w-md rounded-2xl bg-white shadow-lg p-4 sm:p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-800">
                    Booking #{displayId}
                  </h2>
                  <button
                    className=" h-8 w-8 rounded-md hover:bg-gray-100 active:scale-[.98]"
                    onClick={() => setQrOpen(false)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-4 sm:mt-6">
                  {qrSrc ? (
                    <img
                      src={qrSrc}
                      alt="QR code"
                      className="mx-auto w-56 h-56 sm:w-72 sm:h-72 object-contain"
                    />
                  ) : (
                    <div className="mx-auto w-56 h-56 sm:w-72 sm:h-72 rounded-xl bg-gray-100 animate-pulse" />
                  )}
                </div>
                <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2">
                  <a
                    href={qrSrc ?? "#"}
                    download={`booking-${displayId}.png`}
                    className="flex-1 rounded-md bg-gray-900 text-white py-2.5 text-sm text-center active:scale-[.99] disabled:opacity-50"
                    onClick={(e) => {
                      if (!qrSrc) e.preventDefault();
                    }}
                  >
                    Download PNG
                  </a>
                  <button
                    onClick={async () => {
                      if (!bookingId) return;
                      try {
                        await navigator.clipboard.writeText(bookingId);
                      } catch {}
                    }}
                    className="flex-1 rounded-md border border-gray-300 text-gray-800 py-2.5 text-sm active:scale-[.99]"
                  >
                    Copy full ID
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        if (navigator.share && shareUrl) {
                          await navigator.share({
                            title: `Booking #${displayId}`,
                            url: shareUrl,
                          });
                        } else {
                          await navigator.clipboard.writeText(shareUrl);
                        }
                      } catch {}
                    }}
                    className="flex-1 rounded-md bg-blue-600 text-white py-2.5 text-sm active:scale-[.99]"
                  >
                    Share
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500 break-all">
                  {bookingId}
                </p>
              </div>
            </div>
          )}
          {/* Customer mini card */}
          {userId && selectedUser && mode !== "create" && (
            <section className=" mt-6 border border-gray-400 text-gray-700 rounded-md p-3 flex items-start gap-2">
              <div className="grow">
                <div className="font-medium">
                  {selectedUser.full_name ?? "—"}
                </div>
                <div className="text-xs text-gray-600">
                  {selectedUser.email ?? "—"}{" "}
                  {selectedUser.phone ? ` • ${selectedUser.phone}` : ""}
                </div>
              </div>
            </section>
          )}
        </aside>
      </div>

      {/* MOBILE ACTION BAR (floating) */}
      {showMobileActionBar && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <div
            className="px-4 py-3 flex gap-3 max-w-7xl mx-auto"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)",
            }}
          >
            {(status === "onApproval" || status === "confirmed") && (
              <button
                onClick={handleCancel}
                className="flex-1 border rounded-md border-gray-300 text-gray-700 py-3 text-sm active:scale-[.99] transition"
              >
                Cancel booking
              </button>
            )}
            {status === "onApproval" && (
              <button
                onClick={handleConfirm}
                className="flex-1 rounded-md border border-lime-400 text-lime-500 py-3 text-sm active:scale-[.99] transition"
              >
                Confirm booking
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
