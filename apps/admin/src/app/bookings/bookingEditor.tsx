import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useRouteLoaderData,
  useSearchParams,
} from "react-router-dom";
import {
  useQuery,
  useQueryClient,
  useQueryClient as useRQClient,
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Booking } from "@/types/booking";
import { CarContext } from "@/context/carContext";
import {
  fetchBookingsByCarId,
  fetchBookingById,
  updateBooking,
} from "@/app/car/calendar/calendar.service";
import { fetchBookingExtras } from "@/services/booking-extras.service";
import {
  differenceInMinutes,
  isAfter,
  isEqual,
  parseISO,
  startOfDay,
} from "date-fns";
import { Badge } from "@mantine/core";
import { getUserById } from "@/services/user.service";
import { ShareIcon } from "@heroicons/react/24/outline";
import { subscribeBooking } from "@/services/bookings.service";
import { QK } from "@/queryKeys";
import RentalDateTimePicker from "@/components/RentalDateTimePicker";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchAddressFromCoords } from "@/services/geo.service";
import type { MapRef, ViewState } from "react-map-gl/mapbox";
import { fetchCarById, fetchCarExtras } from "@/services/car.service";
import { HostMiniCard } from "@/components/hostMiniCard";
import { GuestMiniCard } from "@/components/guestMiniCard";
import { toast } from "sonner";
import { fetchPricingRules } from "../../services/pricing.service";
import { BookingExtras } from "./bookingExtras";
import { useBookingPrice } from "@/hooks/useBookingPrice";
import { BookingPriceCard } from "./bookingPriceCard";
import { BookingTimelineCard } from "./bookingTimelineCard";
import { BookingActionsCard } from "./bookingActionsCard";
import { BookingDeliveryCard } from "./bookingDeliveryCard";
import { GuestPicker } from "./guestPicker";
import { BookingQrModal } from "./bookingQrModal";
import { BookingActionsBar } from "./bookingActionsBar";
import { BookingCarCard } from "./bookingCarCard";
import { BookingTopActions } from "./bookingTopActions";
import { useBookingSave } from "@/hooks/useBookingSave";
import { getGlobalSettings } from "@/services/settings.service";

const GUEST_CANCEL_MIN_MS = 24 * 60 * 60 * 1000; // сутки

type BookingEditorProps = {
  overrideIds?: { bookingId?: string; carId?: string };
  onRequestClose?: () => void;
};

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
  const seasonalRates = carCtx?.seasonalRates ?? [];

  const lastBookingUserRef = useRef<string | null>(null);

  const [sp] = useSearchParams();
  const navigate = useNavigate();

  const [carId, setCarId] = useState<string | null>(
    () =>
      overrideIds?.carId ??
      (location.state?.carId as string | undefined) ??
      ((carFromCtx as any)?.id as string | undefined) ??
      (carIdParam as string | undefined) ??
      (sp.get("carId") as string | null) ??
      (snapshot?.booking?.car_id as string | undefined) ??
      null
  );

  const isSameCtxCar =
    !!carId && !!ctxCarId && String(ctxCarId) === String(carId);

  const from = (location.state as any)?.from;

  const goBack = () => {
    if (typeof onRequestClose === "function") onRequestClose();
    else if (from) navigate(from);
    else navigate(-1);
  };

  const isUUID = (s?: string) =>
    !!s &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s
    );
  const mode: "create" | "edit" = isUUID(bookingId) ? "edit" : "create";

  const [mark, setMark] = useState<"booking" | "block">(
    (snapshot?.booking?.mark as any) ?? "booking"
  );

  // initial booking
  const initialBooking = useMemo(() => {
    const fromSnap = hasMatchingSnapshot ? snapshot.booking : undefined;
    if (fromSnap) return fromSnap;

    const fromCtx = bookingId
      ? (carFromCtx?.bookings as Booking[] | undefined)?.find(
          (b) => b.id === bookingId
        )
      : undefined;
    if (fromCtx) return fromCtx;

    return bookingId ? qc.getQueryData(["booking", bookingId]) : undefined;
  }, [hasMatchingSnapshot, snapshot?.booking, bookingId, carFromCtx, qc]);

  const carQ = useQuery({
    queryKey: carId ? QK.car(String(carId)) : ["car", null],
    queryFn: () => fetchCarById(String(carId)),
    enabled: !!carId,
    initialData: isSameCtxCar ? carFromCtx : undefined,
    staleTime: 5 * 60_000,
    refetchOnMount: false,
  });

  const snapshotRules = (snapshot as any)?.pricing_rules ?? [];

  const { data: publicRules = [] } = useQuery({
    queryKey: ["pricingRulesPublic", String(carId)],
    queryFn: () => fetchPricingRules(String(carId!)),
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
    enabled: !!carId,
    initialData: extrasFromCtx.length ? extrasFromCtx : undefined,
    staleTime: 5 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  });

  const car = (carQ.data as any) ?? carFromCtx;

  const bookingQ = useQuery({
    queryKey: bookingId ? QK.booking(bookingId) : ["booking", "noop"],
    queryFn: () => fetchBookingById(bookingId!),
    enabled: mode === "edit" && !!bookingId,
    initialData: initialBooking,
    // ВАЖНО: если мы пришли со snapshot'ом — считаем данные сразу устаревшими
    staleTime: hasMatchingSnapshot ? 0 : 60_000,
    refetchOnMount: hasMatchingSnapshot ? "always" : false,
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
    initialData: initialExtras,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const bookedExtras = useMemo(() => {
    const rows = Array.isArray(extrasQ.data)
      ? extrasQ.data
      : Array.isArray(initialExtras)
      ? initialExtras
      : [];
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

  const ownerId = rootData?.ownerId ?? null;

  const appSettingsQ = useQuery({
    queryKey: ownerId
      ? QK.appSettingsByOwner(ownerId)
      : ["appSettings", "noop"],
    queryFn: () => getGlobalSettings(ownerId!),
    enabled: !!ownerId,
    initialData: ownerId
      ? qc.getQueryData(QK.appSettingsByOwner(ownerId))
      : undefined,
    staleTime: 5 * 60_000,
    refetchOnMount: false,
  });
  const appSettings: any = appSettingsQ.data ?? null;

  // Эффективные политики (context → car → globalSettings → fallback)

  const effectiveCurrency: string =
    (carCtx as any)?.effectiveCurrency ?? appSettings?.currency ?? "EUR";

  const effectiveOpenTime: number = Number(
    (carCtx as any)?.effectiveOpenTime ??
      (carFromCtx as any)?.openTime ??
      appSettings?.openTime ??
      0
  );

  const effectiveCloseTime: number = Number(
    (carCtx as any)?.effectiveCloseTime ??
      (carFromCtx as any)?.closeTime ??
      appSettings?.closeTime ??
      0
  );

  // мин/макс период аренды в днях
  const effectiveMinRentPeriodDays: number = Number(
    (carCtx as any)?.effectiveMinRentPeriod ??
      (carFromCtx as any)?.minRentPeriod ??
      appSettings?.minRentPeriod ??
      0
  );

  const effectiveMaxRentPeriodDays: number = Number(
    (carCtx as any)?.effectiveMaxRentPeriod ??
      (carFromCtx as any)?.maxRentPeriod ??
      appSettings?.maxRentPeriod ??
      0
  );

  // интервал между бронями (минуты)
  const effectiveIntervalBetweenBookings: number = Number(
    (carCtx as any)?.effectiveIntervalBetweenBookings ??
      (carFromCtx as any)?.intervalBetweenBookings ??
      appSettings?.intervalBetweenBookings ??
      0
  );

  // возраст арендатора
  const effectiveAgeRenters: number = Number(
    (carCtx as any)?.effectiveAgeRenters ??
      (carFromCtx as any)?.ageRenters ??
      appSettings?.ageRenters ??
      0
  );

  // стаж ВУ
  const effectiveMinDriverLicense: number = Number(
    (carCtx as any)?.effectiveMinDriverLicense ??
      (carFromCtx as any)?.minDriverLicense ??
      appSettings?.minDriverLicense ??
      0
  );

  // конвертация дней в минуты уже после этого блока:
  const minRentMinutes =
    effectiveMinRentPeriodDays > 0 ? effectiveMinRentPeriodDays * 24 * 60 : 0;
  const maxRentMinutes =
    effectiveMaxRentPeriodDays > 0 ? effectiveMaxRentPeriodDays * 24 * 60 : 0;

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

  const [pickedExtras, setPickedExtras] = useState<string[]>(() =>
    Array.isArray(initialExtras)
      ? initialExtras.map((r: any) => String(r.extra_id))
      : []
  );

  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

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

  const [deliveryAddress, setDeliveryAddress] = useState<string>(
    (snapshot?.booking?.delivery_address as string) ?? ""
  );
  const [deliveryLat, setDeliveryLat] = useState<number | null>(
    (snapshot?.booking?.delivery_lat as number) ?? null
  );
  const [deliveryLong, setDeliveryLong] = useState<number | null>(
    (snapshot?.booking?.delivery_long as number) ?? null
  );

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

  const [mapView, setMapView] = useState<ViewState>({
    latitude: initialLat,
    longitude: initialLng,
    zoom: 12,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  const mapRef = useRef<MapRef | null>(null);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrSrc, setQrSrc] = useState<string | null>(null);

  const pickerBookings = useMemo(() => {
    if (
      !Array.isArray(carFromCtx?.bookings) ||
      carFromCtx.bookings.length === 0
    )
      return [];

    const bufferMin = Number(effectiveIntervalBetweenBookings ?? 0);

    const CANCELLED_STATUSES = new Set([
      "canceledHost",
      "canceledGuest",
      "canceledClient",
    ]);

    const isCancelled = (b: any) => {
      const status =
        b.status ??
        b.booking_status ??
        b.bookingStatus ??
        (b.meta && (b.meta.status || b.meta.state)) ??
        null;
      if (!status) return false;
      const s = String(status).toLowerCase();
      return Array.from(CANCELLED_STATUSES).some((cs) =>
        s.includes(String(cs).toLowerCase())
      );
    };

    const raw = carFromCtx.bookings
      .filter(
        (b: any) =>
          !isCancelled(b) && (!bookingId || String(b.id) !== String(bookingId))
      )
      .map((b: any) => {
        const parse = (v: any) => {
          if (!v && v !== 0) return null;
          const d = new Date(v);
          if (isNaN(d.getTime())) return null;
          return d;
        };

        const s = parse(b.start_at);
        const e = parse(b.end_at);
        if (!s || !e) return null;

        const start = new Date(s.getTime() - bufferMin * 60_000);
        const end = new Date(e.getTime() + bufferMin * 60_000);

        if (end.getTime() <= start.getTime()) return null;
        return { start, end };
      })
      .filter(Boolean) as { start: Date; end: Date }[];

    if (raw.length === 0) return [];

    function mergeIntervals(intervals: { start: Date; end: Date }[]) {
      const sorted = intervals
        .slice()
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      const res: { start: Date; end: Date }[] = [];
      for (const iv of sorted) {
        if (res.length === 0) {
          res.push({ ...iv });
          continue;
        }
        const last = res[res.length - 1];
        if (iv.start.getTime() <= last.end.getTime() + 1000) {
          if (iv.end.getTime() > last.end.getTime()) {
            last.end = new Date(iv.end);
          }
        } else {
          res.push({ ...iv });
        }
      }
      return res;
    }

    const merged = mergeIntervals(raw);

    return merged;
  }, [carFromCtx?.bookings, effectiveIntervalBetweenBookings, bookingId]);

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

  const isDisabledByStatus =
    status === "rent" || status === "block" || isFinished;

  const isLocked = isDisabledByStatus || isGuestReadOnly;

  const s = String(status);
  const backOnly =
    s === "rent" ||
    s === "finished" ||
    s === "canceled" ||
    s === "canceledHost" ||
    s === "canceledClient" ||
    s.startsWith("canceled");

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
          from: location.state.from,
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

    setDelivery(b.delivery_type ?? "car_address");
    setDeliveryFeeValue(Number(b.delivery_fee ?? 0));
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
      if (typeof b.deposit === "number") {
        setDeposit(Number(b.deposit));
      } else {
        setDeposit(Number((car as any)?.deposit ?? 0));
      }
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
  }, [bookingQ.data, hasMatchingSnapshot, car]);

  useEffect(() => {
    if (!bookingId) return;

    const unsubscribe = subscribeBooking(bookingId, (row) => {
      qc.setQueryData(QK.booking(bookingId), (old: any) => ({
        ...(old ?? {}),
        ...row,
      }));

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
  }, [mode, hasMatchingSnapshot, sp, carFromCtx]);

  useEffect(() => {
    if (mark === "booking" && !userId && lastBookingUserRef.current)
      setUserId(lastBookingUserRef.current);
    if (mark === "booking" && userId) lastBookingUserRef.current = userId;
  }, [mark, userId]);

  const effectiveExtras = carExtrasQ.data ?? extrasFromCtx;

  const extrasMap = useMemo(() => {
    const pick = (obj: any, ...paths: string[]) => {
      for (const p of paths) {
        const v = p.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
        if (v !== undefined) return v;
      }
      return undefined;
    };

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

    for (const id of Object.keys(bookedById)) {
      if (!byId[id]) {
        byId[id] = { ...bookedById[id], inactive: true };
      }
    }

    const list = Object.values(byId).sort((a, b) => {
      if (a.inactive === b.inactive) return a.title.localeCompare(b.title);
      return a.inactive ? 1 : -1;
    });

    return { list, byId };
  }, [effectiveExtras, bookedExtras]);

  const {
    baseDailyPrice,
    baseTotal,
    avgPerDay,
    discountApplied,
    durationDays,
    durationHours,
    durationMinutes,
    billableDaysForExtras,
    extrasTotal,
    deliveryFee,
    price_total,
  } = useBookingPrice({
    car,
    startDateIso: startDateInp,
    endDateIso: endDateInp,
    pricingRules: effectivePricingRules,
    seasonalRates,
    pickedExtras,
    extrasById: extrasMap.byId,
    mark,
    delivery,
    deliveryFeeValue,
  });

  function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return aStart < bEnd && bStart < aEnd;
  }

  async function assertNoConflicts(
    carIdStr: string,
    startIso: string,
    endIso: string,
    selfId?: string
  ) {
    let list = qc.getQueryData<Booking[]>(QK.bookingsByCarId(carIdStr));

    if (!list) {
      list = await qc.ensureQueryData<Booking[]>({
        queryKey: QK.bookingsByCarId(carIdStr),
        queryFn: () => fetchBookingsByCarId(carIdStr),
      });
    }

    const s = new Date(startIso);
    const e = new Date(endIso);

    const clash = list!.find(
      (b) =>
        b.id !== selfId &&
        !String(b.status ?? "").startsWith("canceled") &&
        overlaps(s, e, new Date(b.start_at), new Date(b.end_at))
    );
    if (clash)
      throw new Error("This period overlaps with another booking/block");

    if (effectiveIntervalBetweenBookings > 0) {
      const gapMin = effectiveIntervalBetweenBookings;

      const tooClose = list!.find((b) => {
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
    client: ReturnType<typeof useRQClient>,
    saved: Booking
  ) {
    client.setQueriesData<Booking[]>(
      {
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] === "bookingsIndex" ||
            q.queryKey[0] === "bookingsByCarId"),
      },
      (prev) => (prev ? patchRowInArray(prev, saved) : prev)
    );

    savedGlobalRef.current = saved;
    patchInfinite(client, "bookingsIndexInfinite");
    patchInfinite(client, "bookingsUserInfinite");
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
    client: ReturnType<typeof useRQClient>,
    family: string
  ) {
    client.setQueriesData<any>(
      {
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === family,
      },
      (prev: { pages: any[] }) => {
        if (!prev) return prev;
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

  function touchBookingCache(
    client: ReturnType<typeof useRQClient>,
    saved: Booking
  ) {
    client.setQueryData(QK.booking(saved.id), saved);
    client.invalidateQueries({ queryKey: QK.bookingExtras(saved.id) });

    if (saved.car_id) {
      client.invalidateQueries({
        queryKey: QK.bookingsByCarId(String(saved.car_id)),
      });
    }

    upsertBookingsLists(client, saved);

    client.invalidateQueries({
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
    client: ReturnType<typeof useRQClient>,
    saved: Booking
  ) {
    client.setQueriesData<any>(
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

    client.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
    });
  }

  async function updateBookingOptimistic(
    client: ReturnType<typeof useRQClient>,
    id: string,
    patch: Partial<Booking>
  ) {
    const prev = client.getQueryData<Booking>(QK.booking(id));
    if (prev) {
      const optimistic = { ...prev, ...patch } as Booking;
      client.setQueryData(QK.booking(id), optimistic);
      if (optimistic.car_id) {
        const listKey = QK.bookingsByCarId(String(optimistic.car_id));
        const prevList = client.getQueryData<Booking[]>(listKey);
        if (prevList) {
          client.setQueryData(
            listKey,
            prevList.map((b) => (b.id === id ? optimistic : b))
          );
        }
      }
    }
    try {
      const saved = await updateBooking(id, patch as any);
      touchBookingCache(client, saved);
      patchCalendarWindowsCache(client, saved);
      return saved;
    } catch (e) {
      if (prev) client.setQueryData(QK.booking(id), prev);
      throw e;
    }
  }

  async function mutateBooking(id: string, payload: Partial<Booking>) {
    const next = await updateBookingOptimistic(qc, id, payload);
    return next;
  }

  type GuestPayload =
    | { id: string }
    | {
        full_name: string;
        email: string;
        phone: string;
        age: number | null;
        driver_license_issue: string | null;
      };

  type BuildGuestPayloadArgs = {
    mark: "booking" | "block";
    userId: string | null;
    selectedUser: any | null;
    effectiveAgeRenters: number;
    effectiveMinDriverLicense: number;
    setError: (msg: string | null) => void;
    setSelectedUser: (u: any | null) => void;
  };

  async function buildGuestPayload({
    mark,
    userId,
    selectedUser,
    effectiveAgeRenters,
    effectiveMinDriverLicense,
    setError,
    setSelectedUser,
  }: BuildGuestPayloadArgs): Promise<GuestPayload | null | undefined> {
    if (mark !== "booking") return null;

    if (userId) {
      const { data: auth } = await supabase.auth.getUser();
      const currentUid = auth?.user?.id ?? null;

      if (currentUid && String(userId) === String(currentUid)) {
        toast.warning("You cannot create a reservation for yourself.");
        return undefined;
      }

      const u = selectedUser ?? (await getUserById(userId).catch(() => null));

      if (!u) {
        toast.warning("Cannot validate customer profile");
        return undefined;
      }

      if (
        effectiveAgeRenters > 0 &&
        typeof u.age === "number" &&
        u.age < effectiveAgeRenters
      ) {
        toast.warning(
          `Customer must be at least ${effectiveAgeRenters} years old`
        );
        return undefined;
      }

      if (effectiveMinDriverLicense > 0) {
        const yrs = yearsBetween(u.driver_license_issue);
        if (yrs !== null && yrs < effectiveMinDriverLicense) {
          toast.warning(
            `Driver's license must be at least ${effectiveMinDriverLicense} year(s) old`
          );
          return undefined;
        }
      }

      return { id: userId };
    }

    if (
      !selectedUser?.full_name?.trim() ||
      !selectedUser?.email?.trim() ||
      !selectedUser?.phone?.trim()
    ) {
      toast.warning("Fill guest Full name + Email + Phone.");
      return undefined;
    }

    const normEmail = selectedUser.email.trim().toLowerCase();
    const normPhone = selectedUser.phone.trim();

    const { data: conflictUsers, error: checkError } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone")
      .or(`email.ilike.${normEmail},phone.eq.${normPhone}`);

    if (checkError) {
      setError("Error checking existing users");
      toast.warning("Error checking existing users.");
      return undefined;
    }

    if (conflictUsers?.length) {
      const exact = conflictUsers.find(
        (u) =>
          (u.email ?? "").toLowerCase() === normEmail &&
          (u.phone ?? "") === normPhone
      );

      if (exact) {
        return { id: exact.id };
      }

      toast.warning(
        "User with this email or phone already exists. Please select from list."
      );
      setSelectedUser(null);
      return undefined;
    }

    return {
      full_name: selectedUser.full_name.trim(),
      email: normEmail,
      phone: normPhone,
      age: Number.isFinite(Number(selectedUser.age))
        ? Math.trunc(Number(selectedUser.age))
        : null,
      driver_license_issue: selectedUser.driver_license_issue || null,
    };
  }

  // ====== ПОДКЛЮЧАЕМ useBookingSave ======

  const {
    saving,
    saved,
    error: saveError,
    handleSave,
  } = useBookingSave({
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
    guestPayloadBuilder: async () =>
      buildGuestPayload({
        mark,
        userId,
        selectedUser,
        effectiveAgeRenters,
        effectiveMinDriverLicense,
        setError,
        setSelectedUser,
      }),
    effectiveCurrency,
    price_total,
    billableDaysForExtras,
    minRentMinutes,
    maxRentMinutes,
    effectiveMinRentPeriodDays,
    effectiveMaxRentPeriodDays,
    effectiveOpenTime,
    effectiveCloseTime,
    assertNoConflicts,
    deposit,
  });

  useEffect(() => {
    if (!saved) return;

    // та же логика, что раньше была в handleSave
    if ((carFromCtx as any)?.id === carId) {
      // триггернём обновление контекста машины
      setCar?.((prev: any) => prev);

      // остаёмся в календаре этой машины
      const to = location.state?.from ?? `/cars/${carId}/calendar`;
      navigate(to, { replace: true });
    } else {
      const backTo = location.state?.from ?? -1;
      if (typeof backTo === "string") {
        navigate(backTo, { replace: true });
      } else {
        navigate(-1);
      }
    }
  }, [saved, carFromCtx, carId, setCar, location.state, navigate]);

  useEffect(() => {
    if (saveError) {
      setError(saveError);
    }
  }, [saveError]);

  const handleSaveClick = () => {
    if (isGuestReadOnly) return;
    void handleSave();
  };

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

  const invalidTime = !isAfter(new Date(endDateInp), new Date(startDateInp));

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

    const currentType = delivery;
    const currentAddr = delivery === "by_address" ? deliveryAddress ?? "" : "";
    const currentLat = delivery === "by_address" ? deliveryLat : null;
    const currentLong = delivery === "by_address" ? deliveryLong : null;
    const currentFee = Number(deliveryFee ?? 0);

    const deliveryChanged =
      initialDeliveryType !== currentType ||
      (currentType === "by_address" &&
        ((initialAddr || "") !== (currentAddr || "") ||
          !eqNum(initialLat, currentLat) ||
          !eqNum(initialLong, currentLong) ||
          !eqNum(initialFee, currentFee))) ||
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
  }, [
    bookingId,
    mark,
    status,
    startDate?.getTime?.(),
    endDate?.getTime?.(),
    now.getTime(),
  ]);

  const statusView = useMemo(() => {
    const s = status;
    if (s === "rent") return { text: s, cls: "green" };
    if (s === "confirmed") return { text: s, cls: "orange" };
    if (s === "onApproval") return { text: s, cls: "blue" };
    if (s === "finished") return { text: s, cls: "dark" };
    if (s?.startsWith("canceled")) return { text: s, cls: "red" };
    return { text: "unknown", cls: "gray" };
  }, [status]);

  const timeUntilStartMs = startDate
    ? startDate.getTime() - now.getTime()
    : -Infinity;

  const guestCanCancel =
    isGuestReadOnly &&
    mark === "booking" &&
    !isFinished &&
    (() => {
      if (status === "onApproval") return true;
      if (status === "confirmed")
        return timeUntilStartMs >= GUEST_CANCEL_MIN_MS;
      return false;
    })();

  const canConfirm =
    mode !== "create" &&
    viewingAsHost &&
    mark === "booking" &&
    status === "onApproval" &&
    !isFinished;

  const hostCanCancel =
    mode !== "create" &&
    viewingAsHost &&
    mark === "booking" &&
    (status === "onApproval" || status === "confirmed") &&
    !isFinished;

  const canCancel = hostCanCancel || guestCanCancel;

  const showMobileActionBar =
    status && (status === "confirmed" || status === "onApproval");

  const showBar = showMobileActionBar || backOnly;

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

  if (error) {
    // покажем тост для любой ошибки
    toast.error(error);
  }

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
          <BookingTimelineCard
            cardCls={cardCls}
            mode={mode}
            mark={mark}
            status={status}
            statusView={statusView}
            isFinished={isFinished}
            isLocked={isLocked}
            startDateInp={startDateInp}
            endDateInp={endDateInp}
            effectiveOpenTime={effectiveOpenTime}
            effectiveCloseTime={effectiveCloseTime}
            durationDays={durationDays}
            durationHours={durationHours}
            durationMinutes={durationMinutes}
            startDate={startDate}
            endDate={endDate}
            tripProgress={tripProgress}
            cdStart={cdStart}
            role={role}
            onOpenPicker={() => setPickerOpen(true)}
          />

          {/* Клиент: только в create-режиме */}
          {mark === "booking" && mode === "create" && (
            <GuestPicker
              cardCls={cardCls}
              userId={userId}
              setUserId={setUserId}
              selectedUser={selectedUser}
              setSelectedUser={setSelectedUser}
            />
          )}

          {/* Delivery */}
          {mark === "booking" && (
            <BookingDeliveryCard
              delivery={delivery}
              setDelivery={setDelivery}
              deliveryOptions={deliveryOptions}
              isLocked={isLocked}
              deliveryFee={deliveryFee}
              effectiveCurrency={effectiveCurrency}
              deliveryAddress={deliveryAddress}
              setDeliveryAddress={setDeliveryAddress}
              deliveryLat={deliveryLat}
              setDeliveryLat={setDeliveryLat}
              deliveryLong={deliveryLong}
              setDeliveryLong={setDeliveryLong}
              deliveryCountry={deliveryCountry}
              setDeliveryCountry={setDeliveryCountry}
              deliveryCity={deliveryCity}
              setDeliveryCity={setDeliveryCity}
              mapView={mapView}
              setMapView={setMapView}
              mapRef={mapRef}
              car={car}
              deliveryFeeValue={deliveryFeeValue}
              setDeliveryFeeValue={setDeliveryFeeValue}
            />
          )}

          {/* Extras */}
          {mark === "booking" && (
            <BookingExtras
              extras={extrasMap}
              pickedExtras={pickedExtras}
              currency={effectiveCurrency}
              isLocked={isLocked}
              setPickedExtras={setPickedExtras}
            />
          )}

          <BookingTopActions
            goBack={goBack}
            handleSave={handleSaveClick}
            saving={saving}
            saved={saved}
            isChanged={isChanged}
            invalidTime={invalidTime}
            isLoading={isLoading}
          />
        </div>

        {/* RIGHT — сводка/действия */}
        <aside className="lg:col-span-1 lg:sticky lg:top-6">
          {/* Фото */}
          <BookingCarCard car={car} isFinished={isFinished} />

          {/* Итоги справа */}
          {mark === "booking" && (
            <BookingPriceCard
              baseDailyPrice={baseDailyPrice}
              effectiveCurrency={effectiveCurrency}
              avgPerDay={avgPerDay}
              discountApplied={discountApplied}
              baseTotal={baseTotal}
              deliveryFee={deliveryFee}
              extrasTotal={extrasTotal}
              priceTotal={price_total}
              deposit={deposit}
            />
          )}

          {/* Десктоп-кнопки Confirm / Cancel для брони */}
          {mode === "edit" && mark === "booking" && (
            <BookingActionsCard
              viewingAsHost={viewingAsHost}
              canConfirm={canConfirm}
              canCancel={canCancel}
              isGuestReadOnly={isGuestReadOnly}
              guestCanCancel={guestCanCancel}
              status={status}
              cancelLabel={cancelLabel}
              saving={saving}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
            />
          )}

          {/* Modal QR */}
          <BookingQrModal
            open={qrOpen}
            onClose={() => setQrOpen(false)}
            displayId={displayId}
            qrSrc={qrSrc}
            bookingId={bookingId}
            shareUrl={shareUrl}
          />

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
      <BookingActionsBar
        mode={mode}
        mark={mark}
        saving={saving}
        saved={saved}
        canConfirm={canConfirm}
        canCancel={canCancel}
        cancelLabel={cancelLabel}
        viewingAsHost={viewingAsHost}
        isGuestReadOnly={isGuestReadOnly}
        guestCanCancel={guestCanCancel}
        status={status}
        onSave={handleSaveClick}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

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
                disabledIntervals={pickerBookings}
                mobileStartOpen
                openTimeMinutes={effectiveOpenTime}
                closeTimeMinutes={effectiveCloseTime}
                minRentDays={effectiveMinRentPeriodDays}
                maxRentDays={effectiveMaxRentPeriodDays}
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
