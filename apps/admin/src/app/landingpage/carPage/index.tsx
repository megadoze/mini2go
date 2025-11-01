import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, CameraIcon } from "@heroicons/react/24/outline";
import { fetchCarById } from "@/services/car.service";
import { HeaderSection } from "../mainPage/header";
import { WELCOME_FEATURES } from "@/constants/carOptions";
import type { CarWithRelations } from "@/types/carWithRelations";

export default function PublicCarLandingMini() {
  const { carId } = useParams();

  const navigate = useNavigate();

  const [car, setCar] = useState<CarWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showNav, setShowNav] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [start] = useState<string>("2025-11-10T08:00");
  const [end] = useState<string>("2025-11-12T08:00");

  // Anchor nav
  const sections = ["overview", "highlights", "services"] as const;
  type SectionId = (typeof sections)[number];

  const [active, setActive] = useState<SectionId>("overview");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);
  const ratiosRef = useRef<Record<string, number>>({});
  const programmaticRef = useRef(false);
  const scrollStopTimer = useRef<number | null>(null);

  // load car
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!carId) return;
        const data = (await fetchCarById(carId)) as unknown as CarWithRelations;
        if (!alive) return;
        setCar(data);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load car");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [carId]);

  // intersection observer for sticky nav highlight
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
  }, [loading]); // достаточно завязаться на loading (после подгрузки DOM уже есть)

  // hero and media
  const photos = useMemo(() => (car?.photos || []).filter(Boolean), [car]);
  const hero = photos[0];
  const videoPoster = photos[1] || "/images/aceman2.webp";

  // brand/model/title
  const brand = (car as any)?.model?.brands?.name;
  const model = (car as any)?.model?.name;
  const title = `${brand ?? ""} ${model ?? ""}`.trim();

  // choose demo video by model name
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

  // rental days
  const days = useMemo(() => {
    if (!start || !end) return 1;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const d = Math.max(1, Math.ceil((e - s) / (1000 * 60 * 60 * 24)));
    return d;
  }, [start, end]);

  // show sticky nav after scroll
  useEffect(() => {
    const onScroll = () => setShowNav(window.scrollY > 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // programmatic scroll unlock
  useEffect(() => {
    const onScroll = () => {
      if (!programmaticRef.current) return;
      if (scrollStopTimer.current) window.clearTimeout(scrollStopTimer.current);
      scrollStopTimer.current = window.setTimeout(() => {
        programmaticRef.current = false;
      }, 120);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // go to request (checkout-ish)
  const goToRequest = () => {
    if (!car) return;
    navigate(
      `/catalog/${car.id}/request?start=${encodeURIComponent(
        start
      )}&end=${encodeURIComponent(end)}`
    );
  };

  if (loading)
    return <div className="p-6 text-sm text-gray-600">Загрузка…</div>;

  if (error || !car)
    return (
      <div className="p-6 text-sm text-red-600">
        {error || "Авто не найдено"}
      </div>
    );

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <HeaderSection
        menuOpen={menuOpen}
        handleMenuOpen={setMenuOpen}
        color="black"
      />

      {/* sticky anchor nav */}
      <nav
        ref={navRef}
        className={`sticky top-0 z-[60] bg-white/80 backdrop-blur print:hidden transition-all duration-300 ${
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

      {/* OVERVIEW */}
      <section id="overview" className="scroll-mt-24">
        {/* back button */}
        <div className="sticky top-20 z-50 ml-4 md:ml-10">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-xs font-medium text-gray-700 shadow hover:bg-white"
          >
            <ArrowLeftIcon className="h-4 w-4" /> Back
          </button>
        </div>

        <div className="mx-auto max-w-5xl px-4 grid grid-cols-1 mt-8 md:mt-0">
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
                  <CameraIcon className="h-10 w-10" />
                </div>
              )}
            </div>
          </div>

          <header className="flex flex-col items-center text-center -mt-5 md:-mt-20 z-10">
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-robotoCondensed font-bold text-black">
              {title}
            </h1>

            <div className="mt-2 md:mt-4 rounded-md py-1 px-2 bg-zinc-100 font-light text-sm md:text-base text-gray-800">
              {`${car.bodyType ?? "—"} · ${car.fuelType ?? "—"} · ${
                car.transmission ?? "—"
              }`}
            </div>

            <p className="pt-2 md:pt-4 text-lg md:text-xl font-roboto text-neutral-800">
              An icon of urban driving. Light, maneuverable, and practical.
            </p>

            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={goToRequest}
                className="rounded-full bg-black text-white px-8 py-3 text-sm font-medium hover:bg-neutral-900"
              >
                Book
              </button>
            </div>
          </header>
        </div>
      </section>

      {/* FACT STRIP */}
      <section>
        <div className="mx-auto max-w-5xl px-4 pt-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Fact
              label="price/day"
              value={`${(car.price ?? 0).toFixed(0)} EUR`}
            />
            <Fact label="Mileage/day" value={`${car.includeMileage} km`} />
            <Fact label="Seats" value={car.seats ?? "—"} />
            <Fact label="Doors" value={car.doors ?? "—"} />
          </div>
        </div>
      </section>

      {/* VIDEO */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="aspect-[9/16] md:aspect-video rounded-2xl overflow-hidden">
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
            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-robotoCondensed font-bold text-black">
              Highlights
            </h2>
            <p className="pt-4 text-lg md:text-xl text-stone-600 font-roboto">
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
                  {/* IMAGE */}
                  <div className="flex justify-center px-4 md:px-0">
                    <div className="w-full md:max-w-[420px] md:w-[340px] lg:w-[380px]">
                      <div className="relative aspect-square md:aspect-[9/16] overflow-hidden rounded-2xl ring-1 ring-black/10 bg-black">
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

                  {/* TEXT */}
                  <div className="mt-4 md:mt-0 flex justify-center">
                    <div className="w-[82vw] max-w-[420px] md:w-[340px] lg:w-[380px]">
                      <h3 className="text-2xl md:text-3xl font-robotoCondensed font-semibold text-black">
                        {item.title}
                      </h3>
                      <p className="mt-3 font-roboto text-stone-600 text-lg lg:text-xl">
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
            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-robotoCondensed font-bold text-black">
              Inclusive services
            </h2>
            <p className="pt-4 text-lg md:text-xl text-stone-600 font-roboto">
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
                      <h3 className="text-lg md:text-xl font-semibold text-black">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-black/70 md:text-base leading-relaxed">
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

      {/* spacer for sticky bottom bar */}
      <div className="mb-36 md:mb-24" />

      {/* sticky bottom booking bar */}
      <BookingBar
        car={car}
        start={start}
        end={end}
        days={days}
        onProceed={goToRequest}
      />
    </div>
  );
}

/* -------------------------
   Sticky bottom booking bar
   (glass style unified)
------------------------- */
function BookingBar({
  car,
  start,
  end,
  days,
  onProceed,
}: {
  car: CarWithRelations;
  start: string;
  end: string;
  days: number;
  onProceed: () => void;
}) {
  const navigate = useNavigate();

  // считаем сумму за период
  const total = Math.max(1, days) * (car.price || 0);

  return (
    <div
      id="booking"
      className="fixed inset-x-0 bottom-0 z-50 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/40 border-t"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-2 flex items-center justify-between">
        {/* левая инфо-зона: total, км, дни */}
        <div className="flex items-center gap-4 md:gap-10 text-center font-robotoCondensed">
          {/* total € */}
          <div className="text-left">
            <div className="text-2xl md:text-4xl font-extrabold leading-none text-neutral-900">
              {total.toFixed(0)}€
            </div>
            <div className="text-[11px] md:text-xs text-neutral-500 leading-snug">
              for {days} {declineDays(days)}
            </div>
          </div>

          {/* блоки метрик */}
          <div className="flex items-center gap-4 md:gap-10 text-center">
            <div>
              <div className="text-2xl md:text-4xl font-extrabold leading-none text-neutral-900">
                {car.includeMileage}
              </div>
              <div className="text-[11px] md:text-xs text-neutral-500 leading-snug">
                incl. km/day
              </div>
            </div>

            <div className="">
              <div className="text-2xl md:text-4xl font-extrabold leading-none text-neutral-900">
                {days}
              </div>
              <div className="text-[11px] md:text-xs text-neutral-500 leading-snug">
                {declineDays(days)}
              </div>
            </div>
          </div>
        </div>

        {/* правая зона: кнопки */}
        <div className="flex items-center justify-end gap-2 md:gap-3">
          {/* Change даты/условия */}
          <button
            onClick={() =>
              navigate(
                `/catalog/${car.id}/availability?start=${encodeURIComponent(
                  start
                )}&end=${encodeURIComponent(end)}`
              )
            }
            className={cn(
              "rounded-xl px-3 h-10 md:px-5 md:h-12 text-sm font-medium text-neutral-600",
              "bg-white/40 backdrop-blur supports-[backdrop-filter]:bg-white/20",
              "border border-neutral-600/50",
              "shadow-[0_8px_20px_rgba(0,0,0,0.05)]",
              "hover:bg-white/60 hover:border-neutral-900 hover:shadow-[0_16px_32px_rgba(0,0,0,0.08)]",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-offset-1 focus:ring-offset-white"
            )}
          >
            Change
          </button>

          {/* Next → бронирование */}
          <button
            onClick={onProceed}
            className={cn(
              "rounded-xl px-3 h-10 md:px-5 md:h-12 text-sm font-medium text-neutral-900",
              "bg-white/40 backdrop-blur supports-[backdrop-filter]:bg-white/20",
              "border border-neutral-600/60",
              "shadow-[0_12px_24px_rgba(0,0,0,0.06)]",
              "hover:border-neutral-900 hover:bg-white/60 hover:shadow-[0_20px_40px_rgba(0,0,0,0.10)]",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-offset-1 focus:ring-offset-white",
              "flex items-center gap-1"
            )}
          >
            <span>Book</span>
            <ArrowRightMini />
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------
   Small bits / helpers
------------------------- */

// визуально одинаковые классы joiner
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// мини-стрелка →
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
      {/* горизонтальная линия почти до головы */}
      <path d="M4 12h13" />
      {/* острие стрелки, крупнее и правее */}
      <path d="M14 6l6 6-6 6" />
    </svg>
  );
}

// блок факта
function Fact({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="rounded-2xl border p-4 text-center">
      <div className="text-4xl font-bold">{value ?? "—"}</div>
      <div className="text-xs text-neutral-500 uppercase tracking-wide pt-1">
        {label}
      </div>
    </div>
  );
}

// подписи для sticky-якорного меню
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

// склонение "days"
function declineDays(n: number) {
  const v = Math.abs(n) % 100;
  const v1 = v % 10;
  if (v > 10 && v < 20) return "days";
  if (v1 > 1 && v1 < 5) return "day";
  if (v1 === 1) return "day";
  return "days";
}

// формат для бара внизу: "10.11 08:00"
// function formatDateForLabel(dt: string) {
//   if (!dt) return "—";
//   try {
//     const d = new Date(dt);
//     const dd = String(d.getDate()).padStart(2, "0");
//     const mm = String(d.getMonth() + 1).padStart(2, "0");
//     const hh = String(d.getHours()).padStart(2, "0");
//     const min = String(d.getMinutes()).padStart(2, "0");
//     return `${dd}.${mm} ${hh}:${min}`;
//   } catch {
//     return dt;
//   }
// }

// cards in "Inclusive services"
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

/* -------------------------
   Lazy video player
------------------------- */
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inViewLoaded, setInViewLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // lazy load video when visible
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
          if (p && typeof (p as any).catch === "function") {
            (p as Promise<void>).catch(() => {});
          }
        } else {
          el.pause();
        }
      },
      { threshold: [0, threshold ?? 0.6, 1] }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [src, threshold, inViewLoaded]);

  // handle loaded/playing state + smooth first frame
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
