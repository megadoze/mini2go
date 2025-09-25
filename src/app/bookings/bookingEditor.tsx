import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  differenceInMinutes,
  format,
  isAfter,
  isEqual,
  parseISO,
  startOfDay,
} from "date-fns";
import { Select, Checkbox, Badge, Loader } from "@mantine/core";
import {
  searchUsers,
  createUserProfile,
  getUserById,
} from "@/services/user.service";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import { subscribeBooking } from "@/services/bookings.service";
import { QK } from "@/queryKeys";
import RentalDateTimePicker from "@/components/RentalDateTimePicker";
// +++ для блока адреса доставки
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Map,
  Marker,
  FullscreenControl,
  ScaleControl,
  NavigationControl,
  GeolocateControl,
} from "react-map-gl/mapbox";
import { AddressAutofill } from "@mapbox/search-js-react";
import Pin from "@/components/pin";
import { fetchAddressFromCoords } from "@/services/geo.service";
import type { MapRef, ViewState } from "react-map-gl/mapbox";

// ========== Types ===========
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

/* ===================== УТИЛИТЫ ===================== */

function minutesSinceMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

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

  const snapshot = location.state?.snapshot as any;

  const { id: carIdFromCarsRoute, bookingId } = useParams();

  const qc = useQueryClient();

  const hasMatchingSnapshot =
    Boolean(snapshot?.booking?.id) && snapshot!.booking.id === bookingId;

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

  const [saving, setSaving] = useState(false);

  const [mark, setMark] = useState<"booking" | "block">(
    (snapshot?.booking.mark as any) ?? "booking"
  );

  /* ---------- initialData из snapshot/кэша ---------- */
  const initialBooking = useMemo(() => {
    // 1) из snapshot
    const fromSnap = hasMatchingSnapshot ? snapshot.booking : undefined;
    if (fromSnap) return fromSnap;

    // 2) из контекста (carCtx.bookings)
    const fromCtx = bookingId
      ? (carFromCtx?.bookings as Booking[] | undefined)?.find(
          (b) => b.id === bookingId
        )
      : undefined;
    if (fromCtx) return fromCtx;

    // 3) из кэша React Query
    return bookingId ? qc.getQueryData(["booking", bookingId]) : undefined;
  }, [hasMatchingSnapshot, snapshot?.booking, bookingId, carFromCtx, qc]);

  const bookingQ = useQuery({
    queryKey: QK.booking(bookingId!),
    queryFn: () => fetchBookingById(bookingId!),
    enabled: mode === "edit" && !!bookingId && !initialBooking,
    initialData: initialBooking,
    staleTime: 60_000,
    refetchOnMount: false,
  });

  const initialExtras = useMemo(() => {
    const fromSnap =
      Array.isArray(snapshot?.booking_extras) &&
      snapshot.booking_extras.length > 0
        ? snapshot.booking_extras
        : undefined;

    if (fromSnap) return fromSnap;

    if (bookingId) {
      return qc.getQueryData(QK.bookingExtras(bookingId));
    }
    return undefined;
  }, [snapshot?.booking_extras, bookingId, qc]);

  const userIdForQ: string | undefined =
    initialBooking?.user_id ?? snapshot?.booking?.user_id ?? undefined;

  const initialUser = useMemo(() => {
    const fromSnap = snapshot?.booking?.user as any | undefined;
    if (fromSnap) return fromSnap;
    return userIdForQ ? qc.getQueryData<any>(["user", userIdForQ]) : undefined;
  }, [snapshot?.booking?.user, userIdForQ, qc]);

  const extrasQ = useQuery({
    queryKey: QK.bookingExtras(bookingId!),
    queryFn: () => fetchBookingExtras(bookingId!),
    enabled:
      mode === "edit" &&
      !!bookingId &&
      (snapshot?.booking?.mark ?? mark) === "booking" &&
      (!initialExtras ||
        (Array.isArray(initialExtras) && initialExtras.length === 0)),
    initialData: initialExtras,
    staleTime: 60_000,
    refetchOnMount: false,
  });

  // экстра, сохранённые в самой броне (фиксируем цену/название/price_type)
  const bookedExtras = useMemo(() => {
    const rows = Array.isArray(extrasQ.data)
      ? extrasQ.data
      : Array.isArray(initialExtras)
      ? initialExtras
      : [];
    // ожидаем, что в booking_extras лежат: extra_id, title, price, price_type, qty
    return rows.map((r: any) => ({
      id: String(r.extra_id),
      title: r.title ?? "Extra",
      price: Number(r.price ?? 0),
      price_type: (r.price_type ?? "per_trip") as
        | "per_trip"
        | "per_day"
        | string,
      qty: Number(r.qty ?? 1),
    }));
  }, [extrasQ.data, initialExtras]);

  const userQ = useQuery({
    queryKey: ["user", userIdForQ],
    queryFn: () => getUserById(userIdForQ!),
    enabled: !!userIdForQ && !initialUser,
    initialData: initialUser,
    staleTime: 5 * 60_000,
    refetchOnMount: false,
  });

  const [userId, setUserId] = useState<string | null>(
    snapshot?.booking?.user_id ?? null
  );
  const [selectedUser, setSelectedUser] = useState<any | null>(
    snapshot?.booking?.user ?? null
  );
  const [startAt, setStartAt] = useState<string>(
    snapshot?.booking?.start_at || ""
  );
  const [endAt, setEndAt] = useState<string>(snapshot?.booking?.end_at || "");
  const [startDateInp, setStartDateInp] = useState<string>(
    snapshot?.booking?.start_at || ""
  );
  const [endDateInp, setEndDateInp] = useState<string>(
    snapshot?.booking?.end_at || ""
  );

  // Прокладка между календарём и существующими стейтами startDateInp/endDateInp
  const calendarRange = useMemo(
    () => ({
      startAt: startDateInp ? new Date(startDateInp) : null,
      endAt: endDateInp ? new Date(endDateInp) : null,
    }),
    [startDateInp, endDateInp]
  );

  const [status, setStatus] = useState<string | null>(
    hasMatchingSnapshot ? snapshot?.booking?.status ?? null : null
  );

  const [deposit, setDeposit] = useState<number>(
    typeof snapshot?.booking?.deposit === "number"
      ? Number(snapshot!.booking.deposit)
      : Number((carFromCtx as any)?.deposit ?? 0)
  );

  const [saved, setSaved] = useState(false);

  // Extras UI: мгновенно из initialExtras
  const [pickedExtras, setPickedExtras] = useState<string[]>(() =>
    Array.isArray(initialExtras)
      ? initialExtras.map((r: any) => String(r.extra_id))
      : []
  );

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

  const [pickerOpen, setPickerOpen] = useState(false);

  // Delivery
  type DeliveryOption = "car_address" | "by_address";
  const deliveryEnabled = Boolean((carFromCtx as any)?.isDelivery);

  const [delivery, setDelivery] = useState<DeliveryOption>(
    (snapshot?.booking?.delivery_type as any) ?? "car_address"
  );

  const [deliveryFeeValue, setDeliveryFeeValue] = useState<number>(() => {
    if (typeof snapshot?.booking?.delivery_fee === "number") {
      return Number(snapshot!.booking.delivery_fee);
    }
    const def = Number((carFromCtx as any)?.deliveryFee ?? 0);
    const isByAddr =
      ((snapshot?.booking?.delivery_type as any) ?? "car_address") ===
      "by_address";
    return isByAddr ? def : 0;
  });

  // +++ адрес доставки (для delivery === "by_address")
  const [deliveryAddress, setDeliveryAddress] = useState<string>(
    (snapshot?.booking?.delivery_address as string) ?? ""
  );
  const [deliveryLat, setDeliveryLat] = useState<number | null>(
    (snapshot?.booking?.delivery_lat as number) ?? null
  );
  const [deliveryLong, setDeliveryLong] = useState<number | null>(
    (snapshot?.booking?.delivery_long as number) ?? null
  );

  // страна/город для delivery
  const [deliveryCountry, setDeliveryCountry] = useState<string>(
    (snapshot?.booking?.delivery_country as string) ?? ""
  );
  const [deliveryCity, setDeliveryCity] = useState<string>(
    (snapshot?.booking?.delivery_city as string) ?? ""
  );

  const toNum = (v: unknown, fallback: number) =>
    Number.isFinite(Number(v)) ? Number(v) : fallback;

  const initialLat = toNum(deliveryLat ?? carFromCtx?.lat, 50.45);
  const initialLng = toNum(deliveryLong ?? carFromCtx?.long, 30.52);

  // карта: управляемый viewState + ref
  const [mapView, setMapView] = useState<ViewState>({
    latitude: initialLat,
    longitude: initialLng,
    zoom: 12,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  const mapRef = useRef<MapRef | null>(null);

  // QR
  const [qrOpen, setQrOpen] = useState(false);
  const [qrSrc, setQrSrc] = useState<string | null>(null);

  // disabledIntervals для занятых/заблокированных периодов (кроме текущей записи и отменённых)
  const disabledIntervals = useMemo(() => {
    const cached =
      (carFromCtx?.bookings as Booking[] | undefined) ??
      qc.getQueryData<Booking[]>(QK.bookingsByCarId(String(carId))) ??
      [];
    return (cached || [])
      .filter(
        (b) =>
          b.id !== bookingId && !String(b.status ?? "").startsWith("canceled")
      )
      .map((b) => ({ start: new Date(b.start_at), end: new Date(b.end_at) }));
  }, [carFromCtx?.bookings, qc, carId, bookingId]);

  const handleCalendarChange = (next: {
    startAt: Date | null;
    endAt: Date | null;
  }) => {
    setStartDateInp(next.startAt ? next.startAt.toISOString() : "");
    setEndDateInp(next.endAt ? next.endAt.toISOString() : "");
  };

  const isFinished =
    status === "finished" ||
    status === "canceledHost" ||
    status === "canceledClient";

  const isDisabled = status === "rent" || status === "block" || isFinished;

  // ДО JSX
  const s = String(status);
  const backOnly =
    s === "rent" ||
    s === "finished" ||
    s === "canceled" ||
    s === "canceledHost" ||
    s === "canceledClient" ||
    s.startsWith("canceled");

  // Лайв-тик раз в 30 сек
  const [tick, setTick] = useState(0);

  const isISO = (s?: string | null) => !!s && !Number.isNaN(Date.parse(s));

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = pickerOpen ? "hidden" : prev || "";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pickerOpen]);

  useEffect(() => {
    const t = window.setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const now = useMemo(() => new Date(), [tick]);

  const isLoading =
    mode === "edit" ? bookingQ.isLoading && !bookingQ.data : false;

  useEffect(() => {
    if (
      mode === "edit" &&
      bookingId &&
      !isLoading &&
      location.state?.snapshot
    ) {
      navigate(location.pathname + location.search, {
        replace: true,
        state: {
          from: location.state.from, // сохраняем откуда пришли
        },
      });
    }
  }, [mode, bookingId, location, isLoading, navigate]);

  useEffect(() => {
    const b = bookingQ.data as any;
    if (!b) return;
    // единственная точка гидратации локального UI-состояния
    setDelivery(b.delivery_type ?? "car_address");
    setDeliveryFeeValue(Number(b.delivery_fee ?? 0));
    // +++ гидратация адреса доставки
    setDeliveryAddress(b.delivery_address ?? "");
    setDeliveryLat(typeof b.delivery_lat === "number" ? b.delivery_lat : null);
    setDeliveryLong(
      typeof b.delivery_long === "number" ? b.delivery_long : null
    );

    if (!hasMatchingSnapshot) {
      setMark(b.mark);
      setUserId(b.user_id ?? null);
      setStartAt(b.start_at);
      setEndAt(b.end_at);
      setStartDateInp(b.start_at);
      setEndDateInp(b.end_at);
      setStatus(b.status ?? null);
      setDeposit(Number(b.deposit ?? 0));
    }
    if (b.delivery_lat != null && b.delivery_long != null) {
      (async () => {
        try {
          const a = await fetchAddressFromCoords(
            b.delivery_lat,
            b.delivery_long
          );
          setDeliveryCountry(a?.country || "");
          setDeliveryCity(a?.city || "");
        } catch {
          /* empty */
        }
      })();
    }
  }, [bookingQ.data, hasMatchingSnapshot]);

  useEffect(() => {
    if (!bookingId) return;
    const unsubscribe = subscribeBooking(bookingId, () => {
      qc.invalidateQueries({ queryKey: QK.booking(bookingId) });
      qc.invalidateQueries({ queryKey: QK.bookingExtras(bookingId) });
      if (carId) qc.invalidateQueries({ queryKey: QK.bookingsByCarId(carId) });
    });
    return unsubscribe;
  }, [bookingId, carId, qc]);

  // если initialExtras не было, но extrasQ догрузил — заполнить чекбоксы
  useEffect(() => {
    if (!Array.isArray(initialExtras) && Array.isArray(extrasQ.data)) {
      setPickedExtras(extrasQ.data.map((r: any) => String(r.extra_id)));
    }
  }, [extrasQ.data]); // initialExtras намеренно не в deps

  // пользователь
  useEffect(() => {
    if (userQ.data && !snapshot?.booking?.user) {
      setSelectedUser(userQ.data);
    }
  }, [userQ.data, snapshot?.booking?.user]);

  useEffect(() => {
    if (mode !== "create" || hasMatchingSnapshot) return;

    const qStart = sp.get("start");
    const qEnd = sp.get("end");

    if (isISO(qStart)) {
      setStartAt(qStart!);
      setStartDateInp(qStart!);
    }
    if (isISO(qEnd)) {
      setEndAt(qEnd!);
      setEndDateInp(qEnd!);
    }

    setMark(sp.get("mark") === "block" ? "block" : "booking");
    setStatus("onApproval");
    setDeposit(Number((carFromCtx as any)?.deposit ?? 0));
    setDelivery("car_address");
    setDeliveryFeeValue(0);
    // локальный loading больше не используем
  }, [mode, hasMatchingSnapshot, sp, carFromCtx]);

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

  // map экстра
  const extrasMap = useMemo(() => {
    // Утилита доставания значений с несколькими вариантами ключей
    const pick = (obj: any, ...paths: string[]) => {
      for (const p of paths) {
        const v = p.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
        if (v !== undefined) return v;
      }
      return undefined;
    };

    // 1) Активные экстра из контекста
    const activeList = (extras ?? [])
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
        return { id, title, price, price_type, inactive: false as boolean };
      });

    // 2) Зафиксированные экстра из booking_extras (то, что реально в броне)
    const bookedById: Record<
      string,
      { id: string; title: string; price: number; price_type: string }
    > = {};
    for (const b of bookedExtras) {
      bookedById[b.id] = {
        id: b.id,
        title: b.title,
        price: b.price,
        price_type: b.price_type,
      };
    }

    // 3) Слить: начинаем с активных; если экстра есть в брони — перезаписываем её полями из брони (фиксируем цену/название/тип)
    const byId: Record<
      string,
      {
        id: string;
        title: string;
        price: number;
        price_type: "per_trip" | "per_day" | string;
        inactive: boolean;
      }
    > = {};

    for (const ex of activeList) {
      const locked = bookedById[ex.id];
      byId[ex.id] = locked
        ? { ...locked, inactive: false }
        : { ...ex, inactive: false };
    }

    // 4) Добавляем те, которых больше нет среди активных, но они есть в брони — помечаем как inactive, но НЕ выкидываем
    for (const id of Object.keys(bookedById)) {
      if (!byId[id]) {
        byId[id] = { ...bookedById[id], inactive: true };
      }
    }

    // Список для UI — сортируем, чтобы «неактивные» шли ниже
    const list = Object.values(byId).sort((a, b) => {
      if (a.inactive === b.inactive) return a.title.localeCompare(b.title);
      return a.inactive ? 1 : -1;
    });

    return { list, byId };
  }, [extras, bookedExtras]);

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

  const deliveryFee = useMemo(
    () => (delivery === "by_address" ? Number(deliveryFeeValue || 0) : 0),
    [delivery, deliveryFeeValue]
  );

  const price_total = useMemo(() => {
    const addons = mark === "booking" ? extrasTotal + deliveryFee : 0;
    return Math.round((baseTotal + addons) * 100) / 100;
  }, [baseTotal, extrasTotal, deliveryFee, mark]);

  function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return aStart < bEnd && bStart < aEnd;
  }
  // гарантирует list: Booking[]
  async function assertNoConflicts(
    carId: string,
    startIso: string,
    endIso: string,
    selfId?: string
  ) {
    // 1) строго берём из кэша
    let list = qc.getQueryData<Booking[]>(QK.bookingsByCarId(String(carId)));

    // 2) если кэша нет — один fetch, с правильной типизацией
    if (!list) {
      list = await qc.ensureQueryData<Booking[]>({
        queryKey: QK.bookingsByCarId(String(carId)),
        queryFn: () => fetchBookingsByCarId(String(carId)),
      });
    }
    // к этому месту list точно Booking[]
    const s = new Date(startIso);
    const e = new Date(endIso);

    // пересечение периодов
    const clash = list.find(
      (b) =>
        b.id !== selfId &&
        !String(b.status ?? "").startsWith("canceled") &&
        overlaps(s, e, new Date(b.start_at), new Date(b.end_at))
    );
    if (clash)
      throw new Error("This period overlaps with another booking/block");

    // интервал между бронями
    if (effectiveIntervalBetweenBookings > 0) {
      const gapMin = effectiveIntervalBetweenBookings;

      const tooClose = list.find((b) => {
        if (b.id === selfId || String(b.status ?? "").startsWith("canceled"))
          return false;
        const bs = new Date(b.start_at);
        const be = new Date(b.end_at);

        if (be <= s) return differenceInMinutes(s, be) < gapMin;
        if (e <= bs) return differenceInMinutes(bs, e) < gapMin;
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

  function upsertBookingsIndexRow(
    qc: ReturnType<typeof useQueryClient>,
    saved: Booking
  ) {
    // пробуем найти ВСЕ bookingsIndex ключи и обновить их
    qc.setQueriesData<Booking[]>(
      {
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "bookingsIndex",
      },
      (prev) => {
        if (!prev) return prev;
        const idx = prev.findIndex((r) => r.id === saved.id);
        const patch: Partial<Booking> = {
          start_at: saved.start_at,
          end_at: saved.end_at,
          status: saved.status ?? null,
          mark: saved.mark,
          car_id: String(saved.car_id),
          user_id: saved.user_id ?? null,
          price_total: saved.price_total ?? null,
          currency: saved.currency,
        };
        if (idx === -1) {
          return [
            {
              ...(patch as Booking),
              id: saved.id,
              created_at: saved.created_at ?? new Date().toISOString(),
            },
            ...prev,
          ];
        }
        const next = prev.slice();
        next[idx] = { ...next[idx], ...patch };
        return next;
      }
    );
  }

  // === УНИВЕРСАЛЬНЫЙ ТРИГГЕР ОБНОВЛЕНИЙ КЭША ==================================
  function touchBookingCache(
    qc: ReturnType<typeof useQueryClient>,
    saved: Booking
  ) {
    qc.setQueryData(QK.booking(saved.id), saved);
    if (saved.car_id) {
      qc.invalidateQueries({ queryKey: QK.bookingsByCarId(saved.car_id) });
    }
    qc.invalidateQueries({ queryKey: QK.bookingExtras(saved.id) });
    upsertBookingsIndexRow(qc, saved); // <— сюда
  }

  function upsertById(list: Booking[], row: Booking) {
    const i = list.findIndex((x) => x.id === row.id);
    if (i === -1) return [row, ...list];
    const next = list.slice();
    next[i] = { ...next[i], ...row };
    return next;
  }

  function patchCalendarWindowsCache(
    qc: ReturnType<typeof useQueryClient>,
    saved: Booking
  ) {
    // 1) оптимистично патчим активные окна в кэше
    qc.setQueriesData<any>(
      {
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
      },
      (win: {
        rangeStart: string | number | Date;
        rangeEnd: string | number | Date;
        cars: any;
      }) => {
        if (!win) return win;
        const wStart = new Date(win.rangeStart);
        const wEnd = new Date(win.rangeEnd);
        const bStart = new Date(saved.start_at);
        const bEnd = new Date(saved.end_at);

        // пересекается ли бронь с окном
        const intersects = !(bEnd < wStart || bStart > wEnd);
        if (!intersects) return win;

        return {
          ...win,
          cars: (win.cars ?? []).map((c: any) =>
            String(c.id) === String(saved.car_id)
              ? { ...c, bookings: upsertById(c.bookings ?? [], saved) }
              : c
          ),
        };
      }
    );

    // 2) и триггерим refetch активных окон
    qc.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
    });
  }

  // === ОПТИМИСТИЧЕСКИЕ ХЕЛПЕРЫ (необязательно, но приятно) ====================
  async function createBookingOptimistic(
    qc: ReturnType<typeof useQueryClient>,
    payload: Omit<Booking, "id">
  ) {
    const tempId = `temp-${Date.now()}`;
    const temp: Booking = { ...(payload as any), id: tempId };

    const listKey = QK.bookingsByCarId(String(payload.car_id));
    const prev = qc.getQueryData<Booking[]>(listKey) ?? [];

    // оптимистично добавляем в список
    qc.setQueryData(listKey, [temp, ...prev]);

    try {
      const saved = await createBooking(payload as any);
      // заменяем временную запись реальной
      qc.setQueryData(listKey, (curr?: Booking[]) =>
        (curr ?? []).map((b) => (b.id === tempId ? saved : b))
      );
      touchBookingCache(qc, saved);
      patchCalendarWindowsCache(qc, saved);

      return saved;
    } catch (e) {
      // откат
      qc.setQueryData(listKey, prev);
      throw e;
    }
  }

  async function updateBookingOptimistic(
    qc: ReturnType<typeof useQueryClient>,
    id: string,
    patch: Partial<Booking>
  ) {
    const prev = qc.getQueryData<Booking>(QK.booking(id));
    if (prev) {
      const optimistic = { ...prev, ...patch } as Booking;
      qc.setQueryData(QK.booking(id), optimistic);
      if (optimistic.car_id) {
        const listKey = QK.bookingsByCarId(String(optimistic.car_id));
        const prevList = qc.getQueryData<Booking[]>(listKey);
        if (prevList) {
          qc.setQueryData(
            listKey,
            prevList.map((b) => (b.id === id ? optimistic : b))
          );
        }
      }
    }
    try {
      const saved = await updateBooking(id, patch);
      touchBookingCache(qc, saved);
      patchCalendarWindowsCache(qc, saved);

      return saved;
    } catch (e) {
      // точечный откат
      if (prev) qc.setQueryData(QK.booking(id), prev);
      throw e;
    }
  }

  // === ЗАМЕНА: mutateBooking (используй везде вместо прямого updateBooking) ===
  async function mutateBooking(id: string, payload: Partial<Booking>) {
    const next = await updateBookingOptimistic(qc, id, payload);
    return next;
  }

  async function handleSave() {
    setError(null);
    setSaving(true);

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

    // +++ проверка адреса для доставки
    if (delivery === "by_address") {
      if (
        !deliveryAddress?.trim() ||
        deliveryLat == null ||
        deliveryLong == null
      ) {
        setError("Please select a delivery address (pin on map or search).");
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

    const basePayload: Omit<Booking, "id"> & { deposit?: number | null } = {
      car_id: carId,
      user_id: mark === "booking" ? userId : null,
      start_at: new Date(startDateInp).toISOString(),
      end_at: new Date(endDateInp).toISOString(),
      mark,
      price_per_day: mark === "booking" ? baseDailyPrice : null,
      price_total: mark === "booking" ? price_total : null,
      deposit: mark === "booking" ? deposit : null,
      delivery_type: delivery,
      delivery_fee: deliveryFee,
      currency: effectiveCurrency,
      delivery_address: delivery === "by_address" ? deliveryAddress : null,
      delivery_lat: delivery === "by_address" ? deliveryLat : null,
      delivery_long: delivery === "by_address" ? deliveryLong : null,
    };

    const payload =
      mode === "create"
        ? {
            ...basePayload,
            status: mark === "booking" ? "onApproval" : "block",
          }
        : basePayload;

    try {
      let saved: Booking;
      if (mode === "create") {
        // оптимистическое создание
        saved = await createBookingOptimistic(
          qc,
          payload as Omit<Booking, "id">
        );
      } else {
        // оптимистическое обновление
        saved = await updateBookingOptimistic(
          qc,
          bookingId!,
          payload as Partial<Booking>
        );
      }

      // Сохраняем экстра-услуги

      if (mark === "booking") {
        const fresh = pickedExtras.map((id) => {
          const ex = extrasMap.byId[id];
          const qty = ex?.price_type === "per_day" ? billableDaysForExtras : 1;
          return {
            extra_id: id,
            title: ex?.title ?? "Extra",
            qty,
            price: ex?.price ?? 0,
            price_type: ex?.price_type ?? "per_trip",
          };
        });

        await upsertBookingExtras(saved.id, fresh);
        qc.setQueryData(QK.bookingExtras(saved.id), fresh);
      }

      if (saved.car_id) {
        touchBookingCache(qc, saved);
        patchCalendarWindowsCache(qc, saved);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);

      // Обновим контекстные брони и возвращаемся на календарь (или назад)
      if ((carFromCtx as any)?.id === saved.car_id) {
        setCar?.((prev: any) => prev);
        setTimeout(
          () =>
            navigate(location.state?.from ?? `/cars/${saved.car_id}/calendar`),
          1000
        );
      } else {
        navigate(location.state?.from ?? -1);
      }
    } catch (e: any) {
      setError(e?.message ?? "Save error");
    } finally {
      setSaving(false);
    }
  }

  // подтверждение / отмена
  const canConfirm = mark === "booking" && status === "onApproval";
  const canCancel =
    mark === "booking" && (status === "onApproval" || status === "confirmed");

  const handleConfirm = async () => {
    if (!bookingId) return;
    try {
      const next = await updateBookingOptimistic(qc, bookingId, {
        status: "confirmed",
      } as any);
      setStatus(next.status ?? "confirmed");
    } catch (e: any) {
      setError(e?.message ?? "Confirm error");
    }
  };

  const handleCancel = async () => {
    if (!bookingId) return;
    try {
      const next = await updateBookingOptimistic(qc, bookingId, {
        status: "canceledHost",
      } as any);
      setStatus(next.status ?? "canceledHost");
    } catch (e: any) {
      setError(e?.message ?? "Cancel error");
    }
  };

  // QR подготовка
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
  const startDate = useMemo(
    () => (isISO(startAt) ? parseISO(startAt) : null),
    [startAt]
  );

  const endDate = useMemo(
    () => (isISO(endAt) ? parseISO(endAt) : null),
    [endAt]
  );
  const totalMs =
    startDate && endDate
      ? Math.max(0, endDate.getTime() - startDate.getTime())
      : 0;
  const elapsedMs = startDate
    ? Math.max(0, now.getTime() - startDate.getTime())
    : 0;

  const tripProgress =
    totalMs > 0
      ? Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)))
      : 0;

  const isChanged = useMemo(() => {
    if (mode === "create") return true;

    const s0 = startAt ? parseISO(startAt) : null;
    const s1 = startDateInp ? parseISO(startDateInp) : null;
    const e0 = endAt ? parseISO(endAt) : null;
    const e1 = endDateInp ? parseISO(endDateInp) : null;

    const datesChanged =
      (!!s0 && !!s1 && !isEqual(s0, s1)) || (!!e0 && !!e1 && !isEqual(e0, e1));

    const extrasIds0 = (extrasQ.data ?? [])
      .map((e: any) => String(e.extra_id))
      .sort();
    const extrasIds1 = pickedExtras.slice().sort();
    const extrasChanged =
      JSON.stringify(extrasIds0) !== JSON.stringify(extrasIds1);

    // helper сравнения чисел (координаты/fee)
    const eqNum = (
      a: number | null | undefined,
      b: number | null | undefined
    ) => {
      if (a == null && b == null) return true;
      if (a == null || b == null) return false;
      return Math.abs(Number(a) - Number(b)) < 1e-6;
    };

    const initialDeliveryType = (bookingQ.data?.delivery_type ??
      "car_address") as DeliveryOption;
    const initialAddr = bookingQ.data?.delivery_address ?? "";
    const initialLat = bookingQ.data?.delivery_lat ?? null;
    const initialLong = bookingQ.data?.delivery_long ?? null;
    const initialFee = Number(bookingQ.data?.delivery_fee ?? 0);

    // текущее (из UI)
    const currentType = delivery;
    const currentAddr = delivery === "by_address" ? deliveryAddress ?? "" : "";
    const currentLat = delivery === "by_address" ? deliveryLat : null;
    const currentLong = delivery === "by_address" ? deliveryLong : null;
    const currentFee = Number(deliveryFee ?? 0); // уже учитывает тип

    const deliveryChanged =
      initialDeliveryType !== currentType ||
      (currentType === "by_address" &&
        ((initialAddr || "") !== (currentAddr || "") ||
          !eqNum(initialLat, currentLat) ||
          !eqNum(initialLong, currentLong) ||
          !eqNum(initialFee, currentFee))) ||
      // если вернулись в car_address — fee должен быть 0
      (currentType === "car_address" && !eqNum(currentFee, 0));

    return datesChanged || extrasChanged || deliveryChanged;
  }, [
    mode,
    startAt,
    startDateInp,
    endAt,
    endDateInp,
    extrasQ.data,
    pickedExtras,
    bookingQ.data?.delivery_type,
    bookingQ.data?.delivery_address,
    bookingQ.data?.delivery_lat,
    bookingQ.data?.delivery_long,
    bookingQ.data?.delivery_fee,
    delivery,
    deliveryAddress,
    deliveryLat,
    deliveryLong,
    deliveryFee,
  ]);

  const countdownParts = (target?: Date | null) => {
    if (!target) return null as any;
    const diffMs = Math.max(0, target.getTime() - now.getTime());
    const totalMin = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const minutes = totalMin % 60;
    return { days, hours, minutes };
  };

  const cdStart = useMemo(
    () => (startDate ? countdownParts(startDate) : null),
    [startDate, now]
  );

  // автопрогрессия статусов (rent/finished)
  useEffect(() => {
    if (!bookingId || !startDate || !endDate || !status) return;

    const terminal = ["canceledHost", "canceledClient", "finished"];
    if (mark !== "booking" || terminal.includes(status)) return;

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

    if (status === "confirmed" && started) {
      void goRent();
      return;
    }
    if (status === "rent" && finished) {
      void goFinished();
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bookingId,
    mark,
    status,
    startDate?.getTime?.(),
    endDate?.getTime?.(),
    now.getTime(),
  ]);

  // статус UI
  const statusView = useMemo(() => {
    const s = status;
    if (s === "rent") return { text: s, cls: "green" };
    if (s === "confirmed") return { text: s, cls: "orange" };
    if (s === "onApproval") return { text: s, cls: "blue" };
    if (s === "finished") return { text: s, cls: "dark" };
    if (s?.startsWith("canceled")) return { text: s, cls: "red" };
    return { text: "unknown", cls: "gray" };
  }, [status]);

  // плавающая мобильная панель
  const showMobileActionBar =
    status && (status === "confirmed" || status === "onApproval");

  const containerPad = showMobileActionBar ? "pb-24 lg:pb-0" : "";

  // если backOnly === true — принудительно показываем бар
  const showBar = showMobileActionBar || backOnly;

  const deliveryOptions = useMemo(() => {
    const opts = [
      {
        value: "car_address",
        label: `Pickup at car address${
          (carFromCtx as any)?.address
            ? ` (${(carFromCtx as any).address})`
            : ""
        }`,
      },
    ];
    if (deliveryEnabled || delivery === "by_address") {
      opts.push({
        value: "by_address",
        label: "Delivery to customer's address",
      });
    }
    return opts;
  }, [deliveryEnabled, delivery, carFromCtx]);

  if (isLoading) return <div className="p-4">Loading…</div>;

  return (
    <div className={`text-gray-800 max-w-4xl ${containerPad}`}>
      {/* Header */}
      <div className="flex flex-wrap flex-col md:flex-row justify-between md:items-center">
        <div className="flex items-center gap-2">
          <h1 className="font-roboto text-xl md:text-2xl font-medium md:font-semibold">
            {mode === "create" && mark === "booking" ? (
              "New Booking"
            ) : mark === "block" ? (
              "Block dates"
            ) : (
              <>
                Booking #
                <span className=" font-normal text-green-500">{displayId}</span>
              </>
            )}
          </h1>
          {mark === "booking" && mode === "edit" && (
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
            fw={500}
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
            />{" "}
            Booking
          </label>
          <label>
            <input
              type="radio"
              name="mark"
              checked={mark === "block"}
              onChange={() => setMark("block")}
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
                    className={`${
                      isFinished && "opacity-50"
                    } h-full w-full object-cover`}
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
                <p className="w-fit border border-gray-200 shadow-sm rounded-sm p-1 text-gray-700 text-sm">
                  {carFromCtx.licensePlate}
                </p>
              ) : null}
            </div>
          </section>

          {/* Даты проката */}
          <section id="dates">
            <p className="font-medium text-base sm:text-lg text-gray-800">
              Dates of trip
            </p>
            {/* Триггер-поле: открывает полноэкранный оверлей с календарём */}
            {!isFinished ? (
              status !== "rent" ? (
                <button
                  type="button"
                  className={`mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-left hover:bg-gray-50 active:scale-[.999] $isDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
                  onClick={() => !isDisabled && setPickerOpen(true)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 md:py-1">
                      <CalendarDaysIcon className="size-5 text-gray-700" />
                      <div>
                        {/* <div className="text-xs text-gray-500">
                          Rental period
                        </div> */}
                        <div className="text-sm font-medium text-gray-800">
                          {startDateInp && endDateInp
                            ? `${format(
                                new Date(startDateInp).toISOString(),
                                "d MMM, HH:mm"
                              )} — ${format(
                                new Date(endDateInp).toISOString(),
                                "d MMM, HH:mm"
                              )}`
                            : "Select start and end"}
                        </div>
                      </div>
                    </div>
                    <ChevronRightIcon className=" size-4 text-gray-400" />
                  </div>
                </button>
              ) : (
                <p className="mt-2 inline-flex items-center gap-2">
                  <CalendarDaysIcon className="size-5" />
                  {format(
                    new Date(startDateInp).toISOString(),
                    "d MMM yy, hh:mm"
                  )}
                  <ArrowRightIcon className="size-4 text-gray-700" />
                  {format(new Date(endDateInp).toISOString(), "d MMM yy, h:mm")}
                </p>
              )
            ) : (
              <p className="line-through mt-2">
                {fmt(startDateInp)} — {fmt(endDateInp)}
              </p>
            )}

            {!isFinished && (
              <div className="text-xs text-gray-500 mt-2">
                {effectiveOpenTime === effectiveCloseTime ? (
                  "Working hours: 24/7"
                ) : (
                  <>
                    Working hours: {mmToHHMM(effectiveOpenTime)} –{" "}
                    {mmToHHMM(effectiveCloseTime)}
                  </>
                )}
              </div>
            )}

            <div className="mt-5">
              Duration:{" "}
              <span>
                {durationDays}d {durationHours}h {durationMinutes}m
              </span>
            </div>
          </section>

          {/* Прогресс бар */}
          <section>
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
                    className="h-full rounded-full transition-[width] duration-500 bg-green-400/90"
                    style={{ width: `${tripProgress}%` }}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Клиент: только в create-режиме */}
          {mark === "booking" && mode === "create" && (
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
                          });
                          setUserId(created.profile.id);
                          setSelectedUser(created.profile);
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
                <div className="mt-2 border border-green-400 rounded p-2 text-sm flex items-start gap-2">
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
                value={delivery}
                onChange={async (v: any) => {
                  const next = (v ?? "car_address") as DeliveryOption;
                  setDelivery(next);

                  if (next === "car_address") {
                    setDeliveryFeeValue(0);
                    return;
                  }

                  // next === "by_address"
                  if (
                    !deliveryFeeValue &&
                    (carFromCtx as any)?.deliveryFee != null
                  ) {
                    setDeliveryFeeValue(
                      Number((carFromCtx as any).deliveryFee)
                    );
                  }

                  // если адрес ещё пуст — подставляем "текущий" (как в AddCar):
                  if (
                    !deliveryAddress &&
                    carFromCtx?.lat != null &&
                    carFromCtx?.long != null
                  ) {
                    // 1) координаты берем из машины
                    const lat = Number(carFromCtx.lat);
                    const lng = Number(carFromCtx.long);
                    setDeliveryLat(lat);
                    setDeliveryLong(lng);

                    try {
                      // 2) обратное геокодирование адреса
                      const addr = await fetchAddressFromCoords(lat, lng);
                      setDeliveryAddress(
                        addr?.address || carFromCtx?.address || ""
                      );
                      setDeliveryCountry(addr?.country || "");
                      setDeliveryCity(addr?.city || "");
                    } catch {
                      setDeliveryAddress(carFromCtx?.address || "");
                      setDeliveryCountry("");
                      setDeliveryCity("");
                    }

                    // 3) подвинем карту
                    setMapView((prev) => ({
                      ...prev,
                      latitude: lat,
                      longitude: lng,
                      zoom: 13,
                    }));
                    mapRef.current?.flyTo({
                      center: [lng, lat],
                      zoom: 13,
                      essential: true,
                    });
                  }
                }}
                data={deliveryOptions}
                readOnly={isDisabled}
                radius="md"
                className={isDisabled ? "opacity-60" : ""}
                classNames={{
                  input: isDisabled
                    ? "!cursor-not-allowed focus:border-gray-300"
                    : "",
                }}
              />

              <div className="text-xs text-gray-600 mt-1">
                Delivery fee:{" "}
                <b>
                  {deliveryFee.toFixed(2)} {effectiveCurrency}
                </b>
              </div>
              {/* +++ адресный блок — показываем только при by_address */}
              {delivery === "by_address" && (
                <div
                  className={`mt-3 space-y-3 ${isDisabled ? "opacity-60" : ""}`}
                >
                  <div className="h-60 rounded-xl overflow-hidden border border-gray-200 my-3">
                    <Map
                      ref={mapRef}
                      {...mapView}
                      onMove={(e) => setMapView(e.viewState as ViewState)}
                      style={{ width: "100%", height: "100%" }}
                      mapStyle="mapbox://styles/megadoze/cldamjew5003701p5mbqrrwkc"
                      mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
                      interactive={!isDisabled}
                    >
                      <Marker
                        longitude={deliveryLong ?? carFromCtx?.long ?? 30.52}
                        latitude={deliveryLat ?? carFromCtx?.lat ?? 50.45}
                        draggable={!isDisabled}
                        onDragEnd={async (e) => {
                          const { lat, lng } = e.lngLat;
                          setDeliveryLat(lat);
                          setDeliveryLong(lng);
                          setMapView((prev) => ({
                            ...prev,
                            latitude: lat,
                            longitude: lng,
                            zoom: Math.max(prev.zoom, 13),
                          }));

                          try {
                            const addr = await fetchAddressFromCoords(lat, lng);
                            if (addr) {
                              setDeliveryAddress(addr.address || "");
                              setDeliveryCountry(addr.country || "");
                              setDeliveryCity(addr.city || "");
                            }
                          } catch {}
                        }}
                      >
                        <Pin />
                      </Marker>

                      <GeolocateControl
                        trackUserLocation
                        showUserHeading
                        onGeolocate={async (pos) => {
                          if (isDisabled) return;
                          const lat = pos.coords.latitude;
                          const lng = pos.coords.longitude;
                          setDeliveryLat(lat);
                          setDeliveryLong(lng);
                          setMapView((prev) => ({
                            ...prev,
                            latitude: lat,
                            longitude: lng,
                            zoom: Math.max(prev.zoom, 13),
                          }));
                          mapRef.current?.flyTo({
                            center: [lng, lat],
                            zoom: Math.max(mapView.zoom, 13),
                            essential: true,
                          });

                          try {
                            const addr = await fetchAddressFromCoords(lat, lng);
                            if (addr) {
                              setDeliveryAddress(addr.address || "");
                              setDeliveryCountry(addr.country || "");
                              setDeliveryCity(addr.city || "");
                            }
                          } catch {}
                        }}
                      />

                      <NavigationControl />
                      <ScaleControl />
                      <FullscreenControl />
                    </Map>
                  </div>

                  <AddressAutofillWrapper
                    accessToken={import.meta.env.VITE_MAPBOX_TOKEN}
                    onRetrieve={async (res: any) => {
                      if (isDisabled) return;
                      const f = res?.features?.[0];
                      const coords = f?.geometry?.coordinates as
                        | [number, number]
                        | undefined;
                      if (!coords) return;

                      const [lng, lat] = coords;
                      setDeliveryLat(lat);
                      setDeliveryLong(lng);

                      // сразу показать адрес в инпуте:
                      const fallback =
                        f?.properties?.full_address || f?.place_name || "";
                      try {
                        const addr = await fetchAddressFromCoords(lat, lng);
                        setDeliveryAddress(addr?.address || fallback);
                        setDeliveryCountry(addr?.country || "");
                        setDeliveryCity(addr?.city || "");
                      } catch {
                        setDeliveryAddress(fallback);
                        setDeliveryCountry("");
                        setDeliveryCity("");
                      }

                      // подвигать карту
                      setMapView((prev) => ({
                        ...prev,
                        latitude: lat,
                        longitude: lng,
                        zoom: Math.max(prev.zoom, 13),
                      }));
                      mapRef.current?.flyTo({
                        center: [lng, lat],
                        zoom: Math.max(mapView.zoom, 14),
                        essential: true,
                      });
                    }}
                  >
                    <input
                      name="delivery-address"
                      id="delivery-address"
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Enter delivery address"
                      autoComplete="address-line1"
                      className="w-full p-2 outline-none border border-gray-300 focus:border-gray-600 rounded-md"
                      disabled={isDisabled}
                    />
                  </AddressAutofillWrapper>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                    <p>
                      Country:{" "}
                      <span className="font-semibold">
                        {deliveryCountry || "—"}
                      </span>
                    </p>
                    <p>
                      City:{" "}
                      <span className="font-semibold">
                        {deliveryCity || "—"}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Extras */}
          {mark === "booking" && (
            <div className="mt-4">
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
                      label={
                        <>
                          {ex.title} ({ex.price} {effectiveCurrency}
                          {ex.price_type === "per_day" ? " / day" : ""})
                          {ex.inactive && (
                            <span className="ml-2 text-xs text-sky-600">
                              (больше не предлагается)
                            </span>
                          )}
                        </>
                      }
                      checked={pickedExtras.includes(ex.id)}
                      onChange={(e) => {
                        const checked = e.currentTarget.checked;
                        if (isDisabled) return;
                        setPickedExtras((prev) =>
                          checked
                            ? [...prev, ex.id]
                            : prev.filter((x) => x !== ex.id)
                        );
                      }}
                      className={isDisabled ? "opacity-80" : ""}
                      classNames={{
                        root: isDisabled ? "!cursor-not-allowed" : "",
                        input: isDisabled ? "!cursor-not-allowed" : "",
                        label:
                          (isDisabled ? "!cursor-not-allowed " : "") +
                          (ex.inactive ? "opacity-70" : ""),
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div className="mt-3 text-red-600 text-sm">{error}</div>}

          <div className="hidden lg:flex justify-between items-centermt-8 text-right mt-10">
            <button
              type="button"
              className="border-gray-300 border rounded-md px-6 py-2 mr-2 disabled:opacity-50"
              onClick={() => navigate(-1)}
              disabled={saving}
            >
              Back
            </button>
            <div className="flex items-center">
              {saved && !saving && (
                <span className="text-lime-500 font-medium text-sm animate-fade-in mr-2">
                  ✓ Saved
                </span>
              )}
              <button
                type="button"
                className={`${
                  isChanged && !saving
                    ? "border-green-400 text-green-500"
                    : "border-gray-300 text-gray-400 cursor-not-allowed"
                } border rounded-md px-8 py-2 inline-flex items-center gap-2`}
                onClick={handleSave}
                disabled={isLoading || invalidTime || !isChanged || saving}
              >
                {saving ? (
                  <>
                    <Loader size="xs" color="gray" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — сводка/действия */}
        <aside className="lg:col-span-1 lg:sticky lg:top-6">
          {/* Фото */}
          <section className=" hidden lg:block">
            <div id="photo">
              {carFromCtx?.photos?.[0] ? (
                <div className="aspect-video w-full overflow-hidden rounded-2xl">
                  <img
                    src={carFromCtx.photos[0]}
                    className={`${
                      isFinished && "opacity-50"
                    } h-full w-full object-cover`}
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
                <p className="w-fit border border-gray-200 shadow-sm rounded-sm p-1 text-gray-700 text-sm">
                  {carFromCtx.licensePlate}
                </p>
              ) : null}
            </div>
          </section>

          {/* Итоги справа */}
          {mark === "booking" && (
            <section className="mt-4 text-sm">
              <div className="flex justify-between">
                <span>Price base</span>
                {baseTotal.toFixed(2)} {effectiveCurrency}
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between">
                  <span>Delivery</span>
                  {deliveryFee.toFixed(2)} {effectiveCurrency}
                </div>
              )}
              {extrasTotal > 0 && (
                <div className="flex justify-between">
                  <span>Extras</span>
                  {extrasTotal.toFixed(2)} {effectiveCurrency}
                </div>
              )}
              <div className="flex justify-between">
                <span className=" font-bold">Total</span>
                <b>
                  {price_total.toFixed(2)} {effectiveCurrency}
                </b>
              </div>
              <div className="flex justify-between mt-2">
                <span>Deposit</span>
                {Number(deposit ?? 0).toFixed(2)} {effectiveCurrency}
              </div>
            </section>
          )}

          {/* Даты + прогресс + отсчёт */}
          {mode === "edit" && mark === "booking" && (
            <>
              <section id="dates" className="mt-6">
                {status === "rent" && typeof tripProgress === "number" && (
                  <p className="w-full inline-flex justify-between border rounded-md px-4 py-2">
                    <span>Trip progress</span>
                    {tripProgress}%
                  </p>
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
                {status === "finished" && (
                  <p className="border rounded-md px-4 py-2">
                    Trip is finished.
                  </p>
                )}
              </section>
              {!isDisabled && (
                <div className="hidden mt-6 space-y-2 lg:block">
                  <button
                    className="w-full border rounded-md border-green-400 text-green-500 py-2 text-sm disabled:border-gray-300 disabled:text-gray-400"
                    onClick={handleConfirm}
                    disabled={!canConfirm || saving}
                  >
                    Confirm booking
                  </button>
                  <button
                    className="w-full border rounded-md border-gray-300 text-gray-700 py-2 text-sm disabled:border-gray-300 disabled:text-gray-400"
                    onClick={handleCancel}
                    disabled={!canCancel || saving}
                  >
                    Cancel booking
                  </button>
                </div>
              )}
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
            <section className=" mt-6 text-gray-700  ">
              <p className="md:text-lg font-semibold">Guest</p>
              <div className=" flex flex-col items-start gap-2 border rounded-md  border-gray-400 p-3 mt-2">
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
      {showMobileActionBar && backOnly && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <div
            className="px-4 py-3 flex gap-3 max-w-7xl mx-auto"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)",
            }}
          >
            <button
              type="button"
              className="flex-1 border-gray-300 border rounded-md px-6 py-2 mr-2"
              onClick={() => navigate(-1)}
              disabled={saving}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {showBar && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <div
            className="px-4 py-3 flex gap-3 max-w-7xl mx-auto"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)",
            }}
          >
            {backOnly ? ( // ← если rent/finished/canceled* — только Back
              <button
                type="button"
                className="flex-1 border-gray-300 border rounded-md px-6 py-2 mr-2 text-gray-700"
                onClick={() => navigate(-1)}
                disabled={saving}
              >
                Back
              </button>
            ) : (
              <>
                {mode !== "create" &&
                (status === "onApproval" || status === "confirmed") &&
                !isChanged ? (
                  <button
                    onClick={handleCancel}
                    className="flex-1 border rounded-md border-gray-300 text-gray-700 py-3 text-sm active:scale-[.99] transition"
                    disabled={saving}
                  >
                    Cancel booking
                  </button>
                ) : (
                  <button
                    type="button"
                    className="flex-1 border-gray-300 border rounded-md px-6 py-2 mr-2 text-gray-700"
                    onClick={() => navigate(-1)}
                    disabled={saving}
                  >
                    Back
                  </button>
                )}

                {mode !== "create" && status === "onApproval" && !isChanged ? (
                  <button
                    onClick={handleConfirm}
                    className="flex-1 rounded-md border border-green-400 text-green-500 py-3 text-sm active:scale-[.99] transition"
                    disabled={saving}
                  >
                    Confirm booking
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${
                      isChanged && !saving
                        ? "border-green-400 text-green-500"
                        : "border-gray-300 text-gray-400 cursor-not-allowed"
                    } flex-1 border rounded-md px-8 py-2 inline-flex items-center justify-center gap-2`}
                    onClick={handleSave}
                    disabled={isLoading || invalidTime || !isChanged || saving}
                  >
                    {saving ? (
                      <>
                        <Loader size="xs" color="gray" />
                        Saving…
                      </>
                    ) : (
                      "Save"
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Календарь */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center"
          onClick={() => setPickerOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white sm:rounded-2xl rounded-none shadow-xl w-full h-full sm:w-[680px] sm:h-fit flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* body */}
            <div className="flex-1 overflow-hidden p-0">
              <RentalDateTimePicker
                value={calendarRange}
                onChange={(next) => {
                  handleCalendarChange(next);
                  setPickerOpen(false);
                }}
                minuteStep={30}
                minDate={startOfDay(new Date())}
                disabledIntervals={disabledIntervals}
                mobileStartOpen
              />
            </div>
          </div>
        </div>
      )}
      {saving && (
        <div
          className="fixed inset-0 z-[70] bg-white/40 backdrop-blur-[2px]"
          aria-hidden="true"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Если не хочешь зависеть от Mantine — оставь простой CSS-спиннер ниже */}
            <div className="h-8 w-8 rounded-full border-2 border-gray-300 border-t-gray-800 animate-spin" />
          </div>
        </div>
      )}
    </div>
  );
}
