/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useRouter, useSearchParams } from "next/navigation";
import type { CarWithRelations } from "@/types/carWithRelations";
import { HeaderSection } from "@/components/header";
import { WELCOME_FEATURES } from "@/constants/carOptions";
import RentalDateTimePicker from "@/components/RentalDateTimePicker";
import { startOfDay } from "date-fns";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { fetchCarExtras } from "@/services/car.service";
import { fetchBookingsByCarId } from "@/services/calendar.service";
import { fetchPricingRules } from "@/services/pricing.service";
import { getGlobalSettings } from "@/services/settings.service";
import { CarExtraWithMeta } from "@/types/carExtra";
import {
  calculateFinalPriceProRated,
  PricingRule,
  SeasonalRate,
} from "@/hooks/useFinalPriceHourly";
import { BookingBar } from "../../../../../components/bookingBar";
import { BookingDrawer } from "../../../../../components/bookingDrawer";
import { MINIMUM_REQS } from "@/constants/minimumReqs";
import { CountUp } from "@/utils/countUp";
import { useSyncQuery } from "@/utils/useSyncQuery";
import { LazyAutoplayVideo } from "@/utils/lazyAutoplayVideo";
import { getCurrencySymbol } from "@/utils/currency";

/** Компонент получает serverCar через проп — никакого fetch внутри */
export default function ClientCarLanding({
  serverCar,
}: {
  serverCar: CarWithRelations;
}) {
  const searchParams = useSearchParams();
  const car = serverCar;
  const router = useRouter();
  const updateQuery = useSyncQuery();

  const [menuOpen, setMenuOpen] = useState(false);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  // даты
  const [start, setStart] = useState(searchParams.get("start") ?? "");
  const [end, setEnd] = useState(searchParams.get("end") ?? "");

  const canBook = Boolean(start && end);

  const [extrasData, setExtrasData] = useState<any[]>([]);
  const [bookingsData, setBookingsData] = useState<any[]>([]);
  const [pricingRulesData, setPricingRulesData] = useState<any[]>([]);
  const [globalSettings, setGlobalSettings] = useState<any>(null);

  const [loadingRemote, setLoadingRemote] = useState(false);

  // показ календаря
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  // десктоп/мобила
  const [isMobile, setIsMobile] = useState(false);

  const [showNav, setShowNav] = useState(false);

  const shouldReduceMotion = useReducedMotion();

  // DRAWER
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sections = ["overview", "highlights", "services"] as const;

  type SectionId = (typeof sections)[number];

  const [active, setActive] = useState<SectionId>("overview");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);
  const ratiosRef = useRef<Record<string, number>>({});
  const programmaticRef = useRef(false);

  // мобилка
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // intersection observer для sticky nav
  useEffect(() => {
    const els = sections
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    ratiosRef.current = {} as Record<SectionId, number>;
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (programmaticRef.current) return;
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id as SectionId;
          ratiosRef.current[id] = entry.isIntersecting
            ? entry.intersectionRatio
            : 0;
        }

        let bestId: SectionId = sections[0];
        let bestRatio = -1;
        for (const id of sections as readonly SectionId[]) {
          const r = ratiosRef.current[id] ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            bestId = id;
          }
        }
        if (bestId !== active) setActive(bestId);
      },
      {
        rootMargin: "-20% 0px -70% 10px",
        threshold: [0, 0.25, 0.6, 0.9, 1],
      }
    );

    els.forEach((el) => observerRef.current!.observe(el));
    return () => observerRef.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // нормализуем pricingRulesData -> PricingRule[]
  const pricingRulesNormalized = useMemo(() => {
    if (!Array.isArray(pricingRulesData)) return [] as PricingRule[];
    return pricingRulesData
      .map((r: any) => {
        const min_days =
          r.min_days ?? r.meta?.min_days ?? r.minDays ?? r.min ?? 0;
        const discount_percent =
          r.discount_percent ??
          r.meta?.discount_percent ??
          r.meta?.discountPercent ??
          r.discountPercent ??
          r.discount ??
          0;
        return {
          min_days: Number(min_days || 0),
          discount_percent: Number(discount_percent || 0),
        } as PricingRule;
      })
      .filter(
        (x) => !Number.isNaN(x.min_days) && !Number.isNaN(x.discount_percent)
      );
  }, [pricingRulesData]);

  const seasonalRatesNormalized = useMemo(() => {
    // Возможно seasonal rates приходят в pricingRulesData.seasonalRates или в отдельном поле.
    // Если у тебя они отдельно — замени источник.
    const candidate =
      (pricingRulesData && (pricingRulesData as any).seasonalRates) ?? null;
    if (Array.isArray(candidate)) {
      return candidate.map((s: any) => ({
        start_date: String(s.start_date ?? s.start ?? s.from),
        end_date: String(s.end_date ?? s.end ?? s.to),
        adjustment_percent: Number(
          s.adjustment_percent ?? s.adjust ?? s.adjustment ?? 0
        ),
      })) as SeasonalRate[];
    }

    return [] as SeasonalRate[];
  }, [pricingRulesData, globalSettings]);

  const pricingResult = useMemo(() => {
    if (!start || !end) return null;
    try {
      const startAt = new Date(start);
      const endAt = new Date(end);
      const baseDailyPrice = Number(car?.price ?? 0);
      return calculateFinalPriceProRated({
        startAt,
        endAt,
        baseDailyPrice,
        pricingRules: pricingRulesNormalized,
        seasonalRates: seasonalRatesNormalized,
      });
    } catch (err) {
      console.warn("pricing calc failed", err);
      return null;
    }
  }, [start, end, car?.price, pricingRulesNormalized, seasonalRatesNormalized]);

  function normalizeExtras(raw: any[]): CarExtraWithMeta[] {
    return (raw ?? []).map((ex: any) => {
      const id = String(ex.extra_id ?? ex.id ?? ex.meta?.id ?? ex.key ?? "");
      const price = Number(ex.price ?? ex.meta?.price ?? 0);
      const meta = ex.meta ?? {
        price_type: ex.price_type ?? (ex.price_per_day ? "per_day" : undefined),
        name: ex.meta?.name ?? ex.title ?? ex.name ?? "",
      };
      const title = ex.title ?? ex.meta?.name ?? ex.name ?? "";
      return {
        extra_id: id,
        title,
        price,
        meta,
        is_available:
          ex.is_available ?? ex.is_available === false
            ? ex.is_available
            : undefined,
      };
    });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingRemote(true);
      try {
        const [extrasRes, bookingsRes, pricingRes, globalRes] =
          await Promise.all([
            typeof fetchCarExtras === "function"
              ? fetchCarExtras(String(car.id))
              : fetch(`/api/cars/${car.id}/extras`).then((r) => r.json()),
            typeof fetchBookingsByCarId === "function"
              ? fetchBookingsByCarId(String(car.id))
              : fetch(`/api/cars/${car.id}/bookings`).then((r) => r.json()),
            typeof fetchPricingRules === "function"
              ? fetchPricingRules(String(car.id))
              : fetch(`/api/pricing-rules/${car.id}`).then((r) => r.json()),
            typeof getGlobalSettings === "function"
              ? getGlobalSettings(String(car.ownerId))
              : fetch(`/api/global-settings`)
                  .then((r) => r.json())
                  .catch(() => null),
          ]);
        if (cancelled) return;
        setExtrasData(normalizeExtras(extrasRes ?? []));
        setBookingsData(bookingsRes ?? []);
        setPricingRulesData(pricingRes ?? []);
        setGlobalSettings(globalRes ?? null);
      } catch (err) {
        console.error("ClientCarLanding load error", err);
      } finally {
        if (!cancelled) setLoadingRemote(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [car.id, car.ownerId]);

  // медиа
  const photos = useMemo(() => (car?.photos || []).filter(Boolean), [car]);
  const hero = photos[0];
  const videoPoster = photos[1] || "/images/aceman2.webp";

  const modelObj = (car as any).model ?? (car as any).models ?? undefined;

  const brand = modelObj?.brands?.name;
  const model = modelObj?.name;
  const title = `${brand ?? ""} ${model ?? ""}`.trim();

  const video = {
    s: "/videos/mini-one.mp4",
    countryman: "/videos/mini-U25.mp4",
    cabrio: "/videos/mini-cabrio.mp4",
    aceman: "/videos/mini-aceman.mp4",
  } as const;

  function getVideoSrcByModelName(raw?: string) {
    const name = (raw ?? "").toLowerCase();
    switch (true) {
      case name.includes("cabrio"):
        return video.cabrio;
      case name.includes("countryman"):
        return video.countryman;
      case name.includes("aceman"):
        return video.aceman;
      case name.includes("s"):
        return video.s;
      default:
        return "";
    }
  }

  const videoSrc = useMemo(() => getVideoSrcByModelName(model), [model]);

  // --- EFFECTIVE SETTINGS: сначала берем из car, потом из globalSettings ---

  const effectiveOpenTime =
    car.openTime ?? globalSettings?.openTime ?? undefined;

  const effectiveCloseTime =
    car.closeTime ?? globalSettings?.closeTime ?? undefined;

  const effectiveMinRentPeriod =
    car.minRentPeriod ?? globalSettings?.minRentPeriod ?? undefined;

  const effectiveMaxRentPeriod =
    car.maxRentPeriod ?? globalSettings?.maxRentPeriod ?? undefined;

  // буфер между бронированиями (в минутах)
  const effectiveIntervalBetweenBookings =
    car.intervalBetweenBookings ?? globalSettings?.intervalBetweenBookings ?? 0;

  // валюта
  const effectiveCurrency = car.currency ?? globalSettings?.currency ?? "EUR";

  // минимальный возраст водителя
  const effectiveAgeRenters =
    car.ageRenters ?? globalSettings?.ageRenters ?? undefined;

  // минимальный стаж водителя
  const effectiveMinDriverLicense =
    car.minDriverLicense ?? globalSettings?.minDriverLicense ?? undefined;

  // EUR -> €
  const normalizeCurrency = getCurrencySymbol(effectiveCurrency);

  function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    // строгое пересечение (как в пикере)
    return aStart < bEnd && bStart < aEnd;
  }

  const pickerBookings = useMemo(() => {
    if (!Array.isArray(bookingsData) || bookingsData.length === 0) return [];

    const bufferMin = Number(effectiveIntervalBetweenBookings ?? 0);

    // статусы, которые считаем отменёнными — добавь ещё, если у тебя другие
    const CANCELLED_STATUSES = new Set([
      "canceledHost",
      "canceledGuest",
      "canceledClient",
    ]);

    const isCancelled = (b: any) => {
      // простая гибкая проверка: смотрим в полях status/state/booking_status и в meta
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

    // парсим и фильтруем отменённые
    const raw = bookingsData
      .filter((b: any) => !isCancelled(b))
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

    // merge overlapping intervals (как раньше)
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
  }, [bookingsData, effectiveIntervalBetweenBookings]);

  useEffect(() => {
    if (!start || !end || pickerBookings.length === 0) return;

    const startAt = new Date(start);
    const endAt = new Date(end);

    // если даты кривые
    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
      setStart("");
      setEnd("");
      updateQuery({ start: null, end: null });
      return;
    }

    const intersectsExisting = pickerBookings.some((iv) =>
      overlaps(startAt, endAt, iv.start, iv.end)
    );

    if (intersectsExisting) {
      // старый диапазон теперь конфликтует с бронями — сбрасываем
      setStart("");
      setEnd("");
      updateQuery({ start: null, end: null });
    }
  }, [start, end, pickerBookings, updateQuery]);

  const days = useMemo(() => {
    if (!start || !end) return 1;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const d = Math.max(1, Math.ceil((e - s) / (1000 * 60 * 60 * 24)));
    return d;
  }, [start, end]);

  // навигационное меню вверху страницы
  useEffect(() => {
    const onScroll = () => setShowNav(window.scrollY > 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // блок скролла на пикере
  useEffect(() => {
    if (pickerOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [pickerOpen]);

  // календарь теперь ничего не режет
  const handleCalendarChange = (next: {
    startAt: Date | null;
    endAt: Date | null;
  }) => {
    const startIso = next.startAt ? next.startAt.toISOString() : "";
    const endIso = next.endAt ? next.endAt.toISOString() : "";

    setStart(startIso);
    setEnd(endIso);

    // сразу синхронизируем URL (замена, чтобы не плодить history)
    updateQuery({ start: startIso || null, end: endIso || null });
  };

  const goToRequest = (opts?: Record<string, string | number | boolean>) => {
    if (!car) return;
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (opts) {
      Object.entries(opts).forEach(([k, v]) => params.set(k, String(v)));
    }

    router.push(`/catalog/${car.id}/request?${params.toString()}`);
  };

  // внутри ClientCarLanding

  const handleBookingConfirm = async (
    opts: Record<string, string | number | boolean>
  ) => {
    if (!car || !start || !end) {
      throw new Error("Missing car or dates");
    }

    // 1) idшники экстрас из строки "a,b,c" → string[]
    const extraIds =
      typeof opts.extras === "string"
        ? (opts.extras as string)
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
        : [];

    const deliveryIsByAddress = Number(opts.delivery ?? 0) === 1;

    // 2) валюта и депозит (car → globalSettings → дефолт)
    const currency =
      (car as any).currency ??
      (globalSettings?.currency as string | undefined) ??
      "EUR";

    const deposit = Number(
      (car as any).deposit ??
        (globalSettings?.defaultDeposit as number | undefined) ??
        0
    );

    // 3) базовая цена за день — из car
    const pricePerDay = Number(car.price ?? 0);

    // 4) тотал (grandTotal) из Drawer
    const priceTotal =
      typeof opts.price_total === "number"
        ? (opts.price_total as number)
        : Number(opts.price_total ?? 0);

    // 5) доставка
    const deliveryFee = deliveryIsByAddress
      ? Number(
          (opts.delivery_fee as number | undefined) ??
            (car as any).deliveryFee ??
            globalSettings?.deliveryFee ??
            0
        )
      : 0;

    const locationId =
      typeof opts.location_id === "string" && opts.location_id
        ? String(opts.location_id)
        : null;

    const countryId =
      typeof opts.country_id === "string" && opts.country_id
        ? String(opts.country_id)
        : null;

    // 6) сколько дней брать для экстрас
    // можно использовать pricingResult.days если есть, иначе пересчитываем по датам
    const billableDays =
      (pricingResult?.days && pricingResult.days > 0
        ? pricingResult.days
        : (() => {
            const sMs = new Date(start).getTime();
            const eMs = new Date(end).getTime();
            const diffDays = (eMs - sMs) / (1000 * 60 * 60 * 24);
            return Math.max(1, Math.ceil(diffDays));
          })()) || 1;

    // 7) Собираем подробные extras из extraIds + extrasData
    const extrasDetailed =
      extraIds.length === 0
        ? []
        : (extraIds
            .map((id) => {
              const ex = (extrasData as any[]).find(
                (e) => String(e.extra_id) === id
              );
              if (!ex) return null;

              const price = Number(ex.price ?? 0);
              const priceType: "per_day" | "per_rental" =
                ex.meta?.price_type === "per_day" ? "per_day" : "per_rental";

              const qty = 1; // если потом добавишь количество — рассчитаем здесь
              const multiplier = priceType === "per_day" ? billableDays : 1;
              const total = price * qty * multiplier;

              return {
                extraId: String(ex.extra_id),
                title: ex.title || ex.meta?.name || "",
                price,
                priceType,
                qty,
                total,
              };
            })
            .filter(Boolean) as Array<{
            extraId: string;
            title: string;
            price: number;
            priceType: "per_day" | "per_rental";
            qty: number;
            total: number;
          }>);

    // 8) Собираем driver для API (под нашу zod-схему: licenseFileName, не url)
    const driver = {
      name: String(opts.driver_name ?? ""),
      dob: opts.driver_dob ? String(opts.driver_dob) : null,
      licenseNumber: String(opts.driver_license ?? ""),
      licenseIssue: opts.driver_license_issue
        ? String(opts.driver_license_issue)
        : null,
      licenseExpiry: opts.driver_license_expiry
        ? String(opts.driver_license_expiry)
        : null,
      phone: String(opts.driver_phone ?? ""),
      email: String(opts.driver_email ?? ""),
      licenseFileName: String(opts.driver_license_file_name ?? "") || null,
      licenseFileUrl:
        typeof opts.driver_license_file_url === "string" &&
        opts.driver_license_file_url
          ? String(opts.driver_license_file_url)
          : null,
    };

    const payload = {
      carId: String(car.id),
      start,
      end,
      pricePerDay,
      priceTotal,
      currency,
      deposit,

      deliveryType: deliveryIsByAddress ? "by_address" : "car_address",
      deliveryFee,
      deliveryAddress: deliveryIsByAddress
        ? String(opts.delivery_address ?? "")
        : "",
      deliveryLat:
        deliveryIsByAddress && opts.delivery_lat
          ? Number(opts.delivery_lat)
          : null,
      deliveryLong:
        deliveryIsByAddress && opts.delivery_long
          ? Number(opts.delivery_long)
          : null,

      extras: extrasDetailed,
      locationId,
      countryId,
      driver,
      extra_field: "",
    };

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        // ignore
      }
      console.error("Booking API error", data);
      throw new Error(data?.error || "Booking failed");
    }

    const data = await res.json();

    // здесь потом можешь редиректить на "спасибо"
    router.push(`/thank-you?booking=${data.bookingId}`);

    return data;
  };

  if (loading)
    return <div className="p-6 text-sm text-gray-600">Загрузка…</div>;
  if (error || !car)
    return (
      <div className="p-6 text-sm text-red-600">
        {error || "Авто не найдено"}
      </div>
    );

  const closePicker = () => {
    setPickerOpen(false);
    setTimeout(() => {
      setPickerVisible(false);
    }, 200);
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <HeaderSection
        menuOpen={menuOpen}
        handleMenuOpen={setMenuOpen}
        color="black"
      />
      <nav
        ref={navRef}
        className={`sticky top-0 z-20 bg-white/80 backdrop-blur print:hidden transition-all duration-300 ${
          showNav
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-3 text-sm">
            {sections.map((s) => (
              <a
                key={s}
                href={`#${s}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActive(s as SectionId);
                  const target = document.getElementById(s);
                  const headerH = navRef.current?.offsetHeight ?? 0;
                  if (target) {
                    programmaticRef.current = true;
                    const top =
                      target.getBoundingClientRect().top +
                      window.scrollY -
                      headerH -
                      8;
                    window.scrollTo({ top, behavior: "smooth" });
                    setTimeout(() => {
                      programmaticRef.current = false;
                    }, 700);
                  }
                }}
                className={`relative pb-2 whitespace-nowrap transition-colors ${
                  active === s
                    ? "text-black"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                {labelFor(s)}
                {active === s && (
                  <span className="absolute left-0 -bottom-px h-0.5 w-full bg-black" />
                )}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <section id="overview" className="scroll-mt-24">
        <div className="sticky top-20 z-50 ml-4 md:ml-10 font-roboto-condensed">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-xs! md:text-sm! font-medium text-gray-700 shadow hover:bg-white cursor-pointer"
          >
            <ArrowLeftIcon className="h-4 w-4" /> Back
          </button>
        </div>

        <div className="mx-auto max-w-5xl px-4 grid grid-cols-1 mt-4 md:-mt-8">
          <div className="overflow-hidden">
            <div className="relative">
              {hero ? (
                <img
                  src={hero}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="h-full w-full grid place-items-center text-neutral-400">
                  <svg
                    className="h-10 w-10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M21 15v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M7 10l5-3 5 3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M7 10v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>

          <header className="flex flex-col items-center text-center -mt-5 md:-mt-20 z-10">
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-roboto-condensed font-bold text-black">
              {title}
            </h1>

            <div className="mt-2 md:mt-3 rounded-md py-1 px-2 bg-zinc-100 font-light text-sm md:text-base text-gray-800">
              {`${car.bodyType ?? "—"} · ${car.fuelType ?? "—"} · ${
                car.transmission ?? "—"
              }`}
            </div>

            <p className="pt-2 md:pt-4 md:text-xl text-neutral-800">
              An icon of urban driving. Light, maneuverable, and practical.
            </p>

            <div className="mt-5 md:mt-6 flex items-center gap-4 font-roboto-condensed">
              <button
                onClick={() => setDrawerOpen(true)}
                className="rounded-full bg-black/85 text-white px-8 py-3 text-sm font-medium hover:bg-black/90 cursor-pointer"
                disabled={!canBook}
              >
                Book
              </button>
            </div>
          </header>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-5xl px-4 pt-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-roboto-condensed">
            <CountUp
              end={Number(car.price ?? 0)}
              duration={600}
              formatter={(n) => `${Math.round(n)} ${effectiveCurrency}`}
              label="price/day"
            />
            <CountUp
              end={Number(car.includeMileage ?? 0)}
              duration={600}
              formatter={(n) => `${Math.round(n)} km`}
              label="mileage/day"
            />
            <CountUp
              end={Number(car.seats ?? 0)}
              duration={600}
              formatter={(n) => `${Math.round(n)} seats`}
              label="seats"
            />
            <CountUp
              end={Number(car.doors ?? 0)}
              duration={600}
              formatter={(n) => `${Math.round(n)} doors`}
              label="doors"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="aspect-9/16 md:aspect-video rounded-2xl overflow-hidden">
          <LazyAutoplayVideo
            key={videoSrc}
            src={videoSrc}
            poster={videoPoster}
            className="h-full w-full object-cover transition-opacity duration-300"
          />
        </div>
      </section>

      {/* HIGHLIGHTS */}
      <section id="highlights" className="bg-white scroll-mt-24 pb-10">
        <div className="lg:px-10 pt-10">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-oleo-script font-bold text-black">
              Highlights
            </h2>
            <p className="pt-1 md:pt-2 text-lg md:text-2xl text-neutral-600 font-roboto-condensed">
              Small formats — big fun. Choose, book, drive.
            </p>
          </div>

          <div className="mt-10 w-full max-w-[1200px] mx-auto space-y-12 md:space-y-16">
            {WELCOME_FEATURES.map((item, i) => {
              const reversed = i % 2 === 0;
              return (
                <div
                  key={i}
                  className={`md:flex md:items-center md:justify-center md:gap-8 ${
                    reversed ? "md:flex-row-reverse" : ""
                  }`}
                >
                  <div className="flex justify-center px-4 md:px-0">
                    <div className="w-full md:max-w-[420px] md:w-[340px] lg:w-[380px]">
                      <div className="relative aspect-square overflow-hidden rounded-2xl">
                        <img
                          src={item.img}
                          alt={item.alt}
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 md:mt-0 flex justify-center">
                    <div className="w-[82vw] max-w-[420px] md:w-[340px] lg:w-[380px]">
                      <h3 className="text-2xl md:text-2xl font-roboto-condensed font-semibold text-black">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-stone-600 lg:text-lg">
                        {item.text}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="bg-white scroll-mt-24">
        <div className="px-[3vw] sm:px-6 lg:px-10 pt-10 mb-10">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-oleo-script font-bold text-black">
              Inclusive services
            </h2>
            <p className="pt-1 md:pt-2 text-lg md:text-2xl text-neutral-600 font-roboto-condensed">
              What do we provide when you rent a MINI.
            </p>
          </div>

          <div className="mt-10 w-full max-w-[1200px] mx-auto flex flex-wrap justify-center gap-6 md:gap-8">
            {MINIMUM_REQS.map((item, i) => (
              <div
                key={i}
                className="w-[94vw] max-w-[420px] md:w-[340px] lg:w-[380px]"
              >
                <div className="h-full rounded-2xl ring-1 ring-black/10 bg-white p-5 md:p-6">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-black text-white flex items-center justify-center">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="text-lg md:text-xl font-roboto-condensed font-semibold text-black">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-black/70 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mb-36 md:mb-24" />

      <BookingBar
        car={car}
        start={start}
        end={end}
        days={days}
        onProceed={() => goToRequest()}
        changePickerStatus={() => {
          setPickerVisible(true);
          requestAnimationFrame(() => {
            setPickerOpen(true);
          });
        }}
        openDrawer={() => setDrawerOpen(true)}
        pricingResult={pricingResult}
        currency={normalizeCurrency}
        disabled={!canBook}
      />

      {pickerVisible && (
        <div
          className={cn(
            "fixed inset-0 flex items-center justify-center z-999 transition-opacity duration-200",
            isMobile ? "bg-transparent" : "bg-black/40",
            pickerOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={isMobile ? undefined : closePicker}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={cn(
              isMobile
                ? "w-full h-full flex flex-col justify-end"
                : "bg-white sm:rounded-2xl overflow-hidden rounded-none shadow-xl w-full h-full sm:w-[680px] sm:h-fit flex flex-col",
              "transform transition-transform duration-200",
              pickerOpen ? "translate-y-0" : "translate-y-3"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <RentalDateTimePicker
              value={{
                startAt: start ? new Date(start) : null,
                endAt: end ? new Date(end) : null,
              }}
              onChange={(next) => {
                handleCalendarChange(next);
                closePicker();
              }}
              minuteStep={30}
              minDate={startOfDay(new Date())}
              disabledIntervals={pickerBookings}
              mobileStartOpen
              // НОВОЕ ↓↓↓
              openTimeMinutes={effectiveOpenTime}
              closeTimeMinutes={effectiveCloseTime}
              minRentDays={effectiveMinRentPeriod}
              maxRentDays={effectiveMaxRentPeriod}
            />
          </div>
        </div>
      )}

      {/* BOOKING DRAWER */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
            className="fixed inset-0 z-50"
          >
            <BookingDrawer
              key="booking-drawer"
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              car={car}
              start={start}
              end={end}
              days={days}
              isMobile={isMobile}
              onConfirm={handleBookingConfirm}
              extras={extrasData}
              loadingRemote={loadingRemote}
              pricingResult={pricingResult}
              currency={normalizeCurrency}
              driverAge={effectiveAgeRenters}
              drivingExperience={effectiveMinDriverLicense}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- вспомогательные компоненты  ---------- */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function labelFor(s: string) {
  switch (s) {
    case "overview":
      return "Overview";
    case "highlights":
      return "Highlights";
    case "services":
      return "Services";
    default:
      return s;
  }
}
