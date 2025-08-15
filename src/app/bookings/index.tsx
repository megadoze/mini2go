import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { supabase } from "@/lib/supabase"; // поправь путь при необходимости

// ---------- Types ----------
import type { Booking } from "@/types/booking"; // snake_case из БД
import type { BookingCard } from "@/types/bookingCard";
import { Badge } from "@mantine/core";

// Проекция авто, которую возвращает текущий select (минимум полей)
export type CarLite = {
  id: string;
  year: number | string | null;
  photos?: string[] | null;
  model_id: string;
  // плоские имена для UI
  brandName?: string | null;
  modelName?: string | null;
  licensePlate?: string | null;
  deposit?: number | null;
};

function mapRowToCard(row: Booking): BookingCard {
  return {
    id: row.id,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status ?? null,
    mark: row.mark,
    carId: (row.car_id as string) ?? "",
    userId: row.user_id ?? null,
    createdAt: row.created_at ?? null,
    car: null,
    priceTotal: row.price_total ?? null,
  };
}

// ---------- Data ----------
async function fetchBookingsByOwner(owner: string): Promise<BookingCard[]> {
  const { data: carsData, error: carErr } = await supabase
    .from("cars")
    .select(
      `
      id, year, photos, model_id, license_plate, owner, deposit,
      models:models ( name, brand_id, brands:brands ( name ) )
    `
    )
    .eq("owner", owner);

  if (carErr) throw carErr;

  // нормализуем ответ (объект/массив в models/brands)
  const carsRaw = (carsData ?? []) as any[];
  const carsList: CarLite[] = carsRaw.map((c: any) => {
    const modelNode = Array.isArray(c.models) ? c.models[0] : c.models;
    const brandsNode = modelNode?.brands;
    const brandName = Array.isArray(brandsNode)
      ? brandsNode[0]?.name ?? null
      : brandsNode?.name ?? null;

    return {
      id: String(c.id),
      year: typeof c.year === "number" ? c.year : Number(c.year) || null,
      photos: (c.photos ?? null) as string[] | null,
      model_id: String(c.model_id),
      modelName: modelNode?.name ?? null,
      brandName,
      licensePlate: c.license_plate ?? null,
      deposit: c.deposit ?? null,
    };
  });

  // <-- вот тут объявляем carIds
  const carIds: string[] = carsList.map((c) => c.id);
  if (carIds.length === 0) return [];

  const { data: bookings, error: bookErr } = await supabase
    .from("bookings")
    .select(
      "id, start_at, end_at, mark, status, car_id, user_id, price_total, created_at"
    )
    .in("car_id", carIds)
    .neq("mark", "block")
    .neq("status", "blocked")
    .order("start_at", { ascending: false });
  if (bookErr) throw bookErr;

  const base = ((bookings as Booking[] | null) ?? []).filter((b) => !!b.car_id);

  const carInfo = new Map<
    string,
    {
      brand?: string | null;
      model?: string | null;
      year?: number | null;
      photo?: string | null;
      licensePlate: string | null;
      deposit?: number | null;
    }
  >();
  for (const c of carsList) {
    carInfo.set(c.id, {
      brand: c.brandName ?? null,
      model: c.modelName ?? null,
      year: typeof c.year === "number" ? c.year : Number(c.year) || null,
      photo: c.photos?.[0] ?? null,
      licensePlate: c.licensePlate ?? null,
      deposit: c.deposit ?? null,
    });
  }

  return base.map((row) => {
    const card = mapRowToCard(row);
    return {
      ...card,
      car: { id: card.carId, ...(carInfo.get(card.carId) ?? {}) },
    };
  });
}

// ---------- Component ----------
interface Props {
  owner: string; // значение из поля cars.owner (text)
  title?: string;
}

export default function BookingsList({ owner, title = "Bookings" }: Props) {
  const [items, setItems] = useState<BookingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // console.log(items);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        if (!owner) {
          throw new Error(
            "Не задан owner (cars.owner). Передай owner пропсом на время разработки."
          );
        }

        const bookings = await fetchBookingsByOwner(owner);

        if (!cancelled) setItems(bookings);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Не удалось загрузить брони");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [owner]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => (a.startAt < b.startAt ? 1 : -1));
  }, [items]);

  return (
    <main className="w-full">
      <header className="flex items-end justify-between mb-4">
        <h1 className="font-openSans text-2xl font-bold">{title}</h1>
      </header>
      <Link to={"/bookings/new"}>Add booking</Link>

      <section id="bookings" className="mt-6 mb-10">
        {loading && (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse h-20 bg-gray-100 rounded-2xl"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div className="p-6 rounded-2xl border text-gray-600 text-sm">
            Броней пока нет.
          </div>
        )}

        {!loading && !error && sorted.length > 0 && (
          <div className="flex flex-col">
            {sorted.map((b) => (
              <Link
                key={b.id}
                to={`/bookings/${b.id}`}
                state={{ b: b, path: "bookings" }}
                className="flex items-center border hover:bg-gray-50 p-2 w-full rounded-2xl my-1 cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {b.car?.photo ? (
                    <img
                      src={b.car.photo}
                      alt=""
                      className="w-24 h-16 sm:w-28 sm:h-[70px] object-cover rounded-xl"
                    />
                  ) : (
                    <div className="w-24 h-16 sm:w-28 sm:h-[70px] rounded-xl bg-gray-100" />
                  )}
                </div>

                <div className="flex-1 min-w-0 pl-4 pr-2">
                  <p className="font-medium text-sm md:text-base truncate">
                    {b.car?.brand} {b.car?.model}
                  </p>
                  {b.car?.year && (
                    <p className="text-sm text-gray-800 border border-gray-500 rounded-sm w-fit p-1 ">
                      {b.car.licensePlate}
                    </p>
                  )}
                  {/* Мобилка: даты в одну строку */}
                  <div className="mt-1 text-sm sm:hidden">
                    <span className="font-medium">
                      {format(parseISO(b.startAt), "d MMM")}
                    </span>
                    {" → "}
                    <span className="font-medium">
                      {format(parseISO(b.endAt), "d MMM")}
                    </span>
                  </div>
                </div>

                <div className="hidden sm:flex flex-col text-sm md:text-base w-56 flex-1">
                  <p>
                    from:
                    <span className="font-medium pl-1">
                      {format(parseISO(b.startAt), "eee, d MMM")}
                    </span>
                  </p>
                  <p>
                    to:
                    <span className="font-medium pl-1">
                      {format(parseISO(b.endAt), "eee, d MMM")}
                    </span>
                  </p>
                </div>

                <div className="flex md:flex-1 justify-between items-center sm:ml-auto mt-2 sm:mt-0 mr-2 md:mr-auto md:text-base">
                  <div>
                    <StatusPill status={b.status} />
                  </div>
                  <p className="hidden sm:block text-base mr-2 text-gray-700">
                    Details
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function StatusPill({ status }: { status: BookingCard["status"] }) {
  const { label, cls } = useMemo(() => {
    const s = (status || "").toLowerCase();
    if (s === "confirmed") {
      return { label: "confirmed", cls: "orange" };
    }
    if (s === "rent") {
      return { label: s, cls: "lime" };
    }
    if (s === "canceledhost" || s === "canceledguest" || s === "canceledtime") {
      return { label: s, cls: "red" };
    }
    if (s === "onapproval") {
      return { label: s, cls: "blue" };
    }
    if (s === "finished") {
      return { label: s, cls: "dark" };
    }
    return { label: status || "—", cls: "gray" };
  }, [status]);

  return (
    <Badge fw={500} variant="dot" color={cls}>
      {label}
    </Badge>
  );
}
