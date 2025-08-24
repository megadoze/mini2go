import { useEffect, useMemo, useRef, useState } from "react";
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
import { useNavigate } from "react-router";
import { FixedSizeList as List } from "react-window";
import type { Booking } from "@/types/booking";
import { fetchCars } from "@/services/car.service";
import { fetchBookingsByCarId } from "../car/calendar/calendar.service";
import { getUserById } from "@/services/user.service";

export type CarLite = { id: string; name: string };
export type CarWithBookings = CarLite & { bookings: Booking[] };

// --- константы
const COL_W = 32; // px ширина дня
const ROW_H = 36; // px высота строки
const HEADER_H = 36; // px высота хедера
const LEFT_W = 200; // px ширина левой колонки
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

export default function GanttCalendarAllCars() {
  const navigate = useNavigate();

  const isPointerFocus = useRef(false);

  // Базовый месяц (по умолчанию текущий)
  const [month, setMonth] = useState<Date>(startOfMonth(new Date()));
  // Месяц, который сейчас «в кадре» по горизонтальному скроллу
  const [visibleMonth, setVisibleMonth] = useState<Date>(month);

  // Диапазон ВСЕГДА: -1, 0, +1 от базового
  const rangeStart = useMemo(() => startOfMonth(addMonths(month, -1)), [month]);
  const rangeEnd = useMemo(() => endOfMonth(addMonths(month, 1)), [month]);
  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd]
  );

  const [cars, setCars] = useState<CarWithBookings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hovered, setHovered] = useState<{
    booking: Booking | null;
    x: number;
    y: number;
  }>({ booking: null, x: 0, y: 0 });

  const [hoveredUser, setHoveredUser] = useState<any | null>(null);

  const today = startOfDay(new Date());

  // ЕДИНЫЙ горизонтальный скролл для правой части (хедер + тело)
  const rightScrollRef = useRef<HTMLDivElement | null>(null);

  // Виртуализация: синхронный вертикальный скролл левой/правой частей
  const leftListRef = useRef<List>(null);
  const rightListRef = useRef<List>(null);
  const syncingRef = useRef(false);

  const listHeight = Math.min(cars.length * ROW_H, LIST_MAX_H);

  useEffect(() => {
    const b = hovered.booking;
    if (!b?.user_id) {
      setHoveredUser(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const u = await getUserById(b.user_id || "");
        if (!cancelled) setHoveredUser(u ?? null);
      } catch {
        if (!cancelled) setHoveredUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hovered.booking?.user_id]);

  // --- ВАЖНО: автоскролл к началу базового месяца + обновление visibleMonth
  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;
    const ix = days.findIndex((d) => isSameDay(d, startOfMonth(month)));
    if (ix >= 0) {
      el.scrollLeft = ix * COL_W;
      setVisibleMonth(startOfMonth(month)); // сразу показать правильный заголовок
    }
  }, [month, days]);

  // Обновление visibleMonth при горизонтальном скролле (берём день в ЦЕНТРЕ вьюпорта)
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
      if (hovered.booking) setHovered({ booking: null, x: 0, y: 0 });

      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    // init (на случай ресайза/первой отрисовки)
    update();
    el.addEventListener("scroll", onScroll, { passive: true });

    // при ресайзе тоже пересчитаем центр
    const onResize = () => update();
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [days]);

  // Данные
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rawCars = await fetchCars();
        const lite: CarLite[] = rawCars
          .filter(
            (c): c is typeof c & { id: string } =>
              typeof c.id === "string" && c.id.length > 0
          )
          .map((c, i) => {
            const brand = c.models?.brands?.name ?? "";
            const model = c.models?.name ?? "";
            const plate = c.licensePlate ?? "";
            return {
              id: c.id,
              name:
                [brand, model, plate].filter(Boolean).join(" ") ||
                `Car ${i + 1}`,
            };
          });

        const carsWithBookings: CarWithBookings[] = await Promise.all(
          lite.map(async (c) => {
            const items: Booking[] = (await fetchBookingsByCarId(c.id)) ?? [];
            const filtered = items.filter((b) => {
              const s = parseISO(b.start_at);
              const e = parseISO(b.end_at);
              return !(e < rangeStart || s > rangeEnd);
            });
            return { ...c, bookings: filtered };
          })
        );

        if (!mounted) return;
        setCars(carsWithBookings);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Не удалось загрузить список авто");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [rangeStart, rangeEnd]);

  // Построение баров
  const rowBars = (bookings: Booking[]) => {
    const relevant = bookings.filter((b) => {
      const s = parseISO(b.start_at);
      const e = parseISO(b.end_at);
      const inRange = !(e < rangeStart || s > rangeEnd);
      if (!inRange) return false;

      // оставляем блоки всегда
      if (b.mark === "block" || b.status === "block") return true;

      // убираем отменённые
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

  // Рендер строки слева (виртуализация)
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

  // Рендер строки справа (виртуализация)
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
        {/* сетка дней фоном */}
        <div
          className="grid absolute inset-0"
          style={{ gridTemplateColumns: `repeat(${days.length}, ${COL_W}px)` }}
        >
          {days.map((d) => {
            const weekend = isWeekend(d);
            // разделитель ставим на ПРАВОЙ границе последнего дня месяца
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

          // 🎨 цвет бара по статусу
          let colorClass = "";
          let ringClass = "";

          if (isBlock) {
            colorClass = "bg-red-500/80 hover:bg-red-500";
            ringClass = "focus-visible:ring-red-400";
          } else if (booking.status === "rent") {
            colorClass = "bg-green-500/80 hover:bg-green-500";
            ringClass = "focus-visible:ring-lime-400";
          } else if (booking.status === "finished") {
            colorClass = "bg-gray-400/80 hover:bg-gray-400";
            ringClass = "focus-visible:ring-gray-400";
          } else if (
            booking.status === "onApproval" ||
            booking.status === "confirmed"
          ) {
            colorClass = "bg-orange-400 hover:bg-orange-500";
            ringClass = "focus-visible:ring-orange-400";
          } else {
            // дефолт на всякий
            colorClass = "bg-green-500/80 hover:bg-green-500";
            ringClass = "focus-visible:ring-lime-400";
          }

          return (
            <button
              key={booking.id}
              type="button"
              className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-xl shadow px-2 text-[10px] leading-5 text-white truncate
        ${colorClass}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${ringClass}`}
              style={{ left: leftPx + 4, width: widthPx }}
              onClick={() =>
                navigate(`/cars/${booking.car_id}/bookings/${booking.id}/edit`)
              }
              onPointerDown={() => {
                isPointerFocus.current = true;
              }}
              onPointerUp={() => {
                setTimeout(() => (isPointerFocus.current = false), 0);
              }}
              title={`${isBlock ? "Blocked" : "Booking"}: ${format(
                parseISO(booking.start_at),
                "dd MMM"
              )} → ${format(parseISO(booking.end_at), "dd MMM")}`}
              onMouseEnter={(e) => {
                const r = (
                  e.currentTarget as HTMLElement
                ).getBoundingClientRect();
                setHovered({ booking, x: r.left + r.width / 2, y: r.top });
              }}
              onMouseLeave={() => setHovered({ booking: null, x: 0, y: 0 })}
              onKeyDown={(e) => {
                if (e.key === " ") e.preventDefault();
              }}
              onFocus={(e) => {
                if (isPointerFocus.current) return;
                requestAnimationFrame(() => {
                  const el = e.currentTarget as HTMLElement;
                  if (document.activeElement !== el) return;
                  const r = el.getBoundingClientRect();
                  setHovered({ booking, x: r.left + r.width / 2, y: r.top });
                });
              }}
              onBlur={() => setHovered({ booking: null, x: 0, y: 0 })}
              aria-label={`${
                isBlock ? "Blocked period" : "Booking"
              } from ${format(
                parseISO(booking.start_at),
                "dd MMM yyyy, HH:mm"
              )} to ${format(parseISO(booking.end_at), "dd MMM yyyy, HH:mm")}`}
            >
              {format(parseISO(booking.start_at), "dd MMM")} →{" "}
              {format(parseISO(booking.end_at), "dd MMM")}
            </button>
          );
        })}
      </div>
    );
  };

  // синхронизация вертикального скролла двух списков
  const onLeftScroll = ({ scrollOffset }: any) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    rightListRef.current?.scrollTo(scrollOffset);
    syncingRef.current = false;
  };
  const onRightScroll = ({ scrollOffset }: any) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    leftListRef.current?.scrollTo(scrollOffset);
    syncingRef.current = false;
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 text-sm border rounded"
            onClick={() => setMonth((m) => addMonths(m, -1))}
          >
            Prev
          </button>
          <button
            className="px-3 py-1 text-sm border rounded"
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            Next
          </button>
          <button
            className="px-3 py-1 text-sm border rounded"
            onClick={() => setMonth(startOfMonth(new Date()))}
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
        </div>
      </div>

      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

      <div className="border  overflow-hidden">
        <div className="flex">
          {/* Левая колонка — не скроллится по X, липкая по Y */}
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
            {loading ? (
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

          {/* Правая область (хедер+тело) — единый X-scroll и виртуализация по Y */}
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

              {loading ? (
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

      {/* Tooltip */}
      {hovered.booking &&
        (() => {
          const b = hovered.booking;
          const start = parseISO(b.start_at);
          const end = parseISO(b.end_at);

          const displayId = b?.id.slice(0, 8).toUpperCase();

          // длительность
          const mins = Math.max(0, differenceInMinutes(end, start));
          const days = Math.floor(mins / 1440);
          const hours = Math.floor((mins % 1440) / 60);

          // деньги
          const currency =
            (b as any)?.effectiveCurrency ?? (b as any)?.currency ?? "EUR";

          // клиент
          const userName = hoveredUser?.full_name ?? null;
          const userPhone = hoveredUser?.phone ?? null;

          return (
            <div
              className="fixed z-50 pointer-events-none px-3 py-2 rounded-md border bg-white text-xs shadow-md max-w-xs"
              style={{ left: hovered.x + 8, top: hovered.y - 8 }}
            >
              <div className="font-medium mb-1">
                Бронирование&nbsp;№{displayId}
              </div>

              <div className="mb-1">
                {format(start, "dd MMM yyyy, HH:mm")} →{" "}
                {format(end, "dd MMM yyyy, HH:mm")}
              </div>

              <div className="mb-1 text-gray-700">
                Длительность: {days} дн. {hours} ч.
              </div>

              {b.price_total != null && (
                <div className="mb-1 font-medium">
                  Итого: {b.price_total}
                  {currency && ` ${currency}`}
                </div>
              )}

              {(userName || userPhone) && (
                <div className="mt-1 text-gray-700">
                  Клиент: {userName ?? "—"}
                  {userPhone ? `, ${userPhone}` : ""}
                </div>
              )}
            </div>
          );
        })()}
    </div>
  );
}
