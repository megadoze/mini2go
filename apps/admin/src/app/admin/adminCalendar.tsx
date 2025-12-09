import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useLoaderData,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchCalendarWindowByMonth,
  type CalendarWindow,
  type CarWithBookings,
} from "@/services/calendar-window.service";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isWithinInterval,
  isWeekend,
  parseISO,
  startOfDay,
  startOfMonth,
  isSameMonth,
  addDays,
  differenceInMinutes,
} from "date-fns";
import { FixedSizeList as List } from "react-window";
import type { Booking } from "@/types/booking";
import { getUserById } from "@/services/user.service";
import { fetchBookingById } from "@/services/calendar.service";
import { fetchBookingExtras } from "@/services/booking-extras.service";

// ключи кэша
import { QK } from "@/queryKeys";
// загрузчик окна календаря (месяц ±1)
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/* -------------------- types -------------------- */

type LoaderShape = { monthISO?: string };

type RTBooking = Pick<
  Booking,
  "id" | "car_id" | "start_at" | "end_at" | "status" | "mark"
>;

type RTPayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

/* -------------------- consts -------------------- */

const COL_W = 32;
const ROW_H = 36;
const HEADER_H = 36;
const LEFT_W = 230;
const PLATE_COL_W = 64;
const LIST_MAX_H = 520;

/* -------------------- helpers -------------------- */

const intersectsDay = (booking: Booking, day: Date) => {
  const start = parseISO(booking.start_at);
  const end = parseISO(booking.end_at);
  return (
    isSameDay(day, start) ||
    isSameDay(day, end) ||
    isWithinInterval(day, { start, end })
  );
};

export default function AdminCalendar() {
  const { monthISO: monthFromLoader } = (useLoaderData() as LoaderShape) ?? {};
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  // const [meId, setMeId] = useState<string | null | undefined>(undefined);

  // управляемый месяц (от лоадера или now)
  const [month, setMonth] = useState<Date>(
    startOfMonth(new Date(monthFromLoader ?? new Date().toISOString()))
  );
  const monthKeyISO = useMemo(() => startOfMonth(month).toISOString(), [month]);

  // читаем окно календаря из кэша/сети (месяц ±1)
  const calQ = useQuery<CalendarWindow, Error>({
    queryKey: QK.calendarWindow(monthKeyISO),
    queryFn: () => fetchCalendarWindowByMonth(monthKeyISO),
    initialData: qc.getQueryData<CalendarWindow>(
      QK.calendarWindow(monthKeyISO)
    ),
    staleTime: 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  const cars: CarWithBookings[] = (calQ.data?.cars as CarWithBookings[]) ?? [];

  // диапазон дней (из ответа или локально, чтобы не мигало)
  const rangeStart = useMemo(
    () =>
      calQ.data?.rangeStart
        ? new Date(calQ.data.rangeStart)
        : startOfMonth(addMonths(month, -1)),
    [calQ.data?.rangeStart, month]
  );
  const rangeEnd = useMemo(
    () =>
      calQ.data?.rangeEnd
        ? new Date(calQ.data.rangeEnd)
        : endOfMonth(addMonths(month, 1)),
    [calQ.data?.rangeEnd, month]
  );

  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd]
  );

  const today = startOfDay(new Date());

  const rightScrollRef = useRef<HTMLDivElement | null>(null);
  const leftListRef = useRef<List>(null);
  const rightListRef = useRef<List>(null);
  const syncingRef = useRef(false);
  const didInitScrollRef = useRef(false);
  const pendingCenterOnDateRef = useRef<Date | null>(null);

  const [visibleMonth, setVisibleMonth] = useState<Date>(month);

  const [popover, setPopover] = useState<{
    booking: (Booking & { user?: any; extras?: any[] }) | null;
    rect: { x: number; y: number; w: number; h: number } | null;
  }>({ booking: null, rect: null });

  const [createPopover, setCreatePopover] = useState<{
    carId: string;
    date: Date;
    rect: { x: number; y: number; w: number; h: number };
  } | null>(null);

  const closePopover = () => setPopover({ booking: null, rect: null });
  const closeCreatePopover = () => setCreatePopover(null);

  /* ---------- prefetch API ---------- */

  const prefetchMonth = (m: Date) => {
    const iso = startOfMonth(m).toISOString();
    void qc.prefetchQuery({
      queryKey: QK.calendarWindow(iso),
      queryFn: () => fetchCalendarWindowByMonth(iso),
      staleTime: 60_000,
    });
  };

  async function loadBookingBundle(booking: Booking) {
    // 1) сначала берём из кэша
    let full = qc.getQueryData<any>(QK.booking(booking.id)) ?? booking;
    let extras = qc.getQueryData<any[]>(QK.bookingExtras(booking.id)) ?? [];
    let user: any =
      booking.user_id != null
        ? qc.getQueryData<any>(QK.user(booking.user_id))
        : null;

    // 2) если чего-то нет — догружаем и кладём в кэш
    if (!qc.getQueryData(QK.booking(booking.id))) {
      full = await qc.ensureQueryData({
        queryKey: QK.booking(booking.id),
        queryFn: () => fetchBookingById(booking.id),
        staleTime: 60_000,
      });
    }
    if (!qc.getQueryData(QK.bookingExtras(booking.id))) {
      extras = await qc.ensureQueryData({
        queryKey: QK.bookingExtras(booking.id),
        queryFn: () => fetchBookingExtras(booking.id),
        staleTime: 60_000,
      });
    }
    if (booking.user_id && !qc.getQueryData(QK.user(booking.user_id))) {
      user = await qc.ensureQueryData({
        queryKey: QK.user(booking.user_id),
        queryFn: () => getUserById(booking.user_id!),
        staleTime: 5 * 60_000,
      });
    }

    return { full, extras, user };
  }

  const carIdsKey = useMemo(
    () =>
      (calQ.data?.cars ?? [])
        .map((c) => String(c.id))
        .sort()
        .join(","),
    [calQ.data?.cars]
  );

  useEffect(() => {
    if (!carIdsKey) return;

    const idsCsv = carIdsKey;

    const channel = supabase
      .channel(`bookings-calendar-${idsCsv}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `car_id=in.(${idsCsv})`,
        },
        (payload: RTPayload) => {
          const newRow = payload.new as Partial<RTBooking> | null;
          const oldRow = payload.old as Partial<RTBooking> | null;

          const id = newRow?.id ?? oldRow?.id;
          const carId = newRow?.car_id ?? oldRow?.car_id;

          // --- МГНОВЕННОЕ УДАЛЕНИЕ -------------------------------------------------
          if (payload.eventType === "DELETE") {
            if (id) {
              // 1) выкидываем из всех открытых окон календаря
              qc.setQueriesData(
                {
                  predicate: (q) =>
                    Array.isArray(q.queryKey) &&
                    q.queryKey[0] === "calendarWindow",
                },
                (win: any) => {
                  if (!win) return win;
                  return {
                    ...win,
                    cars: (win.cars ?? []).map((c: any) => ({
                      ...c,
                      bookings: (c.bookings ?? []).filter(
                        (b: Booking) => b.id !== id
                      ),
                    })),
                  };
                }
              );

              // 2) аккуратно чистим список по машине, если знаем car_id
              if (carId) {
                qc.setQueryData<Booking[]>(
                  QK.bookingsByCarId(String(carId)),
                  (prev) => (prev ?? []).filter((b) => b.id !== id)
                );
              }
            }

            // 3) мягко инвалидируем окна для подтяжки с сервера
            qc.invalidateQueries({
              predicate: (q) =>
                Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
            });
            return;
          }
          // ------------------------------------------------------------------------

          // INSERT/UPDATE: обновим список по машине (если есть) и инвалидируем окна
          if (carId && payload.new) {
            const incoming = payload.new as Booking;
            qc.setQueryData<Booking[]>(
              QK.bookingsByCarId(String(carId)),
              (prev) => {
                const list = prev ?? [];
                const i = list.findIndex((b) => b.id === incoming.id);
                if (i === -1) return [incoming, ...list];
                const next = list.slice();
                next[i] = { ...next[i], ...incoming };
                return next;
              }
            );
          }

          qc.invalidateQueries({
            predicate: (q) =>
              Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
          });

          if (id) {
            qc.invalidateQueries({ queryKey: QK.booking(id) });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [carIdsKey, qc]);

  /* ---------- scroll helpers ---------- */

  const DAY_MS = 24 * 60 * 60 * 1000;
  const dayIndexFromRangeStart = (d: Date) =>
    Math.floor((+startOfDay(d) - +startOfDay(rangeStart)) / DAY_MS);

  const scrollToDate = (d: Date) => {
    const el = rightScrollRef.current;
    if (!el) return;
    const idx = dayIndexFromRangeStart(d);
    const left = idx * COL_W - el.clientWidth / 2 + COL_W / 2;
    el.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  };

  // 1) первый рендер — центрируем сегодня (если текущий месяц), иначе начало месяца
  useEffect(() => {
    if (didInitScrollRef.current) return;
    const el = rightScrollRef.current;
    if (!el || days.length === 0) return;

    const r = requestAnimationFrame(() => {
      const monthStart = startOfMonth(month);
      const isCurrent = isSameMonth(monthStart, new Date());
      const anchorDate = isCurrent ? new Date() : monthStart;
      const idx = days.findIndex((d) => isSameDay(d, startOfDay(anchorDate)));
      if (idx === -1) return;

      const left = idx * COL_W - (el.clientWidth - COL_W) / 2;
      el.scrollLeft = Math.max(0, left);
      setVisibleMonth(monthStart);
      didInitScrollRef.current = true;
    });

    return () => cancelAnimationFrame(r);
  }, [days, month]);

  // 2) последующие смены месяца — ставим левый край на начало месяца
  useEffect(() => {
    if (!didInitScrollRef.current) return;
    const el = rightScrollRef.current;
    if (!el || days.length === 0) return;

    const monthStart = startOfMonth(month);

    // если ждали центрирование конкретной даты (Today из другого месяца)
    const pending = pendingCenterOnDateRef.current;
    if (pending && isSameMonth(monthStart, pending)) {
      const idx = days.findIndex((d) => isSameDay(d, startOfDay(pending)));
      if (idx !== -1) {
        const left = idx * COL_W - (el.clientWidth - COL_W) / 2;
        el.scrollLeft = Math.max(0, left);
        setVisibleMonth(monthStart);
      }
      pendingCenterOnDateRef.current = null;
      return;
    }

    const idx = days.findIndex((d) => isSameDay(d, monthStart));
    if (idx !== -1) {
      el.scrollLeft = idx * COL_W;
      setVisibleMonth(monthStart);
    }
  }, [month, days.length]);

  // debounced-обновление visibleMonth при горизонтальном скролле
  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;

    let raf = 0;
    let t: number | null = null;

    const update = () => {
      // ⬇️ не даём менять visibleMonth до завершения первичной прокрутки
      if (!didInitScrollRef.current) return;

      const center = el.scrollLeft + el.clientWidth / 2;
      let idx = Math.floor(center / COL_W);
      if (idx < 0) idx = 0;
      if (idx > days.length - 1) idx = days.length - 1;
      const d = days[idx];
      if (!d) return;
      const m = startOfMonth(d);
      setVisibleMonth((prev) => (isSameMonth(prev, m) ? prev : m));
    };

    const onScroll = () => {
      if (!didInitScrollRef.current) return; // ⬅️ блокируем до инициализации
      if (popover.booking) closePopover();
      if (createPopover) closeCreatePopover();
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (t !== null) window.clearTimeout(t);
        t = window.setTimeout(() => {
          update();
          t = null;
        }, 120);
      });
    };

    // ⬇️ не вызываем update() сразу, пока не готова первичная позиция
    if (didInitScrollRef.current) {
      update();
    }

    el.addEventListener("scroll", onScroll, { passive: true });

    const onResize = () => {
      if (!didInitScrollRef.current) return; // ⬅️ тоже блок
      if (t !== null) window.clearTimeout(t);
      t = window.setTimeout(() => {
        update();
        t = null;
      }, 120);
    };
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
      if (t !== null) window.clearTimeout(t);
    };
  }, [days, popover.booking, createPopover]);

  /* ---------- month navigation ---------- */

  const goToMonthSmooth = (m: Date) => {
    const mStart = startOfMonth(m);
    const iso = mStart.toISOString();

    navigate({
      pathname: "/admin/calendar",
      search: `?month=${encodeURIComponent(iso)}`,
    });

    setMonth(mStart);
    prefetchMonth(mStart);
  };

  const handleToday = () => {
    const targetMonth = startOfMonth(new Date());
    if (isSameMonth(month, targetMonth)) {
      scrollToDate(new Date());
      setVisibleMonth(targetMonth);
    } else {
      pendingCenterOnDateRef.current = new Date();
      goToMonthSmooth(targetMonth);
    }
  };

  /* ---------- sync lists scroll ---------- */

  const onLeftScroll = ({ scrollOffset }: any) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    rightListRef.current?.scrollTo(scrollOffset);
    syncingRef.current = false;
    closePopover();
    closeCreatePopover();
  };
  const onRightScroll = ({ scrollOffset }: any) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    leftListRef.current?.scrollTo(scrollOffset);
    syncingRef.current = false;
    closePopover();
    closeCreatePopover();
  };

  // if (meId === null) {
  //   return (
  //     <div className="p-6 text-sm text-gray-500">
  //       Sign in to see your calendar
  //     </div>
  //   );
  // }

  /* ---------- bars & rows ---------- */

  const rowBars = (bookings: Booking[]) => {
    const relevant = bookings.filter((b) => {
      const s = parseISO(b.start_at);
      const e = parseISO(b.end_at);
      const inRange = !(e < rangeStart || s > rangeEnd);
      if (!inRange) return false;
      if (b.mark === "block" || b.status === "block") return true;

      const canceled = String(b.status ?? "").startsWith("canceled");

      return !canceled;
    });

    const bars: { booking: Booking; left: number; span: number }[] = [];
    for (const b of relevant) {
      const firstIdx = days.findIndex((d) => intersectsDay(b, d));
      if (firstIdx === -1) continue;
      let lastIdx = firstIdx;
      for (let i = firstIdx + 1; i < days.length; i++) {
        if (intersectsDay(b, days[i])) lastIdx = i;
        else break;
      }
      bars.push({ booking: b, left: firstIdx, span: lastIdx - firstIdx + 1 });
    }
    return bars;
  };

  const LeftRow = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const car = cars[index];
    const brandModel = [car?.brand, car?.model].filter(Boolean).join(" ");
    const plate = car?.license_plate ?? "—";

    return (
      <div
        style={{ ...style, height: ROW_H }}
        className="px-2 whitespace-nowrap text-sm border-b border-gray-100"
        title={`${brandModel}${plate ? ` • ${plate}` : ""}`}
      >
        <div
          className="grid items-center h-full gap-2"
          style={{ gridTemplateColumns: `1fr ${PLATE_COL_W}px` }}
        >
          <span className="text-gray-800 truncate" title={brandModel || "—"}>
            {brandModel || "—"}
          </span>
          <span className=" text-xs text-gray-600 border border-gray-200 shadow-sm text-center py-1">
            {plate}
          </span>
        </div>
      </div>
    );
  };

  const RightRow = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const car = cars[index];
    const bars = rowBars(car?.bookings ?? []);

    const isBusyDay = (date: Date) => {
      const bookings = car?.bookings ?? [];
      return bookings.some((b) => {
        const canceled = String(b.status ?? "").startsWith("canceled");

        if (canceled) return false;
        return intersectsDay(b, date);
      });
    };

    return (
      <div
        style={{ ...style, height: ROW_H }}
        className="relative border-b border-gray-100 bg-white"
      >
        {/* фон-сетка */}
        <div
          className="grid absolute inset-0 pointer-events-none"
          style={{ gridTemplateColumns: `repeat(${days.length}, ${COL_W}px)` }}
        >
          {days.map((d) => {
            const weekend = isWeekend(d);
            const isEndOfMonth = addDays(d, 1).getDate() === 1;
            const monthSep = isEndOfMonth ? "border-r border-gray-300" : "";
            const todayBg = isSameDay(d, today) ? "bg-amber-200/30" : "";
            const weekendBg = weekend ? "bg-slate-50" : "";
            return (
              <div
                key={d.toISOString()}
                className={`border-r border-gray-200 ${monthSep} ${weekendBg} ${todayBg}`}
              />
            );
          })}
        </div>

        {/* кликабельные ячейки для создания */}
        <div
          className="absolute inset-0 grid z-0"
          style={{ gridTemplateColumns: `repeat(${days.length}, ${COL_W}px)` }}
        >
          {days.map((d) => {
            const busy = isBusyDay(d);
            const past = d < today;
            const disabled = busy || past;

            return (
              <button
                key={d.toISOString()}
                className={`w-full h-full bg-transparent ${
                  disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                }`}
                disabled={disabled}
                aria-label={
                  busy
                    ? "Busy day"
                    : past
                    ? "Last day"
                    : "Free day: create a reservation"
                }
                onClick={(e) => {
                  if (disabled) return;
                  closePopover();
                  const rect = (
                    e.currentTarget as HTMLElement
                  ).getBoundingClientRect();
                  setCreatePopover({
                    carId: car.id,
                    date: d,
                    rect: {
                      x: rect.left,
                      y: rect.top,
                      w: rect.width,
                      h: rect.height,
                    },
                  });
                }}
              />
            );
          })}
        </div>

        {/* бары */}
        {bars.map(({ booking, left, span }) => {
          const leftPx = left * COL_W;
          const widthPx = span * COL_W - 8;
          const isBlock =
            booking.mark === "block" || booking.status === "block";

          let colorClass = "";
          let ringClass = "";
          if (isBlock) {
            colorClass = "bg-gradient-to-r from-pink-700/80 to-rose-500/70";
            // ringClass = "focus-visible:ring-red-400";
          } else if (booking.status === "rent") {
            colorClass =
              "bg-gradient-to-r from-emerald-600/90  to-emerald-500/90";
            // ringClass = "focus-visible:ring-emerald-500";
          } else if (booking.status === "finished") {
            colorClass = "bg-gradient-to-r from-gray-400 to-gray-400/60";
            // ringClass = "focus-visible:ring-gray-400";
          } else if (booking.status === "confirmed") {
            colorClass = "bg-gradient-to-r from-orange-600/80 to-orange-500/60";
            // ringClass = "focus-visible:ring-orange-300";
          } else if (booking.status === "onApproval") {
            colorClass = "bg-gradient-to-r from-sky-600/80 to-sky-500/70";
            // ringClass = "focus-visible:ring-blue-500";
          } else {
            colorClass = "bg-green-500/80";
            ringClass = "focus-visible:ring-lime-400";
          }

          const url = `/admin/bookings/${booking.id}`;

          return (
            <Link
              key={booking.id}
              to={url}
              className={`absolute z-10 top-1/2 -translate-y-1/2 h-5 rounded-xl shadow px-2 text-[10px] leading-5 text-white truncate
              ${colorClass}
              focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${ringClass}`}
              style={{ left: leftPx + 4, width: widthPx }}
              onMouseEnter={() => {
                // префетчим бандл данных для быстрого поповера/перехода
                void qc.prefetchQuery({
                  queryKey: QK.booking(booking.id),
                  queryFn: () => fetchBookingById(booking.id),
                  staleTime: 60_000,
                });
                void qc.prefetchQuery({
                  queryKey: QK.bookingExtras(booking.id),
                  queryFn: () => fetchBookingExtras(booking.id),
                  staleTime: 60_000,
                });
                if (booking.user_id) {
                  void qc.prefetchQuery({
                    queryKey: QK.user(booking.user_id),
                    queryFn: () => getUserById(booking.user_id!),
                    staleTime: 5 * 60_000,
                  });
                }
              }}
              onClick={async (e) => {
                if (e.metaKey || e.ctrlKey) return;
                e.preventDefault();

                const target = e.currentTarget as HTMLElement;
                const rect = target.getBoundingClientRect();
                if (!rect) return;

                const { full, extras, user } = await loadBookingBundle(booking);

                setPopover({
                  booking: {
                    ...(full as any),
                    ...(user ? { user } : {}),
                    extras,
                  },
                  rect: {
                    x: rect.left,
                    y: rect.top,
                    w: rect.width,
                    h: rect.height,
                  },
                });
                closeCreatePopover();
              }}
              onKeyDown={(e) => {
                if (e.key === " ") e.preventDefault();
              }}
              aria-label={`${isBlock ? "Blocked period" : "Booking"} ...`}
            >
              {format(parseISO(booking.start_at), "dd MMM")} →{" "}
              {format(parseISO(booking.end_at), "dd MMM")}
            </Link>
          );
        })}
      </div>
    );
  };

  /* ---------- render ---------- */

  return (
    <div className="w-full max-w-screen-2xl">
      <h1 className="font-roboto text-xl md:text-2xl font-medium md:font-bold">
        Calendar
      </h1>
      <div className="flex flex-wrap items-center justify-between mb-3 mt-5">
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 text-sm border bg-white rounded"
            onClick={() => goToMonthSmooth(addMonths(month, -1))}
            onMouseEnter={() => prefetchMonth(addMonths(month, -1))}
            disabled={calQ.isFetching}
          >
            Prev
          </button>
          <button
            className="px-3 py-1 text-sm border bg-white rounded"
            onClick={() => goToMonthSmooth(addMonths(month, 1))}
            onMouseEnter={() => prefetchMonth(addMonths(month, 1))}
            disabled={calQ.isFetching}
          >
            Next
          </button>
          <button
            className="px-3 py-1 text-sm border bg-white rounded"
            onClick={handleToday}
            onMouseEnter={() => prefetchMonth(new Date())}
            disabled={calQ.isFetching}
          >
            Today
          </button>
        </div>
      </div>

      <div className="border overflow-hidden">
        <div className="flex">
          {/* LEFT */}
          <div
            className="flex-none border-r border-gray-200 bg-white"
            style={{ width: LEFT_W }}
          >
            <div
              className="sticky grid grid-cols-2 top-0 z-20 bg-white border-b border-gray-200 px-2  items-center"
              style={{ height: HEADER_H }}
            >
              <p className=" col-span-2">{format(visibleMonth, "LLLL yyyy")}</p>
            </div>
            {calQ.isLoading && !calQ.data ? (
              <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>
            ) : (
              <List
                height={Math.min(cars.length * ROW_H, LIST_MAX_H)}
                width={LEFT_W}
                itemCount={cars.length}
                itemSize={ROW_H}
                onScroll={onLeftScroll}
                ref={leftListRef}
              >
                {LeftRow as any}
              </List>
            )}
          </div>

          {/* RIGHT */}
          <div className="flex-1 overflow-x-auto" ref={rightScrollRef}>
            <div style={{ width: days.length * COL_W }}>
              <div
                className="sticky top-0 z-20 bg-white border-b border-gray-200 border-r"
                style={{ height: HEADER_H }}
              >
                <div
                  className="grid h-full"
                  style={{
                    gridTemplateColumns: `repeat(${days.length}, ${COL_W}px)`,
                  }}
                >
                  {days.map((d) => {
                    const weekend = isWeekend(d);
                    const isEndOfMonth = addDays(d, 1).getDate() === 1;
                    const monthSep = isEndOfMonth
                      ? "border-r border-gray-300"
                      : "";
                    const todayBg = isSameDay(d, today)
                      ? "bg-amber-200/30"
                      : "";
                    const weekendBg = weekend ? "bg-slate-50" : "";
                    return (
                      <div
                        key={d.toISOString()}
                        className={`border-r border-gray-200 ${monthSep} ${weekendBg} ${todayBg} text-[10px] text-gray-600 flex flex-col items-center justify-center h-full`}
                      >
                        <div className="leading-none">{format(d, "dd")}</div>
                        <div className="leading-none">{format(d, "EEE")}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="absolute right-0 top-0 bottom-0 border-l border-gray-200 pointer-events-none" />
              </div>

              {calQ.isLoading && !calQ.data ? (
                <div className="p-6 text-sm text-gray-500">Loading…</div>
              ) : cars.length === 0 ? (
                <div className="p-6 text-sm text-gray-500">No cars</div>
              ) : (
                <List
                  height={Math.min(cars.length * ROW_H, LIST_MAX_H)}
                  width={days.length * COL_W}
                  itemCount={cars.length}
                  itemSize={ROW_H}
                  onScroll={onRightScroll}
                  ref={rightListRef}
                >
                  {RightRow as any}
                </List>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* легенда */}
      <div className="mt-4 flex justify-around sm:justify-end items-center gap-4 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-emerald-600/80" />{" "}
          rent
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-orange-600/70" />{" "}
          confirmed
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-sky-500/80" /> on
          approval
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-gray-400/80" />{" "}
          finished
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-rose-700/80" /> block
        </span>
      </div>

      {/* popover создания */}
      {createPopover &&
        (() => {
          const padding = 8;
          const popW = 260;
          const popH = 110;
          const viewportW = window.innerWidth;
          const viewportH = window.innerHeight;

          let left = createPopover.rect.x + createPopover.rect.w / 2 - popW / 2;
          left = Math.max(padding, Math.min(left, viewportW - popW - padding));

          let top = createPopover.rect.y + createPopover.rect.h + 6;
          if (top + popH + padding > viewportH) {
            top = createPopover.rect.y - popH - 6;
          }

          const startDateHuman = format(createPopover.date, "dd MMM yyyy");

          const goCreate = () => {
            const today = startOfDay(new Date());
            if (createPopover.date < today) {
              closeCreatePopover();
              return;
            }
            const selDayStart = startOfDay(createPopover.date);
            let start = new Date(selDayStart);

            if (isSameDay(selDayStart, today)) {
              const now = new Date();
              const h = now.getHours() + (now.getMinutes() > 0 ? 1 : 0);
              if (h >= 24) {
                start = startOfDay(addDays(selDayStart, 1));
              } else {
                start.setHours(h, 0, 0, 0);
              }
            } else {
              start.setHours(10, 0, 0, 0);
            }

            const end = new Date(start);
            end.setDate(end.getDate() + 1);

            navigate(
              `/admin/bookings/new?carId=${createPopover.carId}` +
                `&start=${encodeURIComponent(start.toISOString())}` +
                `&end=${encodeURIComponent(end.toISOString())}`,
              { state: { from: location.pathname + location.search } }
            );
            closeCreatePopover();
          };

          return (
            <div
              id="create-popover"
              className="fixed z-50 px-3 py-2 rounded-md border bg-white text-xs shadow-lg w-[260px]"
              style={{ left, top }}
              role="dialog"
              aria-modal="true"
            >
              <div className="font-medium mb-1">Create a reservation?</div>
              <div className="text-gray-700 mb-2">Date: {startDateHuman}</div>
              <div className="flex justify-end gap-2">
                <button
                  className="px-2 py-1 border rounded hover:bg-gray-50"
                  onClick={closeCreatePopover}
                >
                  Cancel
                </button>
                <button
                  className="px-2 py-1 border rounded text-lime-600 border-lime-500 hover:bg-lime-50"
                  onClick={goCreate}
                >
                  Create
                </button>
              </div>
            </div>
          );
        })()}

      {/* popover брони */}
      {popover.booking &&
        popover.rect &&
        (() => {
          const b = popover.booking!;
          const start = parseISO(b.start_at);
          const end = parseISO(b.end_at);
          const displayId = b.id.slice(0, 8).toUpperCase();
          const mins = Math.max(0, differenceInMinutes(end, start));
          const dDays = Math.floor(mins / 1440);
          const dHours = Math.floor((mins % 1440) / 60);
          const currency = (b as any)?.currency ?? "EUR";
          const userName = b.user?.full_name ?? null;
          const userPhone = b.user?.phone ?? null;

          const padding = 8;
          const popW = 280;
          const popH = 180;
          const viewportW = window.innerWidth;
          const viewportH = window.innerHeight;

          let left = popover.rect.x + popover.rect.w / 2 - popW / 2;
          left = Math.max(padding, Math.min(left, viewportW - popW - padding));

          let top = popover.rect.y + popover.rect.h + 6;
          if (top + popH + padding > viewportH) {
            top = popover.rect.y - popH - 6;
          }

          return (
            <div
              id="booking-popover"
              className="fixed z-50 px-3 py-2 rounded-md border bg-white text-xs shadow-lg w-[280px]"
              style={{ left, top }}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="font-medium">Booking №{displayId}</div>
                <button
                  className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100"
                  onClick={closePopover}
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>

              <div className="mb-1">
                {format(start, "dd MMM yyyy, HH:mm")} →{" "}
                {format(end, "dd MMM yyyy, HH:mm")}
              </div>
              <div className="mb-1 text-gray-700">
                Duration: {dDays} d. {dHours} h.
              </div>
              {b.price_total != null && (
                <div className="mb-1 font-medium">
                  Total: {b.price_total}
                  {currency && ` ${currency}`}
                </div>
              )}
              {(userName || userPhone) && (
                <div className="mt-1 text-gray-700">
                  {userName ?? "—"}
                  {userPhone ? `, ${userPhone}` : ""}
                </div>
              )}

              <div className="mt-2 flex justify-end items-center gap-2">
                <button
                  className="px-2 py-1 border rounded hover:bg-gray-50"
                  onClick={closePopover}
                >
                  Close
                </button>
                <button
                  className="px-2 py-1 border rounded hover:bg-gray-50"
                  onClick={() => {
                    const url = `/admin/bookings/${b.id}`;
                    navigate(url, {
                      state: {
                        snapshot: {
                          booking: b,
                          booking_extras: b.extras ?? [],
                        },
                        from: location.pathname + location.search,
                      },
                    });
                    closePopover();
                  }}
                >
                  Open
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
