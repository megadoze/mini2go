import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Select, Popover } from "@mantine/core";
import {
  eachDayOfInterval,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isWithinInterval,
  differenceInMinutes,
  isBefore,
  startOfDay,
} from "date-fns";
import { useCarContext } from "@/context/carContext";
import type { Booking } from "@/types/booking";
import {
  createBooking,
  deleteBooking,
  fetchBookingsByCarId,
} from "./calendar.service";
import { getUserById } from "@/services/user.service";
import type { BookingEditorSnapshot } from "@/types/booking-ui";
import { fetchBookingExtras } from "@/services/booking-extras.service";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QK } from "@/queryKeys";

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const hours = Math.floor((i * 30) / 60);
  const minutes = (i * 30) % 60;
  const value = hours * 100 + minutes;
  const label = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
  return { value, label };
});

type EditMode = null | "block" | "booking";

export default function Calendar() {
  const { car, setCar, effectiveCurrency, getCachedUser, setCachedUser } =
    useCarContext();

  const location = useLocation();
  const navigate = useNavigate();
  const carId = car?.id;

  const initial = car?.bookings ?? [];

  const currency = effectiveCurrency ?? "EUR";

  const today = startOfDay(new Date());
  const isPastDay = (date: Date) => isBefore(date, today);

  // локальные состояния
  const [selectedRange, setSelectedRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({ start: null, end: null });

  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null
  );
  const [editMode, setEditMode] = useState<EditMode>(null); // edit target type
  const [startTime, setStartTime] = useState("0");
  const [endTime, setEndTime] = useState("2330");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // якорь поповера (по дате)
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const keyOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const qc = useQueryClient();
  const listKey = QK.bookingsByCarId(String(carId));

  const { data: allBookings = [] } = useQuery({
    queryKey: listKey,
    queryFn: () => fetchBookingsByCarId(String(carId)),
    enabled: !!carId,
    initialData: initial,
    staleTime: 60_000,
    refetchOnMount: false,
  });

  const blockedBookings = useMemo(
    () => allBookings.filter((b) => b.mark === "block"),
    [allBookings]
  );
  const activeBookings = useMemo(
    () =>
      allBookings.filter(
        (b) =>
          b.mark === "booking" &&
          (b.status === "onApproval" ||
            b.status === "rent" ||
            b.status === "confirmed" ||
            b.status === "finished")
      ),
    [allBookings]
  );

  // дни
  const bookedDays = useMemo(
    () =>
      activeBookings.flatMap((b) =>
        eachDayOfInterval({
          start: parseISO(b.start_at),
          end: parseISO(b.end_at),
        })
      ),
    [activeBookings]
  );
  const blockedDays = useMemo(
    () =>
      blockedBookings.flatMap((b) =>
        eachDayOfInterval({
          start: parseISO(b.start_at),
          end: parseISO(b.end_at),
        })
      ),
    [blockedBookings]
  );

  const isBooked = (date: Date) => bookedDays.some((d) => isSameDay(d, date));
  const isBlocked = (date: Date) => blockedDays.some((d) => isSameDay(d, date));

  // текущие выбранные объекты
  const selectedBlock =
    blockedBookings.find((b) => b.id === selectedBlockId) || null;
  const selectedBooking =
    activeBookings.find((b) => b.id === selectedBookingId) || null;

  // поиск по дате
  const findBlockByDate = (date: Date) =>
    blockedBookings.find((b) => {
      const start = parseISO(b.start_at);
      const end = parseISO(b.end_at);
      return (
        isSameDay(date, start) ||
        isSameDay(date, end) ||
        isWithinInterval(date, { start, end })
      );
    });

  const findBookingByDate = (date: Date) =>
    activeBookings.find((b) => {
      const start = parseISO(b.start_at);
      const end = parseISO(b.end_at);
      return (
        isSameDay(date, start) ||
        isSameDay(date, end) ||
        isWithinInterval(date, { start, end })
      );
    });

  // пул занятых дат c учётом редактирования (исключаем сам редактируемый объект)
  const unavailableDatesPool = useMemo(() => {
    const pool: Date[] = [];
    // брони
    activeBookings.forEach((b) => {
      if (editMode === "booking" && selectedBooking?.id === b.id) return; // исключаем редактируемую бронь
      pool.push(
        ...eachDayOfInterval({
          start: parseISO(b.start_at),
          end: parseISO(b.end_at),
        })
      );
    });
    // блоки
    blockedBookings.forEach((b) => {
      if (editMode === "block" && selectedBlock?.id === b.id) return; // исключаем редактируемый блок
      pool.push(
        ...eachDayOfInterval({
          start: parseISO(b.start_at),
          end: parseISO(b.end_at),
        })
      );
    });
    return pool;
  }, [
    activeBookings,
    blockedBookings,
    editMode,
    selectedBlock,
    selectedBooking,
  ]);

  const isUnavailable = (date: Date) =>
    unavailableDatesPool.some((d) => isSameDay(d, date));

  // ограничители выбора (первый занятый день до/после)
  const firstUnavailableAfterStart = useMemo(() => {
    if (!selectedRange.start || selectedRange.end) return null;
    const sorted = unavailableDatesPool
      .filter((d) => d > selectedRange.start!)
      .sort((a, b) => a.getTime() - b.getTime());
    return sorted[0] ?? null;
  }, [unavailableDatesPool, selectedRange.start, selectedRange.end]);

  const firstUnavailableBeforeStart = useMemo(() => {
    if (!selectedRange.start || selectedRange.end) return null;
    const sorted = unavailableDatesPool
      .filter((d) => d < selectedRange.start!)
      .sort((a, b) => b.getTime() - a.getTime());
    return sorted[0] ?? null;
  }, [unavailableDatesPool, selectedRange.start, selectedRange.end]);

  // навигация месяцев
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // открыть карточку, если клик по существующей записи
  const openIfExisting = (date: Date) => {
    if (!editMode) {
      const block = findBlockByDate(date);
      if (block) {
        setSelectedBlockId(block.id);
        setSelectedBookingId(null);
        setSelectedRange({ start: null, end: null });
        setAnchorKey(keyOf(date));
        return true;
      }
      const booking = findBookingByDate(date);
      if (booking) {
        setSelectedBookingId(booking.id);
        setSelectedBlockId(null);
        setSelectedRange({ start: null, end: null });
        setAnchorKey(keyOf(date));
        return true;
      }
    }
    return false;
  };

  // выбор даты
  const handleSelect = (date: Date) => {
    // при клике на существующий блок/бронь — карточка над датой
    if (!editMode) {
      if (openIfExisting(date)) return;
    }

    // обычный/редакционный выбор диапазона
    if (!selectedRange.start || (selectedRange.start && selectedRange.end)) {
      setSelectedRange({ start: date, end: null });
      setSelectedBookingId(null);
      setSelectedBlockId(null);
      // поповер пока НЕ показываем — ждём конечную дату
      setAnchorKey(null);
    } else {
      const start = selectedRange.start;
      const range = eachDayOfInterval({
        start: date < start ? date : start,
        end: date > start ? date : start,
      });
      const hasUnavailable = range.some((d) => isUnavailable(d));

      if (hasUnavailable) {
        setSelectedRange({ start: null, end: null });
        setAnchorKey(null);
      } else {
        const next =
          date < start ? { start: date, end: start } : { start, end: date };
        setSelectedRange(next);
        setAnchorKey(keyOf(date));
      }
    }
  };

  // создания записей
  const handleBlock = async () => {
    if (!selectedRange.start || !selectedRange.end || !carId) return;

    const start = new Date(selectedRange.start);
    const end = new Date(selectedRange.end);

    const sH = Math.floor(Number(startTime) / 100);
    const sM = Number(startTime) % 100;
    start.setHours(sH, sM);

    const eH = Math.floor(Number(endTime) / 100);
    const eM = Number(endTime) % 100;
    end.setHours(eH, eM);

    const payload: Omit<Booking, "id"> = {
      car_id: carId,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      mark: "block",
      status: "block",
      user_id: null,
      price_per_day: null,
      price_total: null,
    };

    const result = await createBooking(payload);
    if (result) {
      qc.setQueryData<Booking[]>(listKey, (prev) => [result, ...(prev ?? [])]);
      setCar((prev) => ({
        ...prev,
        bookings: [...(prev?.bookings ?? []), result],
      }));
      resetSelection();
      qc.invalidateQueries({ queryKey: listKey });
    }
  };

  const handleCreateBooking = async () => {
    if (!selectedRange.start || !selectedRange.end || !carId) return;

    const start = new Date(selectedRange.start);
    const end = new Date(selectedRange.end);

    const sH = Math.floor(Number(startTime) / 100);
    const sM = Number(startTime) % 100;
    start.setHours(sH, sM);

    const eH = Math.floor(Number(endTime) / 100);
    const eM = Number(endTime) % 100;
    end.setHours(eH, eM);

    // ещё раз проверим пересечение
    const rangeDays = eachDayOfInterval({ start, end });
    if (rangeDays.some((d) => isUnavailable(d))) return;

    navigate(
      `/cars/${carId}/bookings/new?carId=${carId}&start=${encodeURIComponent(
        start.toISOString()
      )}&end=${encodeURIComponent(end.toISOString())}`
    );
  };

  // удаление
  const handleRemoveBlock = async (id: string) => {
    await deleteBooking(id);
    // оптимистично убрать из кэша
    qc.setQueryData<Booking[]>(listKey, (prev) =>
      (prev ?? []).filter((b) => b.id !== id)
    );
    setCar((prev) => ({
      ...prev,
      bookings: (prev?.bookings ?? []).filter((b) => b.id !== id),
    }));
    setSelectedBlockId(null);
    if (editMode === "block") setEditMode(null);
    qc.invalidateQueries({ queryKey: listKey });
  };

  const handleRemoveBooking = async (id: string) => {
    await deleteBooking(id);
    qc.setQueryData<Booking[]>(listKey, (prev) =>
      (prev ?? []).filter((b) => b.id !== id)
    );
    setCar((prev) => ({
      ...prev,
      bookings: (prev?.bookings ?? []).filter((b) => b.id !== id),
    }));
    setSelectedBookingId(null);
    if (editMode === "booking") setEditMode(null);
    qc.invalidateQueries({ queryKey: listKey });
  };

  // утилиты
  const resetSelection = () => {
    setSelectedRange({ start: null, end: null });
    setHoveredDate(null);
    setStartTime("0");
    setEndTime("2330");
    setAnchorKey(null);
  };

  // контент поповера
  const renderPopoverContent = (date: Date) => {
    const block = findBlockByDate(date);
    const booking = findBookingByDate(date);

    // карточка БЛОКА
    if (block && !editMode) {
      return (
        <div className="min-w-[260px] space-y-2">
          <p className="text-sm font-medium">Blocked period:</p>
          <p className="text-sm">
            {format(parseISO(block.start_at), "dd MMM yyyy, HH:mm")} →{" "}
            {format(parseISO(block.end_at), "dd MMM yyyy, HH:mm")}
          </p>
          <div className="flex gap-2 justify-end pt-1">
            {!isPastDay(parseISO(block.start_at)) && (
              <button
                onClick={() => {
                  handleRemoveBlock(block.id);
                  setAnchorKey(null);
                }}
                className="px-2 py-1 border border-gray-600 rounded text-xs"
              >
                Remove
              </button>
            )}
            <button
              className="px-2 py-1 border border-gray-400 rounded text-xs"
              onClick={() => setAnchorKey(null)}
            >
              Close
            </button>
          </div>
        </div>
      );
    }

    // карточка БРОНИ
    if (booking && !editMode) {
      const mins = differenceInMinutes(
        parseISO(booking.end_at),
        parseISO(booking.start_at)
      );
      const days = Math.floor(mins / 1440);
      const hours = Math.floor((mins % 1440) / 60);

      return (
        <div className="min-w-[280px] space-y-2">
          <p className="text-sm font-medium">Booking:</p>
          <p className="text-sm">
            {format(parseISO(booking.start_at), "dd MMM yyyy, HH:mm")} →{" "}
            {format(parseISO(booking.end_at), "dd MMM yyyy, HH:mm")} ({days} day
            {days !== 1 ? "s" : ""} {hours} hour{hours !== 1 ? "s" : ""})
          </p>
          {booking.price_total != null && (
            <p className="text-sm font-medium">
              Total: {booking.price_total} {currency}
            </p>
          )}
          <div className="flex gap-2 justify-end pt-1">
            {!isPastDay(parseISO(booking.start_at)) && (
              <button
                onClick={() => {
                  handleRemoveBooking(booking.id);
                  setAnchorKey(null);
                }}
                className="px-2 py-1 border border-gray-500 rounded text-xs"
              >
                Remove
              </button>
            )}
            <button
              className="px-2 py-1 border border-gray-400 rounded text-xs"
              onClick={() => setAnchorKey(null)}
            >
              Close
            </button>
            <button
              className="px-3 py-1 border border-lime-500 text-lime-600 rounded text-xs"
              onClick={async () => {
                const uid = booking.user_id ?? null;
                const [user, extras] = await Promise.all([
                  uid
                    ? getCachedUser?.(uid) ??
                      getUserById(uid).then((u) => {
                        setCachedUser?.(uid, u);
                        return u;
                      })
                    : Promise.resolve(null),
                  fetchBookingExtras(booking.id).catch(() => []),
                ]);

                const snapshot: BookingEditorSnapshot = {
                  booking: {
                    id: booking.id,
                    car_id: booking.car_id,
                    user_id: booking.user_id,
                    start_at: booking.start_at,
                    end_at: booking.end_at,
                    mark: booking.mark,
                    status: booking.status,
                    price_per_day: booking.price_per_day,
                    price_total: booking.price_total,
                    user,
                    deposit: (booking as any)?.deposit ?? null,
                    delivery_type:
                      (booking as any)?.delivery_type ?? "car_address",
                    delivery_fee: (booking as any)?.delivery_fee ?? 0,
                    currency: (booking as any)?.currency ?? "EUR",
                  },
                  booking_extras: Array.isArray(extras) ? extras : [],
                };

                navigate(`/cars/${car?.id}/bookings/${booking.id}/edit`, {
                  state: {
                    snapshot,
                    from: location.pathname + location.search,
                  },
                });
                setAnchorKey(null);
              }}
            >
              Edit
            </button>
          </div>
        </div>
      );
    }

    // выбор времени + действия (когда выбран диапазон)
    if (selectedRange.start && selectedRange.end) {
      return (
        <div className="min-w-[280px] space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Start time</label>
            <Select
              data={TIME_OPTIONS.map((t) => ({
                value: t.value.toString(),
                label: t.label,
              }))}
              value={startTime}
              onChange={(v) => v !== null && setStartTime(v)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End time</label>
            <Select
              data={TIME_OPTIONS.map((t) => ({
                value: t.value.toString(),
                label: t.label,
              }))}
              value={endTime}
              onChange={(v) => v !== null && setEndTime(v)}
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              className="px-3 py-1 border border-gray-400 text-gray-600 rounded text-sm"
              onClick={() => {
                setSelectedRange({ start: null, end: null });
                setAnchorKey(null);
              }}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1 border border-gray-600 rounded text-sm"
              onClick={async () => {
                await handleBlock();
                setAnchorKey(null);
              }}
            >
              Block
            </button>
            <button
              className="px-4 py-1 border border-lime-500 text-lime-600 rounded text-sm"
              onClick={() => {
                handleCreateBooking();
                setAnchorKey(null);
              }}
            >
              Book
            </button>
          </div>
        </div>
      );
    }

    // только первая дата выбрана
    return <div className="text-sm text-gray-600">Choose the end date…</div>;
  };

  return (
    <div className="mb-4 w-full xl:max-w-2xl">
      <h1 className="font-openSans text-2xl font-bold">Calendar</h1>
      <div className="border-b border-gray-100 mt-5 shadow-sm"></div>

      <div className="flex justify-between items-center mb-4 mt-5">
        <button
          className="text-sm px-3 py-1 border rounded"
          onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
        >
          Prev
        </button>
        <div className="text-lg font-semibold">
          {format(currentMonth, "MMMM yyyy")}
        </div>
        <button
          className="text-sm px-3 py-1 border rounded"
          onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
        >
          Next
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-sm font-medium">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 mt-1 overflow-hidden border-t border-l border-gray-200">
        {days.map((date) => {
          const selected =
            (selectedRange.start && isSameDay(date, selectedRange.start)) ||
            (selectedRange.end && isSameDay(date, selectedRange.end));

          const inRange =
            selectedRange.start &&
            selectedRange.end &&
            date > selectedRange.start &&
            date < selectedRange.end;

          const isHoveredRange =
            selectedRange.start &&
            !selectedRange.end &&
            hoveredDate &&
            ((hoveredDate > selectedRange.start &&
              date > selectedRange.start &&
              date <= hoveredDate) ||
              (hoveredDate < selectedRange.start &&
                date < selectedRange.start &&
                date >= hoveredDate));

          const isHover = hoveredDate && isSameDay(hoveredDate, date);
          const isBookedDay = isBooked(date);
          const isBlockedDay = isBlocked(date);

          // disable для «ползунка» выбора
          const isDisabled = (() => {
            if (isPastDay(date)) return true;

            if (!selectedRange.start || selectedRange.end) return false;
            if (
              firstUnavailableAfterStart &&
              date > selectedRange.start &&
              date >= firstUnavailableAfterStart
            )
              return true;
            if (
              firstUnavailableBeforeStart &&
              date < selectedRange.start &&
              date <= firstUnavailableBeforeStart
            )
              return true;
            return false;
          })();

          const isTodayFree =
            isSameDay(date, today) && !isBookedDay && !isBlockedDay;

          const className = [
            "aspect-square flex items-center justify-center border-r border-b border-gray-200",
            inRange || isHoveredRange ? "bg-lime-200/80" : "",
            selected ? "bg-lime-200/80" : "",
            isHover ? "bg-gray-50" : "",
            isBookedDay ? "bg-white bg-hatched-booked" : "",
            isBlockedDay ? "bg-white bg-hatched-blocked" : "",
            isTodayFree && !inRange && !selected ? "bg-hatched-today" : "",
            isPastDay(date) && !isBookedDay && !isBlockedDay
              ? "bg-white bg-hatched-past"
              : "",
            isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
          ].join(" ");

          const onDayHover = () => {
            if (!isDisabled) setHoveredDate(date);
          };

          return (
            <Popover
              key={date.toISOString()}
              opened={anchorKey === keyOf(date)}
              onChange={(opened) => {
                if (!opened) setAnchorKey(null);
              }}
              withinPortal
              position="top"
              width={"368"}
              withArrow
              shadow="sm"
              offset={6}
              closeOnClickOutside={false}
              middlewares={{ flip: false, shift: true }}
              trapFocus={false}
              returnFocus={false}
            >
              <Popover.Target>
                <div
                  className={className}
                  onClick={() => {
                    if (openIfExisting(date)) return;
                    if (!isDisabled) handleSelect(date);
                  }}
                  onMouseOver={onDayHover}
                  onMouseEnter={onDayHover}
                  onTouchStart={onDayHover}
                  onMouseLeave={() => setHoveredDate(null)}
                >
                  {date.getDate()}
                </div>
              </Popover.Target>

              <Popover.Dropdown>{renderPopoverContent(date)}</Popover.Dropdown>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}
