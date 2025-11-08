"use client";

import { useEffect, useRef, useState } from "react";
import { VIDEO_TEASERS } from "@/constants/carOptions";
import { motion } from "framer-motion";
import Image from "next/image";

const CARD_SIZES = "(max-width: 768px) 82vw, (max-width: 1024px) 340px, 380px";

// вынесли ВВЕРХ, до useEffect
function waitFirstFrame(el: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    // нормальные браузеры
    if (typeof el.requestVideoFrameCallback === "function") {
      el.requestVideoFrameCallback(() => resolve());
      // страховка
      setTimeout(() => resolve(), 150);
      return;
    }

    const onLoaded = () => {
      cleanup();
      resolve();
    };

    const onTime = () => {
      if (el.currentTime > 0) {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      el.removeEventListener("loadeddata", onLoaded as EventListener);
      el.removeEventListener("timeupdate", onTime as EventListener);
    };

    el.addEventListener(
      "loadeddata",
      onLoaded as EventListener,
      { once: true } as AddEventListenerOptions
    );
    el.addEventListener("timeupdate", onTime as EventListener);

    // финальная страховка
    setTimeout(() => {
      cleanup();
      resolve();
    }, 200);
  });
}

export const VideoSection = () => {
  // ====== DESKTOP refs ======
  const storyRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [hoveredStory, setHoveredStory] = useState<number | null>(null);

  // ====== MOBILE refs ======
  const mobileRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [mobilePlaying, setMobilePlaying] = useState<number | null>(null);
  const [mobileActive, setMobileActive] = useState<number | null>(null);
  const [mobileVisible, setMobileVisible] = useState<Record<number, boolean>>(
    {}
  );
  const mobileStartTokenRef = useRef<(symbol | null)[]>([]);
  const userPausedRef = useRef<Set<number>>(new Set());

  const isTouchRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  // ===== mount fix for Next =====
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // ===== detect touch =====
  useEffect(() => {
    if (typeof window !== "undefined" && "matchMedia" in window) {
      const noHover = window.matchMedia("(hover: none)").matches;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      isTouchRef.current = noHover || coarse;
    }
  }, []);

  // ===== helpers =====
  const stopAndPoster = (v: HTMLVideoElement) => {
    v.pause();
    try {
      v.currentTime = 0;
    } catch {}
  };

  const stopMobileVideo = (idx: number, v: HTMLVideoElement) => {
    mobileStartTokenRef.current[idx] = null;
    setMobileVisible((s) => ({ ...s, [idx]: false }));
    stopAndPoster(v);
  };

  // ===== DESKTOP =====
  const setStoryRef = (idx: number) => (el: HTMLVideoElement | null) => {
    storyRefs.current[idx] = el;
    if (el) {
      el.muted = true;
      el.preload = "metadata";
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
    }
  };

  const pauseAllDesktopExcept = (keep: number | null) => {
    storyRefs.current.forEach((el, idx) => {
      if (!el) return;
      if (keep !== idx) stopAndPoster(el);
    });
    if (keep === null) setHoveredStory(null);
  };

  const playDesktop = (i: number) => {
    const v = storyRefs.current[i];
    if (!v) return;

    setHoveredStory(i);
    pauseAllDesktopExcept(i);

    v.muted = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");

    v.play().catch(() => {
      try {
        v.currentTime = (v.currentTime || 0) + 0.001;
      } catch {}
      v.play().catch(() => {});
    });
  };

  const pauseDesktop = (i: number) => {
    const v = storyRefs.current[i];
    if (v) stopAndPoster(v);
    setHoveredStory((prev) => (prev === i ? null : prev));
  };

  // ===== MOBILE autoplay =====
  const setMobileRef = (idx: number) => (el: HTMLVideoElement | null) => {
    mobileRefs.current[idx] = el;
    if (el) {
      el.muted = true;
      el.preload = "auto";
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
    }
  };

  useEffect(() => {
    if (!isTouchRef.current) return;

    const ACTIVATE_RATIO = 0.6;
    const DEACTIVATE_RATIO = 0.35;

    const getIdx = (el: Element) =>
      mobileRefs.current.findIndex((v) => v === el);

    const io = new IntersectionObserver(
      (entries) => {
        // 1) выключаем то, что ушло
        entries.forEach((e) => {
          const idx = getIdx(e.target);
          if (idx === -1) return;
          if (e.intersectionRatio < DEACTIVATE_RATIO) {
            userPausedRef.current.delete(idx);
            if (mobilePlaying === idx) setMobilePlaying(null);
            if (mobileActive === idx) setMobileActive(null);
            const v = e.target as HTMLVideoElement;
            stopMobileVideo(idx, v);
          }
        });

        // 2) берём лучшее
        const candidates = entries
          .filter(
            (e) => e.isIntersecting && e.intersectionRatio >= ACTIVATE_RATIO
          )
          .map((e) => ({
            idx: getIdx(e.target),
            ratio: e.intersectionRatio,
            el: e.target as HTMLVideoElement,
          }))
          .filter((x) => x.idx !== -1 && !userPausedRef.current.has(x.idx))
          .sort((a, b) => (b.ratio || 0) - (a.ratio || 0));

        const best = candidates[0];
        if (!best) return;

        // стопаем остальные
        mobileRefs.current.forEach((v, j) => {
          if (v && j !== best.idx) stopMobileVideo(j, v);
        });

        const token = Symbol();
        mobileStartTokenRef.current[best.idx] = token;

        best.el
          .play()
          .then(async () => {
            await waitFirstFrame(best.el);
            if (
              mobileStartTokenRef.current[best.idx] === token &&
              !best.el.paused
            ) {
              setMobilePlaying(best.idx);
              setMobileVisible((s) => ({ ...s, [best.idx]: true }));
              requestAnimationFrame(() => setMobileActive(best.idx));
            }
          })
          .catch(async () => {
            try {
              best.el.currentTime = (best.el.currentTime || 0) + 0.001;
            } catch {}
            try {
              await best.el.play();
              await waitFirstFrame(best.el);
              if (
                mobileStartTokenRef.current[best.idx] === token &&
                !best.el.paused
              ) {
                setMobilePlaying(best.idx);
                setMobileVisible((s) => ({ ...s, [best.idx]: true }));
                requestAnimationFrame(() => setMobileActive(best.idx));
              }
            } catch {}
          });
      },
      { threshold: [0, DEACTIVATE_RATIO, ACTIVATE_RATIO, 0.8, 1] }
    );

    mobileRefs.current.forEach((v) => v && io.observe(v));

    const onVis = () => {
      if (document.hidden) {
        mobileRefs.current.forEach((v, idx) => v && stopMobileVideo(idx, v));
        setMobilePlaying(null);
        setMobileActive(null);
        setMobileVisible({});
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [mobilePlaying, mobileActive]);

  return (
    <section id="mini-stories" className="relative bg-white">
      <div className="px-4 sm:px-6 lg:px-10">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-6xl font-pacifico font-bold text-black">
            Your MINI adventure starts now.
          </h2>
          <p className="pt-4 text-lg md:text-2xl text-neutral-600 font-roboto-condensed">
            Desktop — hover to play. Mobile — auto-play on view.
          </p>
        </div>

        {/* ===== MOBILE ===== */}
        <div className="md:hidden mt-10">
          <div
            className="flex overflow-x-auto pl-[3vw] snap-x snap-mandatory gap-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ WebkitOverflowScrolling: "touch" } as any}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="snap-start shrink-0 w-[82vw] max-w-[420px] touch-manipulation"
              >
                <div className="relative aspect-9/16 overflow-hidden rounded-2xl ring-1 ring-black/10 bg-black">
                  <video
                    ref={setMobileRef(i)}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                      mobileVisible[i] ? "opacity-100" : "opacity-0"
                    }`}
                    src={VIDEO_TEASERS[i].src}
                    muted
                    playsInline
                    preload="auto"
                    onEnded={(e) => {
                      stopMobileVideo(i, e.currentTarget);
                      setMobilePlaying(null);
                      setMobileActive(null);
                    }}
                    onClick={async (e) => {
                      const el = e.currentTarget;
                      if (!el.paused) {
                        stopMobileVideo(i, el);
                        userPausedRef.current.add(i);
                        setMobilePlaying(null);
                        setMobileActive(null);
                      } else {
                        userPausedRef.current.delete(i);
                        mobileRefs.current.forEach((v, j) => {
                          if (v && j !== i) stopMobileVideo(j, v);
                        });

                        const token = Symbol();
                        mobileStartTokenRef.current[i] = token;

                        try {
                          await el.play();
                        } catch {
                          try {
                            el.currentTime = (el.currentTime || 0) + 0.001;
                            await el.play();
                          } catch {}
                        }

                        await waitFirstFrame(el);
                        if (
                          mobileStartTokenRef.current[i] === token &&
                          !el.paused
                        ) {
                          setMobilePlaying(i);
                          setMobileVisible((s) => ({ ...s, [i]: true }));
                          requestAnimationFrame(() => setMobileActive(i));
                        }
                      }
                    }}
                  />

                  {/* постер */}
                  <Image
                    fill
                    sizes={CARD_SIZES}
                    src={VIDEO_TEASERS[i].poster}
                    alt=""
                    className={`pointer-events-none absolute inset-0 h-full w-full object-cover z-10 transition-opacity duration-700 delay-75 ${
                      mounted && mobileActive === i
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                    draggable={false}
                  />

                  {/* затемнение */}
                  <div
                    className={`pointer-events-none absolute inset-0 z-10 bg-black/25 transition-opacity duration-200 ${
                      mounted && mobileActive === i
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                  />

                  {/* title */}
                  <div className="pointer-events-none absolute top-0 left-0 right-0 z-10 p-3">
                    <span
                      className={`inline-block px-2 py-1 text-white/90 transition-opacity duration-200 bg-linear-to-r from-zinc-800/50 to-neutral-400/0 rounded-lg ${
                        mounted && mobileActive === i
                          ? "opacity-90"
                          : "opacity-100"
                      }`}
                    >
                      {VIDEO_TEASERS[i].title}
                    </span>
                  </div>

                  {/* desc */}
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-3">
                    <span
                      className={`inline-block px-3 py-1 text-white/80 transition-opacity duration-200 bg-linear-to-r from-zinc-800/50 to-neutral-400/0 rounded-lg ${
                        mounted && mobileActive === i
                          ? "opacity-90"
                          : "opacity-100"
                      }`}
                    >
                      {VIDEO_TEASERS[i].description}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== DESKTOP ===== */}
        <div className="hidden md:flex justify-center mt-10">
          <div className="flex w-full max-w-[1200px] items-start justify-center gap-8">
            {/* левая колонка */}
            <div className="flex flex-col items-center gap-8">
              {/* CARD 0 */}
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ type: "spring", duration: 0.55, bounce: 0.28 }}
                className="group relative w-[88vw] max-w-[440px] md:w-[340px] lg:w-[380px] overflow-hidden rounded-2xl ring-1 ring-black/10 transition-[transform,box-shadow] duration-300 hover:shadow-xl"
                onMouseEnter={() => playDesktop(0)}
                onMouseLeave={() => pauseDesktop(0)}
              >
                <div className="relative aspect-9/16">
                  <video
                    ref={setStoryRef(0)}
                    className="absolute inset-0 h-full w-full object-cover"
                    src={VIDEO_TEASERS[0].src}
                    muted
                    playsInline
                    preload="metadata"
                    loop
                    onEnded={(e) => {
                      stopAndPoster(e.currentTarget);
                      setHoveredStory((p) => (p === 0 ? null : p));
                    }}
                  />

                  <Image
                    fill
                    sizes={CARD_SIZES}
                    src={VIDEO_TEASERS[0].poster}
                    alt=""
                    className={`pointer-events-none absolute inset-0 h-full w-full object-cover z-10 transition-opacity duration-300 ${
                      mounted && hoveredStory === 0
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                    draggable={false}
                  />

                  <div
                    className={`pointer-events-none absolute inset-0 z-10 bg-black/35 transition-opacity duration-200 ${
                      mounted && hoveredStory === 0
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                  />

                  <div className="pointer-events-none absolute top-0 left-0 right-0 z-20 p-4">
                    <span
                      className={`inline-block px-2 py-1 text-white/90 transition-opacity duration-200 bg-linear-to-r from-zinc-900/50 to-neutral-400/0 rounded-lg ${
                        mounted && hoveredStory === 0
                          ? "opacity-90"
                          : "opacity-100"
                      }`}
                    >
                      {VIDEO_TEASERS[0].title}
                    </span>
                  </div>
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-4">
                    <span
                      className={`inline-block px-3 py-1 text-white/80 transition-opacity duration-200 bg-linear-to-r from-zinc-900/50 to-neutral-400/0 rounded-lg ${
                        mounted && hoveredStory === 0
                          ? "opacity-90"
                          : "opacity-100"
                      }`}
                    >
                      {VIDEO_TEASERS[0].description}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* CARD 2 */}
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  type: "spring",
                  duration: 0.55,
                  bounce: 0.28,
                  delay: 0.05,
                }}
                className="group relative w-[88vw] max-w-[440px] md:w-[340px] lg:w-[380px] overflow-hidden rounded-2xl ring-1 ring-black/10 transition-[transform,box-shadow] duration-300 hover:shadow-xl"
                onMouseEnter={() => playDesktop(2)}
                onMouseLeave={() => pauseDesktop(2)}
              >
                <div className="relative aspect-9/16">
                  <video
                    ref={setStoryRef(2)}
                    className="absolute inset-0 h-full w-full object-cover"
                    src={VIDEO_TEASERS[2].src}
                    muted
                    playsInline
                    preload="metadata"
                    loop
                    onEnded={(e) => {
                      stopAndPoster(e.currentTarget);
                      setHoveredStory((p) => (p === 2 ? null : p));
                    }}
                  />
                  <Image
                    fill
                    sizes={CARD_SIZES}
                    src={VIDEO_TEASERS[2].poster}
                    alt=""
                    className={`pointer-events-none absolute inset-0 h-full w-full object-cover z-10 transition-opacity duration-200 ${
                      mounted && hoveredStory === 2
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                    draggable={false}
                  />

                  <div
                    className={`pointer-events-none absolute inset-0 z-10 bg-black/35 transition-opacity duration-200 ${
                      mounted && hoveredStory === 2
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                  />

                  <div className="pointer-events-none absolute top-0 left-0 right-0 z-20 p-4">
                    <span
                      className={`inline-block px-2 py-1 text-white/90 transition-opacity duration-200 bg-linear-to-r from-zinc-900/50 to-neutral-400/0 rounded-lg ${
                        mounted && hoveredStory === 2
                          ? "opacity-90"
                          : "opacity-100"
                      }`}
                    >
                      {VIDEO_TEASERS[2].title}
                    </span>
                  </div>

                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-4">
                    <span
                      className={`inline-block px-3 py-1 text-white/80 transition-opacity duration-200 bg-linear-to-r from-zinc-900/50 to-neutral-400/0 rounded-lg ${
                        mounted && hoveredStory === 2
                          ? "opacity-90"
                          : "opacity-100"
                      }`}
                    >
                      {VIDEO_TEASERS[2].description}
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* правая колонка */}
            <div className="flex flex-col items-center gap-8 translate-y-[42%]">
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  type: "spring",
                  duration: 0.55,
                  bounce: 0.28,
                  delay: 0.03,
                }}
                className="group relative w-[88vw] max-w-[440px] md:w-[340px] lg:w-[380px] overflow-hidden rounded-2xl ring-1 ring-black/10 transition-[transform,box-shadow] duration-300 hover:shadow-xl"
                onMouseEnter={() => playDesktop(1)}
                onMouseLeave={() => pauseDesktop(1)}
              >
                <div className="relative aspect-9/16">
                  <video
                    ref={setStoryRef(1)}
                    className="absolute inset-0 h-full w-full object-cover"
                    src={VIDEO_TEASERS[1].src}
                    muted
                    playsInline
                    preload="metadata"
                    loop
                    onEnded={(e) => {
                      stopAndPoster(e.currentTarget);
                      setHoveredStory((p) => (p === 1 ? null : p));
                    }}
                  />
                  <Image
                    fill
                    sizes={CARD_SIZES}
                    src={VIDEO_TEASERS[1].poster}
                    alt=""
                    className={`pointer-events-none absolute inset-0 h-full w-full object-cover z-10 transition-opacity duration-200 ${
                      mounted && hoveredStory === 1
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                    draggable={false}
                  />

                  <div
                    className={`pointer-events-none absolute inset-0 z-10 bg-black/35 transition-opacity duration-200 ${
                      mounted && hoveredStory === 1
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                  />

                  <div className="pointer-events-none absolute top-0 left-0 right-0 z-20 p-4">
                    <span
                      className={`inline-block px-2 py-1 text-white/90 transition-opacity duration-200 bg-linear-to-r from-zinc-900/50 to-neutral-400/0 rounded-lg ${
                        mounted && hoveredStory === 1
                          ? "opacity-90"
                          : "opacity-100"
                      }`}
                    >
                      {VIDEO_TEASERS[1].title}
                    </span>
                  </div>

                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-4">
                    <span
                      className={`inline-block px-3 py-1 text-white/80 transition-opacity duration-200 bg-linear-to-r from-zinc-900/50 to-neutral-400/0 rounded-lg ${
                        mounted && hoveredStory === 1
                          ? "opacity-90"
                          : "opacity-100"
                      }`}
                    >
                      {VIDEO_TEASERS[1].description}
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
