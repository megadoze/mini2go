import { useMemo, useState } from "react";
import {
  Link,
  useLoaderData,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { format, parseISO } from "date-fns";
import {
  fetchCarById,
  fetchCarExtras,
  fetchCarsByHost,
  fetchExtras,
} from "@/services/car.service";
import {
  fetchBookingById,
  fetchBookingsByCarId,
} from "@/app/car/calendar/calendar.service";
import { fetchBookingExtras } from "@/services/booking-extras.service";
import { getUserById } from "@/services/user.service";

import type { BookingCard } from "@/types/bookingCard";
import { QK } from "@/queryKeys";
import { getGlobalSettings } from "@/services/settings.service";
import {
  fetchPricingRules,
  fetchSeasonalRates,
} from "../car/pricing/pricing.service";

// ---- тип строк из лоадера (как в твоём bookings.loader.ts) ----
type BookingRow = {
  id: string;
  start_at: string;
  end_at: string;
  mark: string;
  status: string | null;
  car_id: string;
  user_id: string | null;
  price_total: number | null;
  created_at: string | null;
};

type LoaderData = { ownerId: string };

// утилита: склеиваем BookingRow + info об авто -> BookingCard
function toCard(row: BookingRow, carsById: Map<string, any>): BookingCard {
  const carBrief = carsById.get(row.car_id) || {};
  const mark: BookingCard["mark"] = row.mark === "block" ? "block" : "booking";

  return {
    id: row.id,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status ?? null,
    mark,
    carId: row.car_id,
    userId: row.user_id,
    createdAt: row.created_at,
    priceTotal: row.price_total,
    car: {
      id: row.car_id,
      brand: carBrief?.models?.brands?.name ?? null,
      model: carBrief?.models?.name ?? null,
      year: carBrief?.year ?? null,
      photo: carBrief?.photos?.[0] ?? null,
      licensePlate: carBrief?.licensePlate ?? null,
      deposit: carBrief?.deposit ?? null,
    },
  };
}

export default function BookingsList({
  title = "Bookings",
}: {
  title?: string;
}) {
  const { ownerId } = useLoaderData() as LoaderData;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  // 1) Брони: читаем из кэша, который уже прогрет лоадером (ensureQueryData).
  //    initialData берём напрямую из кэша — никаких лишних запросов.
  const bookingsKey = ["bookingsIndex", ownerId];
  const initialRows = qc.getQueryData<BookingRow[]>(bookingsKey);

  const { data: bookingRows = [] } = useQuery({
    queryKey: bookingsKey,
    queryFn: () => Promise.resolve(initialRows ?? []),
    initialData: initialRows,
    enabled: !!initialRows, // к этому моменту лоадер их уже прогрел
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  // 2) Машины хоста: чтобы карточки умели показать бренд/модель/фото/номер.
  //    Если этот список уже где-то прогрет — возьмётся из кэша.
  const carsKey = ["carsByHost", ownerId];
  const initialCars = qc.getQueryData<any[]>(carsKey);

  const { data: cars = [] } = useQuery({
    queryKey: carsKey,
    queryFn: () => fetchCarsByHost(ownerId),
    initialData: initialCars,
    enabled: !initialCars, // если лоадер прогрел — не фетчить
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60_000,
  });

  const carsById = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of cars) m.set(String(c.id), c);
    return m;
  }, [cars]);

  const items: BookingCard[] = useMemo(
    () => bookingRows.map((r) => toCard(r, carsById)),
    [bookingRows, carsById]
  );

  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.startAt < b.startAt ? 1 : -1)),
    [items]
  );

  const [openingId, setOpeningId] = useState<string | null>(null);

  const openEditor = (b: BookingCard) => {
    if (openingId) return;
    setOpeningId(b.id);

    // a) достаём из кеша, если уже префетчено (по ховеру/ранее)
    const cachedBooking = qc.getQueryData<any>(["booking", b.id]);
    const cachedExtras = qc.getQueryData<any[]>(["bookingExtras", b.id]);

    const cachedUser = b.userId
      ? qc.getQueryData<any>(["user", b.userId])
      : null;

    // b) минимальная основа из карточки
    const base = {
      id: b.id,
      car_id: b.carId,
      user_id: b.userId,
      start_at: b.startAt,
      end_at: b.endAt,
      mark: b.mark,
      status: b.status,
      price_total: b.priceTotal,
    };

    void prefetchBundle(qc, b.carId, b.id, b.userId ?? undefined);

    // c) мгновенная навигация со снапшотом, максимально обогащённым из кеша
    navigate(`/cars/${b.carId}/bookings/${b.id}/edit`, {
      state: {
        snapshot: {
          booking: {
            ...base,
            ...(cachedBooking ?? {}),
            ...(cachedUser ? { user: cachedUser } : {}),
          },
          booking_extras: Array.isArray(cachedExtras) ? cachedExtras : [],
        },
        from: location.pathname + location.search,
      },
    });

    setOpeningId(null);
  };

  async function prefetchBundle(
    qc: QueryClient,
    carId: string,
    bId: string,
    uId?: string
  ) {
    await Promise.all([
      qc.prefetchQuery({
        queryKey: QK.appSettings,
        queryFn: getGlobalSettings,
        staleTime: 5 * 60_000,
      }),
      qc.prefetchQuery({
        queryKey: QK.extras,
        queryFn: fetchExtras,
        staleTime: 5 * 60_000,
      }),
      qc.prefetchQuery({
        queryKey: QK.car(carId),
        queryFn: () => fetchCarById(carId),
        staleTime: 5 * 60_000,
      }),
      qc.prefetchQuery({
        queryKey: QK.carExtras(carId),
        queryFn: () => fetchCarExtras(carId),
        staleTime: 5 * 60_000,
      }),
      qc.prefetchQuery({
        queryKey: QK.pricingRules(carId),
        queryFn: () => fetchPricingRules(carId),
        staleTime: 5 * 60_000,
      }),
      qc.prefetchQuery({
        queryKey: QK.seasonalRates(carId),
        queryFn: () => fetchSeasonalRates(carId),
        staleTime: 5 * 60_000,
      }),
      qc.prefetchQuery({
        queryKey: QK.bookingsByCarId(carId),
        queryFn: () => fetchBookingsByCarId(carId),
        staleTime: 60_000,
      }),
      qc.prefetchQuery({
        queryKey: QK.booking(bId),
        queryFn: () => fetchBookingById(bId),
        staleTime: 60_000,
      }),
      qc.prefetchQuery({
        queryKey: QK.bookingExtras(bId),
        queryFn: () => fetchBookingExtras(bId),
        staleTime: 60_000,
      }),
      uId
        ? qc.prefetchQuery({
            queryKey: QK.user(uId),
            queryFn: () => getUserById(uId),
            staleTime: 5 * 60_000,
          })
        : Promise.resolve(),
    ]);
  }

  return (
    <main className="w-full">
      <header className="flex items-end justify-between mb-4">
        <h1 className="font-openSans text-2xl font-bold">{title}</h1>
      </header>

      <section id="bookings" className="mt-6 mb-10">
        {sorted.length === 0 ? (
          <div className="p-6 rounded-2xl border text-gray-600 text-sm">
            Броней пока нет.
          </div>
        ) : (
          <div className="flex flex-col">
            {sorted.map((b) => (
              <Link
                key={b.id}
                to={`/cars/${b.carId}/bookings/${b.id}/edit`}
                className={`flex items-center border hover:bg-lime-100/20 hover:border-lime-200/80 p-2 w-full rounded-2xl my-1 cursor-pointer ${
                  openingId === b.id
                    ? "hover:bg-lime-200/20 pointer-events-none"
                    : ""
                }`}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) return; // новая вкладка — ок
                  e.preventDefault();
                  openEditor(b);
                  // void openEditor(b);
                }}
                onMouseEnter={() => {
                  void prefetchBundle(qc, b.carId, b.id, b.userId ?? undefined);
                }}
                aria-busy={openingId === b.id}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {b.car?.photo ? (
                    <img
                      src={b.car.photo as string}
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
                  {b.car?.licensePlate && (
                    <p className="text-sm text-gray-800 border border-gray-500 rounded-sm w-fit px-1 ">
                      {b.car.licensePlate}
                    </p>
                  )}
                  <div className="mt-1 text-sm sm:hidden">
                    <span>{format(parseISO(b.startAt), "d MMM")}</span>
                    {" → "}
                    <span>{format(parseISO(b.endAt), "d MMM")}</span>
                  </div>
                </div>

                <div className="hidden sm:flex flex-col text-sm md:text-base w-56 flex-1">
                  <p>
                    from:
                    <span className="pl-1">
                      {format(parseISO(b.startAt), "eee, d MMM")}
                    </span>
                  </p>
                  <p>
                    to:
                    <span className="pl-1">
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
  const matches = useMediaQuery("(max-width: 425px)");
  const s = (status || "").toLowerCase();
  const map: Record<string, { label: string; cls: any }> = {
    confirmed: { label: "confirmed", cls: "orange" },
    rent: { label: "rent", cls: "lime" },
    canceledhost: { label: "canceledhost", cls: "red" },
    canceledguest: { label: "canceledguest", cls: "red" },
    canceledtime: { label: "canceledtime", cls: "red" },
    onapproval: { label: "onapproval", cls: "blue" },
    finished: { label: "finished", cls: "dark" },
  };
  const { label, cls } = map[s] ?? { label: status || "—", cls: "gray" };
  return (
    <Badge
      fw={500}
      variant="dot"
      color={cls as any}
      size={matches ? "sm" : "md"}
    >
      {label}
    </Badge>
  );
}
