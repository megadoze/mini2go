import React, { useMemo, useState, useEffect } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfDay,
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
  minuteStep?: 5 | 10 | 15 | 20 | 30 | 60;
  minDate?: Date;
  maxDate?: Date;
  disabledIntervals?: DisabledInterval[];
  initialMonth?: Date;
  locale?: Locale;
  className?: string;
  mobileStartOpen?: boolean;

  /** НОВОЕ: рабочее время в минутах от 00:00 */
  openTimeMinutes?: number; // например 480 для 08:00
  closeTimeMinutes?: number; // например 1230 для 20:30

  /** НОВОЕ: минимальный и максимальный срок аренды (в днях) */
  minRentDays?: number;
  maxRentDays?: number;
};

function roundUpToStep(d: Date, step: number) {
  const t = new Date(d);
  t.setSeconds(0, 0);
  const over = t.getMinutes() % step;
  if (over) t.setMinutes(t.getMinutes() + (step - over));
  return t;
}

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

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  // строгое пересечение: касание концов НЕ считается пересечением
  return aStart < bEnd && bStart < aEnd;
}

// вернуть все блокировки, которые пересекают указанный день (startOfDay..endOfDay)
function intervalsForDay(day: Date, intervals: DisabledInterval[] = []) {
  const s = startOfDay(day);
  const e = endOfDay(day);
  return intervals.filter((iv) => overlaps(s, e, iv.start, iv.end));
}

// найти ближайшую блокировку слева (то есть с end < dayEnd), возвращает самую правую такую
function nearestLeftInterval(day: Date, intervals: DisabledInterval[] = []) {
  const dayStart = startOfDay(day);
  let cand: DisabledInterval | null = null;
  for (const iv of intervals) {
    if (iv.end.getTime() <= dayStart.getTime()) {
      if (!cand || iv.end.getTime() > cand.end.getTime()) cand = iv;
    }
  }
  return cand;
}

// найти ближайшую блокировку справа (то есть с start > dayStart), возвращает самую левую такую
function nearestRightInterval(day: Date, intervals: DisabledInterval[] = []) {
  const dayEnd = endOfDay(day);
  let cand: DisabledInterval | null = null;
  for (const iv of intervals) {
    if (iv.start.getTime() >= dayEnd.getTime()) {
      if (!cand || iv.start.getTime() < cand.start.getTime()) cand = iv;
    }
  }
  return cand;
}

// конвертация времени в индекс (0..timeStepsPerDay-1) — у тебя уже есть timeToIdx / idxToTime,
// но для границ может пригодиться функция clampIndexFromTime
function timeToIdxClamped(d: Date, step: number, stepsPerDay: number) {
  return Math.min(stepsPerDay - 1, Math.max(0, timeToIdx(d, step)));
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
  return Math.floor(minutes / step);
}

function buildTimeOnDay(day: Date, totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const withH = setHours(startOfDay(day), h);
  return setMinutes(withH, m);
}

function formatDayHint(
  kind: "start" | "end",
  day: Date | null,
  intervals: DisabledInterval[] = [],
  openTimeMinutes?: number,
  closeTimeMinutes?: number,
  minuteStep: number = 30,
  locale?: Locale
) {
  if (!day) return "";

  // рабочее окно на этот день
  const workStart =
    typeof openTimeMinutes === "number"
      ? buildTimeOnDay(day, openTimeMinutes)
      : startOfDay(day);

  const workEnd =
    typeof closeTimeMinutes === "number"
      ? buildTimeOnDay(day, closeTimeMinutes)
      : endOfDay(day);

  // все блокировки в этот день
  const sameDayIntervals = intervalsForDay(day, intervals);

  // если нет блокировок — весь рабочий день свободен
  if (sameDayIntervals.length === 0) {
    const fromStr = format(workStart, "HH:mm", { locale });
    const toStr = format(workEnd, "HH:mm", { locale });

    return kind === "start"
      ? `Can be picked up from ${fromStr} to ${toStr}`
      : `Can be returned from ${fromStr} to ${toStr}`;
  }

  // найдём минимальное начало и максимальный конец брони в этот день
  let earliestStart = sameDayIntervals[0].start;
  let latestEnd = sameDayIntervals[0].end;

  for (const iv of sameDayIntervals) {
    if (iv.start < earliestStart) earliestStart = iv.start;
    if (iv.end > latestEnd) latestEnd = iv.end;
  }

  if (kind === "start") {
    // для старта важно: когда освободится после последней брони
    const from = latestEnd > workStart ? latestEnd : workStart;

    if (from >= workEnd) {
      return "There is no available time to start the rental on this day.";
    }

    const fromStr = format(from, "HH:mm", { locale });
    const toStr = format(workEnd, "HH:mm", { locale });

    return `You can pick up from ${fromStr} to ${toStr}`;
  } else {
    // для окончания важно: до первой брони в этот день
    const to = earliestStart < workEnd ? earliestStart : workEnd;

    if (to <= workStart) {
      return "There is no free time to end the rental on this day.";
    }

    const fromStr = format(workStart, "HH:mm", { locale });
    const toStr = format(to, "HH:mm", { locale });

    return `Can be returned from ${fromStr} to ${toStr}`;
  }
}

// есть ли на дне свободное окно между open/close, не попадающее в блокировки
function isDayFullyBlocked(
  day: Date,
  intervals: DisabledInterval[] = [],
  openTimeMinutes?: number,
  closeTimeMinutes?: number,
  minuteStep: number = 30
) {
  // 🔥 НОВОЕ: если это сегодня и время уже позже окончания бронирования — день считаем полностью заблокированным
  if (typeof closeTimeMinutes === "number" && isSameDay(day, new Date())) {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    if (nowMinutes >= closeTimeMinutes) {
      return true;
    }
  }

  const workStart =
    typeof openTimeMinutes === "number"
      ? buildTimeOnDay(day, openTimeMinutes)
      : startOfDay(day);

  const workEnd =
    typeof closeTimeMinutes === "number"
      ? buildTimeOnDay(day, closeTimeMinutes)
      : endOfDay(day);

  if (workEnd <= workStart) return false; // некорректный диапазон — считаем, что день не полностью забит

  // пересечения блокировок с рабочим временем
  const overlapsInWork = intervals
    .map((iv) => {
      const s = iv.start > workStart ? iv.start : workStart;
      const e = iv.end < workEnd ? iv.end : workEnd;
      if (e <= s) return null;
      return { start: s, end: e };
    })
    .filter(Boolean) as DisabledInterval[];

  if (overlapsInWork.length === 0) return false; // вообще нет блокировок в рабочее время — точно не полностью забит

  // мержим блокировки
  const sorted = overlapsInWork.sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );
  const merged: DisabledInterval[] = [];
  for (const iv of sorted) {
    if (!merged.length) {
      merged.push({ ...iv });
    } else {
      const last = merged[merged.length - 1];
      if (iv.start <= last.end) {
        if (iv.end > last.end) last.end = iv.end;
      } else {
        merged.push({ ...iv });
      }
    }
  }

  // ищем свободное окно длиной хотя бы minuteStep
  const minFreeMs = minuteStep * 60_000;
  let cursor = workStart;

  for (const iv of merged) {
    if (iv.start.getTime() - cursor.getTime() >= minFreeMs) {
      // есть «дырка» между cursor и iv.start
      return false; // значит день НЕ полностью заблокирован
    }
    if (iv.end > cursor) cursor = iv.end;
  }

  // проверяем хвост после последней блокировки
  if (workEnd.getTime() - cursor.getTime() >= minFreeMs) {
    return false;
  }

  // свободного окна нет — день полностью заблокирован
  return true;
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
  openTimeMinutes,
  closeTimeMinutes,
  minRentDays,
  maxRentDays,
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
    const start = startOfWeek(startOfMonth(currentMonth), {
      locale,
      weekStartsOn: 1,
    });
    const end = endOfWeek(endOfMonth(currentMonth), {
      locale,
      weekStartsOn: 1,
    });
    const days = eachDayOfInterval({ start, end });
    return Array.from({ length: Math.ceil(days.length / 7) }, (_, i) =>
      days.slice(i * 7, i * 7 + 7)
    );
  }, [currentMonth, locale]);

  function handleDayClick(day: Date) {
    if (isDateDisabled(day, effectiveMinDate, maxDate)) return;

    // день кликается только если в рабочем окне open/close есть свободное окно
    if (
      isDayFullyBlocked(
        day,
        disabledIntervals,
        openTimeMinutes,
        closeTimeMinutes,
        minuteStep
      )
    ) {
      return;
    }

    const { startAt, endAt } = tempRange;

    // базовое время по умолчанию
    const defaultHour =
      typeof openTimeMinutes === "number"
        ? Math.floor(openTimeMinutes / 60)
        : 10;

    const defaultMinute =
      typeof openTimeMinutes === "number" ? openTimeMinutes % 60 : 0;

    // рабочее окно для произвольного дня
    const getWorkBoundsForDay = (d: Date) => {
      const workStart =
        typeof openTimeMinutes === "number"
          ? buildTimeOnDay(d, openTimeMinutes)
          : startOfDay(d);

      const workEnd =
        typeof closeTimeMinutes === "number"
          ? buildTimeOnDay(d, closeTimeMinutes)
          : endOfDay(d);

      return { workStart, workEnd };
    };

    // --- 1) ПЕРВЫЙ КЛИК — ВЫБОР СТАРТА ---
    if (!startAt || (startAt && endAt)) {
      let candidate: Date;

      if (value.startAt) {
        const h = value.startAt.getHours();
        const m = value.startAt.getMinutes();
        candidate = setMinutes(setHours(day, h), m);
      } else if (isSameDay(day, new Date())) {
        candidate = roundUpToStep(new Date(), minuteStep);
      } else {
        candidate = setMinutes(setHours(day, defaultHour), defaultMinute);
      }

      const { workStart, workEnd } = getWorkBoundsForDay(day);
      const sameDayIntervals = intervalsForDay(day, disabledIntervals);

      if (sameDayIntervals.length > 0) {
        // есть частичные блокировки — стартуем после последней
        let latestEnd = sameDayIntervals[0].end;
        for (const iv of sameDayIntervals) {
          if (iv.end > latestEnd) latestEnd = iv.end;
        }

        let from = latestEnd > workStart ? latestEnd : workStart;

        if (isSameDay(day, new Date())) {
          const nowStep = roundUpToStep(new Date(), minuteStep);
          if (nowStep > from) from = nowStep;
        }

        candidate = roundUpToStep(from, minuteStep);
      } else {
        // без блокировок — в пределах рабочего окна + «не раньше сейчас»
        if (candidate < workStart) candidate = workStart;

        if (isSameDay(day, new Date())) {
          const nowStep = roundUpToStep(new Date(), minuteStep);
          if (candidate < nowStep) candidate = nowStep;
        }

        candidate = roundUpToStep(candidate, minuteStep);
      }

      // защита от ухода за конец рабочего дня
      if (candidate >= workEnd) {
        candidate = new Date(workEnd.getTime() - minuteStep * 60_000);
      }

      setTempRange({ startAt: candidate, endAt: null });
      return;
    }

    // --- 2) ВТОРОЙ КЛИК — ВЫБОР КОНЦА ---
    const baseTime = tempRange.startAt ?? value.startAt ?? new Date();
    const baseHour = baseTime.getHours();
    const baseMinute = baseTime.getMinutes();

    const withBaseTime = (d: Date) =>
      setMinutes(setHours(d, baseHour), baseMinute);

    const startDay = startOfDay(startAt);
    const clickDay = startOfDay(day);

    // если кликнули ЛЕВЕЕ старта — считаем, что это новый старт
    if (isBefore(clickDay, startDay)) {
      const newStart = withBaseTime(clickDay);

      const { workStart, workEnd } = getWorkBoundsForDay(clickDay);
      const sameDayIntervals = intervalsForDay(clickDay, disabledIntervals);
      let candidate = newStart;

      if (sameDayIntervals.length > 0) {
        let latestEnd = sameDayIntervals[0].end;
        for (const iv of sameDayIntervals) {
          if (iv.end > latestEnd) latestEnd = iv.end;
        }
        let from = latestEnd > workStart ? latestEnd : workStart;

        if (isSameDay(clickDay, new Date())) {
          const nowStep = roundUpToStep(new Date(), minuteStep);
          if (nowStep > from) from = nowStep;
        }

        candidate = roundUpToStep(from, minuteStep);
      } else {
        if (candidate < workStart) candidate = workStart;
        if (isSameDay(clickDay, new Date())) {
          const nowStep = roundUpToStep(new Date(), minuteStep);
          if (candidate < nowStep) candidate = nowStep;
        }
        candidate = roundUpToStep(candidate, minuteStep);
      }

      if (candidate >= workEnd) {
        candidate = new Date(workEnd.getTime() - minuteStep * 60_000);
      }

      setTempRange({ startAt: candidate, endAt: null });
      return;
    }

    // здесь гарантированно clickDay >= startDay, идём только вперёд
    const fromDay = startDay;
    const toDay = clickDay;

    // ищем первый полностью заблокированный день между fromDay и toDay
    let limitDay = toDay;
    for (let d = addDays(fromDay, 1); !isAfter(d, toDay); d = addDays(d, 1)) {
      if (
        isDayFullyBlocked(
          d,
          disabledIntervals,
          openTimeMinutes,
          closeTimeMinutes,
          minuteStep
        )
      ) {
        limitDay = addDays(d, -1); // обрываемся на день до блокировки
        break;
      }
    }

    if (isBefore(limitDay, fromDay)) {
      return;
    }

    const finalStart = withBaseTime(fromDay);

    // --- НОВОЕ: двигаем КОНЕЧНОЕ время в доступное окно, если день частично занят ---
    const { workStart: endWorkStart, workEnd: endWorkEnd } =
      getWorkBoundsForDay(limitDay);
    const sameDayEndIntervals = intervalsForDay(limitDay, disabledIntervals);

    let finalEnd = withBaseTime(limitDay);

    if (sameDayEndIntervals.length > 0) {
      // для конца важно: ДО первой брони
      let earliestStart = sameDayEndIntervals[0].start;
      for (const iv of sameDayEndIntervals) {
        if (iv.start < earliestStart) earliestStart = iv.start;
      }

      const to = earliestStart < endWorkEnd ? earliestStart : endWorkEnd;

      // clamp по рабочему дню
      if (finalEnd > to) finalEnd = to;
      if (finalEnd < endWorkStart) finalEnd = endWorkStart;

      // не раньше старта
      if (finalEnd < finalStart) finalEnd = finalStart;

      // не в прошлом для сегодняшнего дня
      if (isSameDay(limitDay, new Date())) {
        const nowStep = roundUpToStep(new Date(), minuteStep);
        if (finalEnd < nowStep) finalEnd = nowStep;
      }

      // привязка к шагу вниз (чтобы не улететь за to)
      const idx = timeToIdx(finalEnd, minuteStep);
      finalEnd = idxToTime(limitDay, idx, minuteStep);
    } else {
      // день без блокировок, но всё равно уважаем рабочие границы и старт
      if (finalEnd < endWorkStart) finalEnd = endWorkStart;
      if (finalEnd > endWorkEnd) finalEnd = endWorkEnd;
      if (finalEnd < finalStart) finalEnd = finalStart;

      if (isSameDay(limitDay, new Date())) {
        const nowStep = roundUpToStep(new Date(), minuteStep);
        if (finalEnd < nowStep) finalEnd = nowStep;
      }

      const idx = timeToIdx(finalEnd, minuteStep);
      finalEnd = idxToTime(limitDay, idx, minuteStep);
    }

    setTempRange({ startAt: finalStart, endAt: finalEnd });
  }

  const oneDayMs = 24 * 60 * 60 * 1000;

  const hasFullRange = !!(tempRange.startAt && tempRange.endAt);

  const rentDurationDays =
    hasFullRange && tempRange.startAt && tempRange.endAt
      ? (tempRange.endAt.getTime() - tempRange.startAt.getTime()) / oneDayMs
      : 0;

  const violatesMinMax =
    hasFullRange &&
    ((typeof minRentDays === "number" && rentDurationDays < minRentDays) ||
      (typeof maxRentDays === "number" && rentDurationDays > maxRentDays));

  function commit(next?: DateRange) {
    const nowStep = roundUpToStep(new Date(), minuteStep);
    const src = next ?? { ...tempRange };
    const startOk = src.startAt
      ? new Date(Math.max(+src.startAt, +nowStep))
      : null;
    const endOk = src.endAt ? new Date(Math.max(+src.endAt, +nowStep)) : null;
    onChange({ startAt: startOk, endAt: endOk });
  }

  // --- Time slider helpers
  const timeStepsPerDay = Math.floor((24 * 60) / minuteStep);

  // индексы (0..steps-1), соответствующие open/close
  const dayOpenIdx = useMemo(() => {
    if (typeof openTimeMinutes !== "number") return 0;
    return Math.min(
      timeStepsPerDay - 1,
      Math.max(0, Math.floor(openTimeMinutes / minuteStep))
    );
  }, [openTimeMinutes, minuteStep, timeStepsPerDay]);

  const dayCloseIdx = useMemo(() => {
    if (typeof closeTimeMinutes !== "number") return timeStepsPerDay - 1;
    // closeTime — момент закрытия, поэтому берём последний индекс, попадающий < closeTime
    return Math.min(
      timeStepsPerDay - 1,
      Math.max(0, Math.ceil(closeTimeMinutes / minuteStep) - 0)
    );
  }, [closeTimeMinutes, minuteStep, timeStepsPerDay]);

  const { startAt, endAt } = tempRange;

  const allowedTimeBounds = useMemo(() => {
    const steps = timeStepsPerDay;

    let startMin = dayOpenIdx;
    let startMax = dayCloseIdx;
    let endMin = dayOpenIdx;
    let endMax = dayCloseIdx;

    if (startAt) {
      const day = startAt;
      const left = nearestLeftInterval(day, disabledIntervals);
      const right = nearestRightInterval(day, disabledIntervals);

      if (left) {
        const allowedFrom = new Date(left.end.getTime() + 60_000);
        if (isSameDay(allowedFrom, day)) {
          startMin = Math.max(
            startMin,
            timeToIdxClamped(allowedFrom, minuteStep, steps)
          );
        }
      }

      if (right) {
        const allowedTo = new Date(right.start.getTime() - 60_000);
        if (isSameDay(allowedTo, day)) {
          startMax = Math.min(
            startMax,
            timeToIdxClamped(allowedTo, minuteStep, steps)
          );
        }
      }
    }

    if (endAt) {
      const day = endAt;
      const left = nearestLeftInterval(day, disabledIntervals);
      const right = nearestRightInterval(day, disabledIntervals);

      if (left) {
        const allowedFrom = new Date(left.end.getTime() + 60_000);
        if (isSameDay(allowedFrom, day)) {
          endMin = Math.max(
            endMin,
            timeToIdxClamped(allowedFrom, minuteStep, steps)
          );
        }
      }

      if (right) {
        const allowedTo = new Date(right.start.getTime() - 60_000);
        if (isSameDay(allowedTo, day)) {
          endMax = Math.min(
            endMax,
            timeToIdxClamped(allowedTo, minuteStep, steps)
          );
        }
      }
    }

    if (startMin > startMax) startMin = Math.max(dayOpenIdx, startMax);
    if (endMin > endMax) endMin = Math.max(dayOpenIdx, endMax);

    return { startMin, startMax, endMin, endMax };
  }, [
    startAt, // <= простые зависимости
    endAt,
    disabledIntervals,
    minuteStep,
    timeStepsPerDay,
    dayOpenIdx,
    dayCloseIdx,
  ]);

  const startIdx = useMemo(() => {
    if (!tempRange.startAt) return Math.max(0, allowedTimeBounds.startMin);
    const raw = Math.min(
      timeStepsPerDay - 1,
      timeToIdx(tempRange.startAt, minuteStep)
    );
    return Math.min(
      Math.max(raw, allowedTimeBounds.startMin),
      allowedTimeBounds.startMax
    );
  }, [minuteStep, tempRange.startAt, timeStepsPerDay, allowedTimeBounds]);

  const endIdx = useMemo(() => {
    if (!tempRange.endAt)
      return Math.min(timeStepsPerDay - 1, allowedTimeBounds.endMax);
    const raw = Math.min(
      timeStepsPerDay - 1,
      timeToIdx(tempRange.endAt, minuteStep)
    );
    return Math.min(
      Math.max(raw, allowedTimeBounds.endMin),
      allowedTimeBounds.endMax
    );
  }, [minuteStep, tempRange.endAt, timeStepsPerDay, allowedTimeBounds]);

  useEffect(() => {
    if (!startAt) return;

    const rawIdx = Math.min(
      timeStepsPerDay - 1,
      timeToIdx(startAt, minuteStep)
    );

    const clampedIdx = Math.min(
      allowedTimeBounds.startMax,
      Math.max(allowedTimeBounds.startMin, rawIdx)
    );

    if (clampedIdx !== rawIdx) {
      const snapped = idxToTime(startAt, clampedIdx, minuteStep);

      if (snapped.getTime() !== startAt.getTime()) {
        setTimeout(() => {
          setTempRange((prev) =>
            prev.startAt ? { ...prev, startAt: snapped } : prev
          );
        }, 0);
      }
    }
  }, [
    startAt,
    allowedTimeBounds.startMin,
    allowedTimeBounds.startMax,
    minuteStep,
    timeStepsPerDay,
  ]);

  // --- НОВОЕ: автосдвиг endAt в доступное окно, если день частично занят
  useEffect(() => {
    if (!endAt) return;

    const rawIdx = Math.min(timeStepsPerDay - 1, timeToIdx(endAt, minuteStep));

    const clampedIdx = Math.min(
      allowedTimeBounds.endMax,
      Math.max(allowedTimeBounds.endMin, rawIdx)
    );

    if (clampedIdx !== rawIdx) {
      const snapped = idxToTime(endAt, clampedIdx, minuteStep);

      if (snapped.getTime() !== endAt.getTime()) {
        setTimeout(() => {
          setTempRange((prev) =>
            prev.endAt ? { ...prev, endAt: snapped } : prev
          );
        }, 0);
      }
    }
  }, [
    endAt,
    allowedTimeBounds.endMin,
    allowedTimeBounds.endMax,
    minuteStep,
    timeStepsPerDay,
  ]);

  function setStartIdx(idx: number) {
    if (!tempRange.startAt) return;
    // clamp to allowed bounds
    const clampedIdx = Math.min(
      Math.max(idx, allowedTimeBounds.startMin),
      allowedTimeBounds.startMax
    );
    const base = tempRange.startAt;
    let next = idxToTime(base, clampedIdx, minuteStep);
    if (isSameDay(base, new Date())) {
      const nowStep = roundUpToStep(new Date(), minuteStep);
      if (next < nowStep) next = nowStep;
    }
    setTempRange((prev) => ({ ...prev, startAt: next }));
  }

  function setEndIdx(idx: number) {
    if (!tempRange.endAt) return;
    const clampedIdx = Math.min(
      Math.max(idx, allowedTimeBounds.endMin),
      allowedTimeBounds.endMax
    );
    const base = tempRange.endAt;
    let next = idxToTime(base, clampedIdx, minuteStep);
    if (isSameDay(base, new Date())) {
      const nowStep = roundUpToStep(new Date(), minuteStep);
      if (next < nowStep) next = nowStep;
    }
    setTempRange((prev) => ({ ...prev, endAt: next }));
  }

  function isRangeBlocked(
    start: Date | null,
    end: Date | null,
    intervals: DisabledInterval[] = []
  ) {
    if (!start || !end) return false;
    return intervals.some((iv) => overlaps(start, end, iv.start, iv.end));
  }

  // const rangeBlocked = isRangeBlocked(tempRange.startAt, tempRange.endAt);
  const rangeBlocked = isRangeBlocked(
    tempRange.startAt,
    tempRange.endAt,
    disabledIntervals
  );

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

  // --- Render helpers (DayCell, CalendarGrid) — оставлены без изменений ---
  const DayCell: React.FC<{ d: Date }> = ({ d }) => {
    const inCurrent = isSameMonth(d, currentMonth);

    const fullyBlocked = isDayFullyBlocked(
      d,
      disabledIntervals,
      openTimeMinutes,
      closeTimeMinutes,
      minuteStep
    );

    const dayIntervals = intervalsForDay(d, disabledIntervals);
    const hasPartial = dayIntervals.length > 0 && !fullyBlocked; // есть блокировки, но день не полностью забит

    const disabled =
      isDateDisabled(d, effectiveMinDate, maxDate) || fullyBlocked;

    const isStart = tempRange.startAt && isSameDay(d, tempRange.startAt);
    const isEnd = tempRange.endAt && isSameDay(d, tempRange.endAt);
    const isSingle = Boolean(isStart && isEnd);

    let inRange = false;

    if (tempRange.startAt && tempRange.endAt) {
      inRange = isWithinInterval(d, {
        start: startOfDay(tempRange.startAt),
        end: endOfDay(tempRange.endAt),
      });
    } else if (canHover && tempRange.startAt && hoverDay) {
      const sDay = startOfDay(tempRange.startAt);
      const hDay = startOfDay(hoverDay);

      // если навели на тот же день или левее — НИКАКОГО шлейфа назад, только стартовый день
      if (!isAfter(hDay, sDay)) {
        inRange = isSameDay(d, sDay);
      } else {
        // === ДВИЖЕНИЕ ВПРАВО ОТ СТАРТА ===
        const rangeStart = sDay;
        let rangeEnd = hDay;

        for (
          let cur = addDays(sDay, 1);
          !isAfter(cur, hDay);
          cur = addDays(cur, 1)
        ) {
          if (
            isDayFullyBlocked(
              cur,
              disabledIntervals,
              openTimeMinutes,
              closeTimeMinutes,
              minuteStep
            )
          ) {
            // обрываемся на день ДО первой заблокированной
            rangeEnd = addDays(cur, -1);
            break;
          }
        }

        if (!isBefore(rangeEnd, rangeStart)) {
          inRange = isWithinInterval(d, {
            start: rangeStart,
            end: rangeEnd,
          });
        } else {
          // всё отрезали — остаётся только стартовый день
          inRange = isSameDay(d, sDay);
        }
      }
    }

    const classes = [
      "relative h-10 my-1 w-full flex items-center justify-center text-sm select-none font-roboto-condensed",
      !inCurrent ? "text-gray-400" : "",
      disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
      inRange ? "bg-emerald-50/60 border-y-2 border-emerald-300" : "",
      isSingle
        ? "border-emerald-300 rounded-full border-2 border-emerald-300"
        : "",
      isStart && !isEnd
        ? "border border-2 border-emerald-300 rounded-l-full border-r-0 pr-[2px]"
        : "",
      isEnd && !isStart
        ? " border-2 border-emerald-300 rounded-r-full border-l-0 pl-[2px]"
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
        <span
          className={isStart || isEnd ? "font-medium text-emerald-900" : ""}
        >
          {format(d, "d", { locale })}
        </span>
        {hasPartial && !disabled && !isStart && !isEnd && (
          <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />
        )}
      </div>
    );
  };

  const CalendarGrid = (
    <div className="rounded-2xl border-gray-200 p-3 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between">
        <button
          className="p-2 rounded-xl hover:bg-gray-100 cursor-pointer"
          onClick={() => setCurrentMonth((m) => addMonths(m, -1))}
          aria-label="Prev month"
        >
          <ChevronLeftIcon className=" size-4" />
        </button>
        <div className="font-medium font-roboto-condensed">
          {format(currentMonth, "LLLL yyyy", { locale })}
        </div>
        <button
          className="p-2 rounded-xl hover:bg-gray-100 cursor-pointer"
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          aria-label="Next month"
        >
          <ChevronRightIcon className=" size-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 text-center text-xs text-gray-500">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i}>
            {format(
              addDays(startOfWeek(new Date(), { locale, weekStartsOn: 1 }), i),
              "EEEEE",
              {
                locale,
              }
            )}
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

      <div className=" mt-2 grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 p-2">
          <div className=" flex justify-between">
            <div className="text-xs text-gray-500 font-roboto-condensed">
              Pick Up
            </div>
            <div className="mt-1 text-sm font-medium min-h-5 font-roboto-condensed">
              {tempRange.startAt
                ? format(tempRange.startAt, "d MMM, HH:mm", { locale })
                : "—"}
            </div>
          </div>

          {tempRange.startAt && (
            <div className="my-3">
              <Slider
                min={allowedTimeBounds.startMin}
                max={allowedTimeBounds.startMax}
                step={1}
                value={startIdx}
                onChange={setStartIdx}
                color="oklch(76.5% 0.177 163.223)"
                size="sm"
                radius="xl"
                thumbSize={25}
                className="w-full"
                label={null}
              />
            </div>
          )}
          {tempRange.startAt && disabledIntervals.length > 0 && (
            <div className="mt-1 text-xs text-gray-700">
              {tempRange.startAt && (
                <div>
                  {tempRange.startAt && (
                    <div>
                      {formatDayHint(
                        "start",
                        tempRange.startAt,
                        disabledIntervals,
                        openTimeMinutes,
                        closeTimeMinutes,
                        minuteStep,
                        locale
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 p-2">
          <div className=" flex justify-between">
            <div className="text-xs text-gray-500 font-roboto-condensed">
              Drop Off
            </div>
            <div className="mt-1 text-sm font-medium min-h-5 font-roboto-condensed">
              {tempRange.endAt
                ? format(tempRange.endAt, "d MMM, HH:mm", { locale })
                : "—"}
            </div>
          </div>

          {tempRange.endAt && (
            <div className="my-3">
              <Slider
                min={allowedTimeBounds.endMin}
                max={allowedTimeBounds.endMax}
                step={1}
                value={endIdx}
                onChange={setEndIdx}
                color="oklch(76.5% 0.177 163.223)"
                size="sm"
                radius="xl"
                thumbSize={25}
                className="w-full"
                label={null}
              />
            </div>
          )}
          {tempRange.endAt && disabledIntervals.length > 0 && (
            <div className="mt-1 text-xs text-gray-700">
              {tempRange.endAt && (
                <div>
                  {formatDayHint(
                    "end",
                    tempRange.endAt,
                    disabledIntervals,
                    openTimeMinutes,
                    closeTimeMinutes,
                    minuteStep,
                    locale
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs text-red-500 min-h-4">
          {violatesMinMax && minRentDays && maxRentDays
            ? `Acceptable rental period: from ${minRentDays} to ${maxRentDays} days`
            : violatesMinMax && minRentDays
            ? `Minimum rental period: ${minRentDays} days`
            : violatesMinMax && maxRentDays
            ? `Maximum rental period: ${maxRentDays} days`
            : ""}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <button
              className=" px-4 py-2 border border-black/50 rounded-xl hover:bg-gray-100 cursor-pointer font-roboto-condensed!"
              onClick={() => {
                commit(value);
                setTempRange(value);
                setMobileOpen(false);
              }}
            >
              Close
            </button>
          </div>

          <div className="py-2 flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer font-roboto-condensed!"
              onClick={() => setTempRange(value)}
            >
              Reset
            </button>
            <button
              className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50 cursor-pointer font-roboto-condensed!"
              disabled={
                !tempRange.startAt ||
                !tempRange.endAt ||
                rangeBlocked ||
                violatesMinMax
              }
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
              className="fixed inset-0 z-50 bg-white top-0"
            >
              <div className="p-4 pb-40">{CalendarGrid}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
