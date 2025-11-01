import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  MapPinIcon,
  ShieldCheckIcon,
  ClockIcon,
  CheckCircleIcon,
  CameraIcon,
} from "@heroicons/react/24/outline";
import { fetchPublicCarById } from "@/services/public-cars.service";

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

export default function PublicCarPage() {
  const { carId } = useParams();
  const navigate = useNavigate();
  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Booking UI state
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [insurance, setInsurance] = useState<string>("standard");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!carId) return;
        const data = (await fetchPublicCarById(carId)) as unknown as Car;
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

  const photos = useMemo(() => (car?.photos || []).filter(Boolean), [car]);
  const hero = photos[0];
  const brand =
    (car as any)?.models?.brand?.name || (car as any)?.model?.brand?.name || "";
  const model = (car as any)?.models?.name || (car as any)?.model?.name || "";
  const title = `${brand} ${model}`.trim() || "Автомобиль";

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
      {/* Top bar */}
      <div className="sticky top-3 z-40 ml-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-xs font-medium text-gray-700 shadow hover:bg-white"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Назад
        </button>
      </div>

      {/* Title */}
      <header className="mx-auto max-w-6xl px-4 pt-2 pb-4">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
          {model || title}
        </h1>
        <div className="text-neutral-500 mt-1">
          {brand}
          {car.year ? ` · ${car.year}` : ""}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 grid grid-cols-1 lg:grid-cols-12 gap-10 pb-16">
        {/* LEFT column */}
        <section className="lg:col-span-8 space-y-8">
          {/* Hero media */}
          <div className="rounded-2xl overflow-hidden border">
            {car.heroVideoUrl ? (
              <div className="relative h-[44vh] md:h-[56vh] bg-black">
                <video
                  src={car.heroVideoUrl}
                  className="h-full w-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              </div>
            ) : (
              <div className="relative h-[44vh] md:h-[56vh] bg-neutral-100">
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

          {/* Key facts band (mimic Porsche) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Fact
              label="Preis"
              value={`${car.price.toFixed(0)} ${car.currency || "EUR"}`}
            />
            <Fact label="Freikilometer" value={`${car.includeMileage} km`} />
            <Fact label="Sitze" value={car.seats ?? "—"} />
            <Fact label="Türen" value={car.doors ?? "—"} />
          </div>

          {/* Performance table */}
          <div className="rounded-2xl border p-6">
            <h2 className="text-xl font-semibold mb-4">Fahrleistungen</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-10 text-sm">
              <Spec k="Leistung (kW/PS)" v={combinePower(car.powerHp)} />
              <Spec
                k="0–100 km/h"
                v={car.accelerationSec ? `${car.accelerationSec} s` : undefined}
              />
              <Spec k="Höchstgeschwindigkeit" v={undefined /* optional */} />
              <Spec
                k="Kraftstoffverbrauch (komb.)*"
                v={undefined /* optional */}
              />
              <Spec k="CO₂-Emissionen (komb.)*" v={undefined /* optional */} />
            </dl>
            <p className="mt-3 text-xs text-neutral-500">
              * Werte abhängig von Ausstattung. Angaben dienen
              Vergleichszwecken.
            </p>
          </div>

          {/* Inclusions */}
          <div className="rounded-2xl border p-6">
            <h2 className="text-xl font-semibold mb-4">Inklusivleistungen</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-emerald-600" />{" "}
                Freikilometer
              </li>
              <li className="flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-emerald-600" />{" "}
                Zweitfahrer inklusive
              </li>
              <li className="flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-emerald-600" /> Porsche
                Assistance (24/7)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-emerald-600" />{" "}
                Umfangreiche Versicherung
              </li>
            </ul>
          </div>

          {/* Details & host */}
          <div className="rounded-2xl border p-6 space-y-4 text-sm">
            {car.content && (
              <div>
                <h3 className="text-base font-semibold mb-1">Beschreibung</h3>
                <p className="text-neutral-700">{car.content}</p>
              </div>
            )}
            <div>
              <h3 className="text-base font-semibold mb-1">Adresse</h3>
              <div className="flex items-start gap-2 text-neutral-700">
                <MapPinIcon className="h-5 w-5" /> {car.address || "—"}
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold mb-1">Host</h3>
              {ownerIdDerived ? (
                <Link to={`/hosts/${ownerIdDerived}`} className="underline">
                  {ownerName}
                </Link>
              ) : (
                <span>{ownerName || "—"}</span>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT column — booking card */}
        <aside className="lg:col-span-4">
          <div className="sticky top-8">
            <div className="rounded-3xl border p-6 shadow-sm">
              <div className="flex items-baseline justify-between">
                <div className="text-3xl md:text-4xl font-semibold tracking-tight">
                  {car.price.toFixed(0)} {car.currency || "EUR"}
                </div>
                <div className="text-sm text-neutral-500">pro Tag</div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg border p-2">
                  <div className="font-semibold">{car.price.toFixed(0)}</div>
                  <div className="text-neutral-500">Preis</div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="font-semibold">{car.includeMileage}</div>
                  <div className="text-neutral-500">km</div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="font-semibold">{days}</div>
                  <div className="text-neutral-500">Tage</div>
                </div>
              </div>

              {/* Rental period */}
              <div className="mt-5">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <ClockIcon className="h-5 w-5" /> Mietzeitraum auswählen
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                  <button
                    onClick={() =>
                      navigate(
                        `/catalog/${
                          car.id
                        }/availability?start=${encodeURIComponent(
                          start
                        )}&end=${encodeURIComponent(end)}`
                      )
                    }
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
                  >
                    Fahrzeugverfügbarkeit abrufen
                  </button>
                </div>
              </div>

              {/* Insurance */}
              <div className="mt-6">
                <div className="text-sm font-medium mb-2">
                  Wählen Sie Ihre Versicherung
                </div>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <label className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer">
                    <input
                      type="radio"
                      name="ins"
                      value="standard"
                      checked={insurance === "standard"}
                      onChange={() => setInsurance("standard")}
                    />
                    <span>Standard</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer">
                    <input
                      type="radio"
                      name="ins"
                      value="extended"
                      checked={insurance === "extended"}
                      onChange={() => setInsurance("extended")}
                    />
                    <span>Erweitert</span>
                  </label>
                </div>
              </div>

              <button
                onClick={() =>
                  navigate(
                    `/catalog/${car.id}/request?start=${encodeURIComponent(
                      start
                    )}&end=${encodeURIComponent(end)}&insurance=${insurance}`
                  )
                }
                className="mt-6 w-full rounded-xl bg-black px-4 py-3 text-white font-medium hover:bg-neutral-900"
              >
                Weiter
              </button>

              <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
                <ShieldCheckIcon className="h-4 w-4" /> Sichere Zahlung
              </div>
            </div>
          </div>
        </aside>
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

function combinePower(hp?: number | null) {
  if (hp == null) return null;
  const kw = Math.round(hp * 0.7355);
  return `${kw} kW/${hp} PS`;
}
