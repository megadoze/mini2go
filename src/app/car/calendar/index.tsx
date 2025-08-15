import { useMemo, useState } from "react";
import { Select } from "@mantine/core";
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
} from "date-fns";
import { useCarContext } from "@/context/carContext";
import type { Booking } from "@/types/booking";
import { createBooking, deleteBooking } from "./calendar.service";
import { useLocation, useNavigate } from "react-router";
import { getUserById } from "@/services/user.service";
import type { BookingEditorSnapshot } from "@/types/booking-ui";

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

  const currency = effectiveCurrency ?? "EUR";

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

  const allBookings: Booking[] = useMemo(
    () => car?.bookings ?? [],
    [car?.bookings]
  );

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
            b.status === "confirmed")
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

  // выбор даты
  const handleSelect = (date: Date) => {
    // при клике на существующий блок/бронь — показываем карточку и выходим (если не в режиме редактирования)
    if (!editMode) {
      const block = findBlockByDate(date);
      if (block) {
        setSelectedBlockId(block.id);
        setSelectedBookingId(null);
        setSelectedRange({ start: null, end: null });
        return;
      }
      const booking = findBookingByDate(date);
      if (booking) {
        setSelectedBookingId(booking.id);
        setSelectedBlockId(null);
        setSelectedRange({ start: null, end: null });
        return;
      }
    }

    // обычный/редакционный выбор диапазона
    if (!selectedRange.start || (selectedRange.start && selectedRange.end)) {
      setSelectedRange({ start: date, end: null });
      setSelectedBookingId(null);
      setSelectedBlockId(null);
    } else {
      const start = selectedRange.start;
      const range = eachDayOfInterval({
        start: date < start ? date : start,
        end: date > start ? date : start,
      });
      const hasUnavailable = range.some((d) => isUnavailable(d));
      if (hasUnavailable) {
        setSelectedRange({ start: null, end: null });
      } else {
        setSelectedRange(
          date < start ? { start: date, end: start } : { start, end: date }
        );
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
      setCar({ ...car, bookings: [...(car?.bookings ?? []), result] });
      resetSelection();
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
    setCar({ ...car, bookings: allBookings.filter((b) => b.id !== id) });
    setSelectedBlockId(null);
    if (editMode === "block") setEditMode(null);
  };
  const handleRemoveBooking = async (id: string) => {
    await deleteBooking(id);
    setCar({ ...car, bookings: allBookings.filter((b) => b.id !== id) });
    setSelectedBookingId(null);
    if (editMode === "booking") setEditMode(null);
  };

  const startEditBooking = async () => {
    if (!selectedBooking) return;

    // собери лёгкий снэпшот
    const snapshot: BookingEditorSnapshot = {
      booking: {
        id: selectedBooking.id,
        car_id: selectedBooking.car_id,
        user_id: selectedBooking.user_id,
        start_at: selectedBooking.start_at, // ISO string
        end_at: selectedBooking.end_at, // ISO string
        mark: selectedBooking.mark,
        status: selectedBooking.status,
        price_per_day: selectedBooking.price_per_day,
        price_total: selectedBooking.price_total,
        user: null,
      },
    };

    if (selectedBooking.user_id) {
      try {
        const cached = getCachedUser?.(selectedBooking.user_id) ?? null;
        const user = cached ?? (await getUserById(selectedBooking.user_id));
        snapshot.booking.user = user;
        setCachedUser?.(selectedBooking.user_id, user);
      } catch {} // не валим переход, если профиль не подтянулся
    }

    navigate(`/cars/${carId}/bookings/${selectedBooking.id}/edit`, {
      state: { snapshot, from: location.pathname + location.search },
    });
  };

  // утилиты
  const resetSelection = () => {
    setSelectedRange({ start: null, end: null });
    setHoveredDate(null);
    setStartTime("0");
    setEndTime("2330");
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

          // дисабл для «ползунка» выбора
          const isDisabled = (() => {
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

          const isHover = hoveredDate && isSameDay(hoveredDate, date);
          const isBookedDay = isBooked(date);
          const isBlockedDay = isBlocked(date);

          const className = [
            "aspect-square flex items-center justify-center border-r border-b border-gray-200",
            selected ? " bg-lime-200/80" : "",
            isHover ? " bg-gray-50 " : "",
            inRange || isHoveredRange ? "bg-lime-200/80" : "",
            isBookedDay ? "bg-white bg-hatched-booked" : "",
            isBlockedDay ? "bg-white bg-hatched-blocked" : "",
            isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
          ].join(" ");

          const onDayHover = () => {
            if (!isDisabled) setHoveredDate(date);
          };

          return (
            <div
              key={date.toISOString()}
              className={className}
              onClick={() => {
                if (!isDisabled) handleSelect(date);
              }}
              onMouseOver={onDayHover}
              onMouseEnter={onDayHover}
              onTouchStart={onDayHover}
              onMouseLeave={() => setHoveredDate(null)}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>

      {/* Выбор времени показываем:
          - когда нет открытой карточки блока/брони
          - и когда редактируем (editMode != null)
      */}
      {(!selectedBlockId && !selectedBookingId) || editMode ? (
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start time</label>
            <Select
              data={TIME_OPTIONS.map((t) => ({
                value: t.value.toString(),
                label: t.label,
              }))}
              value={startTime}
              onChange={(value) => {
                if (value !== null) setStartTime(value);
              }}
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
              onChange={(value) => {
                if (value !== null) setEndTime(value);
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Кнопки действий: создание/блокировка (когда не открыты карточки и не редактируем) */}
      {!selectedBlockId && !selectedBookingId && !editMode && (
        <div className="mt-6 flex justify-between">
          {(selectedRange.start || selectedRange.end) && (
            <button
              className="px-4 py-2 border border-gray-500 rounded text-sm"
              onClick={() => setSelectedRange({ start: null, end: null })}
            >
              Cancel
            </button>
          )}
          <div className="flex gap-2 justify-end w-full">
            <button
              disabled={!selectedRange.start || !selectedRange.end}
              onClick={handleBlock}
              className="px-4 py-2 border border-gray-600 rounded text-sm disabled:border-gray-300 disabled:text-gray-400"
            >
              Block
            </button>
            <button
              disabled={!selectedRange.start || !selectedRange.end}
              onClick={handleCreateBooking}
              className="px-5 py-2 border border-lime-500 text-lime-600 rounded text-sm disabled:border-gray-300 disabled:text-gray-400"
            >
              Book
            </button>
          </div>
        </div>
      )}

      {/* Карточка БЛОКА */}
      {selectedBlock && !editMode && (
        <div className="mt-6 p-4 border rounded bg-gray-50">
          <p className="text-sm font-medium">Blocked period:</p>
          <p className="text-sm">
            {format(parseISO(selectedBlock.start_at), "dd MMM yyyy, HH:mm")} →{" "}
            {format(parseISO(selectedBlock.end_at), "dd MMM yyyy, HH:mm")}
          </p>
          <div className="flex justify-end items-center gap-2 mt-2 ">
            <button
              className="px-2 py-2 border rounded text-sm"
              onClick={() => setSelectedBlockId(null)}
            >
              Close
            </button>
            {/* <button
              className="px-2 py-2 border rounded text-sm"
              onClick={startEditBlock}
            >
              Edit
            </button> */}
            <button
              onClick={() => handleRemoveBlock(selectedBlock.id)}
              className="px-2 py-2 border rounded text-red-600 text-sm"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Карточка БРОНИ */}
      {selectedBooking && !editMode && (
        <div className="mt-6 p-4 border rounded bg-gray-50">
          <p className="text-sm font-medium">Booking:</p>
          <p className="text-sm">
            {format(parseISO(selectedBooking.start_at), "dd MMM yyyy, HH:mm")} →{" "}
            {format(parseISO(selectedBooking.end_at), "dd MMM yyyy, HH:mm")}{" "}
            {(() => {
              const mins = differenceInMinutes(
                parseISO(selectedBooking.end_at),
                parseISO(selectedBooking.start_at)
              );
              const days = Math.floor(mins / 1440);
              const hours = Math.floor((mins % 1440) / 60);
              return `(${days} day${days !== 1 ? "s" : ""} ${hours} hour${
                hours !== 1 ? "s" : ""
              })`;
            })()}
          </p>

          {selectedBooking.price_total != null && (
            <p className="text-sm mt-1 font-medium">
              Total: {selectedBooking.price_total} {currency}
            </p>
          )}
          <div className="flex justify-end items-center gap-2 mt-2 ">
            <button
              className="px-2 py-2 border rounded text-sm"
              onClick={() => setSelectedBookingId(null)}
            >
              Close
            </button>
            <button
              className="px-2 py-2 border rounded text-sm"
              onClick={startEditBooking}
            >
              Edit
            </button>
            <button
              onClick={() => handleRemoveBooking(selectedBooking.id)}
              className="px-2 py-2 border rounded text-red-600 text-sm"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
