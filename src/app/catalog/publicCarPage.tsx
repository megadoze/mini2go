import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, CameraIcon } from "@heroicons/react/24/outline";
import { fetchCarById } from "@/services/car.service";
import { HeaderSection } from "../landingpage/header";
import { WELCOME_FEATURES } from "@/constants/carOptions";
import type { CarWithRelations } from "@/types/carWithRelations";

export default function PublicCarLandingMini() {
  const { carId } = useParams();
  const navigate = useNavigate();

  const goToRequest = () => {
    if (!car) return;
    navigate(
      `/catalog/${car.id}/request?start=${encodeURIComponent(
        start
      )}&end=${encodeURIComponent(end)}`
    );
  };

  const [car, setCar] = useState<CarWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNav, setShowNav] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  // Booking UI state
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");

  // Anchor nav
  const sections = ["overview", "highlights", "services"] as const;
  type SectionId = (typeof sections)[number];

  const [active, setActive] = useState<SectionId>("overview");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);
  const ratiosRef = useRef<Record<string, number>>({});
  const programmaticRef = useRef(false);
  const scrollStopTimer = useRef<number | null>(null);

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

        let bestId: SectionId = sections[0]; // ← ВАЖНО: тип указан
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
  }, [loading, sections]);

  const photos = useMemo(() => (car?.photos || []).filter(Boolean), [car]);
  const hero = photos[0];
  const videoPoster = photos[1] || "/images/placeholder-16x9.jpg";

  const brand = (car as any)?.model?.brands?.name;
  const model = (car as any)?.model?.name;
  const title = `${brand} ${model}`.trim();

  const days = useMemo(() => {
    if (!start || !end) return 1;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const d = Math.max(1, Math.ceil((e - s) / (1000 * 60 * 60 * 24)));
    return d;
  }, [start, end]);

  // показывать меню только после прокрутки ~120px
  useEffect(() => {
    const onScroll = () => setShowNav(window.scrollY > 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (!programmaticRef.current) return;
      if (scrollStopTimer.current) window.clearTimeout(scrollStopTimer.current);
      scrollStopTimer.current = window.setTimeout(() => {
        programmaticRef.current = false; // ⬅️ когда прокрутка «успокоилась»
      }, 120); // 120–180мс — норм
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

      {/* Стики-якорное меню (без бордеров) */}
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
                    programmaticRef.current = true; // ⬅️ мы сами начинаем плавный скролл
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

      {/* Обзор */}
      <section id="overview" className="scroll-mt-24">
        {/* Кнопка назад */}
        <div className="sticky top-20 z-50 ml-4 md:ml-10">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-xs font-medium text-gray-700 shadow hover:bg-white"
          >
            <ArrowLeftIcon className="h-4 w-4" /> Back
          </button>
        </div>

        <div className="mx-auto max-w-5xl px-4 grid grid-cols-1">
          <div className=" overflow-hidden">
            <div className="relative ">
              {hero ? (
                <img
                  src={hero}
                  alt={title}
                  className=" w-full h-full object-cover"
                />
              ) : (
                <div className="h-full w-full grid place-items-center text-neutral-400">
                  <CameraIcon className="h-10 w-10" />
                </div>
              )}
            </div>
          </div>

          <header className="flex flex-col items-center text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-robotoCondensed font-bold text-black">
              {title}
            </h1>
            <div className=" mt-4 rounded-md py-1 px-2 bg-zinc-100 text-gray-800">
              {`${car.bodyType} · `}
              {`${car.fuelType} · `}
              {`${car.transmission}`}
            </div>
            <p className="pt-4 text-lg md:text-xl font-roboto text-gray-700">
              An icon of urban driving. Light, maneuverable, and practical.
            </p>
            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={goToRequest}
                className="rounded-full bg-black text-white px-5 py-3 text-sm font-medium hover:bg-neutral-900"
              >
                Book
              </button>
            </div>
          </header>
        </div>
      </section>

      {/* Полоса фактов */}
      <section>
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Fact
              label="price/day"
              value={`${car.price.toFixed(0)} ${"EUR"}`}
            />
            <Fact label="Mileage/day" value={`${car.includeMileage} km`} />
            <Fact label="Seats" value={car.seats ?? "—"} />
            <Fact label="Doors" value={car.doors ?? "—"} />
          </div>
        </div>
      </section>

      {/* Video */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="aspect-[9/16] md:aspect-video rounded-2xl overflow-hidden">
          <LazyAutoplayVideo
            src="/videos/mini-U25.mp4"
            poster={videoPoster}
            className="h-full w-full object-cover"
            // threshold={0.6} // можно подправить чувствительность
          />
        </div>
      </section>

      {/* Highlights */}
      <section id="highlights" className="bg-white scroll-mt-24 pb-10">
        <div className=" lg:px-10 pt-10">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-robotoCondensed font-bold text-black">
              Highlights
            </h2>
            <p className="pt-4 text-lg md:text-xl text-stone-600 font-roboto">
              Small formats — big fun. Choose, book, drive.
            </p>
          </div>

          {/* центрируем контент как у видео */}
          <div className="mt-10 w-full max-w-[1200px] mx-auto space-y-12 md:space-y-16">
            {WELCOME_FEATURES.map((item, i) => {
              const reversed = i % 2 === 0; // зеркалим каждую вторую строку
              return (
                <div
                  key={i}
                  className={`md:flex md:items-center md:justify-center md:gap-8 ${
                    reversed ? "md:flex-row-reverse" : ""
                  }`}
                >
                  {/* КАРТИНКА (ширина как у видео-карточек) */}
                  <div className="flex justify-center px-4 md:px-0">
                    <div className=" w-full md:max-w-[420px] md:w-[340px] lg:w-[380px]">
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

                  {/* ТЕКСТ (ровно та же ширина, отцентрирован) */}
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

      {/* Services */}
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

          {/* центр и ширины — как у видео/карточек */}
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

      <div className="mb-36 md:mb-24"></div>

      {/* Фиксированная нижняя полоса бронирования */}
      <BookingBar
        car={car}
        start={start}
        end={end}
        days={days}
        onStartChange={setStart}
        onEndChange={setEnd}
        onProceed={goToRequest}
      />
    </div>
  );
}

// —— Bottom booking bar (Porsche-like minimal) ——
function BookingBar({
  car,
  start,
  end,
  days,
  // onStartChange,
  // onEndChange,
  onProceed,
}: {
  car: CarWithRelations;
  start: string;
  end: string;
  days: number;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onProceed: () => void;
}) {
  const navigate = useNavigate();
  const total = Math.max(1, days) * (car.price || 0);

  return (
    <div
      id="booking"
      className="fixed inset-x-0 bottom-0 z-50 bg-white/90 backdrop-blur print:hidden border-t"
    >
      <div className="flex items-center justify-between mx-auto max-w-7xl px-3 md:px-6 py-1">
        <div className="flex items-center md:gap-10">
          {/* Сумма */}
          <div>
            <div className="text-2xl md:text-4xl font-extrabold leading-none">
              {total}€
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              for {days} {declineDays(days)}
            </div>
          </div>

          {/* Факты */}
          <div className="flex md:gap-10 text-center">
            <div className="px-3 py-2">
              <div className="text-2xl md:text-4xl font-extrabold leading-none">
                {car.includeMileage}
              </div>
              <div className="text-[11px] md:text-xs text-neutral-500 mt-1">
                incl.km
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-2xl md:text-4xl font-extrabold leading-none">
                {days}
              </div>
              <div className="text-[11px] md:text-xs text-neutral-500 mt-1">
                {declineDays(days)}
              </div>
            </div>
          </div>
        </div>
        {/* Кнопки */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() =>
              navigate(
                `/catalog/${car.id}/availability?start=${encodeURIComponent(
                  start
                )}&end=${encodeURIComponent(end)}`
              )
            }
            className="rounded-xl border px-4 py-3 text-sm font-medium hover:bg-neutral-50"
          >
            Change
          </button>
          <button
            onClick={onProceed}
            className="rounded-xl bg-black px-5 py-3 text-white text-sm font-semibold hover:bg-neutral-900"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// —— UI bits ——
function Fact({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="rounded-2xl border p-4 text-center">
      <div className=" text-4xl font-bold">{value ?? "—"}</div>
      <div className="text-xs text-neutral-500 uppercase tracking-wide pt-1">
        {label}
      </div>
    </div>
  );
}

function labelFor(s: string) {
  switch (s) {
    case "overview":
      return "Overview";
    case "services":
      return "Services";
    case "highlights":
      return "Highlights";
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

const MINIMUM_REQS = [
  {
    title: "Free kilometers",
    desc: "Depending on the plan you choose, you'll be entitled to a certain number of free kilometers. Each additional kilometer costs €0.20.",
    // Спидометр + значок бесконечности = бесплатные км
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
    // Два профиля + бейдж-плюс
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
    // Гарнитура + часы (24/7)
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
        {/* lifebuoy ring */}
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
        {/* lifebuoy straps (N/E/S/W) */}
        <path
          d="M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* clock hands for 24/7 hint */}
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
    // Щит с галочкой
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

function LazyAutoplayVideo({
  src,
  poster,
  className,
  loop = true,
  threshold = 0.6,
}: {
  src: string;
  poster?: string; // передаёшь первый кадр сюда
  className?: string;
  loop?: boolean;
  threshold?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inViewLoaded, setInViewLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false); // можно декодировать кадр
  const [isPlaying, setIsPlaying] = useState(false); // реально играет

  // Ленивая загрузка по видимости
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

  // Готовность видео и аккуратный старт
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onLoadedMeta = () => {
      // часто на 0.0 — чёрный кадр; чуть сдвигаем
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

  // Кросс-фейд: постер виден всегда, видео выезжает по opacity
  return (
    <div className={`relative ${className ?? ""}`}>
      {/* Постер под видео (резерв) */}
      {poster && (
        <img
          src={poster}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden
        />
      )}

      {/* Видео поверх, плавно проявляем как только готово и пошло */}
      <video
        ref={videoRef}
        muted
        playsInline
        controls={false}
        preload="none"
        loop={loop}
        // Убираем атрибут poster, чтобы не мерцал default-переключатель
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          isReady && isPlaying ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
