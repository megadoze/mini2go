"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CarWithRelations } from "@/types/carWithRelations";
import { HeaderSection } from "@/components/header";
import { WELCOME_FEATURES } from "@/constants/carOptions";
import RentalDateTimePicker from "@/components/RentalDateTimePicker";
import { startOfDay } from "date-fns";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import "mapbox-gl/dist/mapbox-gl.css";

/// вместо import("react-map-gl") — используем под-путь mapbox (как у тебя было ранее)
const Map = dynamic(() => import("react-map-gl/mapbox").then((m) => m.Map), {
  ssr: false,
}) as any;

const Marker = dynamic(
  () => import("react-map-gl/mapbox").then((m) => m.Marker),
  { ssr: false }
) as any;

const FullscreenControl = dynamic(
  () => import("react-map-gl/mapbox").then((m) => m.FullscreenControl),
  { ssr: false }
) as any;

const ScaleControl = dynamic(
  () => import("react-map-gl/mapbox").then((m) => m.ScaleControl),
  { ssr: false }
) as any;

const NavigationControl = dynamic(
  () => import("react-map-gl/mapbox").then((m) => m.NavigationControl),
  { ssr: false }
) as any;

const GeolocateControl = dynamic(
  () => import("react-map-gl/mapbox").then((m) => m.GeolocateControl),
  { ssr: false }
) as any;

// динамический импорт AddressAutofill — тоже только на клиенте
const AddressAutofill = dynamic(
  () =>
    import("@mapbox/search-js-react").then((mod) => {
      return (mod as any).AddressAutofill ?? (mod as any).default ?? null;
    }),
  { ssr: false }
) as unknown as React.FC<any>;

import Pin from "@/components/pin"; // если у тебя есть аналог
import { fetchAddressFromCoords } from "@/services/geo.service"; // или свой сервис
// если у тебя есть сервисы для получения extras/bookings/pricing — импортируй их:
import { fetchCarExtras } from "@/services/car.service";
import { fetchBookingsByCarId } from "@/services/calendar.service";
import { fetchPricingRules } from "@/services/pricing.service";
import Link from "next/link";

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

  const days = useMemo(() => {
    if (!start || !end) return 1;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const d = Math.max(1, Math.ceil((e - s) / (1000 * 60 * 60 * 24)));
    return d;
  }, [start, end]);

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

  const pickerDisabledIntervals = useMemo(() => {
    return []; // никаких disabled intervals на уровне списка
  }, []);

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
              formatter={(n) => `${Math.round(n)} EUR`}
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
              disabledIntervals={pickerDisabledIntervals}
              mobileStartOpen
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
              onConfirm={(opts) => {
                goToRequest(opts);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- вспомогательные компоненты (BookingBar, BookingDrawer, Fact, LazyAutoplayVideo ...) ---------- */

function BookingBar({
  car,
  start,
  end,
  days,
  onProceed,
  changePickerStatus,
  openDrawer,
}: {
  car: CarWithRelations;
  start: string;
  end: string;
  days: number;
  onProceed: () => void;
  changePickerStatus: () => void;
  openDrawer: () => void;
}) {
  const total = Math.max(1, days) * (car.price || 0);

  return (
    <div
      id="booking"
      className="z-50 fixed inset-x-0 bottom-0 bg-white/70 backdrop-blur supports-backdrop-filter:bg-white/40 border-t border-gray-200/60"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-10 text-center font-semibold font-roboto-condensed">
          <div className="text-left">
            <div className="text-2xl md:text-4xl leading-none text-neutral-900">
              {total.toFixed(0)}€
            </div>
            <div className="text-[11px] md:text-xs text-neutral-500 leading-snug">
              for {days} {declineDays(days)}
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-10 text-center">
            <div>
              <div className="text-2xl md:text-4xl leading-none text-neutral-900">
                {car.includeMileage}
              </div>
              <div className="text-[11px] md:text-xs text-neutral-500 leading-snug">
                incl. km/day
              </div>
            </div>

            <div className="">
              <div className="text-2xl md:text-4xl leading-none text-neutral-900">
                {days}
              </div>
              <div className="text-[11px] md:text-xs text-neutral-500 leading-snug">
                {declineDays(days)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 md:gap-3 font-roboto-condensed">
          <button
            onClick={changePickerStatus}
            className="rounded-xl px-3 h-10 md:px-5 md:h-12 text-sm font-medium text-neutral-600 bg-white/40 backdrop-blur border border-neutral-600/50 shadow transition-all duration-200 cursor-pointer"
          >
            Change
          </button>

          <button
            onClick={openDrawer}
            className="rounded-xl px-3 h-10 md:px-5 md:h-12 text-sm font-medium text-neutral-900 bg-white/40 backdrop-blur border border-neutral-600/60 shadow transition-all duration-200 flex items-center gap-1 cursor-pointer"
          >
            <span>Book</span>
            <ArrowRightMini />
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingDrawer({
  open,
  onClose,
  car,
  start,
  end,
  days,
  onConfirm,
  isMobile,
}: {
  open: boolean;
  onClose: () => void;
  car: CarWithRelations;
  start: string;
  end: string;
  days: number;
  onConfirm: (opts: Record<string, string | number | boolean | string>) => void;
  isMobile: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const ACCEPTED_VERSION = "v1.0";
  const isLocked = false;
  const cardCls =
    "rounded-2xl bg-white shadow-sm border border-gray-200 px-4 py-4 sm:px-5 sm:py-5";

  const modelObj = (car as any).model ?? (car as any).models ?? undefined;

  const brand = modelObj?.brands?.name;
  const model = modelObj?.name;
  const title = `${brand ?? ""} ${model ?? ""}`.trim();

  // server-driven
  const [extras, setExtras] = useState<
    Array<{
      id: string;
      title: string;
      price: number;
      price_type?: string;
      inactive?: boolean;
    }>
  >([]);
  const [disabledIntervals, setDisabledIntervals] = useState<
    Array<{ start: Date; end: Date }>
  >([]);
  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);

  // dynamic selections
  const [pickedExtras, setPickedExtras] = useState<string[]>([]);
  const [delivery, setDelivery] = useState<"car_address" | "by_address">(
    "car_address"
  );
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLong, setDeliveryLong] = useState<number | null>(null);

  // country / city for delivery (used in UI)
  const [deliveryCountry, setDeliveryCountry] = useState<string>("");
  const [deliveryCity, setDeliveryCity] = useState<string>("");

  const [deliveryFeeValue, setDeliveryFeeValue] = useState<number>(0);

  // driver fields (kept from original)
  const [driverName, setDriverName] = useState("");
  const [driverDob, setDriverDob] = useState<string | null>(null);
  const [driverLicense, setDriverLicense] = useState("");
  const [driverLicenseExpiry, setDriverLicenseExpiry] = useState<string | null>(
    null
  );
  const [driverPhone, setDriverPhone] = useState("");
  const [driverEmail, setDriverEmail] = useState("");

  // upload/license
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // terms/errors/submitting
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedTs, setAcceptedTs] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // refs + UI
  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstFocusRef = useRef<HTMLInputElement | null>(null);
  const lastFocusRef = useRef<HTMLButtonElement | null>(null);
  const mapRef = useRef<any>(null);

  // map view state (initial from car)
  const toNum = (v: unknown, fallback: number | null = 50.45): number | null =>
    Number.isFinite(Number(v)) ? Number(v) : fallback;
  const initialLat = toNum(car?.lat, 50.45);
  const initialLng = toNum(car?.long, 30.52);
  const [mapView, setMapView] = useState<any>({
    latitude: initialLat,
    longitude: initialLng,
    zoom: 12,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  // client-only flag (to prevent using window on server)
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(typeof window !== "undefined"), []);

  // prefill delivery when opening (if car has lat/long)
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoadingRemote(true);
      try {
        const [extrasRes, bookingsRes, pricingRes] = await Promise.all([
          typeof fetchCarExtras === "function"
            ? fetchCarExtras(String(car.id))
            : fetch(`/api/cars/${car.id}/extras`).then((r) => r.json()),
          typeof fetchBookingsByCarId === "function"
            ? fetchBookingsByCarId(String(car.id))
            : fetch(`/api/cars/${car.id}/bookings`).then((r) => r.json()),
          typeof fetchPricingRules === "function"
            ? fetchPricingRules(String(car.id))
            : fetch(`/api/pricing-rules/${car.id}`).then((r) => r.json()),
        ]);

        const normalized = (extrasRes ?? []).map((ex: any) => ({
          id: String(
            ex.extra_id ?? ex.id ?? ex.meta?.id ?? ex.meta?.extra_id ?? ex.key
          ),
          title:
            ex.meta?.title ??
            ex.meta?.name ??
            ex.title ??
            ex.name ??
            String(ex.extra_id ?? ex.id ?? "extra"),
          price: Number(ex.price ?? ex.meta?.price ?? 0),
          price_type:
            ex.price_type ??
            ex.meta?.price_type ??
            (ex.price_per_day ? "per_day" : "per_trip"),
          inactive:
            ex.is_available === false || ex.meta?.is_available === false,
        }));
        setExtras(normalized);

        const intervals =
          (bookingsRes ?? [])
            .filter((b: any) => !String(b.status ?? "").startsWith("canceled"))
            .map((b: any) => ({
              start: new Date(b.start_at),
              end: new Date(b.end_at),
            })) ?? [];
        setDisabledIntervals(intervals);

        setPricingRules(pricingRes ?? []);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("BookingDrawer load error", err);
      } finally {
        setLoadingRemote(false);

        // prefill delivery coords/fee if car has coords and fee defined
        if (
          (car?.lat != null || car?.long != null) &&
          delivery === "car_address"
        ) {
          setDeliveryLat(toNum(car?.lat, null));
          setDeliveryLong(toNum(car?.long, null));
          if ((car as any)?.deliveryFee)
            setDeliveryFeeValue(Number((car as any).deliveryFee));
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, car?.id]);

  // block scroll while open
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // touchmove guard — разрешаем прокрутку, если событие происходит внутри panelRef
    const onTouchMove = (e: TouchEvent) => {
      const panel = panelRef.current;
      if (!panel) {
        e.preventDefault();
        return;
      }
      // если тач внутри панели — не блокируем
      if (panel.contains(e.target as Node)) return;
      // иначе — блокируем (чтобы фон не скроллился)
      e.preventDefault();
    };

    document.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, [open]);

  // reset UI when drawer opens
  useEffect(() => {
    if (!open) return;
    setPickedExtras([]);
    // оставляем delivery выбор, но очищаем адрес
    setDeliveryAddress("");
    setDeliveryLat(null);
    setDeliveryLong(null);
    setLicenseFile(null);
    setLicensePreview(null);
    setUploadProgress(null);
    setUploadedUrl(null);
    setAcceptedTerms(false);
    setAcceptedTs(null);
    setSubmitting(false);
    setErrors({});
    requestAnimationFrame(() => {
      try {
        firstFocusRef.current?.focus?.({ preventScroll: true });
      } catch {
        firstFocusRef.current?.focus?.();
      }
    });
  }, [open]);

  // upload preview mock (as в оригинале)
  useEffect(() => {
    if (!licenseFile) {
      setLicensePreview(null);
      setUploadProgress(null);
      setUploadedUrl(null);
      return;
    }
    const url = URL.createObjectURL(licenseFile);
    setLicensePreview(url);
    let cancelled = false;
    (async () => {
      setUploadProgress(0);
      for (let i = 1; i <= 20; i++) {
        if (cancelled) return;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 60));
        setUploadProgress(Math.round((i / 20) * 100));
      }
      if (cancelled) return;
      setUploadedUrl(`/uploads/${Date.now()}_${licenseFile.name}`);
      setUploadProgress(100);
    })();
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [licenseFile]);

  // helper — compute billable days (same as bookingEditor)
  const billableDaysForExtras = useMemo(() => {
    if (!start || !end) return 1;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const minutes = Math.max(0, Math.ceil((e - s) / (1000 * 60)));
    return Math.max(1, Math.ceil(minutes / (24 * 60)));
  }, [start, end]);

  const extrasTotal = useMemo(() => {
    return pickedExtras.reduce((sum, id) => {
      const ex = extras.find((x) => x.id === id);
      if (!ex) return sum;
      const mult = ex.price_type === "per_day" ? billableDaysForExtras : 1;
      return sum + Number(ex.price || 0) * mult;
    }, 0);
  }, [pickedExtras, extras, billableDaysForExtras]);

  const baseTotal =
    Math.round(Math.max(1, days) * (car.price || 0) * 100) / 100;
  const deliveryFee =
    delivery === "by_address" ? Number(deliveryFeeValue || 0) : 0;
  const optionsTotal = Math.round((extrasTotal + deliveryFee) * 100) / 100;
  const grandTotal = Math.round((baseTotal + optionsTotal) * 100) / 100;

  // validation (simplified, взято из BookingDrawer/Editor)
  function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    if (!driverName.trim() || driverName.trim().length < 2)
      e.driverName = "Please enter full name";
    if (!driverLicense.trim() || driverLicense.trim().length < 3)
      e.driverLicense = "Enter license number";
    if (!driverPhone.trim() || driverPhone.trim().length < 6)
      e.driverPhone = "Enter phone number";
    if (!driverEmail.trim() || !isValidEmail(driverEmail))
      e.driverEmail = "Enter a valid email address";
    if (!acceptedTerms) e.acceptedTerms = "You must accept Terms & Conditions";
    if (licenseFile && (!uploadedUrl || (uploadProgress ?? 0) < 100)) {
      e.driverLicenseFile =
        "License upload in progress. Wait until it completes.";
    }
    if (delivery === "by_address" && !deliveryAddress.trim())
      e.deliveryAddress = "Enter delivery address";
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [
    driverName,
    driverLicense,
    driverPhone,
    driverEmail,
    acceptedTerms,
    licenseFile,
    uploadedUrl,
    uploadProgress,
    delivery,
    deliveryAddress,
  ]);

  const canSubmit =
    driverName.trim().length > 1 &&
    driverLicense.trim().length > 2 &&
    driverPhone.trim().length > 5 &&
    isValidEmail(driverEmail) &&
    acceptedTerms &&
    !(licenseFile && (!uploadedUrl || (uploadProgress ?? 0) < 100)) &&
    (!(delivery === "by_address") || deliveryAddress.trim().length > 0);

  const handleConfirm = async () => {
    if (submitting) return;
    const ok = validate();
    if (!ok) return;
    setSubmitting(true);
    try {
      const opts: Record<string, string | number | boolean> = {
        extras: pickedExtras.join(","),
        delivery: delivery === "by_address" ? 1 : 0,
        delivery_address: delivery === "by_address" ? deliveryAddress : "",
        delivery_lat: delivery === "by_address" ? deliveryLat ?? "" : "",
        delivery_long: delivery === "by_address" ? deliveryLong ?? "" : "",
        driver_name: driverName.trim(),
        driver_dob: driverDob ? new Date(driverDob).toISOString() : "",
        driver_license: driverLicense.trim(),
        driver_license_expiry: driverLicenseExpiry
          ? new Date(driverLicenseExpiry).toISOString()
          : "",
        driver_phone: driverPhone.trim(),
        driver_email: driverEmail.trim(),
        driver_license_file_name: licenseFile ? licenseFile.name : "",
        accepted_terms: acceptedTerms ? 1 : 0,
        accepted_ts: acceptedTs ?? new Date().toISOString(),
        accepted_version: ACCEPTED_VERSION,
        price_total: grandTotal,
      };
      await Promise.resolve(onConfirm(opts));
      onClose();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Booking failed", err);
      setErrors((p) => ({ ...p, submit: "Booking failed. Try again." }));
    } finally {
      setSubmitting(false);
    }
  };

  // dropzone handlers (как раньше)
  const handleFiles = (f: File | null) => {
    if (!f) return;
    setLicenseFile(f);
    setUploadedUrl(null);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.driverLicenseFile;
      return next;
    });
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    handleFiles(f);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  // map + AddressAutofill handlers (reuse logic из bookingEditor)
  const onAddressRetrieve = async (res: any) => {
    const f = res?.features?.[0];
    const coords = f?.geometry?.coordinates as [number, number] | undefined;
    if (!coords) return;
    const [lng, lat] = coords;
    setDeliveryLat(lat);
    setDeliveryLong(lng);
    const fallback = f?.properties?.full_address || f?.place_name || "";
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
    setMapView((prev: any) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      zoom: Math.max(prev.zoom, 13),
    }));
    try {
      mapRef.current?.flyTo?.({
        center: [lng, lat],
        zoom: Math.max(mapView.zoom ?? 13, 14),
        essential: true,
      });
    } catch {}
  };

  // autofill user location into delivery address when delivery === 'by_address' and address empty
  useEffect(() => {
    if (!isClient) return;
    if (delivery !== "by_address") return;
    if (deliveryAddress && deliveryAddress.trim()) return;

    let cancelled = false;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (cancelled) return;
          try {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setDeliveryLat(lat);
            setDeliveryLong(lng);
            setMapView((prev: any) => ({
              ...prev,
              latitude: lat,
              longitude: lng,
              zoom: Math.max(prev.zoom ?? 12, 13),
            }));
            try {
              const addr = await fetchAddressFromCoords(lat, lng);
              if (!cancelled && addr) {
                setDeliveryAddress(addr.address || "");
                setDeliveryCountry(addr.country || "");
                setDeliveryCity(addr.city || "");
              }
            } catch {}
          } catch {}
        },
        () => {},
        { maximumAge: 1000 * 60 * 10, timeout: 5000 }
      );
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery, isClient]);

  const declineDays = (d: number) => (d === 1 ? "day" : "days");

  // helpers for UI timeline & progress
  const computeDurationPretty = (s?: string | null, e?: string | null) => {
    if (!s || !e) return "—";
    const ss = new Date(s);
    const ee = new Date(e);
    const totalMin = Math.max(
      0,
      Math.round((ee.getTime() - ss.getTime()) / 60000)
    );
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    const parts: string[] = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    return parts.length ? parts.join(" ") : "0m";
  };

  const computeTripProgress = (s?: string | null, e?: string | null) => {
    if (!s || !e) return 0;
    const ss = new Date(s).getTime();
    const ee = new Date(e).getTime();
    const now = Date.now();
    if (now <= ss) return 0;
    if (now >= ee) return 100;
    return Math.max(
      0,
      Math.min(100, Math.round(((now - ss) / (ee - ss)) * 100))
    );
  };

  const isBetweenNow = (s?: string | null, e?: string | null) => {
    if (!s || !e) return false;
    const ss = new Date(s).getTime();
    const ee = new Date(e).getTime();
    const now = Date.now();
    return now >= ss && now < ee;
  };

  return (
    <div
      className={`fixed inset-0 z-999 pointer-events-none transition-all ${
        open ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0"
        }`}
      />
      <motion.aside
        initial={{ x: "100%", opacity: 0 }}
        animate={open ? { x: "0%", opacity: 1 } : { x: "100%", opacity: 0 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : {
                x: { type: "tween", duration: 0.45, ease: [0.22, 0.8, 0.2, 1] },
                opacity: { duration: 0.15 },
              }
        }
        className="pointer-events-auto fixed right-0 top-0 h-full w-full sm:w-[920px] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={panelRef}
          className="px-4 sm:px-6 h-full flex flex-col overflow-auto md:overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3 mt-2">
            <div className="text-lg font-semibold">Confirm booking</div>
            <div className="flex items-center">
              <button
                onClick={onClose}
                className="text-sm text-neutral-600 px-3 py-2 rounded-md hover:bg-neutral-100"
                disabled={submitting}
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 h-full">
            {/* LEFT: summary ( точно как в BookingEditor ) */}
            <div className="relative md:flex-none md:w-[360px]">
              <div className="md:sticky md:top-6 md:space-y-4 md:max-h-[calc(100vh-6rem)]">
                {/* Car card */}
                <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-4 sm:p-5">
                  <div className="aspect-video w-full overflow-hidden rounded-xl h-40 object-cover bg-gray-100">
                    {car?.photos?.[0] ? (
                      <img
                        src={car.photos[0]}
                        className="h-full w-full object-cover"
                        alt="Car"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                        no photo
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {title} {car?.year}
                    </p>
                    {car?.licensePlate ? (
                      <p className="mt-1 inline-flex items-center rounded-md border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-[10px] font-mono text-gray-700 shadow-sm ring-1 ring-white/50">
                        {car.licensePlate}
                      </p>
                    ) : null}
                  </div>
                </section>

                {/* Trip timeline */}
                <section className="mt-4 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 px-4 py-4 sm:px-5 sm:py-5">
                  <div>
                    <div className="flex flex-col">
                      <span className="text-[11px] uppercase font-semibold tracking-wide text-gray-900">
                        Rental period
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {start && end
                          ? `${new Date(start).toLocaleString()} — ${new Date(
                              end
                            ).toLocaleString()}`
                          : "Select start and end"}
                      </span>
                    </div>

                    <div className="mt-1 text-sm text-gray-700">
                      <span className="text-gray-600">Duration: </span>
                      <span className="font-medium">
                        {computeDurationPretty(start, end)}
                      </span>
                    </div>

                    {isBetweenNow(start, end) && (
                      <div className="mt-4">
                        <div className="h-2.5 w-full overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                          <div
                            className="h-full bg-green-500/90 transition-[width] duration-500 ease-out"
                            style={{
                              width: `${computeTripProgress(start, end)}%`,
                            }}
                            role="progressbar"
                            aria-valuenow={computeTripProgress(start, end)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                        <div className="mt-1 text-right text-[11px] font-medium text-gray-700">
                          {computeTripProgress(start, end)}%
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* Trip summary */}
                <section className="mt-4 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-4 sm:p-5 text-sm">
                  <div className="mb-4">
                    <p className="text-[11px] uppercase tracking-wide text-gray-900 font-semibold">
                      Trip summary
                    </p>
                  </div>

                  <div className="space-y-2 text-gray-700">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col">
                        <span className="text-gray-600 text-sm">
                          Price per day
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block font-medium text-gray-900">
                          {Number(car?.price || 0).toFixed(2)}€
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start justify-between">
                      <span className="text-gray-600 text-sm">
                        Rental subtotal
                      </span>
                      <span className="font-medium text-gray-900">
                        {baseTotal.toFixed(2)}€
                      </span>
                    </div>

                    {deliveryFee > 0 && (
                      <div className="flex items-start justify-between">
                        <span className="text-gray-600 text-sm">Delivery</span>
                        <span className="font-medium text-gray-900">
                          {deliveryFee.toFixed(2)}€
                        </span>
                      </div>
                    )}

                    {extrasTotal > 0 && (
                      <div className="flex items-start justify-between">
                        <span className="text-gray-600 text-sm">Extras</span>
                        <span className="font-medium text-gray-900">
                          {extrasTotal.toFixed(2)}€
                        </span>
                      </div>
                    )}

                    <div className="border-t border-dashed border-gray-300 pt-1" />

                    <div className="flex items-start justify-between">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="text-base font-semibold text-gray-900">
                        {grandTotal.toFixed(2)}€
                      </span>
                    </div>

                    <div className="flex items-start justify-between text-gray-900">
                      <span>Deposit</span>
                      <span>{car.deposit}€</span>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* RIGHT: form */}
            <div className="flex-1">
              <div className="h-full pb-32 pr-2 md:overflow-y-scroll">
                <div className="space-y-4">
                  {/* Options (Extras) — как в BookingEditor */}
                  <section className={cardCls}>
                    <div className="font-semibold text-xs text-gray-900">
                      Extras
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      Additional services & fees
                    </p>

                    <div className="mt-4 space-y-2">
                      {loadingRemote ? (
                        <div className="text-sm text-gray-500">Loading…</div>
                      ) : (
                        extras.map((ex) => (
                          <div
                            key={ex.id}
                            className="flex items-start justify-between rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 shadow-sm"
                          >
                            <label className="flex-1 flex items-start gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={pickedExtras.includes(ex.id)}
                                onChange={(e) => {
                                  const checked = e.currentTarget.checked;
                                  if (checked)
                                    setPickedExtras((p) => [...p, ex.id]);
                                  else
                                    setPickedExtras((p) =>
                                      p.filter((x) => x !== ex.id)
                                    );
                                }}
                                className="mt-1 h-4 w-4"
                                disabled={isLocked}
                              />
                              <div
                                className={`${ex.inactive ? "opacity-70" : ""}`}
                              >
                                <div className="font-medium text-sm text-gray-800">
                                  {ex.title}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {ex.price}€
                                  {ex.price_type === "per_day" ? " / day" : ""}
                                  {ex.inactive ? " (no longer offered)" : ""}
                                </div>
                              </div>
                            </label>

                            <div className="flex items-center gap-3">
                              <div className="text-sm font-medium">
                                {ex.price}€
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  {/* Delivery block (как в BookingEditor) */}
                  <section className={cardCls}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-xs text-gray-900">
                          Delivery
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">
                          {delivery === "by_address"
                            ? "Delivery to customer's address"
                            : "Pickup at car address"}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-sm font-semibold">
                          {(deliveryFeeValue || 0).toFixed(2)}€
                        </div>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={delivery === "by_address"}
                          onClick={() =>
                            setDelivery((d) =>
                              d === "by_address" ? "car_address" : "by_address"
                            )
                          }
                          className="relative inline-flex h-6 w-10 items-center rounded-full focus:outline-none"
                          disabled={isLocked}
                        >
                          <span
                            aria-hidden
                            className={`absolute inset-0 rounded-full transition-colors duration-200 ${
                              delivery === "by_address"
                                ? "bg-black"
                                : "bg-gray-200"
                            }`}
                          />
                          <span
                            className={`relative inline-block h-4 w-4 ml-1 rounded-full bg-white shadow transform transition-transform duration-200 ${
                              delivery === "by_address"
                                ? "translate-x-4"
                                : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-gray-500">
                      If delivery is turned on, we will deliver the car to the
                      address you enter below.
                    </div>
                  </section>

                  {/* Map + Address (only when delivery === 'by_address') */}
                  {delivery === "by_address" && (
                    <div className="mt-4 space-y-4">
                      <div className="h-60 overflow-hidden rounded-xl border border-gray-100 shadow-sm">
                        <Map
                          ref={mapRef}
                          {...mapView}
                          onMove={(e: { viewState: any }) =>
                            setMapView(e.viewState as any)
                          }
                          style={{ width: "100%", height: "100%" }}
                          mapStyle="mapbox://styles/megadoze/cldamjew5003701p5mbqrrwkc"
                          mapboxAccessToken={
                            process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
                            (typeof import.meta !== "undefined"
                              ? (import.meta as any).env?.VITE_MAPBOX_TOKEN
                              : undefined)
                          }
                          interactive={!isLocked}
                        >
                          <Marker
                            longitude={deliveryLong ?? car?.long ?? initialLng}
                            latitude={deliveryLat ?? car?.lat ?? initialLat}
                            draggable={!isLocked}
                            onDragEnd={async (e: {
                              lngLat: { lat: any; lng: any };
                            }) => {
                              const { lat, lng } = e.lngLat;
                              setDeliveryLat(lat);
                              setDeliveryLong(lng);
                              setMapView((prev: any) => ({
                                ...prev,
                                latitude: lat,
                                longitude: lng,
                                zoom: Math.max(prev.zoom ?? 12, 13),
                              }));
                              try {
                                const addr = await fetchAddressFromCoords(
                                  lat,
                                  lng
                                );
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
                            onGeolocate={async (pos: { coords: { latitude: any; longitude: any; }; }) => {
                              if (isLocked) return;
                              const lat = pos.coords.latitude;
                              const lng = pos.coords.longitude;
                              setDeliveryLat(lat);
                              setDeliveryLong(lng);
                              setMapView((prev: any) => ({
                                ...prev,
                                latitude: lat,
                                longitude: lng,
                                zoom: Math.max(prev.zoom ?? 12, 13),
                              }));
                              try {
                                const addr = await fetchAddressFromCoords(
                                  lat,
                                  lng
                                );
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

                        {/* Address input */}
                        <div className="mt-3">
                          <AddressAutofill
                            accessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
                            onRetrieve={onAddressRetrieve}
                          >
                            <input
                              name="delivery-address"
                              id="delivery-address"
                              type="text"
                              value={deliveryAddress}
                              onChange={(e) =>
                                setDeliveryAddress(e.target.value)
                              }
                              placeholder="Enter delivery address"
                              autoComplete="address-line1"
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-600 focus:outline-none"
                              disabled={isLocked}
                            />
                          </AddressAutofill>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 pt-2">
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

                          {errors.deliveryAddress && (
                            <div className="mt-2 text-xs text-red-500">
                              {errors.deliveryAddress}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Driver card (как в BookingEditor) */}
                  <section className={cardCls}>
                    <div className="font-semibold text-xs text-gray-900">
                      Driver
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3">
                      <input
                        ref={firstFocusRef}
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        placeholder="Full name"
                        className={`w-full rounded-md border border-gray-300 px-3 py-2 ${
                          errors.driverName ? "ring-1 ring-red-400" : ""
                        }`}
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">
                            Date of birth (DOB)
                          </label>
                          <input
                            type="date"
                            value={driverDob ?? ""}
                            onChange={(e) =>
                              setDriverDob(e.target.value || null)
                            }
                            className="w-full rounded-md border border-gray-300  px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">
                            License expiry date
                          </label>
                          <input
                            type="date"
                            value={driverLicenseExpiry ?? ""}
                            onChange={(e) =>
                              setDriverLicenseExpiry(e.target.value || null)
                            }
                            className="w-full rounded-md border border-gray-300  px-3 py-2"
                          />
                        </div>
                      </div>

                      <input
                        value={driverLicense}
                        onChange={(e) => setDriverLicense(e.target.value)}
                        placeholder="Driver license number *"
                        className={`w-full rounded-md border border-gray-300  px-3 py-2 ${
                          errors.driverLicense ? "ring-1 ring-red-400" : ""
                        }`}
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={driverPhone}
                          onChange={(e) => setDriverPhone(e.target.value)}
                          placeholder="Phone *"
                          className={`w-full rounded-md border border-gray-300  px-3 py-2 ${
                            errors.driverPhone ? "ring-1 ring-red-400" : ""
                          }`}
                        />
                        <input
                          value={driverEmail}
                          onChange={(e) => setDriverEmail(e.target.value)}
                          placeholder="Email *"
                          type="email"
                          className={`w-full rounded-md border border-gray-300  px-3 py-2 ${
                            errors.driverEmail ? "ring-1 ring-red-400" : ""
                          }`}
                        />
                      </div>

                      {/* Upload */}
                      <div>
                        <label className="text-xs text-gray-500">
                          Upload driver license (photo)
                        </label>
                        <div
                          onDrop={onDrop}
                          onDragOver={onDragOver}
                          onDragLeave={onDragLeave}
                          className={`mt-2 flex items-center gap-3 rounded-md border-dashed ${
                            dragActive ? "border-black" : "border-gray-200"
                          } border p-3 bg-white`}
                        >
                          <div className="flex-1">
                            {licensePreview ? (
                              <div className="flex items-center gap-3">
                                <img
                                  src={licensePreview}
                                  alt="preview"
                                  className="h-12 w-16 object-cover rounded-md"
                                />
                                <div>
                                  <div className="font-medium">
                                    {licenseFile?.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {licenseFile?.size
                                      ? Math.round(licenseFile.size / 1024)
                                      : ""}{" "}
                                    KB
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">
                                Drag & drop file here, or{" "}
                                <label className="underline cursor-pointer">
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) =>
                                      handleFiles(e.target.files?.[0] ?? null)
                                    }
                                  />
                                  select file
                                </label>
                              </div>
                            )}

                            {uploadProgress != null && (
                              <div
                                role="status"
                                aria-live="polite"
                                className="mb-2 mt-2"
                              >
                                <div className="text-xs text-gray-500">
                                  Upload: {uploadProgress}%
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                                  <div
                                    style={{ width: `${uploadProgress}%` }}
                                    className="h-2 rounded-full bg-black"
                                  />
                                </div>
                              </div>
                            )}

                            {uploadedUrl && (
                              <div className="text-xs text-gray-500 mt-2">
                                Uploaded: {uploadedUrl}
                              </div>
                            )}
                            {errors.driverLicenseFile && (
                              <div className="text-xs text-red-500 mt-2">
                                {errors.driverLicenseFile}
                              </div>
                            )}
                          </div>

                          {licensePreview && (
                            <button
                              type="button"
                              onClick={() => {
                                setLicenseFile(null);
                                setLicensePreview(null);
                                setUploadProgress(null);
                                setUploadedUrl(null);
                              }}
                              className="text-xs text-red-500 px-2 py-1 rounded-md hover:bg-red-50"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Terms */}
                  <section className={cardCls}>
                    <label className="flex items-center gap-3">
                      <input
                        id="terms"
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => {
                          setAcceptedTerms(e.target.checked);
                          if (e.target.checked)
                            setAcceptedTs(new Date().toISOString());
                          else setAcceptedTs(null);
                        }}
                      />
                      <div className="text-sm">
                        I agree to the{" "}
                        <Link
                          href="/rental-terms.pdf"
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-emerald-600"
                        >
                          Terms & Conditions
                        </Link>{" "}
                        and{" "}
                        <Link
                          href="/privacy"
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-emerald-600"
                        >
                          Privacy Policy
                        </Link>
                        .
                        {errors.acceptedTerms && (
                          <div className="text-xs text-red-500">
                            {errors.acceptedTerms}
                          </div>
                        )}
                      </div>
                    </label>
                  </section>

                  {/* desktop action row (как в BookingEditor) */}
                  <div className="hidden sm:flex items-center justify-center gap-3">
                    <button
                      ref={lastFocusRef}
                      onClick={handleConfirm}
                      disabled={!canSubmit || submitting}
                      className={`rounded-xl py-3 px-5 font-medium transition-all flex items-center justify-center gap-3 w-full ${
                        !canSubmit || submitting
                          ? "bg-gray-100 text-gray-800 cursor-not-allowed"
                          : "bg-black text-white"
                      }`}
                    >
                      {submitting
                        ? "Booking…"
                        : `Book — ${grandTotal.toFixed(0)}€`}
                    </button>
                  </div>

                  {/* errors / hints */}
                  {!canSubmit && !submitting && (
                    <div className="mt-2 text-center text-xs text-red-500">
                      Please fill required fields and accept Terms. If you
                      uploaded license — wait until upload finishes.
                    </div>
                  )}
                  {errors.submit && (
                    <div className="mt-2 text-center text-xs text-red-500">
                      {errors.submit}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* MOBILE sticky bar */}
          <div className="sm:hidden fixed left-0 right-0 bottom-0 z-50 border-gray-100 bg-white border-t p-3">
            <div className="mx-auto max-w-3xl flex items-center justify-between gap-3 font-roboto-condensed">
              <div>
                <div className="text-xs text-neutral-500">Total</div>
                <div className="text-xl font-semibold">
                  {grandTotal.toFixed(0)}€
                </div>
              </div>
              <button
                onClick={handleConfirm}
                disabled={!canSubmit || submitting}
                className={`ml-2 rounded-xl py-2 px-4 font-medium transition-all flex items-center gap-2 ${
                  !canSubmit || submitting
                    ? "bg-gray-100 text-gray-800 cursor-not-allowed"
                    : "bg-black text-white"
                }`}
              >
                {submitting ? "Booking…" : "Book"}
              </button>
            </div>
          </div>
        </div>
      </motion.aside>
    </div>
  );
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ArrowRightMini() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12h13" />
      <path d="M14 6l6 6-6 6" />
    </svg>
  );
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

function declineDays(n: number) {
  const v = Math.abs(n) % 100;
  const v1 = v % 10;
  if (v > 10 && v < 20) return "days";
  if (v1 > 1 && v1 < 5) return "day";
  if (v1 === 1) return "day";
  return "days";
}

/* LazyAutoplayVideo — немного упрощён, но сохраняет поведение */
function LazyAutoplayVideo({
  src,
  poster,
  className,
  loop = true,
  threshold = 0.6,
}: {
  src: string;
  poster?: string;
  className?: string;
  loop?: boolean;
  threshold?: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [inViewLoaded, setInViewLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        const inView =
          entry.isIntersecting && entry.intersectionRatio >= (threshold ?? 0.6);
        if (inView) {
          if (!inViewLoaded) {
            el.src = src;
            setInViewLoaded(true);
          }
          const p = el.play();
          if (p && typeof (p as any).catch === "function")
            (p as Promise<void>).catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: [0, threshold ?? 0.6, 1] }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [src, threshold, inViewLoaded]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onLoadedMeta = () => {
      try {
        el.currentTime = Math.min(0.08, el.duration || 0.08);
      } catch {}
    };
    const onCanPlay = () => setIsReady(true);
    const onPlaying = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    el.addEventListener("loadedmetadata", onLoadedMeta);
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("pause", onPause);

    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMeta);
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("pause", onPause);
    };
  }, []);

  return (
    <div className={`relative ${className ?? ""}`}>
      {poster && (
        <img
          src={poster}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden
        />
      )}
      <video
        ref={videoRef}
        muted
        playsInline
        controls={false}
        preload="none"
        loop={loop}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          isReady && isPlaying ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}

const MINIMUM_REQS = [
  {
    title: "Free kilometers",
    desc: "Depending on the plan you choose, you'll be entitled to a certain number of free kilometers. Each additional kilometer costs €0.20.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="size-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 13.5a7.5 7.5 0 1 1 15 0v0a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3m0 0 3 1.5"
        />
      </svg>
    ),
  },
  {
    title: "Second driver included",
    desc: "An additional driver is included in your booking. Please note that this driver must meet the same requirements as the main driver.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="size-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.25 11.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 18.75a6 6 0 0 1 12 0"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 10.5a2.25 2.25 0 1 0 0-4.5"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.25 15.75a5.25 5.25 0 0 1 7.5 4.5"
        />
      </svg>
    ),
  },
  {
    title: "MINI Assistance (24/7)",
    desc: "Mobility and security on demand. 24/7. Across Europe.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="size-6"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="12"
          cy="12"
          r="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 12V10.5M12 12l1.25.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Comprehensive insurance",
    desc: "Comprehensive insurance with a €1,000 or €1,500 deductible for Countryman and Aceman models protects you against serious damage.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="size-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3.75 5.25 6v6.75c0 3.9 2.55 6.9 6.75 7.5 4.2-.6 6.75-3.6 6.75-7.5V6L12 3.75Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m8.75 12.25 2 2 4.5-4.5"
        />
      </svg>
    ),
  },
];

function useSyncQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const base =
        typeof window !== "undefined"
          ? searchParams?.toString()
            ? searchParams.toString()
            : window.location.search.replace(/^\?/, "")
          : searchParams?.toString() ?? "";

      const params = new URLSearchParams(base);

      Object.entries(patch).forEach(([k, v]) => {
        if (v == null || v === "") params.delete(k);
        else params.set(k, v);
      });

      const qs = params.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;

      try {
        router.replace(href);
      } catch (err) {
        console.warn("[updateQuery] router.replace failed:", err);
      }

      setTimeout(() => {
        if (typeof window === "undefined") return;
        const current =
          window.location.pathname + (window.location.search || "");
        if (current !== href) {
          window.history.replaceState({}, "", href);
        }
      }, 50);
    },
    [router, pathname, searchParams]
  );

  return updateQuery;
}

export function CountUp({
  end,
  duration = 1000,
  formatter,
  label,
}: {
  end: number;
  duration?: number;
  formatter?: (n: number) => string;
  label: string;
}) {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);
  const elRef = useRef<HTMLDivElement | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio > 0.6 && !started) {
          setStarted(true);
        }
      },
      {
        threshold: [0, 0.5, 1],
        rootMargin: "0px 0px -50px 0px",
      }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const startValue = 0;
    const startTime = performance.now();

    const animate = (time: number) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (end - startValue) * eased;
      setValue(current);
      if (progress < 1) frame.current = requestAnimationFrame(animate);
    };

    frame.current = requestAnimationFrame(animate);
  }, [started, end, duration]);

  return (
    <div ref={elRef} className="rounded-2xl p-4 text-center">
      <div className="text-4xl md:text-6xl font-bold">
        {formatter ? formatter(value) : Math.round(value)}
      </div>
      <div className="text-xs text-neutral-500 uppercase tracking-wide pt-1">
        {label}
      </div>
    </div>
  );
}
