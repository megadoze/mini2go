import { useEffect, useRef, useState } from "react";
import { VIDEO_TEASERS } from "@/constants/carOptions";
import { motion } from "framer-motion";

export const VideoSection = () => {
  // ====== DESKTOP stories ======
  const storyRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const userPausedRef = useRef<Set<number>>(new Set());

  const [hoveredStory, setHoveredStory] = useState<number | null>(null);
  const [storyPlaying, setStoryPlaying] = useState<Record<number, boolean>>({});
  const isTouchRef = useRef(false);

  // ====== MOBILE stories ======
  const mobileRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [mobilePlaying, setMobilePlaying] = useState<number | null>(null);
  // показывает, какая карточка активна визуально (убираем постер мгновенно)
  const [mobileActive, setMobileActive] = useState<number | null>(null);
  // NEW: трекаем "попытку запуска" для каждого индекса, чтобы избегать гонок
  const mobileStartTokenRef = useRef<(symbol | null)[]>([]);
  const [mobileVisible, setMobileVisible] = useState<Record<number, boolean>>(
    {}
  );

  useEffect(() => {
    if (typeof window !== "undefined" && "matchMedia" in window) {
      isTouchRef.current = window.matchMedia("(hover: none)").matches;
    }
  }, []);

  // ---------- helpers ----------
  const stopAndPoster = (v: HTMLVideoElement) => {
    v.pause();
    try {
      v.currentTime = 0;
    } catch {}
    // постер у нас через <img>-оверлей, отдельный .load() не нужен
  };

  // helper чтобы корректно останавливать и сбрасывать токен на мобильных
  const stopMobileVideo = (idx: number, v: HTMLVideoElement) => {
    mobileStartTokenRef.current[idx] = null; // сбрасываем активную попытку
    setMobileVisible((s) => ({ ...s, [idx]: false }));
    stopAndPoster(v);
  };

  // ---------- Desktop ----------
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
    setStoryPlaying((s) => {
      const next: Record<number, boolean> = {};
      [0, 1, 2].forEach((i) => (next[i] = i === keep ? !!s[i] : false));
      return next;
    });
    if (keep === null) setHoveredStory(null);
  };

  const playDesktop = (i: number) => {
    const v = storyRefs.current[i];
    if (!v) return;
    pauseAllDesktopExcept(i);
    v.muted = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.play()
      .then(() => {
        setHoveredStory(i);
        setStoryPlaying((s) => ({ ...s, [i]: true }));
      })
      .catch(() => {
        try {
          v.currentTime = (v.currentTime || 0) + 0.001;
        } catch {}
        v.play()
          .then(() => {
            setHoveredStory(i);
            setStoryPlaying((s) => ({ ...s, [i]: true }));
          })
          .catch(() => {});
      });
  };

  const pauseDesktop = (i: number) => {
    const v = storyRefs.current[i];
    if (!v) return;
    stopAndPoster(v);
    setStoryPlaying((s) => ({ ...s, [i]: false }));
    setHoveredStory((p) => (p === i ? null : p));
  };

  // ---------- Mobile ----------
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

    const ACTIVATE_RATIO = 0.6; // ▶️ запускать только когда видно сильно
    const DEACTIVATE_RATIO = 0.35; // ⏹️ гасить, когда почти ушёл

    const getIdx = (el: Element) =>
      mobileRefs.current.findIndex((v) => v === el);

    const io = new IntersectionObserver(
      (entries) => {
        // 1) деактивация ниже порога
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

        // 2) кандидаты только ПОСЛЕ верхнего порога (гистерезис)
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

        // стоп остальных
        mobileRefs.current.forEach((v, j) => {
          if (v && j !== best.idx) stopMobileVideo(j, v);
        });

        // запуск best — как у тебя было
        const token = Symbol();
        mobileStartTokenRef.current[best.idx] = token;

        best.el.muted = true;
        best.el.setAttribute("playsinline", "");
        best.el.setAttribute("webkit-playsinline", "");
        best.el
          .play()
          .then(async () => {
            await waitFirstFrame(best.el);
            if (
              mobileStartTokenRef.current[best.idx] === token &&
              !best.el.paused
            ) {
              setMobilePlaying(best.idx);
              // 1) сначала сделать видео видимым (fade-in)
              setMobileVisible((s) => ({ ...s, [best.idx]: true }));
              // 2) затем на следующий кадр скрыть постер
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
      { threshold: [0, DEACTIVATE_RATIO, ACTIVATE_RATIO, 0.8, 1] } // можно чуть плотнее
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

  function waitFirstFrame(el: HTMLVideoElement): Promise<void> {
    const video: HTMLVideoElement = el;
    return new Promise((resolve) => {
      // Safari / современные браузеры

      if (typeof video.requestVideoFrameCallback === "function") {
        video.requestVideoFrameCallback(() => resolve());
        // страховка на случай, если кадр не придёт
        setTimeout(() => resolve(), 150);
        return;
      }

      const onLoaded = () => {
        cleanup();
        resolve();
      };

      const onTime = () => {
        try {
          if (video.currentTime > 0) {
            cleanup();
            resolve();
          }
        } catch {}
      };

      const cleanup = () => {
        video.removeEventListener("loadeddata", onLoaded as EventListener);
        video.removeEventListener("timeupdate", onTime as EventListener);
      };

      video.addEventListener(
        "loadeddata",
        onLoaded as EventListener,
        { once: true } as AddEventListenerOptions
      );
      video.addEventListener("timeupdate", onTime as EventListener);

      // страховка
      setTimeout(() => {
        cleanup();
        resolve();
      }, 200);
    });
  }
  return (
    <section id="mini-stories" className="relative bg-white">
      <div className="px-4 sm:px-6 lg:px-10">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-6xl font-robotoCondensed font-bold text-black">
            Your MINI adventure starts now.
          </h2>
          <p className="pt-4 text-lg md:text-xl text-stone-600 font-roboto">
            Desktop — hover to play. Mobile — auto-play on view.
          </p>
        </div>

        {/* MOBILE: горизонтальная карусель, автоплей по IntersectionObserver */}
        <div className="md:hidden mt-10">
          <div
            className="flex overflow-x-auto pl-[3vw] pr-0 snap-x snap-mandatory gap-4 px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ WebkitOverflowScrolling: "touch" } as any}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className=" snap-start shrink-0 w-[82vw] max-w-[420px] [touch-action:manipulation]"
              >
                <div className="relative aspect-[9/16] overflow-hidden rounded-2xl ring-1 ring-black/10 bg-black">
                  {/* ВИДЕО (снизу) */}
                  <video
                    ref={setMobileRef(i)}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                      mobileVisible[i] ? "opacity-100" : "opacity-0"
                    }`}
                    src={VIDEO_TEASERS[i].src}
                    style={{ willChange: "opacity" }}
                    muted
                    playsInline
                    preload="auto"
                    onEnded={(e) => {
                      stopMobileVideo(i, e.currentTarget); // CHANGED
                      setMobilePlaying(null);
                      setMobileActive(null);
                    }}
                    onClick={async (e) => {
                      const el = e.currentTarget;
                      if (!el.paused) {
                        // пользовательская пауза: вернуть постер и запретить автоплей до выхода
                        stopMobileVideo(i, el); // CHANGED
                        userPausedRef.current.add(i);
                        setMobilePlaying(null);
                        setMobileActive(null);
                      } else {
                        // снять userPause и запустить этот ролик, остальные — стоп
                        userPausedRef.current.delete(i);
                        mobileRefs.current.forEach((v, j) => {
                          if (v && j !== i) stopMobileVideo(j, v); // CHANGED
                        });

                        // НЕ скрываем постер сразу — ждём первый кадр
                        const token = Symbol();
                        mobileStartTokenRef.current[i] = token;

                        el.muted = true;
                        el.setAttribute("playsinline", "");
                        el.setAttribute("webkit-playsinline", "");

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

                  {/* ПОСТЕР-оверлей (сверху) */}
                  <img
                    src={VIDEO_TEASERS[i].poster}
                    alt=""
                    className={`pointer-events-none absolute inset-0 h-full w-full object-cover z-10 transition-opacity duration-700 delay-75   ${
                      mobileActive === i ? "opacity-0" : "opacity-100"
                    }`}
                    draggable={false}
                  />

                  {/* Лёгкое затемнение (сверху) */}
                  <div
                    className={`pointer-events-none absolute inset-0 z-10 bg-black/25 transition-opacity duration-200 ${
                      mobileActive === i ? "opacity-0" : "opacity-100"
                    }`}
                  />
                  {/* Title */}
                  <div className="pointer-events-none absolute top-0 left-0 right-0 z-10 p-3">
                    <span
                      className={`inline-block px-2 py-1 font-normal text-white/90 transition-opacity duration-200 bg-gradient-to-r from-zinc-800/50 to-neutral-400/0 rounded-lg ${
                        mobileActive === i ? "opacity-90" : "opacity-100"
                      }`}
                    >
                      {VIDEO_TEASERS[i].title}
                    </span>
                  </div>

                  {/* Тайтл-description */}
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-3">
                    <span
                      className={`inline-block px-3 py-1 font-normal text-white/80 transition-opacity duration-200 bg-gradient-to-r from-zinc-800/50 to-neutral-400/0 rounded-lg ${
                        mobileActive === i ? "opacity-90" : "opacity-100"
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

        {/* DESKTOP: 2 колонки со смещением */}
        <div className="hidden md:flex justify-center mt-10">
          <div className="flex w-full max-w-[1200px] items-start justify-center gap-8">
            {/* Левая колонка: 0 и 2 */}
            <div className="flex flex-col items-center gap-8">
              {/* CARD 0 */}
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ type: "spring", duration: 0.55, bounce: 0.28 }}
                className="group relative w-[88vw] max-w-[440px] md:w-[340px] lg:w-[380px] overflow-hidden rounded-2xl ring-1 ring-black/10 transition-[transform,box-shadow] duration-300 hover:shadow-xl md:hover:scale-[1.02]"
                onMouseEnter={() => {
                  if (!isTouchRef.current) playDesktop(0);
                }}
                onMouseLeave={() => {
                  if (!isTouchRef.current) pauseDesktop(0);
                }}
              >
                <div className="relative aspect-[9/16]">
                  <video
                    ref={setStoryRef(0)}
                    className="absolute inset-0 h-full w-full object-cover"
                    src={VIDEO_TEASERS[0].src}
                    muted
                    playsInline
                    preload="metadata"
                    loop
                    onPlaying={() =>
                      setStoryPlaying((s) => ({ ...s, [0]: true }))
                    }
                    onPause={() =>
                      setStoryPlaying((s) => ({ ...s, [0]: false }))
                    }
                    onEnded={(e) => {
                      stopAndPoster(e.currentTarget);
                      setStoryPlaying((s) => ({ ...s, [0]: false }));
                      setHoveredStory((p) => (p === 0 ? null : p));
                    }}
                  />
                  <img
                    src={VIDEO_TEASERS[0].poster}
                    alt=""
                    className={`pointer-events-none absolute inset-0 h-full w-full object-cover z-10 transition-opacity duration-200 ${
                      hoveredStory === 0 && storyPlaying[0]
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                    draggable={false}
                  />
                  <div
                    className={`pointer-events-none absolute inset-0 z-10 bg-black/35 transition-opacity duration-200 ${
                      hoveredStory === 0 && storyPlaying[0]
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                  />
                  <div className="pointer-events-none absolute top-0 left-0 right-0 z-20 p-4">
                    <span
                      className={`inline-block px-2 py-1 font-normal text-white/90 transition-opacity duration-200 bg-gradient-to-r from-zinc-900/50 to-neutral-400/0 rounded-lg ${
                        hoveredStory === 0 && storyPlaying[0]
                          ? "opacity-90"
                          : "opacity-100"
                      }`}
                    >
                      {VIDEO_TEASERS[0].title}
                    </span>
                  </div>
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-4">
                    <span
                      className={`inline-block px-3 py-1 font-normal text-white/80 transition-opacity duration-200 bg-gradient-to-r from-zinc-900/50 to-neutral-400/0 rounded-lg ${
                        hoveredStory === 0 && storyPlaying[0]
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
                className="group relative w-[88vw] max-w-[440px] md:w-[340px] lg:w-[380px] overflow-hidden rounded-2xl ring-1 ring-black/10 transition-[transform,box-shadow] duration-300 hover:shadow-xl md:hover:scale-[1.02]"
                onMouseEnter={() => {
                  if (!isTouchRef.current) playDesktop(2);
                }}
                onMouseLeave={() => {
                  if (!isTouchRef.current) pauseDesktop(2);
                }}
              >
                <div className="relative aspect-[9/16]">
                  <video
                    ref={setStoryRef(2)}
                    className="absolute inset-0 h-full w-full object-cover"
                    src={VIDEO_TEASERS[2].src}
                    muted
                    playsInline
                    preload="metadata"
                    loop
                    onPlaying={() =>
                      setStoryPlaying((s) => ({ ...s, [2]: true }))
                    }
                    onPause={() =>
                      setStoryPlaying((s) => ({ ...s, [2]: false }))
                    }
                    onEnded={(e) => {
                      stopAndPoster(e.currentTarget);
                      setStoryPlaying((s) => ({ ...s, [2]: false }));
                      setHoveredStory((p) => (p === 2 ? null : p));
                    }}
                  />
                  <img
                    src={VIDEO_TEASERS[2].poster}
                    alt=""
                    className={`pointer-events-none absolute inset-0 h-full w-full object-cover z-10 transition-opacity duration-200 ${
                      hoveredStory === 2 && storyPlaying[2]
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                    draggable={false}
                  />
                  <div className="pointer-events-none absolute top-0 left-0 right-0 z-20 p-4">
                    <span
                      className={`inline-block px-2 py-1 font-normal text-white/90 transition-opacity duration-200 bg-gradient-to-r from-zinc-900/50 to-neutral-400/0 rounded-lg ${
                        hoveredStory === 0 && storyPlaying[0]
                          ? "opacity-90"
                          : "opacity-100"
                      }`}
                    >
                      {VIDEO_TEASERS[2].title}
                    </span>
                  </div>

                  <div
                    className={`pointer-events-none absolute inset-0 z-10 bg-black/35 transition-opacity duration-200 ${
                      hoveredStory === 2 && storyPlaying[2]
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                  />
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-4">
                    <span
                      className={`inline-block px-3 py-1 font-normal text-white/80 transition-opacity duration-200 bg-gradient-to-r from-zinc-900/50 to-neutral-400/0 rounded-lg ${
                        hoveredStory === 2 && storyPlaying[2]
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

            {/* Правая колонка: 1 со смещением */}
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
                className="group relative w-[88vw] max-w-[440px] md:w-[340px] lg:w-[380px] overflow-hidden rounded-2xl ring-1 ring-black/10 transition-[transform,box-shadow] duration-300 hover:shadow-xl md:hover:scale-[1.02]"
                onMouseEnter={() => {
                  if (!isTouchRef.current) playDesktop(1);
                }}
                onMouseLeave={() => {
                  if (!isTouchRef.current) pauseDesktop(1);
                }}
              >
                <div className="relative aspect-[9/16]">
                  <video
                    ref={setStoryRef(1)}
                    className="absolute inset-0 h-full w-full object-cover"
                    src={VIDEO_TEASERS[1].src}
                    muted
                    playsInline
                    preload="metadata"
                    loop
                    onPlaying={() =>
                      setStoryPlaying((s) => ({ ...s, [1]: true }))
                    }
                    onPause={() =>
                      setStoryPlaying((s) => ({ ...s, [1]: false }))
                    }
                    onEnded={(e) => {
                      stopAndPoster(e.currentTarget);
                      setStoryPlaying((s) => ({ ...s, [1]: false }));
                      setHoveredStory((p) => (p === 1 ? null : p));
                    }}
                  />
                  <img
                    src={VIDEO_TEASERS[1].poster}
                    alt=""
                    className={`pointer-events-none absolute inset-0 h-full w-full object-cover z-10 transition-opacity duration-200 ${
                      hoveredStory === 1 && storyPlaying[1]
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                    draggable={false}
                  />
                  <div
                    className={`pointer-events-none absolute inset-0 z-10 bg-black/35 transition-opacity duration-200 ${
                      hoveredStory === 1 && storyPlaying[1]
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                  />
                  <div className="pointer-events-none absolute top-0 left-0 right-0 z-20 p-4">
                    <span
                      className={`inline-block px-2 py-1 font-normal text-white/90 transition-opacity duration-200 bg-gradient-to-r from-zinc-900/50 to-neutral-400/0 rounded-lg ${
                        hoveredStory === 0 && storyPlaying[0]
                          ? "opacity-90"
                          : "opacity-100"
                      }`}
                    >
                      {VIDEO_TEASERS[1].title}
                    </span>
                  </div>

                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-4">
                    <span
                      className={`inline-block px-3 py-1 font-normal text-white/80 transition-opacity duration-200 bg-gradient-to-r from-zinc-900/50 to-neutral-400/0 rounded-lg ${
                        hoveredStory === 1 && storyPlaying[1]
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
