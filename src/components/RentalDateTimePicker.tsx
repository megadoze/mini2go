import React, { useMemo, useState, useEffect } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isEqual,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  setHours,
  setMinutes,
  startOfDay,
  startOfMonth,
  startOfWeek,
  type Locale,
} from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { Slider } from "@mantine/core";

export type DateRange = {
  startAt: Date | null;
  endAt: Date | null;
};

export type DisabledInterval = { start: Date; end: Date };

export type RentalDateTimePickerProps = {
  value: DateRange;
  onChange: (next: DateRange) => void;
  minuteStep?: 5 | 10 | 15 | 20 | 30 | 60; // default 30
  minDate?: Date; // earliest selectable date
  maxDate?: Date; // latest selectable date
  disabledIntervals?: DisabledInterval[]; // booked/blocked ranges
  initialMonth?: Date; // month to show at mount
  locale?: Locale; // date-fns locale, defaults ru
  className?: string;
  mobileStartOpen?: boolean;
};

function clampDate(date: Date, minDate?: Date, maxDate?: Date) {
  if (minDate && isBefore(date, minDate)) return minDate;
  if (maxDate && isAfter(date, maxDate)) return maxDate;
  return date;
}

function isDateDisabled(d: Date, minDate?: Date, maxDate?: Date) {
  if (minDate && isBefore(d, startOfDay(minDate))) return true;
  if (maxDate && isAfter(d, maxDate)) return true;
  return false;
}

function isInDisabledIntervals(d: Date, intervals: DisabledInterval[] = []) {
  return intervals.some((iv) =>
    isWithinInterval(d, { start: iv.start, end: iv.end })
  );
}

function idxToTime(base: Date, idx: number, step: number) {
  // idx is 0..(1440/step - 1)
  const total = idx * step;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const withH = setHours(base, hours);
  return setMinutes(withH, minutes);
}

function timeToIdx(d: Date, step: number) {
  const minutes = d.getHours() * 60 + d.getMinutes();
  return Math.round(minutes / step);
}

export default function RentalDateTimePicker({
  value,
  onChange,
  minuteStep = 30,
  minDate,
  maxDate,
  disabledIntervals = [],
  initialMonth,
  locale,
  className,
  mobileStartOpen,
}: RentalDateTimePickerProps) {
  const today = startOfDay(new Date());
  const effectiveMinDate = minDate ?? today;
  const [currentMonth, setCurrentMonth] = useState<Date>(
    initialMonth
      ? startOfMonth(initialMonth)
      : startOfMonth(value.startAt ?? today)
  );
  const [tempRange, setTempRange] = useState<DateRange>(value);
  const [mobileOpen, setMobileOpen] = useState<boolean>(!!mobileStartOpen);
  const [hoverDay, setHoverDay] = useState<Date | null>(null);
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    const m = window.matchMedia("(hover: hover) and (pointer: fine)");
    const on = () => setCanHover(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  useEffect(() => setMobileOpen(!!mobileStartOpen), [mobileStartOpen]);

  useEffect(
    () => setTempRange(value),
    [value.startAt?.getTime(), value.endAt?.getTime()]
  );

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { locale });
    const end = endOfWeek(endOfMonth(currentMonth), { locale });
    const days = eachDayOfInterval({ start, end });
    return Array.from({ length: Math.ceil(days.length / 7) }, (_, i) =>
      days.slice(i * 7, i * 7 + 7)
    );
  }, [currentMonth, locale]);

  function handleDayClick(day: Date) {
    if (isDateDisabled(day, effectiveMinDate, maxDate)) return;
    if (isInDisabledIntervals(day, disabledIntervals)) return;

    const { startAt, endAt } = tempRange;

    if (!startAt || (startAt && endAt)) {
      // start new range
      setTempRange({ startAt: day, endAt: null });
      // move time from existing start if any
      if (value.startAt) {
        const h = value.startAt.getHours();
        const m = value.startAt.getMinutes();
        setTempRange({ startAt: setMinutes(setHours(day, h), m), endAt: null });
      }
      return;
    }

    // selecting end
    if (isBefore(day, startOfDay(startAt))) {
      // if picked before start, swap
      setTempRange({ startAt: day, endAt: startAt });
    } else {
      setTempRange({ startAt, endAt: day });
    }
  }

  function commit(next?: DateRange) {
    onChange(next ?? { ...tempRange });
  }

  // --- Time slider helpers
  const timeStepsPerDay = Math.floor((24 * 60) / minuteStep);

  const startIdx = useMemo(() => {
    if (!tempRange.startAt) return 20; // 10:00 default
    return Math.min(
      timeStepsPerDay - 1,
      timeToIdx(tempRange.startAt, minuteStep)
    );
  }, [tempRange.startAt?.getTime(), minuteStep]);

  const endIdx = useMemo(() => {
    if (!tempRange.endAt) return 40; // 20:00 default
    return Math.min(
      timeStepsPerDay - 1,
      timeToIdx(tempRange.endAt, minuteStep)
    );
  }, [tempRange.endAt?.getTime(), minuteStep]);

  function setStartIdx(idx: number) {
    if (!tempRange.startAt) return;
    const base = tempRange.startAt;
    const next = idxToTime(base, idx, minuteStep);
    setTempRange((prev) => ({ ...prev, startAt: next }));
  }

  function setEndIdx(idx: number) {
    if (!tempRange.endAt) return;
    const base = tempRange.endAt;
    const next = idxToTime(base, idx, minuteStep);
    setTempRange((prev) => ({ ...prev, endAt: next }));
  }

  function isRangeBlocked(start: Date | null, end: Date | null) {
    if (!start || !end) return false;
    const days = eachDayOfInterval({
      start: startOfDay(start),
      end: startOfDay(end),
    });
    return days.some((d) => isInDisabledIntervals(d, disabledIntervals));
  }

  const rangeBlocked = isRangeBlocked(tempRange.startAt, tempRange.endAt);

  useEffect(() => {
    // auto-clamp dates within min/max
    if (tempRange.startAt) {
      const clamped = clampDate(tempRange.startAt, effectiveMinDate, maxDate);
      if (!isEqual(clamped, tempRange.startAt))
        setTempRange((p) => ({ ...p, startAt: clamped }));
    }
    if (tempRange.endAt) {
      const clamped = clampDate(tempRange.endAt, effectiveMinDate, maxDate);
      if (!isEqual(clamped, tempRange.endAt))
        setTempRange((p) => ({ ...p, endAt: clamped }));
    }
  }, [minDate?.getTime(), maxDate?.getTime()]);

  // --- Render helpers
  const DayCell: React.FC<{ d: Date }> = ({ d }) => {
    const inCurrent = isSameMonth(d, currentMonth);
    const disabled =
      isDateDisabled(d, effectiveMinDate, maxDate) ||
      isInDisabledIntervals(d, disabledIntervals);
    const isStart = tempRange.startAt && isSameDay(d, tempRange.startAt);
    const isEnd = tempRange.endAt && isSameDay(d, tempRange.endAt);
    const isSingle = Boolean(isStart && isEnd);

    // Compute continuous band (no circles) + hover preview
    let inRange = false;
    if (tempRange.startAt && tempRange.endAt) {
      inRange = isWithinInterval(d, {
        start: startOfDay(tempRange.startAt),
        end: startOfDay(tempRange.endAt),
      });
    } else if (canHover && tempRange.startAt && hoverDay) {
      const start = startOfDay(tempRange.startAt);
      const end = startOfDay(hoverDay);
      if (!isBefore(end, start)) {
        inRange = isWithinInterval(d, { start, end });
      }
    }

    const classes = [
      "relative h-10 my-1 w-full flex items-center justify-center text-sm select-none ",
      !inCurrent ? "text-gray-400" : "",
      disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
      inRange ? "bg-green-100/20 border-y-2 border-green-300" : "",
      // Акцент границ
      isSingle ? "border-green-300 rounded-full border-2 border-green-300" : "",
      isStart && !isEnd
        ? "border border-2 border-green-300 rounded-l-full border-r-0 pr-[2px]"
        : "",
      isEnd && !isStart
        ? " border-2 border-green-300 rounded-r-full border-l-0 pl-[2px]"
        : "",
    ].join(" ");

    return (
      <div
        onPointerEnter={(e) => {
          if (canHover && e.pointerType === "mouse") setHoverDay(d);
        }}
        onPointerLeave={(e) => {
          if (canHover && e.pointerType === "mouse") setHoverDay(null);
        }}
        onPointerUp={() => {
          handleDayClick(d);
        }}
        style={{
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
        className={classes}
      >
        <span className={isStart || isEnd ? "font-medium text-green-900" : ""}>
          {format(d, "d", { locale })}
        </span>
      </div>
    );
  };

  const CalendarGrid = (
    <div className="rounded-2xl border border-gray-200 p-4 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between">
        <button
          className="p-2 rounded-xl hover:bg-gray-100"
          onClick={() => setCurrentMonth((m) => addMonths(m, -1))}
          aria-label="Предыдущий месяц"
        >
          <ChevronLeftIcon className=" size-4" />
        </button>
        <div className="font-medium">
          {format(currentMonth, "LLLL yyyy", { locale })}
        </div>
        <button
          className="p-2 rounded-xl hover:bg-gray-100"
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          aria-label="Следующий месяц"
        >
          <ChevronRightIcon className=" size-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 text-center text-xs text-gray-500">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i}>
            {format(addDays(startOfWeek(new Date(), { locale }), i), "EEEEE", {
              locale,
            })}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-0">
        {weeks.map((w, wi) => (
          <React.Fragment key={wi}>
            {w.map((d) => (
              <div
                key={d.toISOString()}
                className="flex items-center justify-center"
              >
                <DayCell d={d} />
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>

      <div className=" mt-4 grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Pick Up</div>
          <div className="mt-1 text-sm font-medium min-h-[20px]">
            {tempRange.startAt
              ? format(tempRange.startAt, "d MMM, HH:mm", { locale })
              : "—"}
          </div>
          {tempRange.startAt && (
            <div className="my-3">
              <Slider
                min={0}
                max={timeStepsPerDay - 1}
                step={1}
                value={startIdx}
                onChange={setStartIdx}
                color="green"
                size="sm"
                radius="xl"
                thumbSize={25}
                className="w-full"
                label={null}
              />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Drop Off</div>
          <div className="mt-1 text-sm font-medium min-h-[20px]">
            {tempRange.endAt
              ? format(tempRange.endAt, "d MMM, HH:mm", { locale })
              : "—"}
          </div>
          {tempRange.endAt && (
            <div className="my-3">
              <Slider
                min={0}
                max={timeStepsPerDay - 1}
                step={1}
                value={endIdx}
                onChange={setEndIdx}
                color="green"
                size="sm"
                radius="xl"
                thumbSize={25}
                className="w-full"
                label={null}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-0">
        <div className="text-xs text-red-500 min-h-[1rem]">
          {rangeBlocked ? "Выбранный диапазон пересекается с блокировками" : ""}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <button
              className=" px-4 py-2 border rounded-xl hover:bg-gray-100"
              onClick={() => {
                commit(value);
                setTempRange(value);
                setMobileOpen(false);
              }}
            >
              Close
            </button>
          </div>

          <div className="py-2 px-4 flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              onClick={() => setTempRange(value)}
            >
              Reset
            </button>
            <button
              className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
              disabled={!tempRange.startAt || !tempRange.endAt || rangeBlocked}
              onClick={() => commit()}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={"w-full " + (className ?? "")}>
      {/* Desktop / Tablet inline */}
      <div className="hidden sm:block">{CalendarGrid}</div>

      {/* Mobile*/}
      <div className="sm:hidden">
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="fixed inset-0 z-50 bg-white top-16"
            >
              <div className="p-4 pb-40">{CalendarGrid}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- Example usage (remove in production) ---
// export function DemoRentalPicker() {
//   const [range, setRange] = useState<DateRange>({ startAt: null, endAt: null });
//   const disabled: DisabledInterval[] = [
//     {
//       start: addDays(startOfDay(new Date()), 2),
//       end: addDays(startOfDay(new Date()), 4),
//     },
//   ];

//   return (
//     <div className="max-w-xl mx-auto p-4 space-y-4">
//       <h2 className="text-xl font-semibold">Демо календаря аренды</h2>
//       <RentalDateTimePicker
//         value={range}
//         onChange={setRange}
//         minuteStep={30}
//         disabledIntervals={disabled}
//       />

//       <div className="rounded-xl border border-gray-200 p-3 text-sm">
//         <div className="text-gray-500 text-xs mb-1">Текущее значение</div>
//         <div>
//           {range.startAt ? format(range.startAt, "dd.MM.yyyy HH:mm") : "—"} →{" "}
//           {range.endAt ? format(range.endAt, "dd.MM.yyyy HH:mm") : "—"}
//         </div>
//       </div>
//     </div>
//   );
// }
