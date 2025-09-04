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
  //   const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(!!mobileStartOpen);
  const [hoverDay, setHoverDay] = useState<Date | null>(null);

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

  function commit() {
    onChange({ ...tempRange });
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

    // Compute continuous band (no circles) + hover preview
    let inRange = false;
    if (tempRange.startAt && tempRange.endAt) {
      inRange = isWithinInterval(d, {
        start: startOfDay(tempRange.startAt),
        end: startOfDay(tempRange.endAt),
      });
    } else if (tempRange.startAt && hoverDay) {
      const start = startOfDay(tempRange.startAt);
      const end = startOfDay(hoverDay);
      if (!isBefore(end, start)) {
        inRange = isWithinInterval(d, { start, end });
      }
    }

    const classes = [
      "relative h-10 w-full flex items-center justify-center text-sm select-none transition-none",
      !inCurrent ? "text-gray-400" : "",
      disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
      inRange ? "bg-green-200/50" : "",
      isStart ? "bg-emerald-300 rounded-l-full" : "",
      isEnd ? "bg-emerald-300 rounded-r-full" : "",
    ].join(" ");

    return (
      <div
        onMouseEnter={() => setHoverDay(d)}
        onMouseLeave={() => setHoverDay(null)}
        className={classes}
        onClick={() => handleDayClick(d)}
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

      <div className=" mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Pick Up</div>
          <div className="mt-1 text-sm font-medium min-h-[20px]">
            {tempRange.startAt
              ? format(tempRange.startAt, "d MMM, HH:mm", { locale })
              : "—"}
          </div>
          {tempRange.startAt && (
            <div className="mt-2">
              <Slider
                min={0}
                max={timeStepsPerDay - 1}
                step={1}
                value={startIdx}
                onChange={setStartIdx}
                color="green"
                size="sm"
                radius="xl"
                className="w-full"
              />
              <div className="mt-1 text-[11px] text-gray-500">
                Step {minuteStep} min ·{" "}
                {format(
                  idxToTime(tempRange.startAt, startIdx, minuteStep),
                  "HH:mm"
                )}
              </div>
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
            <div className="mt-2">
              <Slider
                min={0}
                max={timeStepsPerDay - 1}
                step={1}
                value={endIdx}
                onChange={setEndIdx}
                color="green"
                size="sm"
                radius="xl"
                className="w-full"
              />
              <div className="mt-1 text-[11px] text-gray-500">
                Step {minuteStep} min ·{" "}
                {format(
                  idxToTime(tempRange.endAt, endIdx, minuteStep),
                  "HH:mm"
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-xs text-red-500 min-h-[1rem]">
          {rangeBlocked ? "Выбранный диапазон пересекается с блокировками" : ""}
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
            onClick={() => setTempRange(value)}
          >
            Reset
          </button>
          <button
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
            disabled={!tempRange.startAt || !tempRange.endAt || rangeBlocked}
            onClick={commit}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={"w-full" + (className ?? "")}>
      {/* Desktop / Tablet inline */}
      <div className="hidden sm:block">{CalendarGrid}</div>

      {/* Mobile: button + full-screen sheet with sliders at bottom */}
      <div className="sm:hidden">
        {/* <button
          className="w-full rounded-2xl border border-gray-200 p-3 flex items-center justify-between"
          onClick={() => setMobileOpen(true)}
        >
          <div className="flex items-center gap-2 text-left">
            <IconCalendar />
            <div>
              <div className="text-xs text-gray-500">Даты аренды</div>
              <div className="text-sm font-medium">
                {value.startAt && value.endAt
                  ? `${format(value.startAt, "d MMM, HH:mm", {
                      locale,
                    })} — ${format(value.endAt, "d MMM, HH:mm", { locale })}`
                  : "Выберите даты"}
              </div>
            </div>
          </div>
          <IconChevron dir="right" />

        </button> */}

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="fixed inset-0 z-50 bg-white top-16"
            >
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 p-2 bg-white">
                <div className="w-[64px]" />
                <div className="font-medium">Выбор дат</div>
                <button
                  className="p-2 border rounded-xl hover:bg-gray-100 text-sm"
                  onClick={() => {
                    commit();
                    setMobileOpen(false);
                  }}
                >
                  Закрыть
                </button>
              </div>

              <div className="p-4 pb-40">{CalendarGrid}</div>

              {/* Bottom time sliders */}
              <div className="hidden fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">Выдача</div>
                    <div className="mt-1 text-sm font-medium min-h-[20px]">
                      {tempRange.startAt
                        ? format(tempRange.startAt, "d MMM, HH:mm", { locale })
                        : "—"}
                    </div>
                    {tempRange.startAt && (
                      <div className="mt-2">
                        <input
                          type="range"
                          min={0}
                          max={timeStepsPerDay - 1}
                          step={1}
                          value={startIdx}
                          onChange={(e) =>
                            setStartIdx(parseInt(e.target.value))
                          }
                          className="w-full accent-green-400"
                        />
                        <div className="mt-1 text-[11px] text-gray-500">
                          Шаг {minuteStep} мин ·{" "}
                          {format(
                            idxToTime(tempRange.startAt, startIdx, minuteStep),
                            "HH:mm"
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">Возврат</div>
                    <div className="mt-1 text-sm font-medium min-h-[20px]">
                      {tempRange.endAt
                        ? format(tempRange.endAt, "d MMM, HH:mm", { locale })
                        : "—"}
                    </div>
                    {tempRange.endAt && (
                      <div className="mt-2">
                        <input
                          type="range"
                          min={0}
                          max={timeStepsPerDay - 1}
                          step={1}
                          value={endIdx}
                          onChange={(e) => setEndIdx(parseInt(e.target.value))}
                          className="w-full accent-green-600"
                        />
                        <div className="mt-1 text-[11px] text-gray-500">
                          Шаг {minuteStep} мин ·{" "}
                          {format(
                            idxToTime(tempRange.endAt, endIdx, minuteStep),
                            "HH:mm"
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    className="px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
                    onClick={() => setTempRange(value)}
                  >
                    Сбросить
                  </button>
                  <button
                    className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
                    disabled={
                      !tempRange.startAt || !tempRange.endAt || rangeBlocked
                    }
                    onClick={() => {
                      commit();
                      setMobileOpen(false);
                    }}
                  >
                    Готово
                  </button>
                </div>
              </div>
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
