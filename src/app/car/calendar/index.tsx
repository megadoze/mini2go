import { useState, useMemo } from "react";
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

export type Booking = {
  id: string;
  carId: string;
  userId: string;
  startDate: string;
  endDate: string;
  startTime: { value: number; label: string };
  endTime: { value: number; label: string };
  mark: "booking" | "block";
  status: { value: string; label: string; isActive: boolean };
};

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

  const bookedDays = useMemo(
    () =>
      allBookings
        .filter((b) => b.mark === "booking" && b.status?.isActive)
        .flatMap((b) =>
          eachDayOfInterval({
            start: parseISO(b.startDate),
            end: parseISO(b.endDate),
          })
        ),
    [allBookings]
  );

  const blockedDays = useMemo(
    () =>
      blockedBookings.flatMap((b) =>
        eachDayOfInterval({
          start: parseISO(b.startDate),
          end: parseISO(b.endDate),
        })
      ),
    [blockedBookings]
  );

  const isBooked = (date: Date) => bookedDays.some((d) => isSameDay(d, date));
  const isBlocked = (date: Date) => blockedDays.some((d) => isSameDay(d, date));

  const findBlockByDate = (date: Date) =>
    blockedBookings.find((b) =>
      isWithinInterval(date, {
        start: parseISO(b.startDate),
        end: parseISO(b.endDate),
      })
    );

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

  const handleBlock = () => {
    if (!selectedRange.start || !selectedRange.end) return;

    if (!carId) return null;

    const newBlock: Booking = {
      id: crypto.randomUUID(),
      carId: carId,
      userId: "host",
      startDate: selectedRange.start.toISOString(),
      endDate: selectedRange.end.toISOString(),
      startTime: TIME_OPTIONS.find((t) => t.value.toString() === startTime)!,
      endTime: TIME_OPTIONS.find((t) => t.value.toString() === endTime)!,
      mark: "block",
      status: { value: "block", label: "Blocked", isActive: true },
    };

    setCar({ ...car, bookings: [...(car?.bookings ?? []), newBlock] });
    setSelectedRange({ start: null, end: null });
    setHoveredDate(null);
    setStartTime("0");
    setEndTime("2330");
  };

  const handleRemoveBlock = (id: string) => {
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
            selected ? "bg-indigo-300" : "",
            inRange || isHoveredRange ? "bg-indigo-100" : "",
            isBookedDay ? "bg-green-200" : "",
            isBlockedDay ? "bg-purple-200" : "",
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
        <div className="mt-4 flex gap-4">
          <button
            disabled={!selectedRange.start || !selectedRange.end}
            onClick={handleBlock}
            className="px-4 py-2 border rounded text-sm disabled:opacity-50"
          >
            Block selected period
          </button>
          {(selectedRange.start || selectedRange.end) && (
            <button
              className="px-4 py-2 border rounded text-sm"
              onClick={() => setSelectedRange({ start: null, end: null })}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {selectedBlock && (
        <div className="mt-6 p-4 border rounded bg-gray-50">
          <p className="text-sm font-medium">Blocked period:</p>
          <p className="text-sm">
            {format(parseISO(selectedBlock.startDate), "dd MMM yyyy")} →{" "}
            {format(parseISO(selectedBlock.endDate), "dd MMM yyyy")}
            <br />
            {selectedBlock.startTime.label} - {selectedBlock.endTime.label}
          </p>
          <button
            onClick={() => handleRemoveBlock(selectedBlock.id)}
            className="mt-2 text-red-600 text-sm hover:underline"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
