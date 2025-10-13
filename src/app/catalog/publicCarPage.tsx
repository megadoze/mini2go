import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  CameraIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { fetchCarById } from "@/services/car.service";
import { HeaderSection } from "../landingpage/header";
import { WELCOME_FEATURES } from "@/constants/carOptions";

type Car = {
  models: any;
  id: string;
  vin: string;
  modelId: string;
  year?: number | null;
  fuelType?: string | null;
  transmission?: string | null;
  seats?: number | null;
  licensePlate?: string | null;
  engineCapacity?: number | null;
  bodyType?: string | null;
  driveType?: string | null;
  color?: string | null;
  doors?: number | null;
  photos?: string[] | null;
  content?: string | null;
  address: string;
  pickupInfo: string;
  returnInfo: string;
  isDelivery: boolean;
  deliveryFee: number;
  includeMileage: number; // km/day
  price: number; // per day
  deposit: number;
  currency?: string | null;
  accelerationSec?: number | null;
  powerHp?: number | null;
  torqueNm?: number | null;
  heroVideoUrl?: string | null;
  owner?: any;
  ownerId?: string | null;
};

export default function PublicCarLandingMini() {
  const { carId } = useParams();
  const navigate = useNavigate();

  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNav, setShowNav] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  // Booking UI state
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");

  // Anchor nav
  const sections = ["overview", "services", "highlights"] as const;
  const [active, setActive] = useState<(typeof sections)[number]>("overview");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!carId) return;
        const data = (await fetchCarById(carId)) as unknown as Car;
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
    const ids = sections.map((id) => document.getElementById(id));
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target?.id) setActive(visible.target.id as any);
      },
      { rootMargin: "-20% 0px -70% 10px", threshold: [0.25, 0.6, 1] }
    );
    ids.forEach((el) => el && observerRef.current?.observe(el));
    return () => observerRef.current?.disconnect();
  }, [loading]);

  const photos = useMemo(() => (car?.photos || []).filter(Boolean), [car]);
  const hero = photos[0];
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
                  const target = document.getElementById(s);
                  const headerH = navRef.current?.offsetHeight ?? 0;
                  if (target) {
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
            <p className="pt-4 text-lg md:text-xl font-roboto">
              Икона городского драйва. Лёгкий, манёвренный и практичный.{" "}
              <br></br>
              MINI для тех, кто любит характер и стиль.
            </p>
            <div className="mt-6 flex items-center gap-4">
              <a
                href="#booking"
                className="rounded-full bg-black text-white px-5 py-3 text-sm font-medium hover:bg-neutral-900"
              >
                Забронировать
              </a>
              <a
                href="#specs"
                className="inline-flex items-center gap-1 text-sm text-neutral-700 hover:text-black"
              >
                ТТХ <ChevronRightIcon className="h-4 w-4" />
              </a>
            </div>
          </header>
        </div>
      </section>

      {/* Полоса фактов */}
      <section className="scroll-mt-24">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Fact
              label="price/day"
              value={`${car.price.toFixed(0)} ${"EUR"}`}
            />
            <Fact label="Inc. mileage." value={`${car.includeMileage} км`} />
            <Fact label="Seats" value={car.seats ?? "—"} />
            <Fact label="Doors" value={car.doors ?? "—"} />
          </div>
        </div>
      </section>

      {/* Video */}
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className=" aspect-[9/16] md:aspect-video">
          <video
            // ref={setStoryRef(2)}
            className=" inset-0 h-full w-full object-cover rounded-2xl"
            src="/videos/mini-U25.mp4"
            muted
            playsInline
            preload="metadata"
            loop
            // onPlaying={() => setStoryPlaying((s) => ({ ...s, [2]: true }))}
            // onPause={() => setStoryPlaying((s) => ({ ...s, [2]: false }))}
            // onEnded={(e) => {
            //   stopAndPoster(e.currentTarget);
            //   setStoryPlaying((s) => ({ ...s, [2]: false }));
            //   setHoveredStory((p) => (p === 2 ? null : p));
            // }}
            autoPlay
          />
        </div>
      </section>

      {/* Services */}
      <section id="services" className="bg-white">
        <div className="px-[3vw] sm:px-6 lg:px-10 pt-24">
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

      {/* Highlights */}
      <section id="highlights" className="bg-white">
        <div className=" lg:px-10 pt-24">
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

      <div className="mb-36 md:mb-24"></div>

      {/* Фиксированная нижняя полоса бронирования */}
      <BookingBar
        car={car}
        start={start}
        end={end}
        days={days}
        onStartChange={setStart}
        onEndChange={setEnd}
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
}: {
  car: Car;
  start: string;
  end: string;
  days: number;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}) {
  const navigate = useNavigate();
  const total = Math.max(1, days) * (car.price || 0);
  const fmt = (n: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-white/90 backdrop-blur print:hidden border-t">
      <div className="flex flex-col md:flex-row items-center justify-between mx-auto max-w-7xl px-4 py-1">
        <div className="flex items-center gap-10">
          {/* Сумма */}
          <div className="">
            <div className="text-3xl md:text-4xl font-extrabold leading-none">
              {fmt(total)}
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              for {days} {declineDays(days)}
            </div>
          </div>

          {/* Факты */}
          <div className="flex gap-10 text-center">
            <div className="px-3 py-2">
              <div className="text-3xl md:text-4xl font-extrabold leading-none">
                {car.includeMileage}
              </div>
              <div className="text-[11px] md:text-xs text-neutral-500 mt-1">
                км/day
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-3xl md:text-4xl font-extrabold leading-none">
                {days}
              </div>
              <div className="text-[11px] md:text-xs text-neutral-500 mt-1">
                days
              </div>
            </div>
          </div>
        </div>
        {/* Кнопки */}
        <div className="flex items-center justify-end gap-3">
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
            Change rental dates
          </button>
          <button
            onClick={() =>
              navigate(
                `/catalog/${car.id}/request?start=${encodeURIComponent(
                  start
                )}&end=${encodeURIComponent(end)}`
              )
            }
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
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="size-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
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
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="size-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z"
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
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="size-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
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
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="size-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
        />
      </svg>
    ),
  },
];
