import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useLocation,
} from "react-router-dom";
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
import { fetchBookingById } from "../car/calendar/calendar.service";
import { fetchBookingExtras } from "@/services/booking-extras.service";

export type CarLite = { id: string; name: string };
export type CarWithBookings = CarLite & { bookings: Booking[] };
type CalendarLoaderData = {
  monthISO: string;
  rangeStart: string;
  rangeEnd: string;
  cars: CarWithBookings[];
};

const COL_W = 32;
const ROW_H = 36;
const HEADER_H = 36;
const LEFT_W = 200;
const LIST_MAX_H = 520;

const intersectsDay = (booking: Booking, day: Date) => {
  const start = parseISO(booking.start_at);
  const end = parseISO(booking.end_at);
  return (
    isSameDay(day, start) ||
    isSameDay(day, end) ||
    isWithinInterval(day, { start, end })
  );
};

export default function CalendarPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useNavigation();

  const fetcher = useFetcher();

  const prefetchMonth = (m: Date) => {
    const iso = startOfMonth(m).toISOString();
    fetcher.load(`/calendar?month=${encodeURIComponent(iso)}`);
  };

  const isSelfLoading =
    navigation.state !== "idle" &&
    navigation.location?.pathname === "/calendar" &&
    navigation.location?.search !== location.search;

  const loaderData = useLoaderData<CalendarLoaderData>();

  const [month, setMonth] = useState<Date>(
    startOfMonth(new Date(loaderData?.monthISO ?? new Date().toISOString()))
  );

  const [cars, setCars] = useState<CarWithBookings[]>(
    (loaderData?.cars as CarWithBookings[]) ?? []
  );

  const [visibleMonth, setVisibleMonth] = useState<Date>(month);

  const rangeStart = useMemo(() => startOfMonth(addMonths(month, -1)), [month]);
  const rangeEnd = useMemo(() => endOfMonth(addMonths(month, 1)), [month]);
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

  const [popover, setPopover] = useState<{
    booking: Booking | null;
    rect: { x: number; y: number; w: number; h: number } | null;
  }>({ booking: null, rect: null });

  const closePopover = () => setPopover({ booking: null, rect: null });

  const listHeight = Math.min(cars.length * ROW_H, LIST_MAX_H);

  useEffect(() => {
    if (!popover.booking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePopover();
    };
    const onClick = (e: MouseEvent) => {
      const el = document.getElementById("booking-popover");
      if (el && !el.contains(e.target as Node)) closePopover();
    };
    const onScrollOrResize = () => closePopover();
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [popover.booking]);

  useEffect(() => {
    if (!loaderData) return;
    setMonth(startOfMonth(new Date(loaderData.monthISO)));
    setCars((loaderData.cars as CarWithBookings[]) ?? []);
  }, [loaderData]);

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

  useEffect(() => {
    if (didInitScrollRef.current) return;
    const el = rightScrollRef.current;
    if (!el || days.length === 0) return;

    // ждём первый layout
    const r = requestAnimationFrame(() => {
      const monthStart = startOfMonth(month);
      const isCurrent = isSameMonth(monthStart, new Date());

      const anchorDate = isCurrent ? new Date() : monthStart;

      // ищем ЯЧЕЙКУ «anchorDate» в массиве days (у тебя это три месяца: prev, current, next)
      const idx = days.findIndex((d) => isSameDay(d, startOfDay(anchorDate)));
      if (idx === -1) return;

      // центрируем эту ячейку
      const left = idx * COL_W - (el.clientWidth - COL_W) / 2;
      el.scrollLeft = Math.max(0, left);

      setVisibleMonth(monthStart);
      didInitScrollRef.current = true;
    });

    return () => cancelAnimationFrame(r);
  }, [days, month]);

  // 2) ПОСЛЕДУЮЩИЕ СМЕНЫ МЕСЯЦА (Prev/Next/GoToMonth):
  //    возвращаем прежнее поведение — ставим ЛЕВЫЙ край на начало месяца.
  useEffect(() => {
    if (!didInitScrollRef.current) return; // пропускаем первый рендер
    const el = rightScrollRef.current;
    if (!el || days.length === 0) return;

    const monthStart = startOfMonth(month);

    // если ждали центрирование конкретной даты (кнопка Today из другого месяца)
    const pending = pendingCenterOnDateRef.current;
    if (pending && isSameMonth(monthStart, pending)) {
      const idx = days.findIndex((d) => isSameDay(d, startOfDay(pending)));
      if (idx !== -1) {
        const left = idx * COL_W - (el.clientWidth - COL_W) / 2;
        el.scrollLeft = Math.max(0, left);
        setVisibleMonth(monthStart);
      }
      pendingCenterOnDateRef.current = null; // сброс
      return;
    }

    // стандартное поведение: поставить левый край на начало месяца
    const idx = days.findIndex((d) => isSameDay(d, monthStart));
    if (idx !== -1) {
      el.scrollLeft = idx * COL_W;
      setVisibleMonth(monthStart);
    }
  }, [month, days.length]);

  const goToMonthSmooth = (m: Date) => {
    const mStart = startOfMonth(m);
    const iso = mStart.toISOString();

    // a) обновляем URL (для истории/шеринга), но loader не перезапустится из-за shouldRevalidate
    navigate({
      pathname: "/calendar",
      search: `?month=${encodeURIComponent(iso)}`,
    });

    // b) локально переключаемся на месяц (перерисовка сетки без размонтирования)
    setMonth(mStart);

    // c) подгружаем данные для окна [-1, 0, +1] месяцев — тем же роут-лоадером, но через fetcher
    fetcher.load(`/calendar?month=${encodeURIComponent(iso)}`);
  };

  const handleToday = () => {
    const targetMonth = startOfMonth(new Date());
    if (isSameMonth(month, targetMonth)) {
      scrollToDate(new Date()); // центрируем именно сегодня
      setVisibleMonth(targetMonth);
    } else {
      pendingCenterOnDateRef.current = new Date();
      goToMonthSmooth(targetMonth);
      // goToMonth(targetMonth); // если другой месяц — как и сейчас
    }
  };

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;

    const data = fetcher.data as CalendarLoaderData;
    const loadedMonth = startOfMonth(new Date(data.monthISO));

    // Применяем данные только если это текущий выбранный месяц
    if (!isSameMonth(loadedMonth, month)) return;

    setCars(data.cars ?? []);
  }, [fetcher.state, fetcher.data, month]);

  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
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
      if (popover.booking) closePopover();
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    el.addEventListener("scroll", onScroll, { passive: true });

    const onResize = () => update();
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [days, popover.booking]);

  const rowBars = (bookings: Booking[]) => {
    const relevant = bookings.filter((b) => {
      const s = parseISO(b.start_at);
      const e = parseISO(b.end_at);
      const inRange = !(e < rangeStart || s > rangeEnd);
      if (!inRange) return false;
      if (b.mark === "block" || b.status === "block") return true;
      const canceled =
        b.status === "canceledHost" || b.status === "canceledClient";
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
  }) => (
    <div
      style={{ ...style, height: ROW_H }}
      className="px-3 flex items-center whitespace-nowrap overflow-hidden text-sm text-ellipsis border-b border-gray-100"
      title={cars[index]?.name}
    >
      {cars[index]?.name}
    </div>
  );

  const RightRow = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const car = cars[index];
    const bars = rowBars(car?.bookings ?? []);
    return (
      <div
        style={{ ...style, height: ROW_H }}
        className="relative border-b border-gray-100"
      >
        {/* фон-сетка НЕ перехватывает клики */}
        <div
          className="grid absolute inset-0 pointer-events-none"
          style={{ gridTemplateColumns: `repeat(${days.length}, ${COL_W}px)` }}
        >
          {days.map((d) => {
            const weekend = isWeekend(d);
            const isEndOfMonth = addDays(d, 1).getDate() === 1;
            const monthSep = isEndOfMonth ? "border-r border-gray-400" : "";
            const todayBg = isSameDay(d, today) ? "bg-amber-100/70" : "";
            const weekendBg = weekend ? "bg-slate-50" : "";
            return (
              <div
                key={d.toISOString()}
                className={`border-r border-gray-200 ${monthSep} ${weekendBg} ${todayBg}`}
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
            colorClass = "bg-red-500/80";
            ringClass = "focus-visible:ring-red-400";
          } else if (booking.status === "rent") {
            colorClass = "bg-green-500/80";
            ringClass = "focus-visible:ring-lime-400";
          } else if (booking.status === "finished") {
            colorClass = "bg-gray-400/80";
            ringClass = "focus-visible:ring-gray-400";
          } else if (
            booking.status === "onApproval" ||
            booking.status === "confirmed"
          ) {
            colorClass = "bg-orange-400";
            ringClass = "focus-visible:ring-orange-400";
          } else {
            colorClass = "bg-green-500/80";
            ringClass = "focus-visible:ring-lime-400";
          }

          const url = `/calendar/bookings/${booking.id}`;

          return (
            <Link
              key={booking.id}
              to={url}
              onClick={async (e) => {
                if (e.metaKey || e.ctrlKey) return;

                e.preventDefault();

                // Сохраняем ссылку и геометрию ДО await
                const target = e.currentTarget as HTMLElement;
                const rect = target.getBoundingClientRect();
                if (!rect) return;

                // Подтягиваем данные
                const [fullRes, extrasRes, userRes] = await Promise.allSettled([
                  fetchBookingById(booking.id),
                  fetchBookingExtras(booking.id),
                  booking.user_id
                    ? getUserById(booking.user_id).catch(() => null)
                    : Promise.resolve(null),
                ]);

                const full =
                  fullRes.status === "fulfilled" ? fullRes.value : booking;
                const extras =
                  extrasRes.status === "fulfilled" ? extrasRes.value : [];
                const user =
                  userRes.status === "fulfilled" ? userRes.value : null;

                setPopover({
                  booking: {
                    ...(full as any),
                    ...(user ? { user } : {}),
                    extras,
                  } as any,
                  rect: {
                    x: rect.left,
                    y: rect.top,
                    w: rect.width,
                    h: rect.height,
                  },
                });
              }}
              className={`absolute z-10 top-1/2 -translate-y-1/2 h-5 rounded-xl shadow px-2 text-[10px] leading-5 text-white truncate
                ${colorClass}
                focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${ringClass}`}
              style={{ left: leftPx + 4, width: widthPx }}
              onKeyDown={(e) => {
                if (e.key === " ") e.preventDefault();
              }}
              aria-label={`${
                isBlock ? "Blocked period" : "Booking"
              } from ${format(
                parseISO(booking.start_at),
                "dd MMM yyyy, HH:mm"
              )} to ${format(parseISO(booking.end_at), "dd MMM yyyy, HH:mm")}`}
            >
              {format(parseISO(booking.start_at), "dd MMM")} →{" "}
              {format(parseISO(booking.end_at), "dd MMM")}
            </Link>
          );
        })}
      </div>
    );
  };

  const onLeftScroll = ({ scrollOffset }: any) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    rightListRef.current?.scrollTo(scrollOffset);
    syncingRef.current = false;
    closePopover();
  };
  const onRightScroll = ({ scrollOffset }: any) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    leftListRef.current?.scrollTo(scrollOffset);
    syncingRef.current = false;
    closePopover();
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 text-sm border rounded"
            onClick={() => goToMonthSmooth(addMonths(month, -1))}
            onMouseEnter={() =>
              fetcher.load(
                `/calendar?month=${encodeURIComponent(
                  startOfMonth(addMonths(month, -1)).toISOString()
                )}`
              )
            }
            disabled={isSelfLoading}
          >
            Prev
          </button>
          <button
            className="px-3 py-1 text-sm border rounded"
            onClick={() => goToMonthSmooth(addMonths(month, 1))}
            onMouseEnter={() =>
              fetcher.load(
                `/calendar?month=${encodeURIComponent(
                  startOfMonth(addMonths(month, 1)).toISOString()
                )}`
              )
            }
            disabled={isSelfLoading}
          >
            Next
          </button>
          <button
            className="px-3 py-1 text-sm border rounded"
            onClick={handleToday}
            onMouseEnter={() => prefetchMonth(new Date())}
            disabled={isSelfLoading}
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-green-500/80" />{" "}
            booking
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-red-500/80" />{" "}
            block
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-gray-400/80" />{" "}
            finished
          </span>
        </div>
      </div>

      <div className="border overflow-hidden">
        <div className="flex">
          <div
            className="flex-none border-r border-gray-200"
            style={{ width: LEFT_W }}
          >
            <div
              className="sticky top-0 z-20 bg-white border-b border-gray-200 px-3 flex items-center"
              style={{ height: HEADER_H }}
            >
              {format(visibleMonth, "LLLL yyyy")}
            </div>
            {isSelfLoading ? (
              <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>
            ) : (
              <List
                height={listHeight}
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
                      ? "border-r border-gray-400"
                      : "";
                    const todayBg = isSameDay(d, today)
                      ? "bg-amber-100/70"
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

              {isSelfLoading ? (
                <div className="p-6 text-sm text-gray-500">Loading…</div>
              ) : cars.length === 0 ? (
                <div className="p-6 text-sm text-gray-500">Нет автомобилей</div>
              ) : (
                <List
                  height={listHeight}
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

      {popover.booking &&
        popover.rect &&
        (() => {
          const b = popover.booking as Booking & { user?: any; extras?: any[] };
          const start = parseISO(b.start_at);
          const end = parseISO(b.end_at);
          const displayId = b?.id?.slice(0, 8)?.toUpperCase?.() ?? "";
          const mins = Math.max(0, differenceInMinutes(end, start));
          const dDays = Math.floor(mins / 1440);
          const dHours = Math.floor((mins % 1440) / 60);
          const currency = (b as any)?.currency ?? "EUR";
          const userName = (b as any)?.user?.full_name ?? null;
          const userPhone = (b as any)?.user?.phone ?? null;

          // позиционирование: под/над прямоугольником бара с ограничением экрана
          const padding = 8;
          const popW = 280; // целевая ширина
          const popH = 180; // примерная высота (хватает под контент)
          const viewportW = window.innerWidth;
          const viewportH = window.innerHeight;

          let left = popover.rect.x + popover.rect.w / 2 - popW / 2;
          left = Math.max(padding, Math.min(left, viewportW - popW - padding));

          // пробуем показать снизу; если не влезает — сверху
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
                <div className="font-medium">Бронирование №{displayId}</div>
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
                Длительность: {dDays} дн. {dHours} ч.
              </div>
              {b.price_total != null && (
                <div className="mb-1 font-medium">
                  Итого: {b.price_total}
                  {currency && ` ${currency}`}
                </div>
              )}
              {(userName || userPhone) && (
                <div className="mt-1 text-gray-700">
                  {userName ?? "—"}
                  {userPhone ? `, ${userPhone}` : ""}
                </div>
              )}

              {/* Пример: быстрые действия */}
              <div className="mt-2 flex justify-end items-center gap-2">
                <button
                  className="px-2 py-1 border rounded hover:bg-gray-50"
                  onClick={closePopover}
                >
                  Закрыть
                </button>
                <button
                  className="px-2 py-1 border rounded hover:bg-gray-50"
                  onClick={() => {
                    const url = `/cars/${b.car_id}/bookings/${b.id}/edit`;
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
                  Открыть
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

// import { useEffect, useMemo, useRef, useState } from "react";
// import {
//   Link,
//   useFetcher,
//   useLoaderData,
//   useNavigate,
//   useNavigation,
//   useLocation,
// } from "react-router-dom";
// import {
//   addMonths,
//   eachDayOfInterval,
//   endOfMonth,
//   format,
//   isSameDay,
//   isWithinInterval,
//   isWeekend,
//   parseISO,
//   startOfDay,
//   startOfMonth,
//   isSameMonth,
//   addDays,
//   differenceInMinutes,
// } from "date-fns";

// import { FixedSizeList as List } from "react-window";
// import type { Booking } from "@/types/booking";
// import { getUserById } from "@/services/user.service";
// import { fetchBookingById } from "../car/calendar/calendar.service";
// import { fetchBookingExtras } from "@/services/booking-extras.service";

// export type CarLite = { id: string; name: string };
// export type CarWithBookings = CarLite & { bookings: Booking[] };
// type CalendarLoaderData = {
//   monthISO: string;
//   rangeStart: string;
//   rangeEnd: string;
//   cars: CarWithBookings[];
// };

// const COL_W = 32;
// const ROW_H = 36;
// const HEADER_H = 36;
// const LEFT_W = 200;
// const LIST_MAX_H = 520;

// const intersectsDay = (booking: Booking, day: Date) => {
//   const start = parseISO(booking.start_at);
//   const end = parseISO(booking.end_at);
//   return (
//     isSameDay(day, start) ||
//     isSameDay(day, end) ||
//     isWithinInterval(day, { start, end })
//   );
// };

// export default function CalendarPage() {
//   const location = useLocation();
//   const navigate = useNavigate();
//   const navigation = useNavigation();

//   const fetcher = useFetcher();

//   const prefetchMonth = (m: Date) => {
//     const iso = startOfMonth(m).toISOString();
//     fetcher.load(`/calendar?month=${encodeURIComponent(iso)}`);
//   };

//   const isSelfLoading =
//     navigation.state !== "idle" &&
//     navigation.location?.pathname === "/calendar" &&
//     navigation.location?.search !== location.search;

//   const loaderData = useLoaderData<CalendarLoaderData>();

//   const [month, setMonth] = useState<Date>(
//     startOfMonth(new Date(loaderData?.monthISO ?? new Date().toISOString()))
//   );

//   const [cars, setCars] = useState<CarWithBookings[]>(
//     (loaderData?.cars as CarWithBookings[]) ?? []
//   );

//   const [visibleMonth, setVisibleMonth] = useState<Date>(month);

//   const rangeStart = useMemo(() => startOfMonth(addMonths(month, -1)), [month]);
//   const rangeEnd = useMemo(() => endOfMonth(addMonths(month, 1)), [month]);
//   const days = useMemo(
//     () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
//     [rangeStart, rangeEnd]
//   );

//   const today = startOfDay(new Date());

//   const rightScrollRef = useRef<HTMLDivElement | null>(null);
//   const leftListRef = useRef<List>(null);
//   const rightListRef = useRef<List>(null);
//   const syncingRef = useRef(false);
//   const didInitScrollRef = useRef(false);
//   const pendingCenterOnDateRef = useRef<Date | null>(null);

//   const [popover, setPopover] = useState<{
//     booking: Booking | null;
//     rect: { x: number; y: number; w: number; h: number } | null;
//   }>({ booking: null, rect: null });

//   const closePopover = () => setPopover({ booking: null, rect: null });

//   const listHeight = Math.min(cars.length * ROW_H, LIST_MAX_H);

//   useEffect(() => {
//     if (!popover.booking) return;
//     const onKey = (e: KeyboardEvent) => {
//       if (e.key === "Escape") closePopover();
//     };
//     const onClick = (e: MouseEvent) => {
//       const el = document.getElementById("booking-popover");
//       if (el && !el.contains(e.target as Node)) closePopover();
//     };
//     const onScrollOrResize = () => closePopover();
//     document.addEventListener("keydown", onKey);
//     document.addEventListener("mousedown", onClick);
//     window.addEventListener("scroll", onScrollOrResize, { passive: true });
//     window.addEventListener("resize", onScrollOrResize, { passive: true });
//     return () => {
//       document.removeEventListener("keydown", onKey);
//       document.removeEventListener("mousedown", onClick);
//       window.removeEventListener("scroll", onScrollOrResize);
//       window.removeEventListener("resize", onScrollOrResize);
//     };
//   }, [popover.booking]);

//   useEffect(() => {
//     if (!loaderData) return;
//     setMonth(startOfMonth(new Date(loaderData.monthISO)));
//     setCars((loaderData.cars as CarWithBookings[]) ?? []);
//   }, [loaderData]);

//   const DAY_MS = 24 * 60 * 60 * 1000;
//   const dayIndexFromRangeStart = (d: Date) =>
//     Math.floor((+startOfDay(d) - +startOfDay(rangeStart)) / DAY_MS);

//   const scrollToDate = (d: Date) => {
//     const el = rightScrollRef.current;
//     if (!el) return;
//     const idx = dayIndexFromRangeStart(d);
//     const left = idx * COL_W - el.clientWidth / 2 + COL_W / 2;
//     el.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
//   };

//   useEffect(() => {
//     if (didInitScrollRef.current) return;
//     const el = rightScrollRef.current;
//     if (!el || days.length === 0) return;

//     // ждём первый layout
//     const r = requestAnimationFrame(() => {
//       const monthStart = startOfMonth(month);
//       const isCurrent = isSameMonth(monthStart, new Date());

//       const anchorDate = isCurrent ? new Date() : monthStart;

//       // ищем ЯЧЕЙКУ «anchorDate» в массиве days (у тебя это три месяца: prev, current, next)
//       const idx = days.findIndex((d) => isSameDay(d, startOfDay(anchorDate)));
//       if (idx === -1) return;

//       // центрируем эту ячейку
//       const left = idx * COL_W - (el.clientWidth - COL_W) / 2;
//       el.scrollLeft = Math.max(0, left);

//       setVisibleMonth(monthStart);
//       didInitScrollRef.current = true;
//     });

//     return () => cancelAnimationFrame(r);
//   }, [days, month]);

//   // 2) ПОСЛЕДУЮЩИЕ СМЕНЫ МЕСЯЦА (Prev/Next/GoToMonth):
//   //    возвращаем прежнее поведение — ставим ЛЕВЫЙ край на начало месяца.
//   useEffect(() => {
//     if (!didInitScrollRef.current) return; // пропускаем первый рендер
//     const el = rightScrollRef.current;
//     if (!el || days.length === 0) return;

//     const monthStart = startOfMonth(month);

//     // если ждали центрирование конкретной даты (кнопка Today из другого месяца)
//     const pending = pendingCenterOnDateRef.current;
//     if (pending && isSameMonth(monthStart, pending)) {
//       const idx = days.findIndex((d) => isSameDay(d, startOfDay(pending)));
//       if (idx !== -1) {
//         const left = idx * COL_W - (el.clientWidth - COL_W) / 2;
//         el.scrollLeft = Math.max(0, left);
//         setVisibleMonth(monthStart);
//       }
//       pendingCenterOnDateRef.current = null; // сброс
//       return;
//     }

//     // стандартное поведение: поставить левый край на начало месяца
//     const idx = days.findIndex((d) => isSameDay(d, monthStart));
//     if (idx !== -1) {
//       el.scrollLeft = idx * COL_W;
//       setVisibleMonth(monthStart);
//     }
//   }, [month, days.length]);

//   const goToMonthSmooth = (m: Date) => {
//     const mStart = startOfMonth(m);
//     const iso = mStart.toISOString();

//     // a) обновляем URL (для истории/шеринга), но loader не перезапустится из-за shouldRevalidate
//     navigate({
//       pathname: "/calendar",
//       search: `?month=${encodeURIComponent(iso)}`,
//     });

//     // b) локально переключаемся на месяц (перерисовка сетки без размонтирования)
//     setMonth(mStart);

//     // c) подгружаем данные для окна [-1, 0, +1] месяцев — тем же роут-лоадером, но через fetcher
//     fetcher.load(`/calendar?month=${encodeURIComponent(iso)}`);
//   };

//   const handleToday = () => {
//     const targetMonth = startOfMonth(new Date());
//     if (isSameMonth(month, targetMonth)) {
//       scrollToDate(new Date()); // центрируем именно сегодня
//       setVisibleMonth(targetMonth);
//     } else {
//       pendingCenterOnDateRef.current = new Date();
//       goToMonthSmooth(targetMonth);
//       // goToMonth(targetMonth); // если другой месяц — как и сейчас
//     }
//   };

//   useEffect(() => {
//     if (fetcher.state === "idle" && fetcher.data) {
//       const data = fetcher.data as CalendarLoaderData;
//       setCars(data.cars ?? []);
//       // month мы уже выставили в goToMonthSmooth — тут повторно трогать не нужно
//     }
//   }, [fetcher.state, fetcher.data]);

//   useEffect(() => {
//     const el = rightScrollRef.current;
//     if (!el) return;

//     let raf = 0;
//     const update = () => {
//       const center = el.scrollLeft + el.clientWidth / 2;
//       let idx = Math.floor(center / COL_W);
//       if (idx < 0) idx = 0;
//       if (idx > days.length - 1) idx = days.length - 1;
//       const d = days[idx];
//       if (!d) return;
//       const m = startOfMonth(d);
//       setVisibleMonth((prev) => (isSameMonth(prev, m) ? prev : m));
//     };

//     const onScroll = () => {
//       if (popover.booking) closePopover();
//       if (raf) cancelAnimationFrame(raf);
//       raf = requestAnimationFrame(update);
//     };

//     update();
//     el.addEventListener("scroll", onScroll, { passive: true });

//     const onResize = () => update();
//     window.addEventListener("resize", onResize, { passive: true });

//     return () => {
//       el.removeEventListener("scroll", onScroll);
//       window.removeEventListener("resize", onResize);
//       if (raf) cancelAnimationFrame(raf);
//     };
//   }, [days, popover.booking]);

//   const rowBars = (bookings: Booking[]) => {
//     const relevant = bookings.filter((b) => {
//       const s = parseISO(b.start_at);
//       const e = parseISO(b.end_at);
//       const inRange = !(e < rangeStart || s > rangeEnd);
//       if (!inRange) return false;
//       if (b.mark === "block" || b.status === "block") return true;
//       const canceled =
//         b.status === "canceledHost" || b.status === "canceledClient";
//       return !canceled;
//     });

//     const bars: { booking: Booking; left: number; span: number }[] = [];
//     for (const b of relevant) {
//       const firstIdx = days.findIndex((d) => intersectsDay(b, d));
//       if (firstIdx === -1) continue;
//       let lastIdx = firstIdx;
//       for (let i = firstIdx + 1; i < days.length; i++) {
//         if (intersectsDay(b, days[i])) lastIdx = i;
//         else break;
//       }
//       bars.push({ booking: b, left: firstIdx, span: lastIdx - firstIdx + 1 });
//     }
//     return bars;
//   };

//   const LeftRow = ({
//     index,
//     style,
//   }: {
//     index: number;
//     style: React.CSSProperties;
//   }) => (
//     <div
//       style={{ ...style, height: ROW_H }}
//       className="px-3 flex items-center whitespace-nowrap overflow-hidden text-sm text-ellipsis border-b border-gray-100"
//       title={cars[index]?.name}
//     >
//       {cars[index]?.name}
//     </div>
//   );

//   const RightRow = ({
//     index,
//     style,
//   }: {
//     index: number;
//     style: React.CSSProperties;
//   }) => {
//     const car = cars[index];
//     const bars = rowBars(car?.bookings ?? []);
//     return (
//       <div
//         style={{ ...style, height: ROW_H }}
//         className="relative border-b border-gray-100"
//       >
//         {/* фон-сетка НЕ перехватывает клики */}
//         <div
//           className="grid absolute inset-0 pointer-events-none"
//           style={{ gridTemplateColumns: `repeat(${days.length}, ${COL_W}px)` }}
//         >
//           {days.map((d) => {
//             const weekend = isWeekend(d);
//             const isEndOfMonth = addDays(d, 1).getDate() === 1;
//             const monthSep = isEndOfMonth ? "border-r border-gray-400" : "";
//             const todayBg = isSameDay(d, today) ? "bg-amber-100/70" : "";
//             const weekendBg = weekend ? "bg-slate-50" : "";
//             return (
//               <div
//                 key={d.toISOString()}
//                 className={`border-r border-gray-200 ${monthSep} ${weekendBg} ${todayBg}`}
//               />
//             );
//           })}
//         </div>

//         {/* бары */}
//         {bars.map(({ booking, left, span }) => {
//           const leftPx = left * COL_W;
//           const widthPx = span * COL_W - 8;

//           const isBlock =
//             booking.mark === "block" || booking.status === "block";

//           let colorClass = "";
//           let ringClass = "";

//           if (isBlock) {
//             colorClass = "bg-red-500/80";
//             ringClass = "focus-visible:ring-red-400";
//           } else if (booking.status === "rent") {
//             colorClass = "bg-green-500/80";
//             ringClass = "focus-visible:ring-lime-400";
//           } else if (booking.status === "finished") {
//             colorClass = "bg-gray-400/80";
//             ringClass = "focus-visible:ring-gray-400";
//           } else if (
//             booking.status === "onApproval" ||
//             booking.status === "confirmed"
//           ) {
//             colorClass = "bg-orange-400";
//             ringClass = "focus-visible:ring-orange-400";
//           } else {
//             colorClass = "bg-green-500/80";
//             ringClass = "focus-visible:ring-lime-400";
//           }

//           const url = `/calendar/bookings/${booking.id}`;

//           return (
//             <Link
//               key={booking.id}
//               to={url}
//               onClick={async (e) => {
//                 if (e.metaKey || e.ctrlKey) return;

//                 e.preventDefault();

//                 // Сохраняем ссылку и геометрию ДО await
//                 const target = e.currentTarget as HTMLElement;
//                 const rect = target.getBoundingClientRect();
//                 if (!rect) return;

//                 // Подтягиваем данные
//                 const [fullRes, extrasRes, userRes] = await Promise.allSettled([
//                   fetchBookingById(booking.id),
//                   fetchBookingExtras(booking.id),
//                   booking.user_id
//                     ? getUserById(booking.user_id).catch(() => null)
//                     : Promise.resolve(null),
//                 ]);

//                 const full =
//                   fullRes.status === "fulfilled" ? fullRes.value : booking;
//                 const extras =
//                   extrasRes.status === "fulfilled" ? extrasRes.value : [];
//                 const user =
//                   userRes.status === "fulfilled" ? userRes.value : null;

//                 setPopover({
//                   booking: {
//                     ...(full as any),
//                     ...(user ? { user } : {}),
//                     extras,
//                   } as any,
//                   rect: {
//                     x: rect.left,
//                     y: rect.top,
//                     w: rect.width,
//                     h: rect.height,
//                   },
//                 });
//               }}
//               className={`absolute z-10 top-1/2 -translate-y-1/2 h-5 rounded-xl shadow px-2 text-[10px] leading-5 text-white truncate
//                 ${colorClass}
//                 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${ringClass}`}
//               style={{ left: leftPx + 4, width: widthPx }}
//               onKeyDown={(e) => {
//                 if (e.key === " ") e.preventDefault();
//               }}
//               aria-label={`${
//                 isBlock ? "Blocked period" : "Booking"
//               } from ${format(
//                 parseISO(booking.start_at),
//                 "dd MMM yyyy, HH:mm"
//               )} to ${format(parseISO(booking.end_at), "dd MMM yyyy, HH:mm")}`}
//             >
//               {format(parseISO(booking.start_at), "dd MMM")} →{" "}
//               {format(parseISO(booking.end_at), "dd MMM")}
//             </Link>
//           );
//         })}
//       </div>
//     );
//   };

//   const onLeftScroll = ({ scrollOffset }: any) => {
//     if (syncingRef.current) return;
//     syncingRef.current = true;
//     rightListRef.current?.scrollTo(scrollOffset);
//     syncingRef.current = false;
//     closePopover();
//   };
//   const onRightScroll = ({ scrollOffset }: any) => {
//     if (syncingRef.current) return;
//     syncingRef.current = true;
//     leftListRef.current?.scrollTo(scrollOffset);
//     syncingRef.current = false;
//     closePopover();
//   };

//   return (
//     <div className="w-full">
//       <div className="flex items-center justify-between mb-3">
//         <div className="flex items-center gap-2">
//           <button
//             className="px-3 py-1 text-sm border rounded"
//             onClick={() => goToMonthSmooth(addMonths(month, -1))}
//             onMouseEnter={() =>
//               fetcher.load(
//                 `/calendar?month=${encodeURIComponent(
//                   startOfMonth(addMonths(month, -1)).toISOString()
//                 )}`
//               )
//             }
//             disabled={isSelfLoading}
//           >
//             Prev
//           </button>
//           <button
//             className="px-3 py-1 text-sm border rounded"
//             onClick={() => goToMonthSmooth(addMonths(month, 1))}
//             onMouseEnter={() =>
//               fetcher.load(
//                 `/calendar?month=${encodeURIComponent(
//                   startOfMonth(addMonths(month, 1)).toISOString()
//                 )}`
//               )
//             }
//             disabled={isSelfLoading}
//           >
//             Next
//           </button>
//           <button
//             className="px-3 py-1 text-sm border rounded"
//             onClick={handleToday}
//             onMouseEnter={() => prefetchMonth(new Date())}
//             disabled={isSelfLoading}
//           >
//             Today
//           </button>
//         </div>
//         <div className="flex items-center gap-4 text-xs text-gray-600">
//           <span className="inline-flex items-center gap-1">
//             <span className="inline-block w-3 h-3 rounded bg-green-500/80" />{" "}
//             booking
//           </span>
//           <span className="inline-flex items-center gap-1">
//             <span className="inline-block w-3 h-3 rounded bg-red-500/80" />{" "}
//             block
//           </span>
//         </div>
//       </div>

//       <div className="border overflow-hidden">
//         <div className="flex">
//           <div
//             className="flex-none border-r border-gray-200"
//             style={{ width: LEFT_W }}
//           >
//             <div
//               className="sticky top-0 z-20 bg-white border-b border-gray-200 px-3 flex items-center"
//               style={{ height: HEADER_H }}
//             >
//               {format(visibleMonth, "LLLL yyyy")}
//             </div>
//             {isSelfLoading ? (
//               <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>
//             ) : (
//               <List
//                 height={listHeight}
//                 width={LEFT_W}
//                 itemCount={cars.length}
//                 itemSize={ROW_H}
//                 onScroll={onLeftScroll}
//                 ref={leftListRef}
//               >
//                 {LeftRow as any}
//               </List>
//             )}
//           </div>

//           <div className="flex-1 overflow-x-auto" ref={rightScrollRef}>
//             <div style={{ width: days.length * COL_W }}>
//               <div
//                 className="sticky top-0 z-20 bg-white border-b border-gray-200 border-r"
//                 style={{ height: HEADER_H }}
//               >
//                 <div
//                   className="grid h-full"
//                   style={{
//                     gridTemplateColumns: `repeat(${days.length}, ${COL_W}px)`,
//                   }}
//                 >
//                   {days.map((d) => {
//                     const weekend = isWeekend(d);
//                     const isEndOfMonth = addDays(d, 1).getDate() === 1;
//                     const monthSep = isEndOfMonth
//                       ? "border-r border-gray-400"
//                       : "";
//                     const todayBg = isSameDay(d, today)
//                       ? "bg-amber-100/70"
//                       : "";
//                     const weekendBg = weekend ? "bg-slate-50" : "";
//                     return (
//                       <div
//                         key={d.toISOString()}
//                         className={`border-r border-gray-200 ${monthSep} ${weekendBg} ${todayBg} text-[10px] text-gray-600 flex flex-col items-center justify-center h-full`}
//                       >
//                         <div className="leading-none">{format(d, "dd")}</div>
//                         <div className="leading-none">{format(d, "EEE")}</div>
//                       </div>
//                     );
//                   })}
//                 </div>
//                 <div className="absolute right-0 top-0 bottom-0 border-l border-gray-200 pointer-events-none" />
//               </div>

//               {isSelfLoading ? (
//                 <div className="p-6 text-sm text-gray-500">Loading…</div>
//               ) : cars.length === 0 ? (
//                 <div className="p-6 text-sm text-gray-500">Нет автомобилей</div>
//               ) : (
//                 <List
//                   height={listHeight}
//                   width={days.length * COL_W}
//                   itemCount={cars.length}
//                   itemSize={ROW_H}
//                   onScroll={onRightScroll}
//                   ref={rightListRef}
//                 >
//                   {RightRow as any}
//                 </List>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>

//       {popover.booking &&
//         popover.rect &&
//         (() => {
//           const b = popover.booking as Booking & { user?: any; extras?: any[] };
//           const start = parseISO(b.start_at);
//           const end = parseISO(b.end_at);
//           const displayId = b?.id?.slice(0, 8)?.toUpperCase?.() ?? "";
//           const mins = Math.max(0, differenceInMinutes(end, start));
//           const dDays = Math.floor(mins / 1440);
//           const dHours = Math.floor((mins % 1440) / 60);
//           const currency = (b as any)?.currency ?? "EUR";
//           const userName = (b as any)?.user?.full_name ?? null;
//           const userPhone = (b as any)?.user?.phone ?? null;

//           // позиционирование: под/над прямоугольником бара с ограничением экрана
//           const padding = 8;
//           const popW = 280; // целевая ширина
//           const popH = 180; // примерная высота (хватает под контент)
//           const viewportW = window.innerWidth;
//           const viewportH = window.innerHeight;

//           let left = popover.rect.x + popover.rect.w / 2 - popW / 2;
//           left = Math.max(padding, Math.min(left, viewportW - popW - padding));

//           // пробуем показать снизу; если не влезает — сверху
//           let top = popover.rect.y + popover.rect.h + 6;
//           if (top + popH + padding > viewportH) {
//             top = popover.rect.y - popH - 6;
//           }

//           return (
//             <div
//               id="booking-popover"
//               className="fixed z-50 px-3 py-2 rounded-md border bg-white text-xs shadow-lg w-[280px]"
//               style={{ left, top }}
//               role="dialog"
//               aria-modal="true"
//             >
//               <div className="flex items-start justify-between gap-3 mb-1">
//                 <div className="font-medium">Бронирование №{displayId}</div>
//                 <button
//                   className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100"
//                   onClick={closePopover}
//                   aria-label="Закрыть"
//                 >
//                   ×
//                 </button>
//               </div>

//               <div className="mb-1">
//                 {format(start, "dd MMM yyyy, HH:mm")} →{" "}
//                 {format(end, "dd MMM yyyy, HH:mm")}
//               </div>
//               <div className="mb-1 text-gray-700">
//                 Длительность: {dDays} дн. {dHours} ч.
//               </div>
//               {b.price_total != null && (
//                 <div className="mb-1 font-medium">
//                   Итого: {b.price_total}
//                   {currency && ` ${currency}`}
//                 </div>
//               )}
//               {(userName || userPhone) && (
//                 <div className="mt-1 text-gray-700">
//                   {userName ?? "—"}
//                   {userPhone ? `, ${userPhone}` : ""}
//                 </div>
//               )}

//               {/* Пример: быстрые действия */}
//               <div className="mt-2 flex justify-end items-center gap-2">
//                 <button
//                   className="px-2 py-1 border rounded hover:bg-gray-50"
//                   onClick={closePopover}
//                 >
//                   Закрыть
//                 </button>
//                 <button
//                   className="px-2 py-1 border rounded hover:bg-gray-50"
//                   onClick={() => {
//                     const url = `/cars/${b.car_id}/bookings/${b.id}/edit`;
//                     navigate(url, {
//                       state: {
//                         snapshot: {
//                           booking: b,
//                           booking_extras: b.extras ?? [],
//                         },
//                         from: location.pathname + location.search,
//                       },
//                     });
//                     closePopover();
//                   }}
//                 >
//                   Открыть
//                 </button>
//               </div>
//             </div>
//           );
//         })()}
//     </div>
//   );
// }
