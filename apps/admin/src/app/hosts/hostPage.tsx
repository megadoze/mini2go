import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchHostById, type Host } from "@/services/host.service";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { fetchCarsByHost } from "@/services/car.service";
import type { CarWithRelations } from "@/types/carWithRelations";

export default function HostPage() {
  const { hostId } = useParams();
  const navigate = useNavigate();

  const [host, setHost] = useState<Host | null>(null);
  const [cars, setCars] = useState<CarWithRelations[]>([]);

  const [loading, setLoading] = useState(true);
  const [carsLoading, setCarsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const primed = useMemo(() => {
    if (!hostId) return null;
    return { id: hostId } as Host;
  }, [hostId]);

  useEffect(() => {
    if (!primed?.id) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const h = await fetchHostById(primed.id);
        if (!mounted) return;
        setHost(h);
      } catch (e: any) {
        setError(e?.message || "Failed to load host");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [primed?.id]);

  useEffect(() => {
    if (!primed?.id) return;
    let mounted = true;
    setCarsLoading(true);
    (async () => {
      try {
        const list = await fetchCarsByHost(primed.id);
        if (!mounted) return;
        setCars(list);
      } catch (e) {
        // можно показать инлайн-ошибку только в секции машин
      } finally {
        if (mounted) setCarsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [primed?.id]);

  if (!primed) {
    return (
      <div className="w-full max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ArrowLeftIcon className="w-4 h-4" />
          <Link to="/dashboard" className="hover:underline">
            Back
          </Link>
        </div>
        <h1 className="mt-3 text-xl md:text-2xl font-semibold">
          Host not found
        </h1>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span className="sm:inline">Back</span>
        </button>
        <span className="text-xs text-gray-400">/</span>
        <h1 className="font-roboto text-xl md:text-2xl font-bold">Host</h1>
      </div>

      {/* Host card */}
      <section className="mt-4 rounded-2xl border border-gray-100 bg-white/70 p-4 md:p-5">
        {loading ? (
          <Skeleton lines={3} />
        ) : error ? (
          <InlineError message={error} />
        ) : host ? (
          <div className="flex items-center gap-4">
            {host.avatar_url ? (
              <img
                src={host.avatar_url}
                className="h-16 w-16 md:h-20 md:w-20 rounded-2xl object-cover border border-gray-100"
                alt={host.full_name ?? host.email ?? host.id}
              />
            ) : (
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-gray-100 grid place-items-center text-xl text-gray-600 border">
                {getInitials(host.full_name || host.email || "H")}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg md:text-xl font-semibold truncate">
                {host.full_name || "Host"}
              </h2>
              <p className="text-sm text-gray-500 truncate">
                {host.email || "—"}
              </p>
              {host.phone && (
                <p className="text-sm text-gray-500">{host.phone}</p>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {/* Fleet */}
      <section className="mt-4 rounded-2xl  border-gray-100 bg-white/70">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Fleet</h3>
          <span className="text-xs text-gray-500">
            {carsLoading
              ? ""
              : `${cars.length} car${cars.length === 1 ? "" : "s"}`}
          </span>
        </div>

        <div className="mt-3">
          {carsLoading ? (
            <Skeleton lines={4} />
          ) : cars.length === 0 ? (
            <EmptyState
              title="No cars yet"
              description="This host hasn't added cars."
            />
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cars.map((c) => {
                const photo = c.photos?.[0] ?? null;
                const brand = c.models?.brands?.name ?? "—";
                const model = c.models?.name ?? "—";
                const price = c.price.toFixed?.(2) ?? null;
                const currency = c.currency ?? "EUR";
                const country = c.locations?.countries?.name ?? "-";
                const location = c.locations?.name ?? "-";

                return (
                  <li
                    key={c.id}
                    className="border rounded-xl bg-white/60 p-3 hover:bg-gray-50"
                  >
                    <Link to={`/catalog/${c.id}`} className="block">
                      <div className="aspect-[3/2] w-full overflow-hidden rounded-lg border border-gray-100">
                        {photo ? (
                          <img
                            src={photo}
                            className="w-full h-full object-cover"
                            alt={`${brand} ${model}`}
                          />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-gray-400">
                            no photo
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between mt-2">
                        <p className="font-medium text-gray-900 truncate">
                          {brand} {model} {c.year ?? ""} <br></br>
                          <span className=" text-gray-500 text-sm">
                            {country}, {location}
                          </span>
                        </p>
                        <p className="">
                          <span className=" text-gray-500 text-sm">from</span>{" "}
                          {price} {currency}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-2 mt-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-100 rounded" />
      ))}
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="mt-2 rounded-xl border border-red-100 bg-red-50 text-red-700 p-3 text-sm">
      {message}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 p-6 text-center">
      <p className="mt-2 text-sm font-medium text-gray-900">{title}</p>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}

function getInitials(name?: string | null) {
  if (!name) return "H";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "H";
}
