// src/app/dashboard/DashboardPage.tsx
import React, { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  FunnelIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Area,
} from "recharts";
import { Drawer, NativeSelect, Menu, Button } from "@mantine/core";
import { DatePickerInput, type DatesRangeValue } from "@mantine/dates";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subWeeks,
  subMonths,
  subDays,
  startOfDay,
  endOfDay,
  parseISO,
  isValid,
  format,
} from "date-fns";

import { fetchCarsByHost } from "@/services/car.service";
import type { CarWithRelations } from "@/types/carWithRelations";
import { Link, useLoaderData } from "react-router";
import {
  fetchBookingsIntersectingRange,
  fetchBookingsSince,
} from "@/services/booking-lite.service";

/* =================== types & helpers =================== */

type BookingRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string | null;
  mark: string | null;
  car_id: string;
  user_id?: string | null;
  price_total?: number | null;
};

// Сырые статусы из БД
type RawStatus =
  | "onapproval"
  | "confirmed"
  | "rent"
  | "finished"
  | "canceledhost"
  | "canceledclient"
  | "blocked";

// Группы для аналитики/фильтра
type StatusGroup =
  | "reserved"
  | "active"
  | "completed"
  | "cancelled"
  | "blocked";

// Каталог: лейблы/цвета + маппинг в группы
const STATUS_CATALOG: Record<
  RawStatus,
  { label: string; group: StatusGroup; className: string }
> = {
  onapproval: {
    label: "OnApproval",
    group: "reserved",
    className: "bg-gradient-to-r from-sky-600/80 to-sky-500/70 text-white",
  },
  confirmed: {
    label: "Confirmed",
    group: "reserved",
    className:
      "bg-gradient-to-r from-orange-600/80 to-orange-500/60 text-white",
  },
  rent: {
    label: "Rent",
    group: "active",
    className:
      "bg-gradient-to-r from-emerald-500 from-30% to-emerald-500/80 text-white",
  },
  finished: {
    label: "Finished",
    group: "completed",
    className: "bg-gradient-to-r from-gray-400 to-gray-400/60 text-white",
  },
  canceledhost: {
    label: "Canceled (host)",
    group: "cancelled",
    className: "bg-rose-50 text-rose-700",
  },
  canceledclient: {
    label: "Canceled (client)",
    group: "cancelled",
    className: "bg-rose-50 text-rose-700",
  },
  blocked: {
    label: "Blocked",
    group: "blocked",
    className: "bg-gradient-to-r from-pink-700/80 to-rose-500/70 text-white",
  },
};

// iOS-safe парсер строк из БД ("YYYY-MM-DD HH:mm:ss+00" → ISO)
const parseDbDate = (s: string) =>
  parseISO(s.includes("T") ? s : s.replace(" ", "T"));

// NB: принимаем Date | string | null
const safeDate = (d: Date | string | null | undefined, fallback: Date) => {
  if (d instanceof Date) return isValid(d) ? d : fallback;
  if (typeof d === "string") {
    const p = parseDbDate(d);
    return isValid(p) ? p : fallback;
  }
  return fallback;
};

const safeISOStart = (d: Date | string | null | undefined, fb: Date) =>
  startOfDay(safeDate(d, fb)).toISOString();

const safeISOEnd = (d: Date | string | null | undefined, fb: Date) =>
  endOfDay(safeDate(d, fb)).toISOString();

const fmtDate = (x: string | Date, withTime = false) => {
  const d = x instanceof Date ? x : parseDbDate(x);
  return format(d, withTime ? "dd MMM yy, HH:mm" : "dd MMM yy", {});
};

const ym = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const nowBetween = (aISO: string, bISO: string) => {
  const a = parseDbDate(aISO).getTime();
  const b = parseDbDate(bISO).getTime();
  const n = Date.now();
  return a <= n && n <= b ? 1 : 0;
};

// Получить сырой статус (как в БД) с нормализацией регистра/вариантов
function getRawStatus(row: BookingRow): RawStatus {
  const m = (row.mark ?? "").toLowerCase();
  const s = (row.status ?? "").toLowerCase();

  if (m === "block" || s === "block" || s === "blocked") return "blocked";
  if (s === "onapproval") return "onapproval";
  if (s === "confirmed") return "confirmed";
  if (s === "rent") return "rent";
  if (s === "finished") return "finished";
  if (s === "canceledhost") return "canceledhost";
  if (s === "canceledclient") return "canceledclient";

  // если реально придёт что-то другое — бросаем ошибку
  throw new Error(`Unknown booking status: ${s} (mark=${m})`);
}

// Группа для аналитики
function getStatusGroup(row: BookingRow): StatusGroup {
  return STATUS_CATALOG[getRawStatus(row)].group;
}

/* =================== main component =================== */

export default function DashboardPage() {
  const qc = useQueryClient();

  const { ownerId: ownerIdFromLoader } =
    (useLoaderData() as { ownerId: string }) ?? {};
  const ownerId = ownerIdFromLoader; // единственный источник

  type RangeV = [Date | string | null, Date | string | null];
  const [range, setRange] = useState<RangeV>([
    startOfMonth(new Date()),
    endOfDay(new Date()),
  ]);
  const [fromSel, toSel] = range;

  const fromDate = safeDate(fromSel, startOfMonth(new Date()));
  const toDate = safeDate(toSel, new Date());
  const fromISO = safeISOStart(fromSel, startOfMonth(new Date()));
  const toISO = safeISOEnd(toSel, new Date());

  const [carId, setCarId] = useState<string>("all");
  const [status, setStatus] = useState<"all" | StatusGroup>("all");
  const [q, setQ] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [view, setView] = useState<"operational" | "managerial">("operational");

  /* -------------------- queries -------------------- */

  const carsQ = useQuery<CarWithRelations[], Error>({
    queryKey: ["carsByHost", ownerId],
    queryFn: () => fetchCarsByHost(ownerId),
    initialData: qc.getQueryData<CarWithRelations[]>(["carsByHost", ownerId]),
    enabled: !!ownerId,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const cars = carsQ.data ?? [];
  const carIds = useMemo(() => cars.map((c) => c.id!).filter(Boolean), [cars]);

  // Выбранный период — для таблиц/аналитики
  const bookingsQ = useQuery<BookingRow[], Error>({
    queryKey: ["dashboardBookings", ownerId, "range", fromISO, toISO],
    queryFn: () => fetchBookingsIntersectingRange(carIds, fromISO, toISO),
    initialData: qc.getQueryData<BookingRow[]>([
      "dashboardBookings",
      ownerId,
      "range",
      fromISO,
      toISO,
    ]),
    enabled: carIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  // "Сейчас" — отдельная выборка, чтобы KPI не зависел от диапазона
  const nowRef = useRef<string>(new Date().toISOString());
  const bookingsNowQ = useQuery<BookingRow[], Error>({
    queryKey: ["dashboardBookings", ownerId, "now"],
    queryFn: () =>
      fetchBookingsIntersectingRange(carIds, nowRef.current, nowRef.current),
    initialData: qc.getQueryData<BookingRow[]>([
      "dashboardBookings",
      ownerId,
      "now",
    ]),
    enabled: carIds.length > 0,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (prev) => prev,
  });

  // 6 месяцев — для тренда выручки
  const sixStart = startOfMonth(subMonths(new Date(), 5));
  const bookings6mQ = useQuery<BookingRow[], Error>({
    queryKey: ["dashboardBookings", ownerId, "last6m"],
    queryFn: () =>
      fetchBookingsSince(carIds, startOfDay(sixStart).toISOString()),
    initialData: qc.getQueryData<BookingRow[]>([
      "dashboardBookings",
      ownerId,
      "last6m",
    ]),
    enabled: carIds.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  // const cars = carsQ.data ?? [];
  const bookings = bookingsQ.data ?? [];
  const bookings6m = bookings6mQ.data ?? [];
  const bookingsNow = bookingsNowQ.data ?? [];

  /* -------------------- derived -------------------- */

  const carsById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cars) {
      if (!c.id) continue;
      const label =
        `${c.models?.brands?.name ?? ""} ${c.models?.name ?? ""}`.trim() ||
        c.id;
      m.set(c.id, label);
    }
    return m;
  }, [cars]);

  const plateById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cars) {
      if (!c?.id) continue;
      const plate = (c as any).licensePlate ?? "";
      if (plate) m.set(c.id, String(plate));
    }
    return m;
  }, [cars]);

  const activeCarIds = useMemo(
    () =>
      cars
        .filter((c) => (c as any).status?.toLowerCase?.() !== "archived")
        .map((c) => c.id!)
        .filter(Boolean),
    [cars]
  );

  // Применяем UI-фильтры к выборке периода
  const filtered = useMemo(() => {
    let arr = bookings;
    if (carId !== "all") arr = arr.filter((b) => b.car_id === carId);
    if (status !== "all") arr = arr.filter((b) => getStatusGroup(b) === status);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      arr = arr.filter((b) => {
        const carName = (carsById.get(b.car_id) ?? "").toLowerCase();
        return carName.includes(needle) || b.id.toLowerCase().includes(needle);
      });
    }
    return arr;
  }, [bookings, carId, status, q, carsById]);

  /* ---------- KPI (оперативные) ---------- */

  const totalActiveCars = activeCarIds.length;

  const activeNow = useMemo(() => {
    return bookingsNow.filter((b) => {
      const g = getStatusGroup(b);
      if (g === "cancelled" || g === "blocked") return false;
      return nowBetween(b.start_at, b.end_at) === 1;
    }).length;
  }, [bookingsNow]);

  const freeNow = Math.max(0, totalActiveCars - activeNow);

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const startsToday = useMemo(() => {
    return (bookings ?? []).filter((b) => {
      const g = getStatusGroup(b);
      if (g === "cancelled" || g === "blocked") return false;
      const s = parseDbDate(b.start_at);
      return s >= todayStart && s <= todayEnd;
    }).length;
  }, [bookings]);

  const endsToday = useMemo(() => {
    return (bookings ?? []).filter((b) => {
      const g = getStatusGroup(b);
      if (g === "cancelled" || g === "blocked") return false;
      const e = parseDbDate(b.end_at);
      return e >= todayStart && e <= todayEnd;
    }).length;
  }, [bookings]);

  /* ---------- Utilization (почасовая) ---------- */
  const {
    utilizationSeries, // [{car, utilization%}]
    fleetUtilizationPct, // средняя по релевантным авто
  } = useMemo(() => {
    const rangeStartMs = new Date(fromDate).getTime();
    const rangeEndMs = new Date(toDate).getTime();
    const totalMs = Math.max(1, rangeEndMs - rangeStartMs);

    const relevantCarIds =
      carId === "all"
        ? activeCarIds
        : activeCarIds.filter((id) => id === carId);

    const intervalsByCar = new Map<string, Array<[number, number]>>();
    relevantCarIds.forEach((id) => intervalsByCar.set(id, []));

    bookings.forEach((b) => {
      if (!relevantCarIds.includes(b.car_id)) return;
      const g = getStatusGroup(b);
      if (g !== "active" && g !== "completed") return; // учитываем только фактическую аренду
      const s = parseDbDate(b.start_at).getTime();
      const e = parseDbDate(b.end_at).getTime();
      const start = Math.max(s, rangeStartMs);
      const end = Math.min(e, rangeEndMs);
      if (end <= start) return;
      intervalsByCar.get(b.car_id)!.push([start, end]);
    });

    let fleetUsedMs = 0;
    const series: Array<{ car: string; utilization: number }> = [];

    intervalsByCar.forEach((arr, id) => {
      let usedMs = 0;
      if (arr.length) {
        arr.sort((a, b) => a[0] - b[0]);
        let [curS, curE] = arr[0];
        for (let i = 1; i < arr.length; i++) {
          const [s, e] = arr[i];
          if (s <= curE) curE = Math.max(curE, e);
          else {
            usedMs += curE - curS;
            [curS, curE] = [s, e];
          }
        }
        usedMs += curE - curS;
      }
      fleetUsedMs += usedMs;
      series.push({
        car: carsById.get(id) ?? id,
        utilization: Math.round((usedMs / totalMs) * 100),
      });
    });

    const denom = Math.max(1, totalMs * Math.max(1, relevantCarIds.length));
    const fleetPct = Math.round((fleetUsedMs / denom) * 100);

    return { utilizationSeries: series, fleetUtilizationPct: fleetPct };
  }, [bookings, fromDate, toDate, activeCarIds, carId, carsById]);

  /* ---------- Списки для оперативного раздела ---------- */

  // Текущие активные (rent) — "Active now"
  const activeNowRows = useMemo(() => {
    let arr = bookingsNow.filter((b) => {
      const g = getStatusGroup(b);
      return g === "active" && nowBetween(b.start_at, b.end_at) === 1;
    });

    if (carId !== "all") arr = arr.filter((b) => b.car_id === carId);

    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      arr = arr.filter((b) => {
        const carName = (carsById.get(b.car_id) ?? "").toLowerCase();
        return carName.includes(needle) || b.id.toLowerCase().includes(needle);
      });
    }

    return arr.sort(
      (a, b) =>
        parseDbDate(a.end_at).getTime() - parseDbDate(b.end_at).getTime()
    );
  }, [bookingsNow, carId, q, carsById]);

  // "Скоро заканчиваются" — активные, у которых end_at в ближайшие 2 часа
  const endingSoonRows = useMemo(() => {
    const now = Date.now();
    const soonThreshold = now + 3 * 60 * 60 * 1000; // 3 часа
    return activeNowRows.filter((b) => {
      const endTs = parseDbDate(b.end_at).getTime();
      return endTs > now && endTs <= soonThreshold;
    });
  }, [activeNowRows]);

  // Будущие
  const upcoming = useMemo(
    () =>
      filtered
        .filter((b) => {
          const startsFuture = parseDbDate(b.start_at) > new Date();

          if (!startsFuture) return false;
          const g = getStatusGroup(b);
          if (status === "blocked") return g === "blocked";
          return g !== "cancelled" && g !== "blocked";
        })
        .sort(
          (a, b) =>
            parseDbDate(a.start_at).getTime() -
            parseDbDate(b.start_at).getTime()
        )
        .slice(0, 6),
    [filtered, status]
  );

  // Просроченные возвраты
  const overdue = useMemo(
    () =>
      filtered
        .filter(
          (b) =>
            parseDbDate(b.end_at) < new Date() && getStatusGroup(b) === "active"
        )
        .sort(
          (a, b) =>
            parseDbDate(a.end_at).getTime() - parseDbDate(b.end_at).getTime()
        )
        .slice(0, 6),
    [filtered]
  );

  /* ---------- Разбивка по СЫРЫМ статусам (аналитика) ---------- */

  const statusBreakdown = useMemo(() => {
    type Key = RawStatus;
    const order: Key[] = [
      "onapproval",
      "confirmed",
      "rent",
      "finished",
      "canceledhost",
      "canceledclient",
      "blocked",
    ];

    const rangeStartMs = new Date(fromDate).getTime();
    const rangeEndMs = new Date(toDate).getTime();

    const agg: Record<
      Key,
      { label: string; count: number; revenue: number; ms: number }
    > = Object.fromEntries(
      order.map((k) => [
        k,
        { label: STATUS_CATALOG[k].label, count: 0, revenue: 0, ms: 0 },
      ])
    ) as any;

    filtered.forEach((b) => {
      const key = getRawStatus(b);
      agg[key].count += 1;
      agg[key].revenue += b.price_total ?? 0;

      const s = Math.max(parseDbDate(b.start_at).getTime(), rangeStartMs);
      const e = Math.min(parseDbDate(b.end_at).getTime(), rangeEndMs);
      if (e > s) agg[key].ms += e - s;
    });

    return order.map((k) => {
      const totalMs = agg[k].ms;
      const days = Math.floor(totalMs / 86_400_000);
      const hours = Math.floor((totalMs % 86_400_000) / 3_600_000);
      return {
        statusKey: k,
        label: agg[k].label,
        count: agg[k].count,
        revenue: Math.round(agg[k].revenue),
        days,
        hours,
      };
    });
  }, [filtered, fromDate, toDate]);

  const statusCountSeries = useMemo(
    () => statusBreakdown.map((r) => ({ status: r.label, count: r.count })),
    [statusBreakdown]
  );

  const statusRevenueSeries = useMemo(
    () =>
      statusBreakdown.map((r) => ({
        status: r.label,
        revenue: r.revenue,
      })),
    [statusBreakdown]
  );

  /* ---------- Прочее ---------- */

  const revenueTrend = useMemo(() => {
    // корзины последних 6 месяцев
    const buckets: Record<string, number> = {};
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(base, i));
      buckets[ym(d)] = 0;
    }

    // применяем фильтры: исключаем cancelled/blocked и уважаем выбранный авто
    const rows = bookings6m.filter((b) => {
      if (carId !== "all" && b.car_id !== carId) return false;
      const g = getStatusGroup(b);
      return g === "completed" || g === "active" || g === "reserved";
    });

    // копим revenue по месяцу старта (можно сменить на end_at, если нужно «по факту завершения»)
    rows.forEach((b) => {
      const key = ym(parseDbDate(b.start_at));
      if (key in buckets) buckets[key] += b.price_total ?? 0;
    });

    return Object.entries(buckets).map(([month, revenue]) => ({
      month,
      revenue,
    }));
  }, [bookings6m, carId]);

  const topCars = useMemo(() => {
    const cnt: Record<string, number> = {};
    filtered.forEach((b) => {
      const g = getStatusGroup(b);
      if (g === "cancelled" || g === "blocked") return;
      cnt[b.car_id] = (cnt[b.car_id] ?? 0) + 1;
    });
    return Object.entries(cnt)
      .map(([id, n]) => ({ car: carsById.get(id) ?? id, count: n }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filtered, carsById]);

  // const loading =
  //   carsQ.isLoading ||
  //   bookingsQ.isLoading ||
  //   bookings6mQ.isLoading ||
  //   bookingsNowQ.isLoading;

  /* -------------------- presets / reset -------------------- */

  const applyPreset = (
    key:
      | "thisWeek"
      | "prevWeek"
      | "last7"
      | "thisMonth"
      | "prevMonth"
      | "last30"
  ) => {
    const now = new Date();
    if (key === "thisWeek") {
      setRange([
        startOfWeek(now, { weekStartsOn: 1 }),
        endOfWeek(now, { weekStartsOn: 1 }),
      ]);
    } else if (key === "prevWeek") {
      const prevW = subWeeks(now, 1);
      setRange([
        startOfWeek(prevW, { weekStartsOn: 1 }),
        endOfWeek(prevW, { weekStartsOn: 1 }),
      ]);
    } else if (key === "last7") {
      setRange([startOfDay(subDays(now, 6)), endOfDay(now)]);
    } else if (key === "thisMonth") {
      setRange([startOfMonth(now), endOfMonth(now)]);
    } else if (key === "prevMonth") {
      const pm = subMonths(now, 1);
      setRange([startOfMonth(pm), endOfMonth(pm)]);
    } else if (key === "last30") {
      setRange([startOfDay(subDays(now, 29)), endOfDay(now)]);
    }
  };

  const resetFilters = () => {
    setQ("");
    setCarId("all");
    setStatus("all");
    setRange([startOfMonth(new Date()), endOfDay(new Date())]);
  };

  /* -------------------- render -------------------- */

  return (
    <div className="space-y-6 w-full max-w-screen-2xl">
      {/* Header */}
      <div className=" flex items-center justify-between">
        <div>
          <h1 className="font-roboto text-xl md:text-2xl font-medium md:font-bold">
            Dashboard
          </h1>
        </div>
        {/* ---- Tabs ---- */}
        <div className="flex gap-2">
          {(
            [
              { key: "operational", label: "Quick" },
              { key: "managerial", label: "Managed" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`px-2 py-1 rounded-lg border text-sm ${
                view === t.key
                  ? "bg-black text-white border-black"
                  : "bg-white/60"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile search */}
      {/* <div className="relative w-full sm:hidden">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <TextInput
          placeholder="Search (ID, car)"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          className="w-full rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm hover:bg-white/80 focus:ring-2 focus:ring-black/10"
        />
      </div> */}

      {/* Mobile Filters */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-md bg-black text-white active:opacity-80"
          aria-label="Открыть фильтры"
        >
          <FunnelIcon className="size-4" />
          Filters
        </button>
      </div>

      <Drawer
        opened={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        position="bottom"
        withinPortal
        size="45%"
        padding="md"
        keepMounted
        withCloseButton={false}
        overlayProps={{ opacity: 0.2, blur: 2 }}
        styles={{
          content: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
        }}
      >
        <div className="w-full flex flex-col gap-3 mt-2">
          <div className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2 shadow-sm">
            <CalendarDaysIcon className="w-5 h-5 text-zinc-600" />
            <DatePickerInput
              type="range"
              value={range as unknown as DatesRangeValue}
              onChange={(v) => setRange(v as RangeV)}
              placeholder="Выбери период"
              valueFormat="DD MMM YYYY"
              className="flex-1"
              dropdownType="modal"
            />
            <Menu withinPortal>
              <Menu.Target>
                <Button variant="default" className="rounded-xl" fw={400}>
                  Presets
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => applyPreset("thisWeek")}>
                  This week
                </Menu.Item>
                <Menu.Item onClick={() => applyPreset("prevWeek")}>
                  Last week
                </Menu.Item>
                <Menu.Item onClick={() => applyPreset("last7")}>
                  Last 7 days
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item onClick={() => applyPreset("thisMonth")}>
                  This month
                </Menu.Item>
                <Menu.Item onClick={() => applyPreset("prevMonth")}>
                  Last month
                </Menu.Item>
                <Menu.Item onClick={() => applyPreset("last30")}>
                  Last 30 days
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>

          <NativeSelect
            value={carId}
            onChange={(e) => setCarId(e.currentTarget.value)}
            className="shrink-0 bg-white shadow-sm rounded-xl px-3 py-2"
          >
            <option value="all">Все авто</option>
            {Array.from(carsById.entries()).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </NativeSelect>

          <NativeSelect
            value={status}
            onChange={(e) =>
              setStatus(e.currentTarget.value as "all" | StatusGroup)
            }
            className="shrink-0 bg-white shadow-sm rounded-xl px-3 py-2"
          >
            <option value="all">All groups</option>
            <option value="reserved">Reserved</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="blocked">Blocked</option>
          </NativeSelect>

          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm text-zinc-500 underline underline-offset-4"
            >
              Reset filters
            </button>
          </div>
        </div>
      </Drawer>

      <div className="hidden lg:flex items-center justify-between">
        <div className="flex flex-shrink-0 items-center gap-2">
          <div className="h-9 flex items-center gap-2 bg-white rounded-lg px-3 border border-zinc-100 shadow-sm">
            <CalendarDaysIcon className="w-5 h-5 text-zinc-600" />
            <DatePickerInput
              type="range"
              value={range as unknown as DatesRangeValue}
              onChange={(v) => setRange(v as RangeV)}
              placeholder="Select dates"
              valueFormat="DD MMM YY"
              dropdownType="popover"
              variant="unstyled"
            />
          </div>
          <Menu withinPortal>
            <Menu.Target>
              <button className="h-9 border border-zinc-100 rounded-lg px-3 bg-white shadow-sm text-sm">
                Presets
              </button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Быстрый выбор</Menu.Label>
              <Menu.Item onClick={() => applyPreset("thisWeek")}>
                This week
              </Menu.Item>
              <Menu.Item onClick={() => applyPreset("prevWeek")}>
                Last week
              </Menu.Item>
              <Menu.Item onClick={() => applyPreset("last7")}>
                Last 7 days
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item onClick={() => applyPreset("thisMonth")}>
                This month
              </Menu.Item>
              <Menu.Item onClick={() => applyPreset("prevMonth")}>
                Last month
              </Menu.Item>
              <Menu.Item onClick={() => applyPreset("last30")}>
                Last 30 days
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>

        {/* Desktop / tablet filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <NativeSelect
            variant="unstiled"
            value={carId}
            onChange={(e) => setCarId(e.currentTarget.value)}
            className="shrink-0 bg-white shadow-sm rounded-xl"
          >
            <option value="all">All cars</option>
            {carsById &&
              Array.from(carsById.entries()).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
          </NativeSelect>

          <NativeSelect
            variant="unstiled"
            value={status}
            onChange={(e) =>
              setStatus(e.currentTarget.value as "all" | StatusGroup)
            }
            className="shrink-0 bg-white shadow-sm rounded-xl"
          >
            <option value="all">All groups</option>
            <option value="reserved">Reserved</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="blocked">Blocked</option>
          </NativeSelect>
        </div>
      </div>

      {/* ---- Views ---- */}
      <>
        {view === "operational" && (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard
                icon={<CheckCircleIcon className="w-6 h-6" />}
                title="Active cars"
                value={totalActiveCars}
                sub={`Total: ${cars.length}`}
              />
              <KpiCard
                icon={<ClockIcon className="w-6 h-6" />}
                title="Currently on rent"
                value={activeNow}
                sub={`Available: ${freeNow}`}
              />
              <KpiCard
                icon={<CalendarDaysIcon className="w-6 h-6" />}
                title="Pickup today"
                value={startsToday}
                sub={`${fmtDate(todayStart)} `}
              />
              <KpiCard
                icon={<CalendarDaysIcon className="w-6 h-6" />}
                title="Returns today"
                value={endsToday}
                sub={`${fmtDate(todayStart)} `}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Active now */}
              <TableCard title="Active now">
                {activeNowRows.length === 0 ? (
                  <div className="py-6 text-center text-zinc-500 text-sm">
                    No active rentals right now
                  </div>
                ) : (
                  <div role="table" className="w-full text-sm">
                    {/* Header row (md+) */}
                    <div
                      role="row"
                      className="hidden md:grid grid-cols-[2fr,1fr,2fr,1fr] gap-3 items-center border rounded-lg px-3 py-2 bg-zinc-50 text-zinc-600"
                    >
                      <div className="font-medium">Car</div>
                      <div className="font-medium">Plate</div>
                      <div className="font-medium">Period</div>
                      <div className="font-medium">Status</div>
                    </div>

                    {/* Body */}
                    <div role="rowgroup" className="mt-2 space-y-2">
                      {activeNowRows.map((b) => (
                        <Link
                          to={`/bookings/${b.id}`}
                          state={b}
                          key={b.id}
                          role="row"
                          className="grid grid-cols-1 md:grid-cols-[2fr,1fr,2fr,1fr] gap-3 items-center rounded-xl border border-zinc-200/70 bg-white/80 backdrop-blur px-3 py-2 shadow-sm hover:shadow-md transition"
                        >
                          <div className="font-medium text-zinc-800">
                            {carsById.get(b.car_id) ?? b.car_id}
                          </div>
                          <div className="text-zinc-600 border rounded w-fit p-0.5 shadow-sm">
                            {plateById.get(b.car_id) ?? "—"}
                          </div>
                          <div className="text-zinc-600">
                            {fmtDate(b.start_at, true)} —{" "}
                            {fmtDate(b.end_at, true)}
                          </div>
                          <div>
                            <StatusBadge row={b} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </TableCard>

              {/* Ending soon (≤2h) */}
              <TableCard title="Ending soon (≤3h)">
                {endingSoonRows.length === 0 ? (
                  <div className="py-6 text-center text-zinc-500 text-sm">
                    No rentals ending within 3 hours
                  </div>
                ) : (
                  <div role="table" className="w-full text-sm">
                    {/* Header row (md+) */}
                    <div
                      role="row"
                      className="hidden md:grid grid-cols-[2fr,1fr,2fr,1fr] gap-3 items-center border rounded-lg px-3 py-2 bg-zinc-50 text-zinc-600"
                    >
                      <div className="font-medium">Car</div>
                      <div className="font-medium">Plate</div>
                      <div className="font-medium">Period</div>
                      <div className="font-medium">Status</div>
                    </div>

                    {/* Body */}
                    <div role="rowgroup" className="mt-2 space-y-2">
                      {endingSoonRows.map((b) => (
                        <Link
                          to={`/bookings/${b.id}`}
                          state={b}
                          key={b.id}
                          role="row"
                          className="grid grid-cols-1 md:grid-cols-[2fr,1fr,2fr,1fr] gap-3 items-center rounded-xl border border-zinc-200/70 bg-white/80 backdrop-blur px-3 py-2 shadow-sm hover:shadow-md transition"
                        >
                          <div className="font-medium text-zinc-800">
                            {carsById.get(b.car_id) ?? b.car_id}
                          </div>
                          <div className="text-zinc-600">
                            {plateById.get(b.car_id) ?? "—"}
                          </div>
                          <div className="text-zinc-600">
                            {fmtDate(b.start_at, true)} —{" "}
                            {fmtDate(b.end_at, true)}
                          </div>
                          <div>
                            <StatusBadge row={b} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </TableCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <TableCard title="Upcoming bookings">
                {(() => {
                  const list = upcoming;

                  return list.length === 0 ? (
                    <div className="py-6 text-center text-zinc-500 text-sm">
                      No entries
                    </div>
                  ) : (
                    <div role="table" className="w-full text-sm">
                      {/* Header row (md+) */}
                      <div
                        role="row"
                        className="hidden md:grid grid-cols-[2fr,1fr,2fr,1fr] gap-3 items-center border rounded-lg px-3 py-2 bg-zinc-50 text-zinc-600"
                      >
                        <div className="font-medium">Car</div>
                        <div className="font-medium">Plate</div>
                        <div className="font-medium">Period</div>
                        <div className="font-medium">Status</div>
                      </div>

                      {/* Body */}
                      <div role="rowgroup" className="mt-2 space-y-2">
                        {list.map((b) => (
                          <Link
                            to={`/bookings/${b.id}`}
                            state={b}
                            key={b.id}
                            role="row"
                            className="grid grid-cols-1 md:grid-cols-[2fr,1fr,2fr,1fr] gap-3 items-center rounded-xl border border-zinc-200/70 bg-white/80 backdrop-blur px-3 py-2 shadow-sm hover:shadow-md transition"
                          >
                            <div className="font-medium text-zinc-800">
                              {carsById.get(b.car_id) ?? b.car_id}
                            </div>
                            <div className="text-zinc-600">
                              {plateById.get(b.car_id) ?? "—"}
                            </div>
                            <div className="text-zinc-600">
                              {fmtDate(b.start_at, true)} —{" "}
                              {fmtDate(b.end_at, true)}
                            </div>
                            <div>
                              <StatusBadge row={b} />
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </TableCard>

              <TableCard title="Overdue returns">
                {overdue.length === 0 ? (
                  <div className="py-6 text-center text-zinc-500 text-sm">
                    Everything is ok — there are no overdue returns
                  </div>
                ) : (
                  <div role="table" className="w-full text-sm">
                    {/* Header row (md+) */}
                    <div
                      role="row"
                      className="hidden md:grid grid-cols-[2fr,1fr,2fr,1fr] gap-3 items-center border rounded-lg px-3 py-2 bg-zinc-50 text-zinc-600"
                    >
                      <div className="font-medium">Car</div>
                      <div className="font-medium">Plate</div>
                      <div className="font-medium">Must return</div>
                      <div className="font-medium">Status</div>
                    </div>

                    {/* Body */}
                    <div role="rowgroup" className="mt-2 space-y-2">
                      {overdue.map((b) => (
                        <Link
                          to={`/bookings/${b.id}`}
                          state={b}
                          key={b.id}
                          role="row"
                          className="grid grid-cols-1 md:grid-cols-[2fr,1fr,2fr,1fr] gap-3 items-center rounded-xl border border-zinc-200/70 bg-white/80 backdrop-blur px-3 py-2 shadow-sm hover:shadow-md transition"
                        >
                          <div className="font-medium text-zinc-800">
                            {carsById.get(b.car_id) ?? b.car_id}
                          </div>
                          <div className="text-zinc-600">
                            {plateById.get(b.car_id) ?? "—"}
                          </div>
                          <div className="text-zinc-600">
                            {fmtDate(b.end_at, true)}
                          </div>
                          <div>
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <ExclamationTriangleIcon className="w-4 h-4" />
                              Overdue
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </TableCard>
            </div>
          </>
        )}

        {view === "managerial" && (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard
                icon={<ArrowTrendingUpIcon className="w-6 h-6" />}
                title="Revenue (period)"
                value={`€${filtered
                  .filter((b) => {
                    const g = getStatusGroup(b);
                    return g === "active" || g === "completed";
                  })
                  .reduce((a, b) => a + (b.price_total ?? 0), 0)
                  .toLocaleString()}`}
                sub={`${fmtDate(fromDate)} — ${fmtDate(toDate)}`}
              />

              <KpiCard
                icon={<BanknotesIcon className="w-6 h-6" />}
                title="Average check"
                value={`€${Math.round(
                  filtered
                    .filter(
                      (b) =>
                        getStatusGroup(b) !== "cancelled" &&
                        getStatusGroup(b) !== "blocked"
                    )
                    .reduce((a, b) => a + (b.price_total ?? 0), 0) /
                    Math.max(
                      1,
                      filtered.filter(
                        (b) =>
                          getStatusGroup(b) !== "cancelled" &&
                          getStatusGroup(b) !== "blocked"
                      ).length
                    )
                ).toLocaleString()}`}
              />

              <KpiCard
                icon={<CalendarDaysIcon className="w-6 h-6" />}
                title="Bookings (period)"
                value={
                  filtered.filter((b) => {
                    const g = getStatusGroup(b);
                    return g === "completed" || g === "active"; // только завершенные и текущие (rent)
                  }).length
                }
              />

              <KpiCard
                icon={<ClockIcon className="w-6 h-6" />}
                title="Loading (avg.)"
                value={`${fleetUtilizationPct}%`}
                sub="by fleet (hourly)"
              />
            </div>

            {/* ---- Разбивка по статусам: графики ---- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard
                title="Revenue by month (6m)"
                className="lg:col-span-1"
              >
                <ResponsiveContainer
                  width="100%"
                  height={260}
                  className="text-sm"
                >
                  <LineChart
                    data={revenueTrend}
                    margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
                  >
                    <defs>
                      <linearGradient
                        id="revLineGrad"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop offset="0%" stopColor="#4f46e5" />
                        <stop offset="100%" stopColor="#7c3aed" />
                      </linearGradient>
                      <linearGradient
                        id="revAreaGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#4f46e5"
                          stopOpacity={0.22}
                        />
                        <stop
                          offset="100%"
                          stopColor="#7c3aed"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickMargin={6} />
                    <YAxis tickMargin={8} />
                    <Tooltip
                      formatter={(v: any) => [
                        `€${Number(v).toLocaleString()}`,
                        "Revenue",
                      ]}
                    />

                    <Area
                      type="monotone"
                      dataKey="revenue"
                      fill="url(#revAreaGrad)"
                      stroke="transparent"
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="url(#revLineGrad)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard className="lg:col-span-1" title="Loading by car (%)">
                <ResponsiveContainer
                  width="100%"
                  height={260}
                  className="text-sm"
                >
                  <BarChart
                    data={utilizationSeries}
                    margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
                  >
                    <defs>
                      <linearGradient id="utilGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" />
                        <stop offset="100%" stopColor="#7c3aed" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="car" />
                    <YAxis
                      tickFormatter={(v: number) => `${v}%`}
                      domain={[0, 100]}
                    />
                    <Tooltip formatter={(v: any) => [`${v}%`, "Utilization"]} />
                    <Bar
                      dataKey="utilization"
                      fill="url(#utilGrad)"
                      radius={[8, 8, 8, 8]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TableCard title="Status breakdown (period)">
                {statusBreakdown.every((r) => r.count === 0) ? (
                  <div className="py-6 text-center text-zinc-500 text-sm">
                    No data
                  </div>
                ) : (
                  <div className="w-full text-[12px] sm:text-sm">
                    {/* Header */}
                    <div
                      role="row"
                      className="grid grid-cols-[1.6fr,1fr,1.2fr,1.2fr] items-center gap-2 sm:gap-3 border rounded-lg px-2 py-2 sm:px-3 sm:py-2.5 bg-zinc-50 text-zinc-600"
                    >
                      <div className="font-medium">Status</div>
                      <div className="font-medium text-right">Count</div>
                      <div className="font-medium text-right">Revenue</div>
                      <div className="font-medium text-right">Days / Hours</div>
                    </div>

                    {/* Rows */}
                    <div
                      role="rowgroup"
                      className="mt-2 space-y-1.5 sm:space-y-2"
                    >
                      {statusBreakdown.map((r) => (
                        <div
                          key={r.statusKey}
                          role="row"
                          className="grid grid-cols-[1.6fr,1fr,1.2fr,1.2fr] items-center gap-2 sm:gap-3 rounded-xl border border-zinc-200/70 bg-white/80 backdrop-blur px-2 py-2 sm:px-3 sm:py-2.5 shadow-sm hover:shadow-md transition"
                        >
                          <div className="flex items-center gap-2">
                            <StatusBadge
                              row={{
                                id: "",
                                start_at: "",
                                end_at: "",
                                status: r.statusKey as any,
                                mark: null,
                                car_id: "",
                              }}
                            />
                          </div>
                          <div className="text-zinc-900 text-right">
                            {r.count}
                          </div>
                          <div className="text-zinc-900 text-right">
                            €{r.revenue.toLocaleString()}
                          </div>
                          <div className="text-zinc-900 text-right">
                            {r.days}d {r.hours}h
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TableCard>

              <div className="flex flex-col gap-4">
                <ChartCard title="Bookings by raw status (count)">
                  <ResponsiveContainer
                    width="100%"
                    height={260}
                    className="text-sm"
                  >
                    <BarChart
                      data={statusCountSeries}
                      margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
                    >
                      <defs>
                        <linearGradient
                          id="countGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="#4f46e5" />
                          <stop offset="100%" stopColor="#7c3aed" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" />
                      <YAxis />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        fill="url(#countGrad)"
                        radius={[8, 8, 8, 8]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Revenue by raw status (€)">
                  <ResponsiveContainer
                    width="100%"
                    height={260}
                    className="text-sm"
                  >
                    <BarChart
                      data={statusRevenueSeries}
                      margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
                    >
                      <defs>
                        <linearGradient
                          id="revStatusGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="#4f46e5" />
                          <stop offset="100%" stopColor="#7c3aed" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" />
                      <YAxis />
                      <Tooltip
                        formatter={(v: any) => [
                          `€${Number(v).toLocaleString()}`,
                          "Revenue",
                        ]}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="url(#revStatusGrad)"
                        radius={[8, 8, 8, 8]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TableCard title="TOP cars (by number of bookings)">
                {topCars.length === 0 ? (
                  <div className="py-6 text-center text-zinc-500 text-sm">
                    No data
                  </div>
                ) : (
                  <div role="table" className="w-full text-sm">
                    {/* Header row (md+) */}
                    <div
                      role="row"
                      className="hidden md:grid grid-cols-[3fr,1fr] gap-3 items-center border rounded-lg px-3 py-2 bg-zinc-50 text-zinc-600"
                    >
                      <div className="font-medium">Car</div>
                      <div className="font-medium">Bookings</div>
                    </div>

                    {/* Body */}
                    <div role="rowgroup" className="mt-2 space-y-2">
                      {topCars.map((r) => (
                        <div
                          key={r.car}
                          role="row"
                          className="grid grid-cols-1 md:grid-cols-[3fr,1fr] gap-3 items-center rounded-xl border border-zinc-200/70 bg-white/80 backdrop-blur px-3 py-2 shadow-sm hover:shadow-md transition"
                        >
                          <div className="font-medium text-zinc-800">
                            {r.car}
                          </div>
                          <div className="font-semibold text-zinc-900">
                            {r.count}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TableCard>

              <TableCard title="Clients: New vs. Repeat (Assessment)">
                {(() => {
                  const map: Record<string, number> = {};
                  filtered.forEach((b) => {
                    if (!b.user_id) return;
                    map[b.user_id] = (map[b.user_id] ?? 0) + 1;
                  });
                  const users = Object.keys(map);
                  const newCount = users.filter((u) => map[u] === 1).length;
                  const repeatCount = Math.max(0, users.length - newCount);
                  const total = Math.max(1, users.length);
                  const newPct = Math.round((newCount / total) * 100);
                  const repeatPct = Math.round((repeatCount / total) * 100);

                  return (
                    <div className="space-y-3 text-sm">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-zinc-600">New</span>
                          <span className="font-medium text-zinc-900">
                            {newPct}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${newPct}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-zinc-600">Repeated</span>
                          <span className="font-medium text-zinc-900">
                            {repeatPct}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${repeatPct}%` }}
                          />
                        </div>
                      </div>

                      <p className="text-xs text-zinc-500 mt-2">
                        * Score based on user_id repeatability in filtered
                        bookings.
                      </p>
                    </div>
                  );
                })()}
              </TableCard>
            </div>
          </>
        )}
      </>
      {/* )} */}
    </div>
  );
}

/* =================== subcomponents =================== */

function KpiCard({
  icon,
  title,
  value,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl bg-white/85 backdrop-blur border border-zinc-200/70 shadow-[0_8px_24px_rgba(24,24,27,0.06)] hover:shadow-[0_14px_34px_rgba(24,24,27,0.10)] p-5"
    >
      {/* Title row: icon + title on one line, bold & larger */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-zinc-100/60  text-emerald-400 ">
            <div className="w-6 h-6">{icon}</div>
          </div>
          <h3 className=" font-medium tracking-[-0.01em] text-zinc-900">
            {title}
          </h3>
        </div>
      </div>

      {/* Big metric */}
      <div className="mt-3">
        <div className="text-2xl md:text-3xl font-bold leading-none tracking-tight text-zinc-900">
          {value}
        </div>
        {sub ? (
          <div className="text-xs md:text-sm text-zinc-500 mt-3">{sub}</div>
        ) : null}
      </div>
    </motion.div>
  );
}

function ChartCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-2xl bg-white p-4 shadow ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-zinc-600">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

function TableCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl bg-white p-4 shadow"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-medium text-zinc-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </motion.div>
  );
}

function StatusBadge({ row }: { row: BookingRow }) {
  const raw = getRawStatus(row);
  const meta = STATUS_CATALOG[raw];
  return (
    <span className={`px-2 py-1 text-xs rounded-lg ${meta.className}`}>
      {meta.label}
    </span>
  );
}
