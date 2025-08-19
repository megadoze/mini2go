import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { VIDEO_TEASERS } from "@/constants/carOptions";
import { HeaderLanding } from "./header";
import HeroSection from "./hero";
import ModelsLanding from "./models";

export default function MiniRentalHero() {
  const [menuOpen, setMenuOpen] = useState(false);

  // ===== Detect touch (mobile) =====
  const isTouchRef = useRef(false);
  useEffect(() => {
    if (typeof window !== "undefined" && "matchMedia" in window) {
      isTouchRef.current = window.matchMedia("(hover: none)").matches;
    }
  }, []);

  // ===== Desktop refs/state =====
  const deskRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const setDeskRef = (i: number) => (el: HTMLVideoElement | null) => {
    deskRefs.current[i] = el;
    if (el) primeVideo(el);
  };

  // ===== Mobile refs/state =====
  const mobRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const setMobRef = (i: number) => (el: HTMLVideoElement | null) => {
    mobRefs.current[i] = el;
    if (el) primeVideo(el);
  };
  const userPaused = useRef<Set<number>>(new Set()); // если юзер поставил паузу — не автозапускать пока он не тапнет сам

  // ===== Helpers =====
  function primeVideo(v: HTMLVideoElement) {
    v.muted = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.preload = "auto";
  }

  function playVideo(v: HTMLVideoElement) {
    v.muted = true;
    const start = () =>
      v.play().catch(() => {
        // второй шанс для iOS
        try {
          v.currentTime = (v.currentTime || 0) + 0.001;
        } catch {}
        return v.play().catch(() => {});
      });
    if (v.readyState < 2) {
      const onData = () => {
        v.removeEventListener("loadeddata", onData);
        start();
      };
      v.addEventListener("loadeddata", onData, { once: true });
      v.load(); // постер остаётся пока не начнётся воспроизведение
    } else {
      start();
    }
  }

  function stopToPoster(v: HTMLVideoElement) {
    // Стоп и вернём постер нативно
    v.pause();
    try {
      v.currentTime = 0;
    } catch {}
    // На iOS иногда нужен load() чтобы сразу показать постер.
    // Практика показывает: после pause()+currentTime=0 вызвать load() даёт стабильный возврат постера без «черного».
    v.load();
  }

  // ===== Desktop hover logic =====
  const hoverPlay = (i: number) => {
    if (isTouchRef.current) return;
    deskRefs.current.forEach((el, idx) => {
      if (!el) return;
      if (idx !== i) stopToPoster(el);
    });
    const v = deskRefs.current[i];
    if (v) playVideo(v);
  };

  const hoverStop = (i: number) => {
    if (isTouchRef.current) return;
    const v = deskRefs.current[i];
    if (v) stopToPoster(v);
  };

  // ===== Mobile autoplay in view =====
  useEffect(() => {
    if (!isTouchRef.current) return;

    const els = mobRefs.current.filter(Boolean) as HTMLVideoElement[];
    if (!els.length) return;

    const ratios = new Map<HTMLVideoElement, number>();
    let raf = 0;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) =>
          ratios.set(e.target as HTMLVideoElement, e.intersectionRatio)
        );

        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          // остановить те, что почти вышли
          els.forEach((v) => {
            const r = ratios.get(v) || 0;
            if (r < 0.35) stopToPoster(v);
          });

          // выбрать лучшую видимость
          let bestIdx = -1;
          let bestV: HTMLVideoElement | null = null;
          let bestR = 0;
          els.forEach((v, idx) => {
            const r = ratios.get(v) || 0;
            if (r > bestR) {
              bestR = r;
              bestIdx = idx;
              bestV = v;
            }
          });

          if (bestV && bestR >= 0.6 && !userPaused.current.has(bestIdx)) {
            // стоп остальных
            els.forEach((v, idx) => {
              if (idx !== bestIdx) stopToPoster(v);
            });
            playVideo(bestV);
          }
        });
      },
      { threshold: [0, 0.35, 0.6, 0.85, 1] }
    );

    els.forEach((v) => io.observe(v));

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      els.forEach((v) => stopToPoster(v));
    };
  }, []); // один раз при монтировании

  // ===== Mobile tap toggle =====
  const onMobileTap = (i: number, el: HTMLVideoElement) => {
    if (!el) return;
    if (!el.paused && !el.ended) {
      // ручная пауза
      userPaused.current.add(i);
      stopToPoster(el);
    } else {
      userPaused.current.delete(i);
      playVideo(el);
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

      {/* VIDEO */}
      <section id="mini-stories" className="relative bg-white">
        <div className="px-4 sm:px-6 lg:px-10">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-openSans font-bold text-black">
              Your MINI adventure starts now.
            </h2>
            <p className="pt-4 md:text-lg text-black/70">
              Desktop: hover to play • Mobile: auto-play in view, tap to pause.
            </p>
          </div>

          {/* MOBILE — простая карусель с автоплеем. Никаких overlay/opacity. */}
          <div className="md:hidden mt-10">
            <div
              className="flex overflow-x-auto snap-x snap-mandatory gap-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ WebkitOverflowScrolling: "touch" } as any}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="snap-center shrink-0 w-[82vw] max-w-[420px]"
                >
                  <div className="relative aspect-[9/16] overflow-hidden rounded-2xl ring-1 ring-black/10 bg-black">
                    <video
                      ref={setMobRef(i)}
                      className="absolute inset-0 h-full w-full object-cover"
                      src={VIDEO_TEASERS[i].src}
                      poster={VIDEO_TEASERS[i].poster}
                      muted
                      playsInline
                      preload="auto"
                      onClick={(e) => onMobileTap(i, e.currentTarget)}
                      onEnded={(e) => {
                        stopToPoster(e.currentTarget);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DESKTOP — 2 колонки со смещением */}
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
                  onMouseEnter={() => hoverPlay(0)}
                  onMouseLeave={() => hoverStop(0)}
                >
                  <div className="relative aspect-[9/16]">
                    <video
                      ref={setDeskRef(0)}
                      className="absolute inset-0 h-full w-full object-cover"
                      src={VIDEO_TEASERS[0].src}
                      poster={VIDEO_TEASERS[0].poster}
                      muted
                      playsInline
                      preload="metadata"
                      loop
                    />
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
                  onMouseEnter={() => hoverPlay(2)}
                  onMouseLeave={() => hoverStop(2)}
                >
                  <div className="relative aspect-[9/16]">
                    <video
                      ref={setDeskRef(2)}
                      className="absolute inset-0 h-full w-full object-cover"
                      src={VIDEO_TEASERS[2].src}
                      poster={VIDEO_TEASERS[2].poster}
                      muted
                      playsInline
                      preload="metadata"
                      loop
                    />
                  </div>
                </motion.div>
              </div>

              {/* Правая колонка: 1 со смещением вниз */}
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
                  onMouseEnter={() => hoverPlay(1)}
                  onMouseLeave={() => hoverStop(1)}
                >
                  <div className="relative aspect-[9/16]">
                    <video
                      ref={setDeskRef(1)}
                      className="absolute inset-0 h-full w-full object-cover"
                      src={VIDEO_TEASERS[1].src}
                      poster={VIDEO_TEASERS[1].poster}
                      muted
                      playsInline
                      preload="metadata"
                      loop
                    />
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

// import { useEffect, useRef, useState } from "react";
// import { motion } from "framer-motion";
// import { VIDEO_TEASERS } from "@/constants/carOptions";
// import { HeaderLanding } from "./header";
// import HeroSection from "./hero";
// import ModelsLanding from "./models";

// export default function MiniRentalHero() {
//   const [menuOpen, setMenuOpen] = useState(false);

//   // ====== DESKTOP stories ======
//   const storyRefs = useRef<(HTMLVideoElement | null)[]>([]);
//   const userPausedRef = useRef<Set<number>>(new Set());

//   const [hoveredStory, setHoveredStory] = useState<number | null>(null);
//   const [storyPlaying, setStoryPlaying] = useState<Record<number, boolean>>({});
//   const isTouchRef = useRef(false);

//   // ====== MOBILE stories ======
//   const mobileRefs = useRef<(HTMLVideoElement | null)[]>([]);
//   const [mobilePlaying, setMobilePlaying] = useState<number | null>(null);
//   const [mobileReady, setMobileReady] = useState<Record<number, boolean>>({});

//   useEffect(() => {
//     if (typeof window !== "undefined" && "matchMedia" in window) {
//       isTouchRef.current = window.matchMedia("(hover: none)").matches;
//     }
//   }, []);

//   // ---------- helpers ----------
//   const stopAndPoster = (v: HTMLVideoElement) => {
//     v.pause();
//     try {
//       v.currentTime = 0;
//     } catch {}
//     // постер у нас через <img>-оверлей, отдельный .load() не нужен
//   };

//   // ---------- Desktop ----------
//   const setStoryRef = (idx: number) => (el: HTMLVideoElement | null) => {
//     storyRefs.current[idx] = el;
//     if (el) {
//       el.muted = true;
//       el.preload = "metadata";
//       el.setAttribute("playsinline", "");
//       el.setAttribute("webkit-playsinline", "");
//     }
//   };

//   const pauseAllDesktopExcept = (keep: number | null) => {
//     storyRefs.current.forEach((el, idx) => {
//       if (!el) return;
//       if (keep !== idx) stopAndPoster(el);
//     });
//     setStoryPlaying((s) => {
//       const next: Record<number, boolean> = {};
//       [0, 1, 2].forEach((i) => (next[i] = i === keep ? !!s[i] : false));
//       return next;
//     });
//     if (keep === null) setHoveredStory(null);
//   };

//   const playDesktop = (i: number) => {
//     const v = storyRefs.current[i];
//     if (!v) return;
//     pauseAllDesktopExcept(i);
//     v.muted = true;
//     v.setAttribute("playsinline", "");
//     v.setAttribute("webkit-playsinline", "");
//     v.play()
//       .then(() => {
//         setHoveredStory(i);
//         setStoryPlaying((s) => ({ ...s, [i]: true }));
//       })
//       .catch(() => {
//         try {
//           v.currentTime = (v.currentTime || 0) + 0.001;
//         } catch {}
//         v.play()
//           .then(() => {
//             setHoveredStory(i);
//             setStoryPlaying((s) => ({ ...s, [i]: true }));
//           })
//           .catch(() => {});
//       });
//   };

//   const pauseDesktop = (i: number) => {
//     const v = storyRefs.current[i];
//     if (!v) return;
//     stopAndPoster(v);
//     setStoryPlaying((s) => ({ ...s, [i]: false }));
//     setHoveredStory((p) => (p === i ? null : p));
//   };

//   // ---------- Mobile ----------
//   const setMobileRef = (idx: number) => (el: HTMLVideoElement | null) => {
//     mobileRefs.current[idx] = el;
//     if (el) {
//       el.muted = true;
//       el.preload = "auto";
//       el.setAttribute("playsinline", "");
//       el.setAttribute("webkit-playsinline", "");
//     }
//   };

//   useEffect(() => {
//     if (!isTouchRef.current) return; // только мобильные/тач
//     const getIdx = (el: Element) =>
//       mobileRefs.current.findIndex((v) => v === el);

//     const io = new IntersectionObserver(
//       (entries) => {
//         // снять userPause, если карточка почти вышла
//         entries.forEach((e) => {
//           const idx = getIdx(e.target);
//           if (idx === -1) return;
//           if (e.intersectionRatio < 0.35) {
//             userPausedRef.current.delete(idx);
//             if (mobilePlaying === idx) setMobilePlaying(null);
//             const v = e.target as HTMLVideoElement;
//             stopAndPoster(v);
//           }
//         });

//         // выбрать самую видимую, которая не user-paused
//         const candidates = entries
//           .filter((e) => e.isIntersecting)
//           .map((e) => ({
//             idx: getIdx(e.target),
//             ratio: e.intersectionRatio,
//             el: e.target as HTMLVideoElement,
//           }))
//           .filter((x) => x.idx !== -1 && !userPausedRef.current.has(x.idx))
//           .sort((a, b) => (b.ratio || 0) - (a.ratio || 0));

//         const best = candidates[0];
//         if (!best) return;

//         // стоп остальных
//         mobileRefs.current.forEach((v, j) => {
//           if (v && j !== best.idx) stopAndPoster(v);
//         });

//         best.el.muted = true;
//         best.el.setAttribute("playsinline", "");
//         best.el.setAttribute("webkit-playsinline", "");
//         best.el
//           .play()
//           .then(() => setMobilePlaying(best.idx))
//           .catch(() => {
//             try {
//               best.el.currentTime = (best.el.currentTime || 0) + 0.001;
//             } catch {}
//             best.el
//               .play()
//               .then(() => setMobilePlaying(best.idx))
//               .catch(() => {});
//           });
//       },
//       { threshold: [0, 0.35, 0.6] }
//     );

//     mobileRefs.current.forEach((v) => v && io.observe(v));
//     const onVis = () => {
//       if (document.hidden) {
//         mobileRefs.current.forEach((v) => v && stopAndPoster(v));
//         setMobilePlaying(null);
//       }
//     };
//     document.addEventListener("visibilitychange", onVis);

//     return () => {
//       io.disconnect();
//       document.removeEventListener("visibilitychange", onVis);
//     };
//   }, [mobilePlaying]);

//   // Автовоспроизведение на мобиле по входу в вьюпорт
//   useEffect(() => {
//     if (!isTouchRef.current) return; // только для мобильных/тач
//     const vids = mobileRefs.current.filter((v): v is HTMLVideoElement => !!v);
//     if (vids.length === 0) return;

//     const chooseAndPlay = (entries: IntersectionObserverEntry[]) => {
//       // ищем самый видимый ролик
//       const visible = entries
//         .filter((e) => e.isIntersecting)
//         .sort(
//           (a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0)
//         );
//       const target = visible[0]?.target as HTMLVideoElement | undefined;

//       // стопаем все, кроме таргета
//       vids.forEach((v) => {
//         if (!target || v !== target) stopAndPoster(v);
//       });

//       if (!target) {
//         setMobilePlaying(null);
//         return;
//       }

//       // пытаемся играть таргет
//       target.muted = true;
//       target.setAttribute("playsinline", "");
//       target.setAttribute("webkit-playsinline", "");
//       target
//         .play()
//         .then(() => {
//           // какой это индекс?
//           const i = mobileRefs.current.findIndex((x) => x === target);
//           if (i !== -1) setMobilePlaying(i);
//         })
//         .catch(() => {
//           try {
//             target.currentTime = (target.currentTime || 0) + 0.001;
//           } catch {}
//           target
//             .play()
//             .then(() => {
//               const i = mobileRefs.current.findIndex((x) => x === target);
//               if (i !== -1) setMobilePlaying(i);
//             })
//             .catch(() => {});
//         });
//     };

//     const io = new IntersectionObserver(chooseAndPlay, {
//       threshold: [0.4, 0.6, 0.8], // начнём играть, когда видно ~60%
//     });

//     vids.forEach((v) => io.observe(v));

//     // пауза при уходе со страницы/скрытии таба
//     const onVis = () => {
//       if (document.hidden) {
//         vids.forEach((v) => stopAndPoster(v));
//         setMobilePlaying(null);
//       }
//     };
//     document.addEventListener("visibilitychange", onVis);

//     return () => {
//       io.disconnect();
//       document.removeEventListener("visibilitychange", onVis);
//     };
//   }, []);

//   return (
//     <div className="relative min-h-screen bg-black text-white">
//       {/* HEADER */}
//       <HeaderLanding menuOpen={menuOpen} handleMenuOpen={setMenuOpen} />

//       {/* HERO */}
//       <HeroSection />

//       {/* MODELS */}
//       <ModelsLanding />

//       {/* === VIDEO === */}
//       <section id="mini-stories" className="relative bg-white">
//         <div className="px-4 sm:px-6 lg:px-10">
//           <div className="text-center">
//             <h2 className="text-2xl sm:text-3xl lg:text-5xl font-openSans font-bold text-black">
//               Your MINI adventure starts now.
//             </h2>
//             <p className="pt-4 md:text-lg text-black/70">
//               Desktop — hover to play. Mobile — auto-play on view.
//             </p>
//           </div>

//           {/* MOBILE: горизонтальная карусель, автоплей по IntersectionObserver */}
//           <div className="md:hidden mt-10">
//             <div
//               className="flex overflow-x-auto snap-x snap-mandatory gap-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
//               style={{ WebkitOverflowScrolling: "touch" } as any}
//             >
//               {[0, 1, 2].map((i) => (
//                 <div
//                   key={i}
//                   className="snap-center shrink-0 w-[82vw] max-w-[420px] [touch-action:manipulation]"
//                 >
//                   <div className="relative aspect-[9/16] overflow-hidden rounded-2xl ring-1 ring-black/10 bg-black">
//                     {/* ВИДЕО (снизу) */}
//                     <video
//                       ref={setMobileRef(i)}
//                       className="absolute inset-0 h-full w-full object-cover"
//                       src={VIDEO_TEASERS[i].src}
//                       muted
//                       playsInline
//                       preload="auto"
//                       onEnded={(e) => {
//                         stopAndPoster(e.currentTarget);
//                         setMobilePlaying(null);
//                       }}
//                       onLoadedData={() =>
//                         setMobileReady((r) => ({ ...r, [i]: true }))
//                       }
//                       onClick={(e) => {
//                         const el = e.currentTarget;
//                         if (!el.paused) {
//                           // пользовательская пауза: показать постер и запретить автоплей до выхода из вьюпорта или повторного тапа
//                           stopAndPoster(el);
//                           userPausedRef.current.add(i);
//                           setMobilePlaying(null);
//                         } else {
//                           // снять userPause и запустить этот ролик, остальные — стоп
//                           userPausedRef.current.delete(i);
//                           mobileRefs.current.forEach((v, j) => {
//                             if (v && j !== i) stopAndPoster(v);
//                           });
//                           el.muted = true;
//                           el.setAttribute("playsinline", "");
//                           el.setAttribute("webkit-playsinline", "");
//                           el.play()
//                             .then(() => setMobilePlaying(i))
//                             .catch(() => {
//                               try {
//                                 el.currentTime = (el.currentTime || 0) + 0.001;
//                               } catch {}
//                               el.play()
//                                 .then(() => setMobilePlaying(i))
//                                 .catch(() => {});
//                             });
//                         }
//                       }}
//                     />

//                     {/* ПОСТЕР-оверлей (сверху) */}
//                     <img
//                       src={VIDEO_TEASERS[i].poster}
//                       alt=""
//                       className={`pointer-events-none absolute inset-0 h-full w-full object-cover z-10 transition-opacity duration-200 ${
//                         mobilePlaying === i && mobileReady[i]
//                           ? "opacity-0"
//                           : "opacity-100"
//                       }`}
//                       draggable={false}
//                     />
//                     {/* Лёгкое затемнение (сверху) */}
//                     <div
//                       className={`pointer-events-none absolute inset-0 z-10 bg-black/25 transition-opacity duration-200 ${
//                         mobilePlaying === i && mobileReady[i]
//                           ? "opacity-0"
//                           : "opacity-100"
//                       }`}
//                     />
//                     {/* Тайтл-чип */}
//                     <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-3">
//                       <span
//                         className={`inline-block rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-black transition-opacity duration-200 ${
//                           mobilePlaying === i && mobileReady[i]
//                             ? "opacity-0"
//                             : "opacity-100"
//                         }`}
//                       >
//                         {VIDEO_TEASERS[i].title}
//                       </span>
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>

//           {/* DESKTOP: 2 колонки со смещением */}
//           <div className="hidden md:flex justify-center mt-10">
//             <div className="flex w-full max-w-[1200px] items-start justify-center gap-8">
//               {/* Левая колонка: 0 и 2 */}
//               <div className="flex flex-col items-center gap-8">
//                 {/* CARD 0 */}
//                 <motion.div
//                   initial={{ opacity: 0, y: 24, scale: 0.98 }}
//                   whileInView={{ opacity: 1, y: 0, scale: 1 }}
//                   viewport={{ once: true, amount: 0.2 }}
//                   transition={{ type: "spring", duration: 0.55, bounce: 0.28 }}
//                   className="group relative w-[88vw] max-w-[440px] md:w-[340px] lg:w-[380px] overflow-hidden rounded-2xl ring-1 ring-black/10 transition-[transform,box-shadow] duration-300 hover:shadow-xl md:hover:scale-[1.02]"
//                   onMouseEnter={() => {
//                     if (!isTouchRef.current) playDesktop(0);
//                   }}
//                   onMouseLeave={() => {
//                     if (!isTouchRef.current) pauseDesktop(0);
//                   }}
//                 >
//                   <div className="relative aspect-[9/16]">
//                     <video
//                       ref={setStoryRef(0)}
//                       className="absolute inset-0 h-full w-full object-cover"
//                       src={VIDEO_TEASERS[0].src}
//                       muted
//                       playsInline
//                       preload="metadata"
//                       loop
//                       onPlaying={() =>
//                         setStoryPlaying((s) => ({ ...s, [0]: true }))
//                       }
//                       onPause={() =>
//                         setStoryPlaying((s) => ({ ...s, [0]: false }))
//                       }
//                       onEnded={(e) => {
//                         stopAndPoster(e.currentTarget);
//                         setStoryPlaying((s) => ({ ...s, [0]: false }));
//                         setHoveredStory((p) => (p === 0 ? null : p));
//                       }}
//                     />
//                     <img
//                       src={VIDEO_TEASERS[0].poster}
//                       alt=""
//                       className={`pointer-events-none absolute inset-0 h-full w-full object-cover z-10 transition-opacity duration-200 ${
//                         hoveredStory === 0 && storyPlaying[0]
//                           ? "opacity-0"
//                           : "opacity-100"
//                       }`}
//                       draggable={false}
//                     />
//                     <div
//                       className={`pointer-events-none absolute inset-0 z-10 bg-black/35 transition-opacity duration-200 ${
//                         hoveredStory === 0 && storyPlaying[0]
//                           ? "opacity-0"
//                           : "opacity-100"
//                       }`}
//                     />
//                     <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-4">
//                       <span
//                         className={`inline-block rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-black transition-opacity duration-200 ${
//                           hoveredStory === 0 && storyPlaying[0]
//                             ? "opacity-0"
//                             : "opacity-100"
//                         }`}
//                       >
//                         {VIDEO_TEASERS[0].title}
//                       </span>
//                     </div>
//                   </div>
//                 </motion.div>

//                 {/* CARD 2 */}
//                 <motion.div
//                   initial={{ opacity: 0, y: 24, scale: 0.98 }}
//                   whileInView={{ opacity: 1, y: 0, scale: 1 }}
//                   viewport={{ once: true, amount: 0.2 }}
//                   transition={{
//                     type: "spring",
//                     duration: 0.55,
//                     bounce: 0.28,
//                     delay: 0.05,
//                   }}
//                   className="group relative w-[88vw] max-w-[440px] md:w-[340px] lg:w-[380px] overflow-hidden rounded-2xl ring-1 ring-black/10 transition-[transform,box-shadow] duration-300 hover:shadow-xl md:hover:scale-[1.02]"
//                   onMouseEnter={() => {
//                     if (!isTouchRef.current) playDesktop(2);
//                   }}
//                   onMouseLeave={() => {
//                     if (!isTouchRef.current) pauseDesktop(2);
//                   }}
//                 >
//                   <div className="relative aspect-[9/16]">
//                     <video
//                       ref={setStoryRef(2)}
//                       className="absolute inset-0 h-full w-full object-cover"
//                       src={VIDEO_TEASERS[2].src}
//                       muted
//                       playsInline
//                       preload="metadata"
//                       loop
//                       onPlaying={() =>
//                         setStoryPlaying((s) => ({ ...s, [2]: true }))
//                       }
//                       onPause={() =>
//                         setStoryPlaying((s) => ({ ...s, [2]: false }))
//                       }
//                       onEnded={(e) => {
//                         stopAndPoster(e.currentTarget);
//                         setStoryPlaying((s) => ({ ...s, [2]: false }));
//                         setHoveredStory((p) => (p === 2 ? null : p));
//                       }}
//                     />
//                     <img
//                       src={VIDEO_TEASERS[2].poster}
//                       alt=""
//                       className={`pointer-events-none absolute inset-0 h-full w-full object-cover z-10 transition-opacity duration-200 ${
//                         hoveredStory === 2 && storyPlaying[2]
//                           ? "opacity-0"
//                           : "opacity-100"
//                       }`}
//                       draggable={false}
//                     />
//                     <div
//                       className={`pointer-events-none absolute inset-0 z-10 bg-black/35 transition-opacity duration-200 ${
//                         hoveredStory === 2 && storyPlaying[2]
//                           ? "opacity-0"
//                           : "opacity-100"
//                       }`}
//                     />
//                     <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-4">
//                       <span
//                         className={`inline-block rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-black transition-opacity duration-200 ${
//                           hoveredStory === 2 && storyPlaying[2]
//                             ? "opacity-0"
//                             : "opacity-100"
//                         }`}
//                       >
//                         {VIDEO_TEASERS[2].title}
//                       </span>
//                     </div>
//                   </div>
//                 </motion.div>
//               </div>

//               {/* Правая колонка: 1 со смещением */}
//               <div className="flex flex-col items-center gap-8 translate-y-[42%]">
//                 <motion.div
//                   initial={{ opacity: 0, y: 24, scale: 0.98 }}
//                   whileInView={{ opacity: 1, y: 0, scale: 1 }}
//                   viewport={{ once: true, amount: 0.2 }}
//                   transition={{
//                     type: "spring",
//                     duration: 0.55,
//                     bounce: 0.28,
//                     delay: 0.03,
//                   }}
//                   className="group relative w-[88vw] max-w-[440px] md:w-[340px] lg:w-[380px] overflow-hidden rounded-2xl ring-1 ring-black/10 transition-[transform,box-shadow] duration-300 hover:shadow-xl md:hover:scale-[1.02]"
//                   onMouseEnter={() => {
//                     if (!isTouchRef.current) playDesktop(1);
//                   }}
//                   onMouseLeave={() => {
//                     if (!isTouchRef.current) pauseDesktop(1);
//                   }}
//                 >
//                   <div className="relative aspect-[9/16]">
//                     <video
//                       ref={setStoryRef(1)}
//                       className="absolute inset-0 h-full w-full object-cover"
//                       src={VIDEO_TEASERS[1].src}
//                       muted
//                       playsInline
//                       preload="metadata"
//                       loop
//                       onPlaying={() =>
//                         setStoryPlaying((s) => ({ ...s, [1]: true }))
//                       }
//                       onPause={() =>
//                         setStoryPlaying((s) => ({ ...s, [1]: false }))
//                       }
//                       onEnded={(e) => {
//                         stopAndPoster(e.currentTarget);
//                         setStoryPlaying((s) => ({ ...s, [1]: false }));
//                         setHoveredStory((p) => (p === 1 ? null : p));
//                       }}
//                     />
//                     <img
//                       src={VIDEO_TEASERS[1].poster}
//                       alt=""
//                       className={`pointer-events-none absolute inset-0 h-full w-full object-cover z-10 transition-opacity duration-200 ${
//                         hoveredStory === 1 && storyPlaying[1]
//                           ? "opacity-0"
//                           : "opacity-100"
//                       }`}
//                       draggable={false}
//                     />
//                     <div
//                       className={`pointer-events-none absolute inset-0 z-10 bg-black/35 transition-opacity duration-200 ${
//                         hoveredStory === 1 && storyPlaying[1]
//                           ? "opacity-0"
//                           : "opacity-100"
//                       }`}
//                     />
//                     <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-4">
//                       <span
//                         className={`inline-block rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-black transition-opacity duration-200 ${
//                           hoveredStory === 1 && storyPlaying[1]
//                             ? "opacity-0"
//                             : "opacity-100"
//                         }`}
//                       >
//                         {VIDEO_TEASERS[1].title}
//                       </span>
//                     </div>
//                   </div>
//                 </motion.div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </section>
//     </div>
//   );
// }
