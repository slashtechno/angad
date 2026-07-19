import { useState, useEffect } from "react";

/**
 * Returns a clock string that ticks once per second and a date string that
 * ticks once per minute. Both update via a single setInterval; the date is
 * re-read from the Date object on each tick and only the values that
 * changed are passed up via setState.
 */
export function useClock() {
  const [clockStr, setClockStr] = useState(() => fmtTime(new Date()));
  const [dateStr, setDateStr] = useState(() => fmtDate(new Date()));

  useEffect(() => {
    // Align the first tick to the next second so the seconds digit updates
    // consistently. Then tick once per second.
    const now = new Date();
    const msToNextSecond = 1000 - now.getMilliseconds();
    const timeout = setTimeout(() => {
      setClockStr(fmtTime(new Date()));
      const id = setInterval(() => {
        const d = new Date();
        setClockStr(fmtTime(d));
        // Date is cheap to re-format once per second
        setDateStr(fmtDate(d));
      }, 1000);
      // Save interval id on the timeout's data so cleanup can find it.
      (timeout as unknown as { _id: ReturnType<typeof setInterval> })._id = id;
    }, msToNextSecond);
    return () => {
      clearTimeout(timeout);
      const interval = (timeout as unknown as { _id?: ReturnType<typeof setInterval> })._id;
      if (interval) clearInterval(interval);
    };
  }, []);

  return { clockStr, dateStr };
}

function fmtTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
const pad = (n: number) => String(n).padStart(2, "0");
