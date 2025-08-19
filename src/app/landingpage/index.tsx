import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { VIDEO_TEASERS } from "@/constants/carOptions";
import { HeaderLanding } from "./header";
import HeroSection from "./hero";
import ModelsLanding from "./models";

export default function MiniRentalHero() {
  const [menuOpen, setMenuOpen] = useState(false);

  // ====== DESKTOP stories ======
  const storyRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [hoveredStory, setHoveredStory] = useState<number | null>(null);
  const [storyPlaying, setStoryPlaying] = useState<Record<number, boolean>>({});
  const isTouchRef = useRef(false);

  // ====== MOBILE stories ======
  const mobileRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [mobilePlaying, setMobilePlaying] = useState<number | null>(null);
  const [mobileReady, setMobileReady] = useState<Record<number, boolean>>({});
  //   const mobileStripRef = useRef<HTMLDivElement>(null);
  //   const mobileScrollDebounce = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "matchMedia" in window) {
      isTouchRef.current = window.matchMedia("(hover: none)").matches;
    }
  }, []);

  // ---------- Video helpers (общие) ----------
  const stopAndPoster = (v: HTMLVideoElement) => {
    v.pause();
    try {
      v.currentTime = 0;
    } catch {}
    // постер показываем через <img>-оверлей, поэтому .load() не нужен
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

  // ---------- Desktop play/pause ----------
  const setStoryRef = (idx: number) => (el: HTMLVideoElement | null) => {
    storyRefs.current[idx] = el;
    if (el) {
      el.muted = true;
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
      el.preload = "metadata";
    }
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

  // ---------- Mobile play/pause ----------
  const setMobileRef = (idx: number) => (el: HTMLVideoElement | null) => {
    mobileRefs.current[idx] = el;
    if (el) {
      el.muted = true;
      el.preload = "metadata";
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
    }
  };

  const toggleMobile = (i: number, el: HTMLVideoElement) => {
    // при любом старте — остальные стоп
    mobileRefs.current.forEach((v, idx) => {
      if (v && idx !== i) stopAndPoster(v);
    });

    el.muted = true;
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "");

    if (el.paused || el.ended) {
      const start = () =>
        el
          .play()
          .then(() => setMobilePlaying(i))
          .catch(() => {
            try {
              el.currentTime = (el.currentTime || 0) + 0.001;
            } catch {}
            el.play()
              .then(() => setMobilePlaying(i))
              .catch(() => {});
          });

      if (el.readyState < 2) {
        const onData = () => {
          el.removeEventListener("loadeddata", onData);
          setMobileReady((r) => ({ ...r, [i]: true }));
          start();
        };
        el.addEventListener("loadeddata", onData, { once: true });
        el.load(); // первый старт
      } else {
        setMobileReady((r) => ({ ...r, [i]: true }));
        start();
      }
    } else {
      stopAndPoster(el);
      setMobilePlaying(null);
    }
  };

  return (
    <div className="relative min-h-screen bg-black text-white">
      {/* HEADER */}
      <HeaderLanding menuOpen={menuOpen} handleMenuOpen={setMenuOpen} />

      {/* HERO */}
      <HeroSection />

      {/* MODELS */}
      <ModelsLanding />

      {/* === VIDEO === */}
      <section id="mini-stories" className="relative bg-white">
        <div className="px-4 sm:px-6 lg:px-10">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-openSans font-bold text-black">
              Your MINI adventure starts now.
            </h2>
            <p className="pt-4 md:text-lg text-black/70">
              Vertical stories — hover to play (desktop) / tap (mobile).
            </p>
          </div>

          {/* MOBILE carousel */}
          <div className="md:hidden mt-10">
            <div
              onScroll={() => {
                // стопаем все во время скролла (постер покажется)
                mobileRefs.current.forEach((el) => el && stopAndPoster(el));
                setMobilePlaying(null);
              }}
              className="flex overflow-x-auto snap-x snap-mandatory gap-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ WebkitOverflowScrolling: "touch" } as any}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="snap-center shrink-0 w-[82vw] max-w-[420px] [touch-action:manipulation]"
                >
                  <div className="relative aspect-[9/16] overflow-hidden rounded-2xl ring-1 ring-black/10 bg-black">
                    {/* ВИДЕО (снизу) */}
                    <video
                      ref={setMobileRef(i)}
                      className="absolute inset-0 h-full w-full object-cover"
                      src={VIDEO_TEASERS[i].src}
                      muted
                      playsInline
                      preload="metadata"
                      onLoadedData={() =>
                        setMobileReady((r) => ({ ...r, [i]: true }))
                      }
                      onPlaying={() => setMobilePlaying(i)}
                      onPause={() => {
                        if (mobilePlaying === i) setMobilePlaying(null);
                      }}
                      onEnded={(e) => {
                        stopAndPoster(e.currentTarget);
                        setMobilePlaying(null);
                      }}
                      onClick={(e) => toggleMobile(i, e.currentTarget)}
                    />
                    {/* ПОСТЕР-Оверлей (сверху!) */}
                    <img
                      src={VIDEO_TEASERS[i].poster}
                      alt=""
                      className={`pointer-events-none absolute inset-0 h-full w-full object-cover z-10 transition-opacity duration-200 ${
                        mobilePlaying === i && mobileReady[i]
                          ? "opacity-0"
                          : "opacity-100"
                      }`}
                      draggable={false}
                    />
                    {/* Лёгкое затемнение — тоже поверх */}
                    <div
                      className={`pointer-events-none absolute inset-0 z-10 bg-black/25 transition-opacity duration-200 ${
                        mobilePlaying === i && mobileReady[i]
                          ? "opacity-0"
                          : "opacity-100"
                      }`}
                    />
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-3">
                      <span
                        className={`inline-block rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-black transition-opacity duration-200 ${
                          mobilePlaying === i && mobileReady[i]
                            ? "opacity-0"
                            : "opacity-100"
                        }`}
                      >
                        {VIDEO_TEASERS[i].title}
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
                    {/* ВИДЕО (снизу) */}
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
                    {/* ПОСТЕР-Оверлей (сверху!) */}
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
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-4">
                      <span
                        className={`inline-block rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-black transition-opacity duration-200 ${
                          hoveredStory === 0 && storyPlaying[0]
                            ? "opacity-0"
                            : "opacity-100"
                        }`}
                      >
                        {VIDEO_TEASERS[0].title}
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
                    {/* ВИДЕО (снизу) */}
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
                    {/* ПОСТЕР-Оверлей (сверху!)  — тут была опечатка, теперь ок */}
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
                    <div
                      className={`pointer-events-none absolute inset-0 z-10 bg-black/35 transition-opacity duration-200 ${
                        hoveredStory === 2 && storyPlaying[2]
                          ? "opacity-0"
                          : "opacity-100"
                      }`}
                    />
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-4">
                      <span
                        className={`inline-block rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-black transition-opacity duration-200 ${
                          hoveredStory === 2 && storyPlaying[2]
                            ? "opacity-0"
                            : "opacity-100"
                        }`}
                      >
                        {VIDEO_TEASERS[2].title}
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
                    {/* ВИДЕО (снизу) */}
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
                    {/* ПОСТЕР-Оверлей (сверху!) */}
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
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-4">
                      <span
                        className={`inline-block rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-black transition-opacity duration-200 ${
                          hoveredStory === 1 && storyPlaying[1]
                            ? "opacity-0"
                            : "opacity-100"
                        }`}
                      >
                        {VIDEO_TEASERS[1].title}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
