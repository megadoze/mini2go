import { useEffect, useMemo, useState } from "react";
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
} from "date-fns";
import { useCarContext } from "@/context/carContext";
import type { Booking } from "@/types/booking";
import {
  createBooking,
  deleteBooking,
  fetchBookingsByCarId,
} from "./calendar.service";

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

export default function Calendar() {
  const { car, setCar } = useCarContext();
  const carId = car?.id;

  const [selectedRange, setSelectedRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({ start: null, end: null });
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState("0");
  const [endTime, setEndTime] = useState("2330");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const allBookings: Booking[] = useMemo(() => car.bookings ?? [], [car]);

  const blockedBookings = useMemo(
    () => allBookings.filter((b) => b.mark === "block"),
    [allBookings]
  );

  useEffect(() => {
    if (!carId) return;
    fetchBookingsByCarId(carId).then((bookings) => {
      setCar((prev) => ({ ...prev, bookings }));
    });
  }, [carId]);

  const bookedDays = useMemo(
    () =>
      allBookings
        .filter((b) => b.mark === "booking" && b.status === "active")
        .flatMap((b) =>
          eachDayOfInterval({
            start: parseISO(b.start_at),
            end: parseISO(b.end_at),
          })
        ),
    [allBookings]
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

  const handleSelect = (date: Date) => {
    const block = findBlockByDate(date);
    if (block) {
      setSelectedBlockId(block.id);
      setSelectedRange({ start: null, end: null });
      return;
    }

    setSelectedBlockId(null);

    if (!selectedRange.start || (selectedRange.start && selectedRange.end)) {
      setSelectedRange({ start: date, end: null });
    } else {
      const start = selectedRange.start;
      const range = eachDayOfInterval({
        start: date < start ? date : start,
        end: date > start ? date : start,
      });

      const hasBlocked = range.some((d) => isBlocked(d));

      if (hasBlocked) {
        setSelectedRange({ start: null, end: null });
      } else {
        setSelectedRange(
          date < start
            ? { start: date, end: start }
            : { start: start, end: date }
        );
      }
    }
  };

  const handleBlock = async () => {
    if (!selectedRange.start || !selectedRange.end || !carId) return;

    const start = new Date(selectedRange.start);
    const end = new Date(selectedRange.end);

    const startHours = Math.floor(Number(startTime) / 100);
    const startMinutes = Number(startTime) % 100;
    start.setHours(startHours, startMinutes);

    const endHours = Math.floor(Number(endTime) / 100);
    const endMinutes = Number(endTime) % 100;
    end.setHours(endHours, endMinutes);

    const newBlock: Omit<Booking, "id"> = {
      car_id: carId,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      mark: "block",
      status: "block",
      user_id: null,
    };

    const result = await createBooking(newBlock);
    if (result) {
      setCar({ ...car, bookings: [...(car?.bookings ?? []), result] });
      setSelectedRange({ start: null, end: null });
      setHoveredDate(null);
      setStartTime("0");
      setEndTime("2330");
    }
  };

  const handleRemoveBlock = async (id: string) => {
    await deleteBooking(id);
    setCar({ ...car, bookings: allBookings.filter((b) => b.id !== id) });
    setSelectedBlockId(null);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const selectedBlock = blockedBookings.find((b) => b.id === selectedBlockId);

  const firstBlockedAfterStart = useMemo(() => {
    if (!selectedRange.start || selectedRange.end) return null;
    const sorted = blockedDays
      .filter((d) => d > selectedRange.start!)
      .sort((a, b) => a.getTime() - b.getTime());
    return sorted[0] ?? null;
  }, [blockedDays, selectedRange.start, selectedRange.end]);

  const firstBlockedBeforeStart = useMemo(() => {
    if (!selectedRange.start || selectedRange.end) return null;
    const sorted = blockedDays
      .filter((d) => d < selectedRange.start!)
      .sort((a, b) => b.getTime() - a.getTime());
    return sorted[0] ?? null;
  }, [blockedDays, selectedRange.start, selectedRange.end]);

  return (
    <div className="mb-4 w-full xl:max-w-2xl">
      <h1 className="font-openSans text-2xl font-bold">Car details</h1>
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

          const isBookedDay = isBooked(date);
          const isBlockedDay = isBlocked(date);

          const isDisabled = (() => {
            if (!selectedRange.start || selectedRange.end) return false;
            if (
              firstBlockedAfterStart &&
              date > selectedRange.start &&
              date >= firstBlockedAfterStart
            )
              return true;
            if (
              firstBlockedBeforeStart &&
              date < selectedRange.start &&
              date <= firstBlockedBeforeStart
            )
              return true;
            return false;
          })();

          const className = [
            "aspect-square flex items-center justify-center border-r border-b border-gray-200",
            selected ? " bg-lime-100 " : "",
            inRange || isHoveredRange ? "bg-lime-100" : "",
            isBookedDay ? "bg-green-200" : "",
            isBlockedDay ? "bg-lime-200/90" : "",
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
              onMouseEnter={onDayHover}
              onTouchStart={onDayHover}
              onMouseLeave={() => setHoveredDate(null)}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>

      {!selectedBlockId && (
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
      )}

      {!selectedBlockId && (
        <div className="mt-4 flex justify-end gap-2">
          {(selectedRange.start || selectedRange.end) && (
            <button
              className="px-4 py-2 border rounded text-sm"
              onClick={() => setSelectedRange({ start: null, end: null })}
            >
              Cancel
            </button>
          )}
          <button
            disabled={!selectedRange.start || !selectedRange.end}
            onClick={handleBlock}
            className="px-4 py-2 border rounded text-sm disabled:opacity-50"
          >
            Block selected period
          </button>
        </div>
      )}

      {selectedBlock && (
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
              Cancel
            </button>
            <button
              onClick={() => handleRemoveBlock(selectedBlock.id)}
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
