export function minutesSinceMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

export function isWithinDailyWindow(
  startMin: number,
  endMin: number,
  timeMin: number,
  inclusiveEnd = false
) {
  if (endMin === startMin) return true; // 24/7
  if (endMin > startMin) {
    return (
      timeMin >= startMin &&
      (inclusiveEnd ? timeMin <= endMin : timeMin < endMin)
    );
  } else {
    // окно через полночь (например 22:00–06:00)
    return (
      timeMin >= startMin ||
      (inclusiveEnd ? timeMin <= endMin : timeMin < endMin)
    );
  }
}

export function mmToHHMM(m: number) {
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
