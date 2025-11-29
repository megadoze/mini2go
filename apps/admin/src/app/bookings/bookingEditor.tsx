import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useRouteLoaderData,
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
import { searchUsers, getUserById } from "@/services/user.service";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  PercentBadgeIcon,
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
import { fetchCarById, fetchCarExtras } from "@/services/car.service";
import { HostMiniCard } from "@/components/hostMiniCard";
import { GuestMiniCard } from "@/components/guestMiniCard";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { fetchPricingRules } from "../../services/pricing.service";

const GUEST_CANCEL_MIN_MS = 24 * 60 * 60 * 1000; // сутки

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

type BookingEditorProps = {
  overrideIds?: { bookingId?: string; carId?: string };
  onRequestClose?: () => void; // чем закрывать редактор в кабинете
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

export default function BookingEditor(props: BookingEditorProps = {}) {
  const { overrideIds, onRequestClose } = props;

  const location = useLocation() as any;

  const snapshot = location.state?.snapshot as any;

  const { carId: carIdParam, bookingId } = useParams();

  const qc = useQueryClient();

  const hasMatchingSnapshot =
    Boolean(snapshot?.booking?.id) && snapshot!.booking.id === bookingId;

  // контекст
  const carCtx = useContext(CarContext);

  const carFromCtx = carCtx?.car as any | undefined;
  const ctxCarId = (carFromCtx as any)?.id ?? null;

  const setCar = carCtx?.setCar;
  // const pricingRules = carCtx?.pricingRules ?? [];
  const seasonalRates = carCtx?.seasonalRates ?? [];

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

  const [carId, setCarId] = useState<string | null>(
    () =>
      overrideIds?.carId ??
      (location.state?.carId as string | undefined) ?? // ← ВАЖНО
      ((carFromCtx as any)?.id as string | undefined) ??
      (carIdParam as string | undefined) ??
      (sp.get("carId") as string | null) ??
      (snapshot?.booking?.car_id as string | undefined) ??
      null
  );

  const isSameCtxCar =
    !!carId && !!ctxCarId && String(ctxCarId) === String(carId);

  const from = (location.state as any)?.from;

  // helper
  const goBack = () => {
    if (typeof onRequestClose === "function") onRequestClose();
    else if (from) navigate(from);
    else navigate(-1);
  };

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

  const carQ = useQuery({
    queryKey: carId ? QK.car(String(carId)) : ["car", null],
    queryFn: () => fetchCarById(String(carId)),
    enabled: !!carId, // грузим всегда для актуальной машины
    initialData: isSameCtxCar ? carFromCtx : undefined, // только если та же машина
    staleTime: 5 * 60_000,
    refetchOnMount: false,
  });

  // const effectivePricingRules =
  //   carCtx?.pricingRules && carCtx.pricingRules.length > 0
  //     ? carCtx.pricingRules
  //     : carQ.data?.pricingRules ?? [];

  const snapshotRules = (snapshot as any)?.pricing_rules ?? [];

  // если ни контекст, ни carQ не принесли правил — подгружаем публичные
  const { data: publicRules = [] } = useQuery({
    queryKey: ["pricingRulesPublic", String(carId)],
    queryFn: () => fetchPricingRules(String(carId!)), // см. сервис ниже
    enabled:
      !!carId &&
      !(
        (carCtx?.pricingRules?.length ?? 0) > 0 ||
        (carQ.data?.pricingRules?.length ?? 0) > 0 ||
        (snapshotRules?.length ?? 0) > 0
      ),
    staleTime: 5 * 60_000,
    refetchOnMount: false,
  });

  const effectivePricingRules =
    (carCtx?.pricingRules?.length ?? 0) > 0
      ? carCtx!.pricingRules
      : (carQ.data?.pricingRules?.length ?? 0) > 0
      ? carQ.data!.pricingRules
      : (snapshotRules?.length ?? 0) > 0
      ? snapshotRules
      : publicRules;

  const extrasFromCtx = isSameCtxCar ? carCtx?.extras ?? [] : [];

  const carExtrasQ = useQuery({
    queryKey: carId ? QK.carExtras(String(carId)) : ["carExtras", null],
    queryFn: () => fetchCarExtras(String(carId!)),
    enabled: !!carId, // всегда подтягиваем под нужный carId
    initialData: extrasFromCtx.length ? extrasFromCtx : undefined,
    staleTime: 5 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  });

  // Единая точка правды про машину
  const car = (carQ.data as any) ?? carFromCtx;

  const bookingQ = useQuery({
    queryKey: bookingId ? QK.booking(bookingId) : ["booking", "noop"],
    queryFn: () => fetchBookingById(bookingId!),
    enabled: mode === "edit" && !!bookingId && !initialBooking,
    initialData: initialBooking,
    staleTime: 60_000,
    refetchOnMount: false,
  });

  useEffect(() => {
    const bid = bookingQ.data as any;
    if (!carId && bid?.car_id) {
      setCarId(String(bid.car_id));
    }
  }, [bookingQ.data, carId]);

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

  const extrasQ = useQuery({
    queryKey: QK.bookingExtras(bookingId!),
    queryFn: () => fetchBookingExtras(bookingId!),
    enabled: mode === "edit" && !!bookingId && mark === "booking",
    initialData: initialExtras, // можно оставить, чтобы сразу показать старые данные
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
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

  const [userId, setUserId] = useState<string | null>(
    snapshot?.booking?.user_id ?? null
  );

  const userIdForQ: string | undefined =
    bookingQ.data?.user_id ??
    initialBooking?.user_id ??
    snapshot?.booking?.user_id ??
    undefined;

  const rootData = useRouteLoaderData("rootAuth") as
    | { ownerId: string }
    | undefined;

  const [currentUserId, setCurrentUserId] = useState<string | null>(
    rootData?.ownerId ?? null
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

  useEffect(() => {
    if (currentUserId) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        setCurrentUserId(data.session?.user.id ?? null);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [currentUserId]);

  const bookingUserId = userIdForQ ?? userId ?? null;
  const carOwnerId = (car as any)?.owner_id ?? (car as any)?.ownerId ?? null;

  const viewingAsGuest =
    !!currentUserId && !!bookingUserId && currentUserId === bookingUserId;

  const viewingAsHost =
    !!currentUserId && !!carOwnerId && currentUserId === carOwnerId;

  const role: "host" | "guest" | "other" = viewingAsHost
    ? "host"
    : viewingAsGuest
    ? "guest"
    : "other";

  const isGuestReadOnly = viewingAsGuest && !viewingAsHost;

  useEffect(() => {
    if (mode === "create" && isGuestReadOnly) {
      navigate(-1);
    }
  }, [mode, isGuestReadOnly, navigate]);

  const guest = bookingQ.data?.user ?? selectedUser ?? null;
  const host = bookingQ.data?.host ?? null;

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

  const cancelLabel = "Cancel booking";

  const [deposit, setDeposit] = useState<number>(
    typeof snapshot?.booking?.deposit === "number"
      ? Number(snapshot!.booking.deposit)
      : Number((car as any)?.deposit ?? 0)
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
    age: number | null;
    driver_license_issue?: string | "";
  }>({
    full_name: "",
    email: "",
    phone: "",
    age: null,
    driver_license_issue: "",
  });

  const userForCard = selectedUser;

  const [pickerOpen, setPickerOpen] = useState(false);

  // Delivery
  type DeliveryOption = "car_address" | "by_address";
  const deliveryEnabled = Boolean((car as any)?.isDelivery);

  const [delivery, setDelivery] = useState<DeliveryOption>(
    (snapshot?.booking?.delivery_type as any) ?? "car_address"
  );

  const [deliveryFeeValue, setDeliveryFeeValue] = useState<number>(() => {
    if (typeof snapshot?.booking?.delivery_fee === "number") {
      return Number(snapshot!.booking.delivery_fee);
    }
    const def = Number((car as any)?.deliveryFee ?? 0);
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

  const initialLat = toNum(deliveryLat ?? car?.lat, 50.45);
  const initialLng = toNum(deliveryLong ?? car?.long, 30.52);

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
    if (!carId) return [];
    const cached =
      (carFromCtx?.bookings as Booking[] | undefined) ??
      qc.getQueryData<Booking[]>(QK.bookingsByCarId(String(carId))) ??
      [];
    return cached
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

  // const isDisabled = status === "rent" || status === "block" || isFinished;
  const isDisabledByStatus =
    status === "rent" || status === "block" || isFinished;

  const isLocked = isDisabledByStatus || isGuestReadOnly;

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
    if (!car) return;
    if (
      delivery === "by_address" &&
      !deliveryAddress &&
      car.lat != null &&
      car.long != null
    ) {
      const lat = Number(car.lat);
      const lng = Number(car.long);
      setDeliveryLat(lat);
      setDeliveryLong(lng);
      setMapView((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        zoom: Math.max(prev.zoom, 13),
      }));
    }
  }, [car, delivery, deliveryAddress]);

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

    const unsubscribe = subscribeBooking(bookingId, (row) => {
      qc.setQueryData(QK.booking(bookingId), (old: any) => ({
        ...(old ?? {}),
        ...row,
      }));

      // 2) если у тебя есть локальный стейт статуса — синхронизируем
      setStatus?.(row.status);
      qc.invalidateQueries({ queryKey: QK.booking(bookingId) });
      qc.invalidateQueries({ queryKey: QK.bookingExtras(bookingId) });
      qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] === "bookingsIndex" ||
            q.queryKey[0] === "bookingsIndexInfinite" ||
            q.queryKey[0] === "bookingsUserInfinite"),
      });

      if (carId) qc.invalidateQueries({ queryKey: QK.bookingsByCarId(carId) });
    });
    return unsubscribe;
  }, [bookingId, carId, qc]);

  useEffect(() => {
    if (Array.isArray(extrasQ.data)) {
      const next = extrasQ.data.map((r: any) => String(r.extra_id));
      setPickedExtras((prev) => {
        // чтобы лишний раз не триггерить ререндеры
        const a = [...prev].sort().join(",");
        const b = [...next].sort().join(",");
        return a === b ? prev : next;
      });
    }
  }, [extrasQ.data]);

  useEffect(() => {
    if (!bookingId) return;

    const ch = supabase
      .channel(`be_${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booking_extras",
          filter: `booking_id=eq.${bookingId}`,
        },
        () => qc.invalidateQueries({ queryKey: QK.bookingExtras(bookingId) })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [bookingId, qc]);

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

  const baseDailyPrice = Number((car as any)?.price ?? 0);

  const {
    total: baseTotal,
    avgPerDay,
    discountApplied,
  } = useMemo(
    () =>
      calculateFinalPriceProRated({
        startAt: new Date(startDateInp),
        endAt: new Date(endDateInp),
        baseDailyPrice,
        pricingRules: effectivePricingRules,
        seasonalRates,
      }),
    [
      startDateInp,
      endDateInp,
      baseDailyPrice,
      effectivePricingRules,
      seasonalRates,
    ]
  );

  const rawMinutes = differenceInMinutes(
    new Date(endDateInp),
    new Date(startDateInp)
  );
  const totalMinutes = Math.max(0, rawMinutes);
  const durationDays = Math.floor(totalMinutes / (24 * 60));
  const durationHours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const durationMinutes = totalMinutes % 60;

  const effectiveExtras = carExtrasQ.data ?? extrasFromCtx;

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
    const activeList = (effectiveExtras ?? [])
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
  }, [effectiveExtras, bookedExtras]);

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

  function upsertBookingsLists(
    qc: ReturnType<typeof useQueryClient>,
    saved: Booking
  ) {
    // Обычные массивы
    qc.setQueriesData<Booking[]>(
      {
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] === "bookingsIndex" ||
            q.queryKey[0] === "bookingsByCarId"),
      },
      (prev) => (prev ? patchRowInArray(prev, saved) : prev)
    );

    // Бесконечные ленты: owner index + user index
    savedGlobalRef.current = saved;
    patchInfinite(qc, "bookingsIndexInfinite");
    patchInfinite(qc, "bookingsUserInfinite");
    savedGlobalRef.current = null;
  }

  function patchRowInArray(list: Booking[], saved: Booking) {
    if (!Array.isArray(list)) return list;
    const i = list.findIndex((x) => x.id === saved.id);
    if (i === -1) return list;
    const next = list.slice();
    next[i] = { ...next[i], ...saved };
    return next;
  }

  function patchInfinite(
    qc: ReturnType<typeof useQueryClient>,
    family: string
  ) {
    qc.setQueriesData<any>(
      {
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === family, // ровное совпадение семейства
      },
      (prev: { pages: any[] }) => {
        if (!prev) return prev;
        // react-query v4 infinite: { pageParams:[], pages:[] }
        if (Array.isArray(prev.pages)) {
          const pages = prev.pages.map((page: any) => {
            if (Array.isArray(page)) {
              return patchRowInArray(page, savedGlobalRef.current!);
            }
            if (Array.isArray(page.items)) {
              return {
                ...page,
                items: patchRowInArray(page.items, savedGlobalRef.current!),
              };
            }
            return page;
          });
          return { ...prev, pages };
        }
        return prev;
      }
    );
  }

  const savedGlobalRef = { current: null as Booking | null };

  // === УНИВЕРСАЛЬНЫЙ ТРИГГЕР ОБНОВЛЕНИЙ КЭША ==================================

  function touchBookingCache(
    qc: ReturnType<typeof useQueryClient>,
    saved: Booking
  ) {
    // 1) одиночная запись
    qc.setQueryData(QK.booking(saved.id), saved);

    // 2) экстры брони
    qc.invalidateQueries({ queryKey: QK.bookingExtras(saved.id) });

    // 3) список по машине
    if (saved.car_id) {
      qc.invalidateQueries({
        queryKey: QK.bookingsByCarId(String(saved.car_id)),
      });
    }

    // 4) мгновенный локальный патч в видимых списках
    upsertBookingsLists(qc, saved);

    // 5) и безопасная инвалидация семей «индексов» (на случай фильтров/пагинации)
    qc.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        (q.queryKey[0] === "bookingsIndex" ||
          q.queryKey[0] === "bookingsIndexInfinite" ||
          q.queryKey[0] === "bookingsUserInfinite"),
    });
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

  // === ОПТИМИСТИЧЕСКИЕ ХЕЛПЕРЫ ====================

  async function createBookingOptimistic(
    qc: ReturnType<typeof useQueryClient>,
    payload: Omit<Booking, "id">
  ) {
    const tempId = `temp-${Date.now()}`;
    const temp: Booking = { ...(payload as any), id: tempId };

    const listKey = QK.bookingsByCarId(String(payload.car_id));
    const prevByCar = qc.getQueryData<Booking[]>(listKey) ?? [];
    qc.setQueryData(listKey, [temp, ...prevByCar]);

    try {
      const saved = await createBooking(payload as any);
      qc.setQueryData(listKey, (curr?: Booking[]) =>
        (curr ?? []).map((b) => (b.id === tempId ? saved : b))
      );
      touchBookingCache(qc, saved);
      patchCalendarWindowsCache(qc, saved);
      return saved;
    } catch (e) {
      qc.setQueryData(listKey, prevByCar);
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

  // === ЗАМЕНА: mutateBooking  ===
  async function mutateBooking(id: string, payload: Partial<Booking>) {
    const next = await updateBookingOptimistic(qc, id, payload);
    return next;
  }

  async function handleSave() {
    if (isGuestReadOnly) return;
    setError(null);

    // ---------- базовые проверки ----------
    if (!carId) {
      toast.warning("Car ID is missing");
      return;
    }

    const nowDt = new Date();
    const startDt = new Date(startDateInp);
    const endDt = new Date(endDateInp);

    // базовая валидация дат
    if (isNaN(+startDt) || isNaN(+endDt)) {
      toast.warning("Select start and end time");
      return;
    }

    // старт должен быть в будущем
    if (!isAfter(startDt, nowDt)) {
      toast.warning("Start time must be in the future");
      return;
    }

    if (!isAfter(new Date(endDateInp), new Date(startDateInp))) {
      toast.warning("End time must be after start time");
      return;
    }
    if (minRentMinutes > 0 && totalMinutes < minRentMinutes) {
      toast.warning(
        `Too short: minimum duration is ${effectiveMinRentPeriodDays} day(s)`
      );
      return;
    }
    if (maxRentMinutes > 0 && totalMinutes > maxRentMinutes) {
      toast.warning(
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
        toast.warning("Booking must start and end within working hours");
        return;
      }
    }
    if (delivery === "by_address") {
      if (
        !deliveryAddress?.trim() ||
        deliveryLat == null ||
        deliveryLong == null
      ) {
        toast.warning(
          "Please select a delivery address (pin on map or search)."
        );
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

    // ---------- подготовка guestPayload ----------
    let guestPayload: any = null;
    if (mark === "booking") {
      if (userId) {
        // запрет «на самого себя» только для существующего профиля
        const { data: auth } = await supabase.auth.getUser();
        const currentUid = auth?.user?.id ?? null;
        if (currentUid && String(userId) === String(currentUid)) {
          toast.warning("You cannot create a reservation for yourself.");
          return;
        }
        const u = selectedUser ?? (await getUserById(userId).catch(() => null));
        if (!u) {
          toast.warning("Cannot validate customer profile");
          return;
        }
        if (
          effectiveAgeRenters > 0 &&
          typeof u.age === "number" &&
          u.age < effectiveAgeRenters
        ) {
          toast.warning(
            `Customer must be at least ${effectiveAgeRenters} years old`
          );

          return;
        }
        if (effectiveMinDriverLicense > 0) {
          const yrs = yearsBetween(u.driver_license_issue);
          if (yrs !== null && yrs < effectiveMinDriverLicense) {
            toast.warning(
              `Driver's license must be at least ${effectiveMinDriverLicense} year(s) old`
            );
            return;
          }
        }
        guestPayload = { id: userId };
      } else {
        // драфтовый гость — создастся на сервере внутри RPC, но сначала проверим дубль
        if (
          !selectedUser?.full_name?.trim() ||
          !selectedUser?.email?.trim() ||
          !selectedUser?.phone?.trim()
        ) {
          toast.warning("Fill guest Full name + Email + Phone.");
          return;
        }

        // === ПРОВЕРКА ДУБЛЕЙ ПО EMAIL/PHONE ===
        const normEmail = selectedUser.email.trim().toLowerCase();
        const normPhone = selectedUser.phone.trim();

        const { data: conflictUsers, error: checkError } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone")
          .or(`email.ilike.${normEmail},phone.eq.${normPhone}`);

        if (checkError) {
          setError("Error checking existing users");
          toast.warning("Error checking existing users.");
          return;
        }

        if (conflictUsers?.length) {
          // точное совпадение по обоим полям
          const exact = conflictUsers.find(
            (u) =>
              (u.email ?? "").toLowerCase() === normEmail &&
              (u.phone ?? "") === normPhone
          );

          if (exact) {
            // используем существующего — не создаём нового
            guestPayload = { id: exact.id };
          } else {
            // совпал email ИЛИ phone — это конфликт

            toast.warning(
              "User with this email or phone already exists. Please select from list."
            );

            setSelectedUser(null);
            return;
          }
        } else {
          // совпадений нет — позволяем создать нового гостя внутри RPC
          guestPayload = {
            full_name: selectedUser.full_name.trim(),
            email: normEmail,
            phone: normPhone,
            age: Number.isFinite(Number(selectedUser.age))
              ? Math.trunc(Number(selectedUser.age))
              : null,
            driver_license_issue: selectedUser.driver_license_issue || null,
          };
        }
      }
    }

    setSaving(true);

    // локальный helper для мгновенного появления записи в ленте
    const prependToBookingsIndex = (row: any) => {
      qc.setQueriesData(
        {
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            q.queryKey[0] === "bookingsIndexInfinite",
        },
        (old: any) => {
          if (!old?.pages?.length) {
            return { pageParams: [0], pages: [{ items: [row], count: 1 }] };
          }
          const pages = old.pages.slice();
          const first = pages[0];

          if (Array.isArray(first)) {
            if (first.some((x: any) => String(x.id) === String(row.id)))
              return old;
            pages[0] = [row, ...first];
            return { ...old, pages };
          }

          const items = Array.isArray(first?.items) ? first.items : [];
          if (items.some((x: any) => String(x.id) === String(row.id)))
            return old;

          pages[0] = {
            ...first,
            items: [row, ...items],
            count: (first?.count ?? items.length) + 1,
          };
          return { ...old, pages };
        }
      );
    };

    try {
      if (mode === "create") {
        if (mark === "booking") {
          // ===== создать (или найти) гостя и бронь в 1 RPC =====
          const { data: newId, error: rpcErr } = await supabase.rpc(
            "create_booking_with_guest",
            {
              p_car_id: carId,
              p_guest: guestPayload, // {id} ИЛИ {full_name,email,phone,age,driver_license_issue}
              p_booking: {
                start_at: new Date(startDateInp).toISOString(),
                end_at: new Date(endDateInp).toISOString(),
                mark: "booking",
                status: "onApproval",
                price_per_day: baseDailyPrice || null,
                price_total,
                currency: effectiveCurrency,
                deposit: deposit ?? null,
                delivery_type: delivery,
                delivery_fee:
                  delivery === "by_address" ? Number(deliveryFee) : 0,
                delivery_address:
                  delivery === "by_address" ? deliveryAddress : null,
                delivery_lat: delivery === "by_address" ? deliveryLat : null,
                delivery_long: delivery === "by_address" ? deliveryLong : null,
              },
            }
          );
          if (rpcErr) throw rpcErr;

          const saved = await fetchBookingById(String(newId));

          // экстра → booking_extras
          if (pickedExtras.length) {
            const fresh = pickedExtras.map((id) => {
              const ex = extrasMap.byId[id];
              const qty =
                ex?.price_type === "per_day" ? billableDaysForExtras : 1;
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

          // мгновенно показать в индексе (если страница уже открыта)
          prependToBookingsIndex({
            id: saved.id,
            car_id: String(saved.car_id),
            user_id: saved.user_id ?? null,
            start_at: saved.start_at,
            end_at: saved.end_at,
            created_at: saved.created_at ?? new Date().toISOString(),
            status: saved.status ?? "onApproval",
            mark: saved.mark,
            price_total: saved.price_total ?? null,
            currency: saved.currency ?? effectiveCurrency,
            brand_name: car?.model?.brands?.name ?? "",
            model_name: car?.model?.name ?? "",
            cover_photos: car?.coverPhotos ?? null,
            license_plate: (car as any)?.licensePlate ?? null,
            user_full_name: guest?.full_name ?? null,
          });

          // безопасная инвалидация всех списков
          qc.invalidateQueries({
            predicate: (q) =>
              Array.isArray(q.queryKey) &&
              (q.queryKey[0] === "bookingsIndex" ||
                q.queryKey[0] === "bookingsIndexInfinite" ||
                q.queryKey[0] === "bookingsUserInfinite"),
          });
        } else {
          // ===== блок дат =====
          const saved = await createBookingOptimistic(qc, {
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
            location_id: car?.location?.id ?? null,
            country_id: car?.location?.country_id ?? null,
          } as any);

          if (saved.car_id) {
            touchBookingCache(qc, saved);
            patchCalendarWindowsCache(qc, saved);
          }

          // показать сразу
          prependToBookingsIndex({
            id: saved.id,
            car_id: String(saved.car_id),
            user_id: null,
            start_at: saved.start_at,
            end_at: saved.end_at,
            created_at: saved.created_at ?? new Date().toISOString(),
            status: "block",
            mark: "block",
            price_total: null,
            currency: effectiveCurrency,
            brand_name: car?.model?.brands?.name ?? "",
            model_name: car?.model?.name ?? "",
            cover_photos: car?.coverPhotos ?? null,
            license_plate: (car as any)?.licensePlate ?? null,
            user_full_name: null,
          });

          qc.invalidateQueries({
            predicate: (q) =>
              Array.isArray(q.queryKey) &&
              (q.queryKey[0] === "bookingsIndex" ||
                q.queryKey[0] === "bookingsIndexInfinite" ||
                q.queryKey[0] === "bookingsUserInfinite"),
          });
        }
      } else {
        // ===== EDIT =====
        const patch: Partial<Booking> = {
          start_at: new Date(startDateInp).toISOString(),
          end_at: new Date(endDateInp).toISOString(),
          delivery_type: delivery,
          delivery_fee: delivery === "by_address" ? Number(deliveryFee) : 0,
          delivery_address: delivery === "by_address" ? deliveryAddress : null,
          delivery_lat: delivery === "by_address" ? deliveryLat : null,
          delivery_long: delivery === "by_address" ? deliveryLong : null,
          price_total: mark === "booking" ? price_total : null,
          price_per_day: mark === "booking" ? baseDailyPrice : null,
          deposit: mark === "booking" ? deposit : null,
        };

        const saved = await updateBookingOptimistic(qc, bookingId!, patch);

        if (mark === "booking") {
          const extrasPayload = pickedExtras.map((id) => {
            const ex = extrasMap.byId[id];
            const qty =
              ex?.price_type === "per_day" ? billableDaysForExtras : 1;
            return {
              extra_id: id,
              title: ex?.title ?? "Extra",
              qty,
              price: ex?.price ?? 0,
              price_type: ex?.price_type ?? "per_trip",
            };
          });
          await upsertBookingExtras(bookingId!, extrasPayload);
          qc.setQueryData(QK.bookingExtras(bookingId!), extrasPayload);
          // можно подстраховаться инвалидацией:
          qc.invalidateQueries({ queryKey: QK.bookingExtras(bookingId!) });
        }

        if (saved.car_id) {
          touchBookingCache(qc, saved);
          patchCalendarWindowsCache(qc, saved);
        }

        qc.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            (q.queryKey[0] === "bookingsIndex" ||
              q.queryKey[0] === "bookingsIndexInfinite" ||
              q.queryKey[0] === "bookingsUserInfinite"),
        });
      }

      // ---------- UI / навигация ----------
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);

      if ((carFromCtx as any)?.id === carId) {
        setCar?.((prev: any) => prev);
        toast.success("Booking saved");
        setTimeout(
          () => navigate(location.state?.from ?? `/cars/${carId}/calendar`),
          2000
        );
      } else {
        const backTo = location.state?.from ?? -1;
        if (typeof backTo === "string") navigate(backTo, { replace: true });
        else navigate(-1);
      }
    } catch (e: any) {
      setError(e?.message ?? "Save error");
    } finally {
      setSaving(false);
    }
  }

  const handleConfirm = async () => {
    if (!viewingAsHost) return;
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

    if (isGuestReadOnly && !guestCanCancel) return;
    const nextStatus = viewingAsHost ? "canceledHost" : "canceledClient";
    try {
      const next = await updateBookingOptimistic(qc, bookingId, {
        status: nextStatus,
      } as any);
      setStatus(next.status ?? nextStatus);
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

  // подтверждение / отмена
  const timeUntilStartMs = startDate
    ? startDate.getTime() - now.getTime()
    : -Infinity;

  const guestCanCancel =
    isGuestReadOnly &&
    mark === "booking" &&
    !isFinished &&
    (() => {
      if (status === "onApproval") return true; // всегда можно
      if (status === "confirmed")
        return timeUntilStartMs >= GUEST_CANCEL_MIN_MS; // 24ч правило
      return false; // rent/finished/canceled*
    })();

  const canConfirm =
    mode !== "create" && // ← НОВОЕ
    viewingAsHost &&
    mark === "booking" &&
    status === "onApproval" &&
    !isFinished;

  const hostCanCancel =
    mode !== "create" && // ← НОВОЕ
    viewingAsHost &&
    mark === "booking" &&
    (status === "onApproval" || status === "confirmed") &&
    !isFinished;

  const canCancel = hostCanCancel || guestCanCancel;

  // плавающая мобильная панель
  const showMobileActionBar =
    status && (status === "confirmed" || status === "onApproval");

  const showBar = showMobileActionBar || backOnly;

  // любой из баров => добавляем паддинг
  const containerPad = showBar ? "pb-24 lg:pb-0" : "";

  const deliveryOptions = useMemo(() => {
    const opts = [
      {
        value: "car_address",
        label: `Pickup at car address${
          (car as any)?.address ? ` (${(car as any).address})` : ""
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
  }, [deliveryEnabled, delivery, car]);

  const cardCls =
    "rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 px-4 py-4 sm:px-5 sm:py-5";

  if (isLoading) return <div className="p-4">Loading…</div>;

  return (
    <div className={`text-gray-800 max-w-4xl ${containerPad}`}>
      {/* Header */}
      <header className="mb-6 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          {/* left side: title + subtitle */}
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900 md:text-xl">
                {mode === "create" && mark === "booking" ? (
                  "New Booking"
                ) : mark === "block" ? (
                  "Block dates"
                ) : (
                  <>
                    Booking&nbsp;#
                    <span className="text-green-500 font-mono">
                      {displayId}
                    </span>
                  </>
                )}
              </h1>

              {mode === "edit" && mark === "booking" && (
                <Badge
                  variant="dot"
                  color={statusView.cls as any}
                  fw={500}
                  className="uppercase tracking-wide text-[10px] leading-none"
                >
                  {statusView.text}
                </Badge>
              )}
            </div>

            {/* subline with car */}
            <div className="mt-1 text-xs text-gray-500 md:text-sm flex flex-wrap items-center gap-2">
              <span className="font-medium text-gray-700">
                {car?.model?.brands?.name} {car?.model?.name} {car?.year}
              </span>
              {car?.licensePlate && (
                <span className="rounded-md border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-[10px] font-mono text-gray-700 shadow-sm">
                  {car.licensePlate}
                </span>
              )}
            </div>
          </div>

          {/* right side: actions (QR / Share) */}
          {mark === "booking" && mode === "edit" && (
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <button
                onClick={() => setQrOpen(true)}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm active:scale-[.98]"
              >
                QR
              </button>

              <button
                onClick={async () => {
                  try {
                    if (navigator.share && shareUrl) {
                      await navigator.share({
                        title: `Booking #${displayId}`,
                        text: `Booking for ${car?.model?.brands?.name ?? ""} ${
                          car?.model?.name ?? ""
                        }`,
                        url: shareUrl,
                      });
                    } else {
                      await navigator.clipboard.writeText(shareUrl);
                    }
                  } catch {}
                }}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm active:scale-[.98]"
              >
                <ShareIcon className="h-4 w-4" />
                <span>Share</span>
              </button>
            </div>
          )}
        </div>
      </header>

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
          {/* Даты проката */}
          {/* [UI+] Trip timeline card */}
          <section className={cardCls}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Trip timeline
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Start / end time, duration, and status
                </p>
              </div>

              {/* статус для мобильного когда нет header-badge (например create/block) */}
              {mode !== "edit" && mark === "booking" && status && (
                <Badge
                  variant="dot"
                  color={statusView.cls as any}
                  fw={500}
                  className="uppercase tracking-wide text-[10px] leading-none"
                >
                  {statusView.text}
                </Badge>
              )}
            </div>

            {/* дата-кнопка или статичные даты */}
            <div className="mt-4">
              {!isFinished ? (
                status !== "rent" ? (
                  <button
                    type="button"
                    className={`w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-left shadow-sm hover:bg-gray-50 active:scale-[.995] ${
                      isLocked ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    onClick={() => !isLocked && setPickerOpen(true)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 md:py-1">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-700 ring-1 ring-gray-200">
                          <CalendarDaysIcon className="size-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] uppercase tracking-wide text-gray-500">
                            Rental period
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {startDateInp && endDateInp
                              ? `${format(
                                  new Date(startDateInp).toISOString(),
                                  "d MMM, HH:mm"
                                )} — ${format(
                                  new Date(endDateInp).toISOString(),
                                  "d MMM, HH:mm"
                                )}`
                              : "Select start and end"}
                          </span>
                        </div>
                      </div>
                      <ChevronRightIcon className="size-4 text-gray-400" />
                    </div>
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-800">
                    <CalendarDaysIcon className="size-5 text-gray-700" />
                    {format(
                      new Date(startDateInp).toISOString(),
                      "d MMM yy, HH:mm"
                    )}
                    <ArrowRightIcon className="size-4 text-gray-500" />
                    {format(
                      new Date(endDateInp).toISOString(),
                      "d MMM yy, HH:mm"
                    )}
                  </div>
                )
              ) : (
                <p className="mt-2 line-through text-sm text-gray-500">
                  {fmt(startDateInp)} — {fmt(endDateInp)}
                </p>
              )}

              {!isFinished && (
                <div className="mt-3 text-[11px] text-gray-500">
                  {effectiveOpenTime === effectiveCloseTime ? (
                    <>Working hours: 24/7</>
                  ) : (
                    <>
                      Working hours:{" "}
                      <span className="font-medium text-gray-700">
                        {mmToHHMM(effectiveOpenTime)} –{" "}
                        {mmToHHMM(effectiveCloseTime)}
                      </span>
                    </>
                  )}
                </div>
              )}

              <div className="mt-4 text-sm text-gray-700">
                <span className="text-gray-500">Duration: </span>
                <span className="font-medium text-gray-900">
                  {durationDays}d {durationHours}h {durationMinutes}m
                </span>
              </div>
            </div>

            {/* прогресс или таймер до начала */}
            <div className="mt-6 space-y-3">
              {status === "rent" && startDate && endDate && (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-gray-600 mb-1">
                    <span>{format(startDate, "d MMM, HH:mm")}</span>
                    <span>{format(endDate, "d MMM, HH:mm")}</span>
                  </div>

                  <div className="h-2.5 w-full overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                    <div
                      className="h-full bg-green-500/90 transition-[width] duration-500 ease-out"
                      style={{ width: `${tripProgress}%` }}
                      role="progressbar"
                      aria-valuenow={tripProgress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>

                  <div className="mt-1 text-right text-[11px] font-medium text-gray-700">
                    {tripProgress}%
                  </div>
                </div>
              )}

              {status === "confirmed" && cdStart && (
                <div className="rounded-lg border border-orange-200 bg-orange-50/50 px-4 py-3 text-sm text-orange-800 shadow-sm">
                  <div className="font-medium">
                    {role === "guest"
                      ? "Your booking is confirmed"
                      : role === "host"
                      ? "Trip is confirmed"
                      : "Booking confirmed"}
                  </div>
                  <div className="text-xs text-orange-700 mt-1">
                    Starts in:&nbsp;
                    {cdStart.days ? `${cdStart.days}d ` : ""}
                    {cdStart.hours}h {cdStart.minutes}m
                  </div>
                </div>
              )}

              {status === "onApproval" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm shadow-sm">
                  <div className="font-medium text-amber-800">
                    {role === "host"
                      ? "Waiting for your confirmation"
                      : role === "guest"
                      ? "Request sent to host"
                      : "Pending host approval"}
                  </div>
                  <div className="text-xs text-amber-700 mt-1">
                    {role === "host"
                      ? "Please confirm this booking."
                      : role === "guest"
                      ? "You can cancel before it's confirmed."
                      : "Host hasn't confirmed yet."}
                  </div>
                </div>
              )}

              {status === "finished" && (
                <div className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700 shadow-sm">
                  Trip is finished.
                </div>
              )}
            </div>
          </section>

          {/* Клиент: только в create-режиме */}
          {mark === "booking" && mode === "create" && (
            <section className={`${cardCls} mt-6`}>
              <h2 className="text-base font-semibold text-gray-900">
                Customer
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Select existing user or add a new guest
              </p>

              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-600 focus:outline-none"
                    placeholder="Search by name / email / phone…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    onBlur={() => setTimeout(() => setUserResults([]), 100)}
                  />
                  <button
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm active:scale-[.98]"
                    onClick={() => setCreatingUser((v) => !v)}
                  >
                    {creatingUser ? "Cancel" : "New user"}
                  </button>
                </div>

                {userResults.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm ring-1 ring-gray-100">
                    {userResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 ${
                          userId === u.id ? "bg-gray-50" : ""
                        }`}
                        onClick={() => {
                          setUserId(u.id);
                          setSelectedUser(u);
                          setUserSearch("");
                          setUserResults([]);
                        }}
                      >
                        <div className="font-medium text-gray-900">
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
                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm ring-1 ring-gray-100">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-600 focus:outline-none"
                        placeholder="Full name"
                        value={newUser.full_name}
                        onChange={(e) =>
                          setNewUser({ ...newUser, full_name: e.target.value })
                        }
                      />
                      <input
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-600 focus:outline-none"
                        placeholder="Email"
                        value={newUser.email}
                        onChange={(e) =>
                          setNewUser({ ...newUser, email: e.target.value })
                        }
                      />
                      <input
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-600 focus:outline-none"
                        placeholder="Phone"
                        value={newUser.phone}
                        onChange={(e) =>
                          setNewUser({ ...newUser, phone: e.target.value })
                        }
                      />
                      <input
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-600 focus:outline-none"
                        placeholder="Age (optional)"
                        type="number"
                        value={newUser.age ?? ""}
                        onChange={(e) =>
                          setNewUser({
                            ...newUser,
                            age:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                      <input
                        className="sm:col-span-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-600 focus:outline-none"
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

                    <div className="mt-3 flex justify-end">
                      <button
                        className="rounded-lg border border-green-400 bg-white px-3 py-2 text-xs font-medium text-green-600 shadow-sm active:scale-[.98] disabled:border-gray-300 disabled:text-gray-400"
                        onClick={() => {
                          setSelectedUser({
                            ...newUser,
                            id: null,
                            __draft: true,
                          });
                          setUserId(null);
                          setCreatingUser(false);
                          setUserSearch("");
                          setUserResults([]);
                        }}
                        disabled={
                          !newUser.full_name.trim() ||
                          !newUser.email.trim() ||
                          !newUser.phone.trim()
                        }
                      >
                        Use this customer (draft)
                      </button>
                    </div>

                    <div className="mt-2 text-[11px] text-gray-500">
                      * Email и phone обязательны.
                    </div>
                  </div>
                )}

                {userForCard && (
                  <div className="rounded-lg border border-green-400 bg-green-50/60 p-3 text-sm text-gray-800 shadow-sm ring-1 ring-green-200/50 flex items-start gap-2">
                    <div className="grow">
                      <div className="font-medium text-gray-900">
                        {userForCard.full_name ?? "—"}
                      </div>
                      <div className="text-xs text-gray-600">
                        {userForCard.email ?? "—"}
                        {userForCard.phone ? ` • ${userForCard.phone}` : ""}
                        {userForCard.__draft && (
                          <span className="ml-2 text-amber-600">(draft)</span>
                        )}
                      </div>
                    </div>
                    <button
                      className="text-[11px] font-medium text-blue-600 underline"
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
            </section>
          )}

          {/* Delivery */}
          {mark === "booking" && (
            <section className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 px-4 py-4 sm:px-5 sm:py-5">
              {/* header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    Delivery
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Pickup or drop-off location
                  </p>
                </div>
              </div>

              {/* select + fee */}
              <div className="mt-4 space-y-2">
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
                      (car as any)?.deliveryFee != null
                    ) {
                      setDeliveryFeeValue(Number((car as any).deliveryFee));
                    }

                    // автоподстановка адреса/координат если пусто
                    if (
                      !deliveryAddress &&
                      car?.lat != null &&
                      car?.long != null
                    ) {
                      const lat = Number(car.lat);
                      const lng = Number(car.long);
                      setDeliveryLat(lat);
                      setDeliveryLong(lng);

                      try {
                        const addr = await fetchAddressFromCoords(lat, lng);
                        setDeliveryAddress(addr?.address || car?.address || "");
                        setDeliveryCountry(addr?.country || "");
                        setDeliveryCity(addr?.city || "");
                      } catch {
                        setDeliveryAddress(car?.address || "");
                        setDeliveryCountry("");
                        setDeliveryCity("");
                      }

                      // подвинуть карту
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
                  readOnly={isLocked}
                  radius="md"
                  className={isLocked ? "opacity-60" : ""}
                  classNames={{
                    input: isLocked
                      ? "!cursor-not-allowed focus:border-gray-300"
                      : "",
                  }}
                />

                <div className="text-[11px] text-gray-600">
                  Delivery fee:&nbsp;
                  <b className="text-gray-800">
                    {deliveryFee.toFixed(2)} {effectiveCurrency}
                  </b>
                </div>
              </div>

              {/* map + address only if delivery by_address */}
              {delivery === "by_address" && (
                <div
                  className={`mt-4 space-y-4 ${isLocked ? "opacity-60" : ""}`}
                >
                  {/* MAP CARD */}
                  <div className="h-60 overflow-hidden rounded-xl border border-gray-100 shadow-sm ring-1 ring-gray-100">
                    <Map
                      ref={mapRef}
                      {...mapView}
                      onMove={(e) => setMapView(e.viewState as ViewState)}
                      style={{ width: "100%", height: "100%" }}
                      mapStyle="mapbox://styles/megadoze/cldamjew5003701p5mbqrrwkc"
                      mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
                      interactive={!isLocked}
                    >
                      <Marker
                        longitude={deliveryLong ?? car?.long ?? 30.52}
                        latitude={deliveryLat ?? car?.lat ?? 50.45}
                        draggable={!isLocked}
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
                          if (isLocked) return;
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

                  {/* ADDRESS INPUT + meta */}
                  <div className="space-y-2">
                    <AddressAutofillWrapper
                      accessToken={import.meta.env.VITE_MAPBOX_TOKEN}
                      onRetrieve={async (res: any) => {
                        if (isLocked) return;
                        const f = res?.features?.[0];
                        const coords = f?.geometry?.coordinates as
                          | [number, number]
                          | undefined;
                        if (!coords) return;

                        const [lng, lat] = coords;
                        setDeliveryLat(lat);
                        setDeliveryLong(lng);

                        // показать адрес сразу
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

                        // сдвинуть карту
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
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-600 focus:outline-none"
                        disabled={isLocked}
                      />
                    </AddressAutofillWrapper>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                      <p>
                        <span className="text-gray-500">Country: </span>
                        <span className="font-semibold text-gray-800">
                          {deliveryCountry || "—"}
                        </span>
                      </p>
                      <p>
                        <span className="text-gray-500">City: </span>
                        <span className="font-semibold text-gray-800">
                          {deliveryCity || "—"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Extras */}
          {mark === "booking" && (
            <section className={`${cardCls} mt-6`}>
              <h2 className="text-base font-semibold text-gray-900">Extras</h2>
              <p className="mt-1 text-xs text-gray-500">
                Additional services & fees
              </p>

              <div className="mt-4 space-y-2">
                {extrasMap.list.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-start justify-between rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 shadow-sm ring-1 ring-white/50"
                  >
                    <Checkbox
                      color="dark"
                      label={
                        <div className="text-sm leading-5">
                          <span className="font-medium text-gray-800">
                            {ex.title}
                          </span>{" "}
                          <span className="text-gray-500">
                            ({ex.price} {effectiveCurrency}
                            {ex.price_type === "per_day" ? " / day" : ""})
                          </span>
                          {ex.inactive && (
                            <span className="ml-2 text-[11px] text-sky-600">
                              (no longer offered)
                            </span>
                          )}
                        </div>
                      }
                      checked={pickedExtras.includes(ex.id)}
                      onChange={(e) => {
                        const checked = e.currentTarget.checked;
                        if (isLocked) return;
                        setPickedExtras((prev) =>
                          checked
                            ? [...prev, ex.id]
                            : prev.filter((x) => x !== ex.id)
                        );
                      }}
                      className={`${
                        isLocked ? "opacity-60" : ""
                      } w-full flex items-start`}
                      classNames={{
                        root: `w-full flex ${
                          isLocked ? "!cursor-not-allowed" : ""
                        }`,
                        input: isLocked ? "!cursor-not-allowed" : "",
                        label:
                          (isLocked ? "!cursor-not-allowed " : "") +
                          (ex.inactive ? "opacity-70" : ""),
                      }}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {error && <div className="mt-3 text-red-600 text-sm">{error}</div>}

          <div className="hidden lg:block mt-8">
            <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 px-5 py-4 flex items-center justify-between">
              <button
                type="button"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm active:scale-[.98] disabled:opacity-50"
                onClick={goBack}
                disabled={saving}
              >
                Back
              </button>

              <div className="flex items-center gap-3">
                {saved && !saving && (
                  <span className="text-sm font-medium text-lime-600 animate-fade-in">
                    ✓ Saved
                  </span>
                )}

                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-lg border px-5 py-2 text-sm font-medium shadow-sm active:scale-[.98] ${
                    isChanged && !saving
                      ? "border-green-400 bg-white text-green-600"
                      : "border-gray-300 bg-white text-gray-400 cursor-not-allowed"
                  }`}
                  onClick={handleSave}
                  disabled={isLoading || invalidTime || !isChanged || saving}
                >
                  {saving ? (
                    <>
                      <Loader size="xs" color="gray" />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </button>
              </div>
            </section>
          </div>
        </div>

        {/* RIGHT — сводка/действия */}
        <aside className="lg:col-span-1 lg:sticky lg:top-6">
          {/* Фото */}
          {/* [UI+] Car card in sidebar */}
          <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-4 sm:p-5">
            <div className="aspect-video w-full overflow-hidden rounded-xl ring-1 ring-gray-200 bg-gray-100">
              {car?.coverPhotos?.[0] ? (
                <img
                  src={car.coverPhotos[0]}
                  className={`h-full w-full object-cover ${
                    isFinished ? "opacity-50" : ""
                  }`}
                  alt="Car"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                  no photo
                </div>
              )}
            </div>

            <div className="mt-3">
              <p className="text-sm font-semibold text-gray-900">
                {car?.model?.brands?.name} {car?.model?.name} {car?.year}
              </p>
              {car?.licensePlate ? (
                <p className="mt-1 inline-flex items-center rounded-md border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-[10px] font-mono text-gray-700 shadow-sm ring-1 ring-white/50">
                  {car.licensePlate}
                </p>
              ) : null}
            </div>
          </section>

          {/* Итоги справа */}
          {mark === "booking" && (
            <section className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-4 sm:p-5 text-sm">
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">
                  Trip summary
                </p>
              </div>

              <div className="space-y-3 text-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="text-gray-600 text-sm">Price per day</span>

                    {discountApplied !== 0 && (
                      <span className="mt-1 flex items-center gap-1 text-[11px] leading-tight text-green-600">
                        <PercentBadgeIcon className="size-3" />
                        {avgPerDay?.toFixed(2)} {effectiveCurrency} with
                        discount
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="block font-medium text-gray-900">
                      {baseDailyPrice.toFixed(2)} {effectiveCurrency}
                    </span>
                    {discountApplied !== 0 && (
                      <span className="text-[11px] font-medium leading-tight text-green-600">
                        {discountApplied?.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <span className="text-gray-600 text-sm">Rental subtotal</span>
                  <span className="font-medium text-gray-900">
                    {baseTotal.toFixed(2)} {effectiveCurrency}
                  </span>
                </div>

                {deliveryFee > 0 && (
                  <div className="flex items-start justify-between">
                    <span className="text-gray-600 text-sm">Delivery</span>
                    <span className="font-medium text-gray-900">
                      {deliveryFee.toFixed(2)} {effectiveCurrency}
                    </span>
                  </div>
                )}

                {extrasTotal > 0 && (
                  <div className="flex items-start justify-between">
                    <span className="text-gray-600 text-sm">Extras</span>
                    <span className="font-medium text-gray-900">
                      {extrasTotal.toFixed(2)} {effectiveCurrency}
                    </span>
                  </div>
                )}

                <div className="border-t border-dashed border-gray-300 pt-3" />

                <div className="flex items-start justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-base font-semibold text-gray-900">
                    {price_total.toFixed(2)} {effectiveCurrency}
                  </span>
                </div>

                <div className="flex items-start justify-between pt-2 text-[13px] text-gray-600">
                  <span>Deposit</span>
                  <span className="font-medium text-gray-900">
                    {Number(deposit ?? 0).toFixed(2)} {effectiveCurrency}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Даты + прогресс + отсчёт */}
          {mode === "edit" && mark === "booking" && (
            <section className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-4 sm:p-5 text-sm">
              {/* status info */}
              {status === "rent" && typeof tripProgress === "number" && (
                <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      Trip progress
                    </span>
                    <span className="text-gray-700 font-medium">
                      {tripProgress}%
                    </span>
                  </div>
                </div>
              )}

              {status === "confirmed" && (
                <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50/50 px-4 py-3 text-sm text-orange-800 shadow-sm">
                  <div className="font-medium">
                    {role === "guest"
                      ? "Your booking is confirmed"
                      : role === "host"
                      ? "Trip is confirmed"
                      : "Booking confirmed"}
                  </div>
                  <div className="text-xs text-orange-700 mt-1">
                    Starts in:{" "}
                    {cdStart &&
                    (cdStart.days || cdStart.hours || cdStart.minutes) ? (
                      <>
                        {cdStart.days ? `${cdStart.days} d ` : ""}
                        {cdStart.hours} h {cdStart.minutes} m
                      </>
                    ) : (
                      "less than a minute"
                    )}
                  </div>
                </div>
              )}

              {status === "onApproval" && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 shadow-sm">
                  {role === "host"
                    ? "Confirm the guest's booking request as soon as possible."
                    : role === "guest"
                    ? "Your request was sent. You can cancel it anytime before confirmation."
                    : "Booking request is pending host approval."}
                </div>
              )}

              {status === "finished" && (
                <div className="mt-3 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700 shadow-sm">
                  Trip is finished.
                </div>
              )}

              {(viewingAsHost || canCancel) && (
                <div className="mt-5 space-y-2">
                  {viewingAsHost && canConfirm && (
                    <button
                      className="w-full rounded-lg border border-green-400 bg-white py-2 text-center text-sm font-medium text-green-600 shadow-sm active:scale-[.98] disabled:border-gray-300 disabled:text-gray-400"
                      onClick={handleConfirm}
                      disabled={saving}
                    >
                      Confirm booking
                    </button>
                  )}

                  {canCancel && (
                    <button
                      className="w-full rounded-lg border border-gray-300 bg-white py-2 text-center text-sm font-medium text-gray-700 shadow-sm active:scale-[.98] disabled:border-gray-300 disabled:text-gray-400"
                      onClick={handleCancel}
                      disabled={saving}
                    >
                      {cancelLabel}
                    </button>
                  )}

                  {isGuestReadOnly && guestCanCancel && (
                    <p className="text-[11px] text-gray-500">
                      {status === "onApproval"
                        ? "You can cancel this request anytime before the host confirms."
                        : "You can cancel ≥ 24h before start and not during rent."}
                    </p>
                  )}
                </div>
              )}
            </section>
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
          {mode !== "create" && mark === "booking" && (
            <div className="mt-6 space-y-4">
              {viewingAsGuest && <HostMiniCard host={host} />}

              {viewingAsHost && <GuestMiniCard guest={guest} />}

              {!viewingAsGuest && !viewingAsHost && (
                <>
                  <HostMiniCard host={host} />
                  <GuestMiniCard guest={guest} />
                </>
              )}
            </div>
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
              onClick={goBack}
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
                onClick={() => goBack()}
                disabled={saving}
              >
                Back
              </button>
            ) : mode === "create" ? (
              <>
                <button
                  type="button"
                  className="border-green-400 text-green-500 flex-1 border rounded-md px-8 py-2 inline-flex items-center justify-center gap-2"
                  onClick={handleSave}
                  disabled={isLoading || invalidTime || saving}
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

                <button
                  type="button"
                  className="flex-1 border-gray-300 border rounded-md px-6 py-2 mr-2 text-gray-700"
                  onClick={goBack}
                  disabled={saving}
                >
                  Back
                </button>
              </>
            ) : (
              <>
                {/* 1) Хост + можно подтверждать => показываем Confirm (и при желании Cancel рядом) */}
                {viewingAsHost && canConfirm ? (
                  <>
                    <button
                      onClick={handleConfirm}
                      className="flex-1 rounded-md border border-green-400 text-green-500 py-3 text-sm active:scale-[.99] transition"
                      disabled={saving}
                    >
                      Confirm booking
                    </button>

                    {canCancel && (
                      <button
                        onClick={handleCancel}
                        className="flex-1 border rounded-md border-gray-300 text-gray-700 py-3 text-sm active:scale-[.99] transition"
                        disabled={saving}
                      >
                        {cancelLabel}
                      </button>
                    )}
                  </>
                ) : canCancel ? (
                  /* 2) Если подтвердить нельзя, но отменить можно — показываем Cancel */
                  <button
                    onClick={handleCancel}
                    className="flex-1 border rounded-md border-gray-300 text-gray-700 py-3 text-sm active:scale-[.99] transition"
                    disabled={saving}
                  >
                    Cancel booking
                  </button>
                ) : isChanged ? (
                  /* 3) Кнопка Save (когда есть изменения и это уместно) */
                  <button
                    type="button"
                    className="border-green-400 text-green-500 flex-1 border rounded-md px-8 py-2 inline-flex items-center justify-center gap-2"
                    onClick={handleSave}
                    disabled={
                      !viewingAsHost ||
                      isLoading ||
                      invalidTime ||
                      !isChanged ||
                      saving
                    }
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
                ) : (
                  /* 4) Иначе — Back */
                  <button
                    type="button"
                    className="flex-1 border-gray-300 border rounded-md px-6 py-2 mr-2 text-gray-700"
                    onClick={goBack}
                    disabled={saving}
                  >
                    Back
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
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999]"
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
                  if (!isLocked) {
                    handleCalendarChange(next);
                    setPickerOpen(false);
                  }
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
            <div className="h-8 w-8 rounded-full border-2 border-gray-300 border-t-gray-800 animate-spin" />
          </div>
        </div>
      )}
    </div>
  );
}
