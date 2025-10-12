import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  MapPinIcon,
  CameraIcon,
  ChevronRightIcon,
  PlayCircleIcon,
} from "@heroicons/react/24/outline";
import { fetchCarById } from "@/services/car.service";
import { HeaderSection } from "../landingpage/header";

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
  const sections = [
    "overview",
    "highlights",
    "exterior",
    "interior",
    "tech",
    "specs",
    "booking",
  ] as const;
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
      { rootMargin: "-20% 0px -70% 0px", threshold: [0.25, 0.6, 1] }
    );
    ids.forEach((el) => el && observerRef.current?.observe(el));
    return () => observerRef.current?.disconnect();
  }, [loading]);

  const photos = useMemo(() => (car?.photos || []).filter(Boolean), [car]);
  const hero = photos[0];
  const brand =
    (car as any)?.models?.brand?.name ||
    (car as any)?.model?.brand?.name ||
    "MINI";
  const model =
    (car as any)?.models?.name || (car as any)?.model?.name || "Cooper";
  const title = `${brand} ${model}`.trim() || "Автомобиль";
  // const logoUrl =
  //   (car as any)?.models?.brand?.logo ||
  //   (car as any)?.model?.brand?.logo ||
  //   null;

  const ownerObj: any = (car as any)?.owner;
  const ownerName =
    typeof ownerObj === "string"
      ? ownerObj
      : ownerObj?.full_name || ownerObj?.email || "Хост";
  const ownerIdDerived =
    car?.ownerId || (typeof ownerObj === "object" ? ownerObj?.id : undefined);

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
      {/* Логотип по центру */}
      {/* <header className="py-3">
        <div className="mx-auto max-w-5xl px-4 flex justify-center">
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="h-8" />
          ) : (
            <span className="text-xl font-semibold tracking-tight">MINI</span>
          )}
        </div>
      </header> */}
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
            <ArrowLeftIcon className="h-4 w-4" /> Назад
          </button>
        </div>

        <div className="mx-auto max-w-5xl px-4 grid grid-cols-1 gap-8 py-8 mt-10">
          <div className=" overflow-hidden">
            {car.heroVideoUrl ? (
              <div className="relative h-[44vh] md:h-[64vh] bg-black">
                <video
                  src={car.heroVideoUrl}
                  className="h-full w-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
                <div className="absolute left-4 bottom-4 flex items-center gap-2 text-white/90">
                  <PlayCircleIcon className="h-6 w-6" />
                  <span className="text-xs">Hero video</span>
                </div>
              </div>
            ) : (
              <div className="relative h-[44vh] md:h-[64vh] bg-neutral-100">
                {hero ? (
                  <img
                    src={hero}
                    alt={title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full grid place-items-center text-neutral-400">
                    <CameraIcon className="h-10 w-10" />
                  </div>
                )}
              </div>
            )}
          </div>

          <header className="flex flex-col items-center text-center py-2">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
              {title}
            </h1>
            <div className="text-neutral-500 mt-1">
              {car.year ? `${car.year} · ` : ""}
              {car.bodyType || "Хэтчбек"}
            </div>
            <p className="mt-4 text-neutral-700 text-sm max-w-3xl">
              Икона городского драйва. Лёгкий, манёвренный и практичный. MINI
              для тех, кто любит характер и стиль.
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
      <section id="highlights" className="scroll-mt-24">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Fact
              label="Цена/день"
              value={`${car.price.toFixed(0)} ${"EUR"}`}
            />
            <Fact label="Пробег вкл." value={`${car.includeMileage} км`} />
            <Fact label="Места" value={car.seats ?? "—"} />
            <Fact label="Двери" value={car.doors ?? "—"} />
          </div>
        </div>
      </section>

      {/* Экстерьер/Интерьер */}
      <FeatureRow
        id="exterior"
        title="Экстерьер"
        text="Контрастная крыша и светодиодная оптика подчёркивают характер MINI."
        image={photos[1] || hero}
      />
      <FeatureRow
        id="interior"
        title="Интерьер"
        text="Круглый OLED-дисплей и премиальные материалы — всё под рукой."
        image={photos[2] || photos[0]}
        flip
      />

      {/* Технологии */}
      <section id="tech" className="bg-neutral-50 scroll-mt-24">
        <div className="mx-auto max-w-5xl px-4 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <h2 className="text-2xl font-semibold text-center lg:text-left">
              Технологии
            </h2>
            <ul className="mt-6 space-y-3 text-sm text-neutral-700">
              <Bullet>Адаптивный круиз-контроль*</Bullet>
              <Bullet>Парковочный ассистент*</Bullet>
              <Bullet>Apple CarPlay / Android Auto</Bullet>
              <Bullet>Камера заднего вида*</Bullet>
            </ul>
            <p className="mt-3 text-xs text-neutral-500">
              * Наличие зависит от комплектации конкретного авто.
            </p>
          </div>
          <div className="lg:col-span-7 rounded-2xl overflow-hidden min-h-[320px] bg-neutral-100">
            {photos[3] ? (
              <img
                src={photos[3]}
                alt="Tech"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="h-full w-full grid place-items-center text-neutral-400 p-10 text-center">
                <CameraIcon className="h-10 w-10" />
                <p className="mt-2 text-xs">
                  Добавьте фото, чтобы показать технологии
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Галерея */}
      <section className="scroll-mt-24">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <h3 className="text-xl font-semibold mb-4 text-center">Галерея</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-100"
              >
                {photos[i] ? (
                  <img
                    src={photos[i]}
                    alt={`photo-${i}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full grid place-items-center text-neutral-400">
                    <CameraIcon className="h-10 w-10" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Характеристики */}
      <section id="specs" className="scroll-mt-24">
        <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
          <div className="rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-4 text-center">
              Характеристики
            </h2>
            <dl className="mx-auto max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-10 text-sm">
              <Spec k="Мощность (кВт/л.с.)" v={combinePower(car.powerHp)} />
              <Spec
                k="Крутящий момент"
                v={car.torqueNm ? `${car.torqueNm} Н·м` : undefined}
              />
              <Spec
                k="0–100 км/ч"
                v={car.accelerationSec ? `${car.accelerationSec} с` : undefined}
              />
              <Spec k="Трансмиссия" v={car.transmission} />
              <Spec k="Тип топлива" v={car.fuelType} />
              <Spec k="Привод" v={car.driveType} />
              <Spec
                k="Объём двигателя"
                v={car.engineCapacity ? `${car.engineCapacity} см³` : undefined}
              />
              <Spec k="Цвет" v={car.color} />
            </dl>
            <p className="mt-3 text-xs text-neutral-500 text-center">
              Значения указаны для представленного автомобиля и могут
              отличаться.
            </p>
          </div>
        </div>
      </section>

      {/* Описание / Адрес / Хост */}
      <section className="scroll-mt-24">
        <div className="mx-auto max-w-5xl px-4 py-10 grid grid-cols-1 gap-10">
          <div className="rounded-2xl p-6 space-y-4 text-sm">
            {car.content && (
              <div>
                <h3 className="text-base font-semibold mb-1">Описание</h3>
                <p className="text-neutral-700">{car.content}</p>
              </div>
            )}
            <div>
              <h3 className="text-base font-semibold mb-1">Адрес</h3>
              <div className="flex items-start gap-2 text-neutral-700">
                <MapPinIcon className="h-5 w-5" /> {car.address || "—"}
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold mb-1">Хост</h3>
              {ownerIdDerived ? (
                <Link to={`/hosts/${ownerIdDerived}`} className="underline">
                  {ownerName}
                </Link>
              ) : (
                <span>{ownerName || "—"}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Фиксированная нижняя полоса бронирования */}
      <BookingBar
        car={car}
        start={start}
        end={end}
        days={days}
        onStartChange={setStart}
        onEndChange={setEnd}
      />

      {/* Низ страницы без разделителей */}
      <footer>
        <div className="mx-auto max-w-5xl px-4 py-10 text-xs text-neutral-500">
          Изображения носят иллюстративный характер. Комплектация и
          характеристики зависят от конкретного автомобиля.
        </div>
      </footer>
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
    <div
      id="booking"
      className="fixed inset-x-0 bottom-0 z-50 bg-white/90 backdrop-blur print:hidden border-t"
    >
      <div className="flex items-center justify-between mx-auto max-w-7xl px-4 py-1">
        <div className="flex items-center gap-10">
          {/* Сумма */}
          <div className="">
            <div className="text-3xl md:text-4xl font-extrabold leading-none">
              {fmt(total)}
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              за {days} {declineDays(days)}
            </div>
          </div>

          {/* Факты */}
          <div className="flex gap-10 text-center">
            <div className="px-3 py-2">
              <div className="text-3xl md:text-4xl font-extrabold leading-none">
                {car.includeMileage}
              </div>
              <div className="text-[11px] md:text-xs text-neutral-500 mt-1">
                км/день
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-3xl md:text-4xl font-extrabold leading-none">
                {days}
              </div>
              <div className="text-[11px] md:text-xs text-neutral-500 mt-1">
                дней
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
            Изменить даты проката
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
            Дальше
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
    <div className="rounded-2xl p-4 text-center">
      <div className="text-xs text-neutral-500 uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold">{value ?? "—"}</div>
    </div>
  );
}

function Spec({ k, v }: { k: string; v?: string | number | null }) {
  if (v == null || v === "") return null;
  return (
    <div className="grid grid-cols-12">
      <dt className="col-span-7 text-neutral-500">{k}</dt>
      <dd className="col-span-5 font-medium text-neutral-900">{String(v)}</dd>
    </div>
  );
}

function FeatureRow({
  id,
  title,
  text,
  image,
  flip,
}: {
  id: string;
  title: string;
  text: string;
  image?: string;
  flip?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mx-auto max-w-5xl px-4 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {flip ? (
          <>
            <div className="lg:col-span-6 rounded-2xl overflow-hidden min-h-[320px] bg-neutral-100 order-2 lg:order-none">
              {image ? (
                <img
                  src={image}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="h-full w-full grid place-items-center text-neutral-400 p-10 text-center">
                  <CameraIcon className="h-10 w-10" />
                  <p className="mt-2 text-xs">
                    Добавьте фото для раздела “{title}”
                  </p>
                </div>
              )}
            </div>
            <div className="lg:col-span-6 flex flex-col justify-center text-center lg:text-left order-1 lg:order-none">
              <h2 className="text-2xl font-semibold">{title}</h2>
              <p className="mt-4 text-neutral-700">{text}</p>
            </div>
          </>
        ) : (
          <>
            <div className="lg:col-span-6 flex flex-col justify-center text-center lg:text-left">
              <h2 className="text-2xl font-semibold">{title}</h2>
              <p className="mt-4 text-neutral-700">{text}</p>
            </div>
            <div className="lg:col-span-6 rounded-2xl overflow-hidden min-h-[320px] bg-neutral-100">
              {image ? (
                <img
                  src={image}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="h-full w-full grid place-items-center text-neutral-400 p-10 text-center">
                  <CameraIcon className="h-10 w-10" />
                  <p className="mt-2 text-xs">
                    Добавьте фото для раздела “{title}”
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-neutral-900" />
      <span>{children}</span>
    </li>
  );
}

function labelFor(s: string) {
  switch (s) {
    case "overview":
      return "Обзор";
    case "highlights":
      return "Особенности";
    case "exterior":
      return "Экстерьер";
    case "interior":
      return "Интерьер";
    case "tech":
      return "Технологии";
    case "specs":
      return "Характеристики";
    case "booking":
      return "Бронирование";
    default:
      return s;
  }
}

function combinePower(hp?: number | null) {
  if (hp == null) return null;
  const kw = Math.round(hp * 0.7355);
  return `${kw} кВт/${hp} л.с.`;
}

function declineDays(n: number) {
  const v = Math.abs(n) % 100;
  const v1 = v % 10;
  if (v > 10 && v < 20) return "дней";
  if (v1 > 1 && v1 < 5) return "дня";
  if (v1 === 1) return "день";
  return "дней";
}
