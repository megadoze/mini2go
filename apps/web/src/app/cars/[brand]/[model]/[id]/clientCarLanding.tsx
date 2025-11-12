"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CarWithRelations } from "@/types/carWithRelations";
import { HeaderSection } from "@/components/header";
import { WELCOME_FEATURES } from "@/constants/carOptions";
import RentalDateTimePicker from "@/components/RentalDateTimePicker";
import { startOfDay } from "date-fns";

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

  const [loading] = useState(false); // сервер дал данные — не нужен локальный fetch
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

  const sections = ["overview", "highlights", "services"] as const;
  type SectionId = (typeof sections)[number];

  const [active, setActive] = useState<SectionId>("overview");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);
  const ratiosRef = useRef<Record<string, number>>({});
  const programmaticRef = useRef(false);
  const scrollStopTimer = useRef<number | null>(null);

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
  }, []); // привязываем один раз — данные статичны

  // медиа
  const photos = useMemo(() => (car?.photos || []).filter(Boolean), [car]);
  const hero = photos[0];
  const videoPoster = photos[1] || "/images/aceman2.webp";

  const brand = (car as any)?.model?.brands?.name;
  const model = (car as any)?.model?.name;
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

  // programmatic unlock (для smooth scroll)
  // useEffect(() => {
  //   const onScroll = () => {
  //     if (!(programmaticRef.current as boolean)) return;
  //     if (scrollStopTimer.current) window.clearTimeout(scrollStopTimer.current);
  //     scrollStopTimer.current = window.setTimeout(() => {
  //       programmaticRef.current = false;
  //     }, 120);
  //   };
  //   window.addEventListener("scroll", onScroll, { passive: true });
  //   return () => window.removeEventListener("scroll", onScroll);
  // }, []);

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

  const goToRequest = () => {
    if (!car) return;
    router.push(
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
        className={`sticky top-0 z-60 bg-white/80 backdrop-blur print:hidden transition-all duration-300 ${
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

      <section id="overview" className="scroll-mt-24">
        <div className="sticky top-20 z-50 ml-4 md:ml-10 font-roboto-condensed">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-xs font-medium text-gray-700 shadow hover:bg-white cursor-pointer"
          >
            <ArrowLeftIcon className="h-4 w-4" /> Back
          </button>
        </div>

        <div className="mx-auto max-w-5xl px-4 grid grid-cols-1 md:-mt-12">
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

            <p className="pt-2 md:pt-4 text-lg md:text-xl text-neutral-800">
              An icon of urban driving. Light, maneuverable, and practical.
            </p>

            <div className="mt-5 md:mt-6 flex items-center gap-4 font-roboto-condensed">
              <button
                onClick={() => router.back()}
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
            {/* <Fact
              label="price/day"
              value={`${(car.price ?? 0).toFixed(0)} EUR`}
            /> */}
            <CountUp
              end={Number(car.price ?? 0)}
              duration={600}
              formatter={(n) => `${Math.round(n)} EUR`}
              label="price/day"
            />
            {/* <Fact label="Mileage/day" value={`${car.includeMileage} km`} /> */}
            <CountUp
              end={Number(car.includeMileage ?? 0)}
              duration={600}
              formatter={(n) => `${Math.round(n)} km`}
              label="mileage/day"
            />
            {/* <Fact label="Seats" value={car.seats ?? "—"} /> */}
            <CountUp
              end={Number(car.seats ?? 0)}
              duration={600}
              formatter={(n) => `${Math.round(n)} seats`}
              label="seats"
            />
            {/* <Fact label="Doors" value={car.doors ?? "—"} /> */}
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
                  {/* IMAGE */}
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

                  {/* TEXT */}
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
        onProceed={goToRequest}
        changePickerStatus={() => {
          setPickerVisible(true);
          requestAnimationFrame(() => {
            setPickerOpen(true);
          });
        }}
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
    </div>
  );
}

/* ---------- вспомогательные компоненты (BookingBar, Fact, LazyAutoplayVideo ...) ---------- */

function BookingBar({
  car,
  start,
  end,
  days,
  onProceed,
  changePickerStatus,
}: {
  car: CarWithRelations;
  start: string;
  end: string;
  days: number;
  onProceed: () => void;
  changePickerStatus: () => void;
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
            className="rounded-xl px-3 h-10 md:px-5 md:h-12 text-sm font-medium text-neutral-600 bg-white/40 backdrop-blur border border-neutral-600/50 shadow transition-all duration-200"
          >
            Change
          </button>

          <button
            onClick={onProceed}
            className="rounded-xl px-3 h-10 md:px-5 md:h-12 text-sm font-medium text-neutral-900 bg-white/40 backdrop-blur border border-neutral-600/60 shadow transition-all duration-200 flex items-center gap-1"
          >
            <span>Book</span>
            <ArrowRightMini />
          </button>
        </div>
      </div>
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

      // Первично пробуем через router.replace (чтобы Next знал о навигации)
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
          console.debug("[updateQuery] fallback history.replaceState ->", {
            from: current,
            to: href,
          });
          window.history.replaceState({}, "", href);
        } else {
          console.debug("[updateQuery] router already applied href");
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

    // ⚡️ Настраиваем rootMargin с учётом нижнего меню (например, 150px высоты)
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Запускаем только если элемент реально полностью виден
        if (entry.intersectionRatio > 0.6 && !started) {
          setStarted(true);
        }
      },
      {
        threshold: [0, 0.5, 1],
        rootMargin: "0px 0px -50px 0px", // 🔥 ВАЖНО — отступ снизу
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
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
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
