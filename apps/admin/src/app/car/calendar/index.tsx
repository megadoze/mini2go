import { useEffect, useMemo, useState } from "react";
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
import { toast } from "sonner";
import { useBookingsRealtimeRQ } from "@/hooks/useBookingsRealtime";

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

function nowStepValue(stepMin = 30) {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const over = mins % stepMin;
  const next = over ? mins + (stepMin - over) : mins;
  const hh = Math.floor(next / 60);
  const mm = next % 60;
  return hh * 100 + mm;
}

type EditMode = null | "block" | "booking";

export default function Calendar() {
  const { car, setCar, effectiveCurrency, getCachedUser, setCachedUser } =
    useCarContext();

  const location = useLocation();
  const navigate = useNavigate();
  const carId = car?.id;

  useBookingsRealtimeRQ(carId ?? null);

  const initial = car?.bookings ?? [];

  const currency = effectiveCurrency ?? "EUR";

  const today = startOfDay(new Date());
  const isPastDay = (date: Date) => isBefore(date, today);

  const [selectedRange, setSelectedRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({ start: null, end: null });

  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null
  );
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [startTime, setStartTime] = useState("0");
  const [endTime, setEndTime] = useState("2330");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const keyOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const stepMin = 30;
  const _nowStep = nowStepValue(stepMin);

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

  const isOnApproval = (s?: string | null) =>
    String(s ?? "").toLowerCase() === "onapproval";

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

  const selectedBlock =
    blockedBookings.find((b) => b.id === selectedBlockId) || null;
  const selectedBooking =
    activeBookings.find((b) => b.id === selectedBookingId) || null;

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

  // 👇 helper: это неполный (не 23:59) КОНЕЦ брони/блока
  function isPartialEndOfBookingOrBlock(date: Date): boolean {
    const booking = findBookingByDate(date);
    if (booking) {
      const be = parseISO(booking.end_at);
      if (isSameDay(date, be)) {
        if (!(be.getHours() === 23 && be.getMinutes() === 59)) {
          return true;
        }
      }
    }
    const block = findBlockByDate(date);
    if (block) {
      const be = parseISO(block.end_at);
      if (isSameDay(date, be)) {
        if (!(be.getHours() === 23 && be.getMinutes() === 59)) {
          return true;
        }
      }
    }
    return false;
  }

  // Пул занятых дат, из которого мы ВЫКИДЫВАЕМ такие неполные концы
  const unavailableDatesPool = useMemo(() => {
    const pool: Date[] = [];

    activeBookings.forEach((b) => {
      if (editMode === "booking" && selectedBooking?.id === b.id) return;
      const s = parseISO(b.start_at);
      const e = parseISO(b.end_at);
      const days = eachDayOfInterval({ start: s, end: e });
      days.forEach((d) => {
        // 👉 если это неполный конец ЭТОЙ брони — не кладём в пул
        const isEnd =
          isSameDay(d, e) && !(e.getHours() === 23 && e.getMinutes() === 59);
        if (!isEnd) pool.push(d);
      });
    });

    blockedBookings.forEach((b) => {
      if (editMode === "block" && selectedBlock?.id === b.id) return;
      const s = parseISO(b.start_at);
      const e = parseISO(b.end_at);
      const days = eachDayOfInterval({ start: s, end: e });
      days.forEach((d) => {
        const isEnd =
          isSameDay(d, e) && !(e.getHours() === 23 && e.getMinutes() === 59);
        if (!isEnd) pool.push(d);
      });
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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // обычное открытие поповера (но не на хвостах)
  const openIfExisting = (date: Date) => {
    if (isPartialEndOfBookingOrBlock(date)) {
      return false;
    }

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

  const startTimeOptions = useMemo(() => {
    if (!selectedRange.start) return TIME_OPTIONS;
    const isToday = isSameDay(selectedRange.start, today);
    const minVal = isToday ? _nowStep : 0;
    return TIME_OPTIONS.filter((o) => o.value >= minVal);
  }, [selectedRange.start, today, _nowStep]);

  const endTimeOptions = useMemo(() => {
    if (!selectedRange.end) return TIME_OPTIONS;
    const endIsToday = isSameDay(selectedRange.end, today);
    const sameDay =
      selectedRange.start && isSameDay(selectedRange.end, selectedRange.start);

    let minVal = 0;
    if (endIsToday) minVal = Math.max(minVal, _nowStep);
    if (sameDay) minVal = Math.max(minVal, Number(startTime));

    return TIME_OPTIONS.filter((o) => o.value > minVal);
  }, [selectedRange.start, selectedRange.end, startTime, today, _nowStep]);

  const endTimeSelectData = useMemo(() => {
    const base = endTimeOptions.map((t) => ({
      value: String(t.value),
      label: t.label,
    }));
    const sameDay =
      selectedRange.start &&
      selectedRange.end &&
      isSameDay(selectedRange.start, selectedRange.end);
    if (sameDay) {
      const v = Number(startTime);
      const label =
        TIME_OPTIONS.find((o) => o.value === v)?.label ??
        `${String(Math.floor(v / 100)).padStart(2, "0")}:${String(
          v % 100
        ).padStart(2, "0")}`;
      return [
        { value: String(v), label: `${label} (start)`, disabled: true },
        ...base,
      ];
    }
    return base;
  }, [endTimeOptions, selectedRange.start, selectedRange.end, startTime]);

  useEffect(() => {
    if (!selectedRange.start || !selectedRange.end) return;
    const sameDay = isSameDay(selectedRange.start, selectedRange.end);
    const endIsToday = isSameDay(selectedRange.end, today);
    const minVal = Math.max(Number(startTime), endIsToday ? _nowStep : 0);
    const firstValid = endTimeOptions[0];

    if (sameDay) {
      const endNum = Number(endTime);
      const endIsInList = endTimeOptions.some(
        (o) => String(o.value) === endTime
      );
      if ((!endIsInList || endNum <= minVal) && firstValid) {
        setEndTime(String(firstValid.value));
      }
    } else {
      const endIsInList = endTimeOptions.some(
        (o) => String(o.value) === endTime
      );
      if (!endIsInList && firstValid) {
        setEndTime(String(firstValid.value));
      }
    }
  }, [
    selectedRange.start,
    selectedRange.end,
    startTime,
    today,
    _nowStep,
    endTimeOptions,
    endTime,
  ]);

  const handleSelect = (date: Date) => {
    const hasStart = !!selectedRange.start;
    const hasEnd = !!selectedRange.end;
    const inProgress = hasStart && !hasEnd;

    // если мы НЕ выбираем сейчас конец — и кликнули по хвосту → считаем это стартом
    if (!inProgress && isPartialEndOfBookingOrBlock(date)) {
      setSelectedRange({ start: date, end: null });
      setSelectedBookingId(null);
      setSelectedBlockId(null);
      setAnchorKey(null);
      return;
    }

    // если день принадлежит существующей записи — показываем поповер
    if (!editMode) {
      if (openIfExisting(date)) return;
    }

    // обычный выбор
    if (!selectedRange.start || (selectedRange.start && selectedRange.end)) {
      setSelectedRange({ start: date, end: null });
      setSelectedBookingId(null);
      setSelectedBlockId(null);
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

        // подстройка времени
        if (next.start && isSameDay(next.start, today)) {
          const asNum = Number(startTime);
          if (asNum < _nowStep) {
            setStartTime(String(_nowStep));
          }
          if (next.end && isSameDay(next.end, next.start)) {
            const endNum = Number(endTime);
            if (endNum <= Math.max(_nowStep, asNum)) {
              const opt = endTimeOptions.find(
                (o) => o.value > Math.max(_nowStep, asNum)
              );
              if (opt) setEndTime(String(opt.value));
            }
          }
        }
      }
    }
  };

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

    {
      const now = new Date();
      const mins = now.getMinutes();
      const roundedNow = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        mins % stepMin ? mins + (stepMin - (mins % stepMin)) : mins,
        0,
        0
      );
      if (start < roundedNow) {
        start.setTime(roundedNow.getTime());
        if (end <= start) end.setTime(start.getTime() + stepMin * 60_000);
      }
    }

    if (isSameDay(start, end) && end <= start) {
      end.setTime(start.getTime() + stepMin * 60_000);
    }

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
      qc.setQueryData<Booking[]>(QK.bookingsByCarId(String(carId)), (prev) => [
        result,
        ...(prev ?? []),
      ]);
      setCar((prev) => ({
        ...prev,
        bookings: [...(prev?.bookings ?? []), result],
      }));
      resetSelection();
      qc.invalidateQueries({ queryKey: QK.bookingsByCarId(String(carId)) });
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

    {
      const now = new Date();
      const mins = now.getMinutes();
      const roundedNow = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        mins % stepMin ? mins + (stepMin - (mins % stepMin)) : mins,
        0,
        0
      );
      if (start < roundedNow) {
        start.setTime(roundedNow.getTime());
        if (end <= start) end.setTime(start.getTime() + stepMin * 60_000);
      }
    }

    if (isSameDay(start, end) && end <= start) {
      end.setTime(start.getTime() + stepMin * 60_000);
    }

    const rangeDays = eachDayOfInterval({ start, end });
    if (rangeDays.some((d) => isUnavailable(d))) return;

    navigate(
      `/cars/${carId}/bookings/new?carId=${carId}&start=${encodeURIComponent(
        start.toISOString()
      )}&end=${encodeURIComponent(end.toISOString())}`
    );
  };

  function removeFromCalendarWindowsCache(
    qc: ReturnType<typeof useQueryClient>,
    removed: Booking
  ) {
    qc.setQueriesData<any>(
      {
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
      },
      (win: {
        rangeStart: string | number | Date;
        rangeEnd: string | number | Date;
        cars: any;
      }) => {
        if (!win) return win;

        const wStart = new Date(win.rangeStart);
        const wEnd = new Date(win.rangeEnd);
        const bStart = new Date(removed.start_at);
        const bEnd = new Date(removed.end_at);

        const intersects = !(bEnd < wStart || bStart > wEnd);
        if (!intersects) return win;

        return {
          ...win,
          cars: (win.cars ?? []).map((c: any) =>
            String(c.id) === String(removed.car_id)
              ? {
                  ...c,
                  bookings: (c.bookings ?? []).filter(
                    (x: Booking) => x.id !== removed.id
                  ),
                }
              : c
          ),
        };
      }
    );

    qc.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
    });
  }

  const handleRemoveBlock = async (id: string) => {
    const b = allBookings.find((x) => x.id === id);
    if (!b) return;

    await deleteBooking(id);

    removeFromCalendarWindowsCache(qc, b);

    qc.setQueryData<Booking[]>(listKey, (prev) =>
      (prev ?? []).filter((b) => b.id !== id)
    );

    removeFromInfiniteLists(qc, id);

    setCar((prev) => ({
      ...prev,
      bookings: (prev?.bookings ?? []).filter((b) => b.id !== id),
    }));

    setSelectedBlockId(null);
    if (editMode === "block") setEditMode(null);
    qc.invalidateQueries({ queryKey: listKey });
    qc.removeQueries({ queryKey: QK.booking(id) });
    qc.removeQueries({ queryKey: QK.bookingExtras(id) });
  };

  const handleRemoveBooking = async (id: string) => {
    const b = allBookings.find((x) => x.id === id);
    if (!b) return;

    if (!isOnApproval(b.status)) {
      toast.warning("You can delete booking only with status onApproval");
      return;
    }

    await deleteBooking(id);

    removeFromCalendarWindowsCache(qc, b);

    qc.setQueryData<Booking[]>(listKey, (prev) =>
      (prev ?? []).filter((r) => r.id !== id)
    );

    removeFromInfiniteLists(qc, id);

    setCar((prev) => ({
      ...prev,
      bookings: (prev?.bookings ?? []).filter((r) => r.id !== id),
    }));

    setSelectedBookingId(null);
    if (editMode === "booking") setEditMode(null);

    qc.invalidateQueries({ queryKey: listKey });
    qc.removeQueries({ queryKey: QK.booking(id) });
    qc.removeQueries({ queryKey: QK.bookingExtras(id) });
  };

  const resetSelection = () => {
    setSelectedRange({ start: null, end: null });
    setHoveredDate(null);
    setStartTime("0");
    setEndTime("2330");
    setAnchorKey(null);
  };

  const renderPopoverContent = (date: Date) => {
    const block = findBlockByDate(date);
    const booking = findBookingByDate(date);

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
                className="px-2 py-1 border border-gray-600 rounded text-sm"
              >
                Remove
              </button>
            )}
            <button
              className="px-3 py-1 border border-gray-400 rounded text-sm"
              onClick={() => setAnchorKey(null)}
            >
              Close
            </button>
          </div>
        </div>
      );
    }

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
          <div className="flex gap-2 justify-end pt-1 flex-wrap">
            {!isPastDay(parseISO(booking.start_at)) &&
              isOnApproval(booking.status) && (
                <button
                  onClick={() => {
                    handleRemoveBooking(booking.id);
                    setAnchorKey(null);
                  }}
                  className="px-2 py-1 border border-gray-500 rounded text-sm"
                >
                  Remove
                </button>
              )}

            <button
              className="px-3 py-1 border border-gray-400 rounded text-sm"
              onClick={() => setAnchorKey(null)}
            >
              Close
            </button>
            <button
              className="px-4 py-1 border border-lime-500 text-lime-600 rounded text-sm"
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

    if (selectedRange.start && selectedRange.end) {
      return (
        <div className="min-w-[280px] space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Start time</label>
            <Select
              data={startTimeOptions.map((t) => ({
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
              data={endTimeSelectData}
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

    return <div className="text-sm text-gray-600">Choose the end date…</div>;
  };

  return (
    <div className="mb-4 w-full xl:max-w-2xl">
      <h1 className="font-roboto text-xl md:text-2xl font-medium">Calendar</h1>
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

          const bookingForThisDate = activeBookings.find((b) => {
            const s = parseISO(b.start_at);
            const e = parseISO(b.end_at);
            return (
              isSameDay(date, s) ||
              isSameDay(date, e) ||
              isWithinInterval(date, { start: s, end: e })
            );
          });

          const blockForThisDate = blockedBookings.find((b) => {
            const s = parseISO(b.start_at);
            const e = parseISO(b.end_at);
            return (
              isSameDay(date, s) ||
              isSameDay(date, e) ||
              isWithinInterval(date, { start: s, end: e })
            );
          });

          let startsLate = false;
          let endsEarly = false;
          let isBlockPartial = false;

          if (bookingForThisDate) {
            const bs = parseISO(bookingForThisDate.start_at);
            const be = parseISO(bookingForThisDate.end_at);
            if (isSameDay(bs, date)) {
              if (bs.getHours() > 0 || bs.getMinutes() > 0) {
                startsLate = true;
              }
            }
            if (isSameDay(be, date)) {
              if (!(be.getHours() === 23 && be.getMinutes() === 59)) {
                endsEarly = true;
              }
            }
          } else if (blockForThisDate) {
            const bs = parseISO(blockForThisDate.start_at);
            const be = parseISO(blockForThisDate.end_at);
            if (
              isSameDay(bs, date) &&
              (bs.getHours() > 0 || bs.getMinutes() > 0)
            ) {
              isBlockPartial = true;
            }
            if (
              isSameDay(be, date) &&
              !(be.getHours() === 23 && be.getMinutes() === 59)
            ) {
              isBlockPartial = true;
            }
          }

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
            "aspect-square flex items-center justify-center border-r border-b border-gray-200 relative overflow-hidden",
            inRange || isHoveredRange ? "bg-lime-200/80" : "",
            selected ? "bg-lime-200/80" : "",
            isHover ? "bg-gray-50" : "",
            isBookedDay && startsLate ? "bg-partly-busy-diag-start" : "",
            isBookedDay && endsEarly ? "bg-partly-busy-diag-end" : "",
            isBookedDay && !startsLate && !endsEarly
              ? "bg-white bg-hatched-booked"
              : "",
            isBlockedDay && isBlockPartial ? "bg-partly-busy-diag-block" : "",
            isBlockedDay && !isBlockPartial
              ? "bg-white bg-hatched-blocked"
              : "",
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
                    const inProgress =
                      !!selectedRange.start && !selectedRange.end;

                    // кликаем по хвосту, НО мы не в процессе выбора → начинаем новую
                    if (!inProgress && isPartialEndOfBookingOrBlock(date)) {
                      handleSelect(date);
                      return;
                    }

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

function removeFromInfiniteLists(
  qc: ReturnType<typeof useQueryClient>,
  bookingId: string
) {
  qc.setQueriesData(
    {
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        (q.queryKey[0] === "bookingsIndexInfinite" ||
          q.queryKey[0] === "bookingsUserInfinite"),
    },
    (old: any) => {
      if (!old?.pages) return old;
      const pages = old.pages.map((p: any) => {
        if (Array.isArray(p?.items)) {
          return {
            ...p,
            items: p.items.filter(
              (x: any) => String(x.id) !== String(bookingId)
            ),
          };
        }
        if (Array.isArray(p)) {
          return p.filter((x: any) => String(x.id) !== String(bookingId));
        }
        return p;
      });
      return { ...old, pages };
    }
  );
}
