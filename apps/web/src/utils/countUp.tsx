import { useEffect, useRef, useState } from "react";

export function CountUp({
  end,
  duration = 1000,
  formatter,
  label,
}: {
  end: number;
  duration?: number;
  formatter?: (n: number) => string;
  label: string;
}) {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);
  const elRef = useRef<HTMLDivElement | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio > 0.6 && !started) {
          setStarted(true);
        }
      },
      {
        threshold: [0, 0.5, 1],
        rootMargin: "0px 0px -50px 0px",
      }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const startValue = 0;
    const startTime = performance.now();

    const animate = (time: number) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (end - startValue) * eased;
      setValue(current);
      if (progress < 1) frame.current = requestAnimationFrame(animate);
    };

    frame.current = requestAnimationFrame(animate);
  }, [started, end, duration]);

  return (
    <div ref={elRef} className="rounded-2xl p-4 text-center">
      <div className="text-4xl md:text-6xl font-bold">
        {formatter ? formatter(value) : Math.round(value)}
      </div>
      <div className="text-xs text-neutral-500 uppercase tracking-wide pt-1">
        {label}
      </div>
    </div>
  );
}
