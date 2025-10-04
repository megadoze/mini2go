// src/app/catalog/publicCarPage.tsx
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  fetchPublicCarById,
  type PublicCar,
} from "@/services/public-cars.service";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function PublicCarPage() {
  const { carId } = useParams();
  const navigate = useNavigate();
  const [car, setCar] = useState<PublicCar | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!carId) return;
        const data = await fetchPublicCarById(carId);
        if (!alive) return;
        setCar(data);
      } catch (e: any) {
        setErr(e?.message || "Failed to load car");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [carId]);

  if (loading) return <div className="p-4">Loading…</div>;
  if (err || !car) return <div className="p-4">{err || "Car not found"}</div>;

  const photo = car.photos?.[0] ?? null;
  const brand = car.model?.brand?.name ?? "—";
  const model = car.model?.name ?? "—";

  return (
    <div className="max-w-5xl mx-auto p-4">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back
      </button>

      <h1 className="mt-3 text-2xl font-semibold">
        {brand} {model} {car.year ?? ""}
      </h1>
      {car.license_plate && (
        <p className="text-sm text-gray-600 mt-1">{car.license_plate}</p>
      )}

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border overflow-hidden">
          {photo ? (
            <img
              src={photo}
              alt={`${brand} ${model}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="aspect-video w-full grid place-items-center text-gray-400">
              no photo
            </div>
          )}
        </div>

        <div className="rounded-2xl border p-4 bg-white/70">
          <div className="text-sm text-gray-700 space-y-2">
            <div>
              <span className="text-gray-500">Price / day:</span>{" "}
              <b>
                {car.price?.toFixed?.(2)} {car.currency ?? "EUR"}
              </b>
            </div>
            {car.deposit != null && (
              <div>
                <span className="text-gray-500">Deposit:</span> {car.deposit}
              </div>
            )}
            {car.address && (
              <div>
                <span className="text-gray-500">Location:</span> {car.address}
              </div>
            )}
            {car.owner && (
              <div className="pt-2">
                <div className="text-xs text-gray-500">Host</div>
                <Link to={`/hosts/${car.owner.id}`} className="underline">
                  {car.owner.full_name ?? car.owner.email ?? "Host"}
                </Link>
              </div>
            )}
          </div>

          {/* тут можно добавить кнопку «Запросить бронь» или ссылку в твой публичный flow */}
        </div>
      </div>
    </div>
  );
}
