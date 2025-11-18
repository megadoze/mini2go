/* eslint-disable @next/next/no-img-element */

import { CAR_CARDS } from "@/constants/carOptions";
import { useEffect, useRef, useState } from "react";

export const ModelsSection = () => {
  const rafRef = useRef<number | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [displayIdx, setDisplayIdx] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const targetIdxRef = useRef<number | null>(null);
  const [sidePad, setSidePad] = useState(0);

  const displayIdxRef = useRef(0);
  useEffect(() => {
    displayIdxRef.current = displayIdx;
  }, [displayIdx]);

  // ---------- Slider helpers ----------
  const scrollToSlide = (idx: number) => {
    const track = sliderRef.current;
    if (!track) return;
    const slides = Array.from(
      track.querySelectorAll("[data-slide]")
    ) as HTMLElement[];
    const count = slides.length;
    const next = (idx + count) % count;
    targetIdxRef.current = next;
    slides[next]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  const onSliderScroll = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      const track = sliderRef.current;
      if (!track) {
        rafRef.current = null;
        return;
      }
      const center = track.getBoundingClientRect().left + track.clientWidth / 2;
      const slides = Array.from(
        track.querySelectorAll("[data-slide]")
      ) as HTMLElement[];
      let best = 0,
        min = Infinity;
      slides.forEach((child, i) => {
        const r = child.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - center);
        if (d < min) {
          min = d;
          best = i;
        }
      });
      setActiveSlide(best);

      const w = slides[best]?.getBoundingClientRect().width ?? 1;
      const enter = Math.min(28, w * 0.08);
      const margin = Math.min(18, w * 0.05);
      const currentIdx = displayIdxRef.current;

      if (targetIdxRef.current !== null) {
        if (best === targetIdxRef.current && min <= enter) {
          if (currentIdx !== best) setDisplayIdx(best);
          targetIdxRef.current = null;
        }
      } else {
        if (currentIdx !== best) {
          let currentDist = Infinity;
          const currentEl = slides[currentIdx];
          if (currentEl) {
            const r = currentEl.getBoundingClientRect();
            currentDist = Math.abs(r.left + r.width / 2 - center);
          }
          if (min <= enter || min + margin < currentDist) setDisplayIdx(best);
        }
      }
      rafRef.current = null;
    });
  };

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    const commit = () => {
      if (targetIdxRef.current !== null) {
        setDisplayIdx(targetIdxRef.current);
        targetIdxRef.current = null;
      } else setDisplayIdx(activeSlide);
    };
    el.addEventListener("scrollend", commit as EventListener);
    let t: any;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(commit, 100);
    };
    el.addEventListener("scroll", onScroll);
    return () => {
      el.removeEventListener("scrollend", commit as EventListener);
      el.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };
  }, [activeSlide]);

  useEffect(() => {
    const measure = () => {
      const track = sliderRef.current;
      if (!track) return;
      const first = track.querySelector("[data-slide]") as HTMLElement | null;
      if (!first) return;
      const w = first.getBoundingClientRect().width;
      setSidePad(Math.max((window.innerWidth - w) / 2, 0));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") scrollToSlide(activeSlide - 1);
      if (e.key === "ArrowRight") scrollToSlide(activeSlide + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSlide]);

  return (
    <section id="models" className="relative bg-white text-black">
      <div className=" pt-18 md:pt-20 pb-20">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-6xl font-oleo-script font-extrabold ">
            Which one will it be today?
          </h2>
          <p className="pt-1 md:pt-2 text-lg md:text-2xl text-neutral-600 font-roboto-condensed">
            The road is calling — choose your MINI.
          </p>
        </div>

        <div className="relative mt-18">
          <div
            ref={sliderRef}
            onScroll={onSliderScroll}
            className="relative flex gap-34 2xl:gap-44 overflow-x-auto snap-x snap-mandatory scroll-smooth items-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden h-80 md:h-[456px]"
            style={{ paddingLeft: sidePad, paddingRight: sidePad }}
          >
            {CAR_CARDS.map((c, i) => (
              <a
                key={c.title}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                }}
                data-slide
                className="z-10 snap-center shrink-0 w-[80vw] sm:w-[50vw] lg:w-[560px] flex flex-col items-center justify-center no-underline"
                aria-label={`Open ${c.title} preview`}
              >
                <div
                  className={` absolute top-4 text-5xl sm:text-7xl font-roboto-condensed font-bold z-50 transition-opacity duration-75 bg-zinc-300/60  bg-clip-text text-transparent ${
                    i === displayIdx ? "opacity-100" : "opacity-0"
                  }`}
                  aria-hidden={i !== displayIdx}
                >
                  {c.title}
                </div>
                <img
                  src={c.img}
                  alt={c.title}
                  className={` transition-transform duration-300 h-[200px] sm:h-[260px] lg:h-80 object-contain select-none ${
                    i === activeSlide ? "scale-125" : "scale-100"
                  }`}
                  draggable={false}
                  loading="lazy"
                />
                <div
                  className={` text-center z-50 -mt-8 transition-opacity duration-75 ${
                    i === displayIdx ? "opacity-100" : "opacity-0"
                  }`}
                  aria-hidden={i !== displayIdx}
                >
                  <div className="font-boogaloo font-medium text-lg md:text-3xl text-zinc-500/90 ">
                    {c.price}
                  </div>
                </div>
              </a>
            ))}
          </div>
          {activeSlide !== 0 && (
            <button
              type="button"
              aria-label="Previous"
              onClick={() => scrollToSlide(activeSlide - 1)}
              className="hidden absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black text-white h-10 w-10 md:flex items-center justify-center opacity-20 hover:opacity-80 transition duration-300"
            >
              ‹
            </button>
          )}
          <button
            type="button"
            aria-label="Next"
            onClick={() => scrollToSlide(activeSlide + 1)}
            className="hidden absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black text-white h-10 w-10 md:flex items-center justify-center opacity-20 hover:opacity-80 transition duration-300"
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
};
