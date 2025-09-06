// src/app/dashboard/DashboardPage.tsx
import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CalendarDaysIcon,
  CurrencyEuroIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
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
} from "recharts";
import {
  Badge,
  Drawer,
  NativeSelect,
  TextInput,
  Loader,
  Menu,
  Button,
} from "@mantine/core";
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
} from "date-fns";

import { supabase } from "@/lib/supabase";
import { fetchCars } from "@/services/car.service";
import type { CarWithRelations } from "@/types/carWithRelations";
import { QK } from "@/queryKeys";

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

type NormStatus = "reserved" | "active" | "completed" | "cancelled" | "blocked";

function normalizeStatus(row: BookingRow): NormStatus {
  const s = (row.status ?? "").toLowerCase();
  const m = (row.mark ?? "").toLowerCase();
  if (m === "block" || s === "block" || s === "blocked") return "blocked";
  if (s === "rent") return "active";
  if (s === "finished") return "completed";
  if (s === "canceledhost" || s === "canceledclient") return "cancelled";
  if (s === "confirmed" || s === "onapproval") return "reserved";
  return "reserved";
}

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

const fmtDate = (x: string | Date) =>
  (x instanceof Date ? x : parseDbDate(x)).toLocaleDateString();

const ym = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const daysBetween = (a: Date, b: Date) =>
  Math.max(1, Math.ceil((b.getTime() - a.getTime()) / 86400000));

const nowBetween = (aISO: string, bISO: string) => {
  const a = parseDbDate(aISO).getTime();
  const b = parseDbDate(bISO).getTime();
  const n = Date.now();
  return a <= n && n <= b ? 1 : 0;
};

/* =================== data fetchers =================== */

// Пересекающие интервал: end >= from AND start <= to
async function fetchBookingsRange(fromISO: string, toISO: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, start_at, end_at, status, mark, car_id, user_id, price_total")
    .gte("end_at", fromISO)
    .lte("start_at", toISO)
    .neq("mark", "block")
    .neq("status", "blocked")
    .neq("status", "block")
    .order("start_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BookingRow[];
}

/* =================== main component =================== */

export default function DashboardPage() {
  const qc = useQueryClient();

  // ВАЖНО: DatePicker может отдавать строки → разрешаем и Date, и string
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
  const [status, setStatus] = useState<"all" | NormStatus>("all");
  const [q, setQ] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [view, setView] = useState<"operational" | "managerial">("operational");

  /* -------------------- queries -------------------- */

  const carsQ = useQuery<CarWithRelations[], Error>({
    queryKey: QK.cars,
    queryFn: () => fetchCars(),
    initialData: qc.getQueryData<CarWithRelations[]>(QK.cars),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const bookingsQ = useQuery<BookingRow[], Error>({
    queryKey: ["dashboard", "bookings", { fromISO, toISO }],
    queryFn: () => fetchBookingsRange(fromISO, toISO),
    initialData: qc.getQueryData<BookingRow[]>([
      "dashboard",
      "bookings",
      { fromISO, toISO },
    ]),
    staleTime: 5 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  // 6 месяцев для тренда
  const sixStart = startOfMonth(subMonths(new Date(), 5));
  const bookings6mQ = useQuery<BookingRow[], Error>({
    queryKey: ["dashboard", "bookings6m"],
    queryFn: () =>
      fetchBookingsRange(
        startOfDay(sixStart).toISOString(),
        endOfDay(new Date()).toISOString()
      ),
    initialData: qc.getQueryData<BookingRow[]>(["dashboard", "bookings6m"]),
    staleTime: 10 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  const cars = carsQ.data ?? [];
  const bookings = bookingsQ.data ?? [];
  const bookings6m = bookings6mQ.data ?? [];

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

  const carOptions = useMemo(
    () =>
      cars
        .filter((c) => !!c.id)
        .map((c) => ({
          id: c.id as string,
          label:
            `${c.models?.brands?.name ?? ""} ${c.models?.name ?? ""}`.trim() ||
            (c.id as string),
        })),
    [cars]
  );

  const filtered = useMemo(() => {
    let arr = bookings;
    if (carId !== "all") arr = arr.filter((b) => b.car_id === carId);
    if (status !== "all")
      arr = arr.filter((b) => normalizeStatus(b) === status);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      arr = arr.filter((b) => {
        const carName = (carsById.get(b.car_id) ?? "").toLowerCase();
        return carName.includes(needle) || b.id.toLowerCase().includes(needle);
      });
    }
    return arr;
  }, [bookings, carId, status, q, carsById]);

  const totalActiveCars = useMemo(
    () =>
      cars.filter((c) => (c as any).status?.toLowerCase?.() !== "archived")
        .length,
    [cars]
  );

  const activeNow = useMemo(
    () =>
      bookings.reduce(
        (acc, b) =>
          acc +
          (normalizeStatus(b) === "active"
            ? nowBetween(b.start_at, b.end_at)
            : 0),
        0
      ),
    [bookings]
  );

  const freeNow = Math.max(0, totalActiveCars - activeNow);

  // рядом с остальными derived
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const startsToday = useMemo(() => {
    return bookings.filter((b) => {
      const s = parseDbDate(b.start_at);
      const ns = normalizeStatus(b);
      if (ns === "cancelled" || ns === "blocked") return false;
      return s >= todayStart && s <= todayEnd;
    }).length;
  }, [bookings]);

  const endsToday = useMemo(() => {
    return bookings.filter((b) => {
      const e = parseDbDate(b.end_at);
      const ns = normalizeStatus(b);
      if (ns === "cancelled" || ns === "blocked") return false;
      return e >= todayStart && e <= todayEnd;
    }).length;
  }, [bookings]);

  const utilizationByCar = useMemo(() => {
    const totalDays = daysBetween(fromDate, toDate);
    const usage: Record<string, number> = {};
    cars.forEach((c) => c.id && (usage[c.id] = 0));
    filtered.forEach((b) => {
      const ns = normalizeStatus(b);
      if (ns === "cancelled" || ns === "blocked") return;
      const s = parseDbDate(b.start_at);
      const e = parseDbDate(b.end_at);
      const start = new Date(Math.max(s.getTime(), fromDate.getTime()));
      const end = new Date(Math.min(e.getTime(), toDate.getTime()));
      if (end < start) return;
      usage[b.car_id] = (usage[b.car_id] ?? 0) + daysBetween(start, end);
    });
    return Object.entries(usage).map(([id, usedDays]) => ({
      car: carsById.get(id) ?? id,
      utilization: Math.round((usedDays / Math.max(1, totalDays)) * 100),
    }));
  }, [filtered, fromDate, toDate, carsById, cars.length]);

  const revenueTrend = useMemo(() => {
    const buckets: Record<string, number> = {};
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(base, i));
      buckets[ym(d)] = 0;
    }
    bookings6m.forEach((b) => {
      const key = ym(parseDbDate(b.start_at));
      if (key in buckets) buckets[key] += b.price_total ?? 0;
    });
    return Object.entries(buckets).map(([month, revenue]) => ({
      month,
      revenue,
    }));
  }, [bookings6m]);

  const topCars = useMemo(() => {
    const cnt: Record<string, number> = {};
    filtered.forEach((b) => {
      const ns = normalizeStatus(b);
      if (ns === "cancelled" || ns === "blocked") return;
      cnt[b.car_id] = (cnt[b.car_id] ?? 0) + 1;
    });
    return Object.entries(cnt)
      .map(([id, n]) => ({ car: carsById.get(id) ?? id, count: n }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filtered, carsById]);

  const avgCheck = useMemo(() => {
    const priced = filtered.filter((b) => (b.price_total ?? 0) > 0);
    if (!priced.length) return 0;
    const sum = priced.reduce((a, b) => a + (b.price_total ?? 0), 0);
    return Math.round(sum / priced.length);
  }, [filtered]);

  const upcoming = useMemo(
    () =>
      filtered
        .filter(
          (b) =>
            parseDbDate(b.start_at) > new Date() &&
            !["cancelled", "blocked"].includes(normalizeStatus(b))
        )
        .sort(
          (a, b) =>
            parseDbDate(a.start_at).getTime() -
            parseDbDate(b.start_at).getTime()
        )
        .slice(0, 6),
    [filtered]
  );

  const overdue = useMemo(
    () =>
      filtered
        .filter(
          (b) =>
            parseDbDate(b.end_at) < new Date() &&
            normalizeStatus(b) === "active"
        )
        .sort(
          (a, b) =>
            parseDbDate(a.end_at).getTime() - parseDbDate(b.end_at).getTime()
        )
        .slice(0, 6),
    [filtered]
  );

  const loading =
    carsQ.isLoading || bookingsQ.isLoading || bookings6mQ.isLoading;

  // Пресеты — пишем Dates напрямую
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
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="font-roboto text-xl md:text-2xl font-medium md:font-bold">
            Dashboard
          </h1>
          {(bookings?.length ?? 0) > 0 && (
            <Badge color="black">{bookings.length}</Badge>
          )}
          {(carsQ.isFetching ||
            bookingsQ.isFetching ||
            bookings6mQ.isFetching) && <Loader size="xs" color="gray" />}
        </div>
      </div>

      {/* Desktop / tablet filters */}
      <div className="hidden sm:flex flex-wrap gap-3 items-center w-full">
        {/* Date range + presets */}
        <div className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2 shadow-sm">
          <CalendarDaysIcon className="w-5 h-5 text-zinc-600" />
          <DatePickerInput
            type="range"
            value={range as unknown as DatesRangeValue}
            onChange={(v) => setRange(v as RangeV)}
            placeholder="Выбери период"
            valueFormat="DD MMM YYYY"
            dropdownType="popover"
          />
          <Menu withinPortal>
            <Menu.Target>
              <Button variant="default" size="sm" className="rounded-xl">
                Presets
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Быстрый выбор</Menu.Label>
              <Menu.Item onClick={() => applyPreset("thisWeek")}>
                Эта неделя
              </Menu.Item>
              <Menu.Item onClick={() => applyPreset("prevWeek")}>
                Прошлая неделя
              </Menu.Item>
              <Menu.Item onClick={() => applyPreset("last7")}>
                Последние 7 дней
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item onClick={() => applyPreset("thisMonth")}>
                Этот месяц
              </Menu.Item>
              <Menu.Item onClick={() => applyPreset("prevMonth")}>
                Прошлый месяц
              </Menu.Item>
              <Menu.Item onClick={() => applyPreset("last30")}>
                Последние 30 дней
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>

        {/* car select */}
        <NativeSelect
          value={carId}
          onChange={(e) => setCarId(e.currentTarget.value)}
          className="shrink-0 bg-white shadow-sm rounded-xl px-3 py-2"
        >
          <option value="all">Все авто</option>
          {carOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </NativeSelect>

        {/* status select */}
        <NativeSelect
          value={status}
          onChange={(e) =>
            setStatus(e.currentTarget.value as "all" | NormStatus)
          }
          className="shrink-0 bg-white shadow-sm rounded-xl px-3 py-2"
        >
          <option value="all">Все статусы</option>
          <option value="reserved">Забронировано</option>
          <option value="active">В аренде</option>
          <option value="completed">Завершено</option>
          <option value="cancelled">Отменено</option>
          <option value="blocked">Блок</option>
        </NativeSelect>

        {/* Search */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <TextInput
            placeholder="Поиск (ID брони, авто)"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            className="w-full rounded-2xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm hover:bg-white/80 focus:ring-2 focus:ring-black/10"
          />
        </div>

        {/* Reset */}
        <button
          type="button"
          onClick={resetFilters}
          className="p-2 rounded hover:bg-gray-100 active:bg-gray-200 transition"
          aria-label="Сбросить фильтры"
          title="Сбросить фильтры"
        >
          <XMarkIcon className="size-5 text-gray-800 stroke-1" />
        </button>
      </div>

      {/* Mobile search */}
      <div className="relative w-full sm:hidden">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <TextInput
          placeholder="Поиск (ID брони, авто)"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          className="w-full rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm hover:bg-white/80 focus:ring-2 focus:ring-black/10"
        />
      </div>

      {/* Mobile floating Filters button */}
      <div className="sm:hidden">
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

      {/* Drawer with filters (mobile) */}
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
                <Button variant="default" size="xs" className="rounded-xl">
                  Presets
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => applyPreset("thisWeek")}>
                  Эта неделя
                </Menu.Item>
                <Menu.Item onClick={() => applyPreset("prevWeek")}>
                  Прошлая неделя
                </Menu.Item>
                <Menu.Item onClick={() => applyPreset("last7")}>
                  Последние 7 дней
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item onClick={() => applyPreset("thisMonth")}>
                  Этот месяц
                </Menu.Item>
                <Menu.Item onClick={() => applyPreset("prevMonth")}>
                  Прошлый месяц
                </Menu.Item>
                <Menu.Item onClick={() => applyPreset("last30")}>
                  Последние 30 дней
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
            {carOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </NativeSelect>

          <NativeSelect
            value={status}
            onChange={(e) =>
              setStatus(e.currentTarget.value as "all" | NormStatus)
            }
            className="shrink-0 bg-white shadow-sm rounded-xl px-3 py-2"
          >
            <option value="all">Все статусы</option>
            <option value="reserved">Забронировано</option>
            <option value="active">В аренде</option>
            <option value="completed">Завершено</option>
            <option value="cancelled">Отменено</option>
            <option value="blocked">Блок</option>
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

      {/* ---- Tabs (2 раздела) ---- */}
      <div className="flex gap-2">
        {(
          [
            { key: "operational", label: "Оперативные" },
            { key: "managerial", label: "Управленческие" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`px-3 py-1.5 rounded-xl border text-sm ${
              view === t.key
                ? "bg-black text-white border-black"
                : "bg-white/60 dark:bg-zinc-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---- Views ---- */}
      {loading ? (
        <div className="flex justify-center items-center gap-2 text-center text-zinc-500 mt-6">
          <Loader size="sm" color="gray" /> Loading...
        </div>
      ) : (
        <>
          {view === "operational" && (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard
                  icon={<CheckCircleIcon className="w-6 h-6" />}
                  title="Активных авто"
                  value={totalActiveCars}
                  sub={`Всего: ${cars.length}`}
                />
                <KpiCard
                  icon={<ClockIcon className="w-6 h-6" />}
                  title="Сейчас в аренде"
                  value={activeNow}
                  sub={`Свободно: ${freeNow}`}
                />
                <KpiCard
                  icon={<CalendarDaysIcon className="w-6 h-6" />}
                  title="Заезды сегодня"
                  value={startsToday}
                  sub={`${fmtDate(todayStart)} `}
                />
                <KpiCard
                  icon={<CalendarDaysIcon className="w-6 h-6" />}
                  title="Возвраты сегодня"
                  value={endsToday}
                  sub={`${fmtDate(todayStart)} `}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TableCard title="Ближайшие бронирования">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-zinc-500">
                        <th className="py-2">ID</th>
                        <th className="py-2">Авто</th>
                        <th className="py-2">Период</th>
                        <th className="py-2">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const list = upcoming;
                        return list.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="py-6 text-center text-zinc-500"
                            >
                              Нет записей
                            </td>
                          </tr>
                        ) : (
                          list.map((b) => (
                            <tr
                              key={b.id}
                              className="border-t border-zinc-200/60"
                            >
                              <td className="py-2 font-medium">{b.id}</td>
                              <td className="py-2">
                                {carsById.get(b.car_id) ?? b.car_id}
                              </td>
                              <td className="py-2">
                                {fmtDate(b.start_at)} — {fmtDate(b.end_at)}
                              </td>
                              <td className="py-2">
                                <StatusBadge status={normalizeStatus(b)} />
                              </td>
                            </tr>
                          ))
                        );
                      })()}
                    </tbody>
                  </table>
                </TableCard>

                <TableCard title="Просроченные возвраты">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-zinc-500">
                        <th className="py-2">ID</th>
                        <th className="py-2">Авто</th>
                        <th className="py-2">Должен вернуть</th>
                        <th className="py-2">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdue.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-6 text-center text-zinc-500"
                          >
                            Всё ок — просрочек нет
                          </td>
                        </tr>
                      ) : (
                        overdue.map((b) => (
                          <tr
                            key={b.id}
                            className="border-t border-zinc-200/60"
                          >
                            <td className="py-2 font-medium">{b.id}</td>
                            <td className="py-2">
                              {carsById.get(b.car_id) ?? b.car_id}
                            </td>
                            <td className="py-2">{fmtDate(b.end_at)}</td>
                            <td className="py-2">
                              <span className="inline-flex items-center gap-1 text-amber-600">
                                <ExclamationTriangleIcon className="w-4 h-4" />
                                Просрочено
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </TableCard>
              </div>
            </>
          )}

          {view === "managerial" && (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard
                  icon={<CurrencyEuroIcon className="w-6 h-6" />}
                  title="Выручка (период)"
                  value={`€${filtered
                    .reduce((a, b) => a + (b.price_total ?? 0), 0)
                    .toLocaleString()}`}
                  sub={`${fmtDate(fromDate)} — ${fmtDate(toDate)}`}
                />
                <KpiCard
                  icon={<ArrowTrendingUpIcon className="w-6 h-6" />}
                  title="Средний чек"
                  value={`€${avgCheck}`}
                  sub="на бронирование"
                />
                <KpiCard
                  icon={<CheckCircleIcon className="w-6 h-6" />}
                  title="Бронирований"
                  value={filtered.length}
                  sub="в выбранном периоде"
                />
                <KpiCard
                  icon={<ClockIcon className="w-6 h-6" />}
                  title="Загрузка (ср.)"
                  value={`${Math.round(
                    utilizationByCar.reduce((a, b) => a + b.utilization, 0) /
                      Math.max(1, utilizationByCar.length)
                  )}%`}
                  sub="по автопарку"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ChartCard title="Выручка по месяцам (6м)">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart
                      data={revenueTrend}
                      margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="revenue" />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  className="lg:col-span-2"
                  title="Загрузка по авто (%)"
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={utilizationByCar}
                      margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="car" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="utilization" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TableCard title="ТОП авто (по кол-ву бронирований)">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-zinc-500">
                        <th className="py-2">Авто</th>
                        <th className="py-2">Бронирований</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCars.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2}
                            className="py-6 text-center text-zinc-500"
                          >
                            Нет данных
                          </td>
                        </tr>
                      ) : (
                        topCars.map((r) => (
                          <tr
                            key={r.car}
                            className="border-t border-zinc-200/60"
                          >
                            <td className="py-2">{r.car}</td>
                            <td className="py-2 font-medium">{r.count}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </TableCard>

                <TableCard title="Клиенты: новые vs повторные (оценка)">
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
                      <div className="text-sm">
                        <div className="mb-2">
                          Новые: <span className="font-medium">{newPct}%</span>
                        </div>
                        <div>
                          Повторные:{" "}
                          <span className="font-medium">{repeatPct}%</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">
                          * Оценка по повторяемости user_id в отфильтрованных
                          бронированиях.
                        </p>
                      </div>
                    );
                  })()}
                </TableCard>
              </div>
            </>
          )}
        </>
      )}

      <p className="text-xs text-zinc-500">
        Период — одно поле DateRange, пресеты — «Presets». Парсинг дат iOS-safe.
      </p>
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
      transition={{ duration: 0.25 }}
      className="rounded-2xl border bg-white/70 dark:bg-zinc-900 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800">
          {icon}
        </div>
        <FunnelIcon className="w-5 h-5 opacity-0" />
      </div>
      <div className="mt-3">
        <div className="text-sm text-zinc-500">{title}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {sub ? <div className="text-xs text-zinc-500 mt-1">{sub}</div> : null}
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
      className={`rounded-2xl border bg-white/70 dark:bg-zinc-900 p-4 shadow-sm ${className}`}
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
      className="rounded-2xl border bg-white/70 dark:bg-zinc-900 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-zinc-600">{title}</h3>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: NormStatus }) {
  const map: Record<NormStatus, string> = {
    reserved: "bg-blue-50 text-blue-700",
    active: "bg-emerald-50 text-emerald-700",
    completed: "bg-zinc-100 text-zinc-700",
    cancelled: "bg-rose-50 text-rose-700",
    blocked: "bg-amber-50 text-amber-700",
  };
  const label: Record<NormStatus, string> = {
    reserved: "Забронировано",
    active: "В аренде",
    completed: "Завершено",
    cancelled: "Отменено",
    blocked: "Блок",
  };
  return (
    <span className={`px-2 py-1 text-xs rounded-lg ${map[status]}`}>
      {label[status]}
    </span>
  );
}
