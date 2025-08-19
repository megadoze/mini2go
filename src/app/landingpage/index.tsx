import { useEffect, useRef, useState } from "react";
import { Burger, Drawer, Modal } from "@mantine/core";
import { motion } from "framer-motion";

const NAV = [
  { label: "Cars", href: "cars" },
  { label: "Special", href: "#special" },
  { label: "Terms", href: "#terms" },
  { label: "FAQ", href: "#faq" },
  { label: "Contacts", href: "#contacts" },
];

const CAR_CARDS = [
  {
    title: "Cooper",
    subtitle: "Urban go-kart feel",
    price: "from €89/day",
    img: "/img/one.png",
    href: "/cars?model=cooper-3d",
  },
  {
    title: "Cabrio",
    subtitle: "Silent & zippy",
    price: "from €99/day",
    img: "/img/cabrio.png",
    href: "/cars?model=electric",
  },
  {
    title: "Countryman",
    subtitle: "Space for adventures",
    price: "from €109/day",
    img: "/img/countryman.png",
    href: "/cars?model=countryman",
  },
];

const VIDEO_TEASERS = [
  {
    title: "Cooper city ride",
    src: "/videos/mini-one.mp4",
    poster: "/img/minione.webp",
  },
  {
    title: "Countryman escape",
    src: "/videos/mini-U25.mp4",
    poster: "/img/minicountryman.webp",
  },
  {
    title: "Cabrio seaside",
    src: "/videos/mini-cabrio.mp4",
    poster: "/img/minicabrio.webp",
  },
] as const;

export default function MiniRentalHero() {
  const [menuOpen, setMenuOpen] = useState(false);

  // Slider refs/state
  const sliderRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  // Индекс для показа подписи/цены (стабильный)
  const [displayIdx, setDisplayIdx] = useState(0);
  const displayIdxRef = useRef(0);
  useEffect(() => {
    displayIdxRef.current = displayIdx;
  }, [displayIdx]);

  // Целевой индекс для программной прокрутки (wrap/стрелки)
  const targetIdxRef = useRef<number | null>(null);

  const rafRef = useRef<number | null>(null);
  const [sidePad, setSidePad] = useState(0);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  // Stories (masonry) player control
  const storyRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [hoveredStory, setHoveredStory] = useState<number | null>(null);
  const isTouchRef = useRef(false);

  const scrollToSlide = (idx: number) => {
    const track = sliderRef.current;
    if (!track) return;

    const slides = Array.from(
      track.querySelectorAll("[data-slide]")
    ) as HTMLElement[];
    const count = slides.length;
    const next = (idx + count) % count;

    // запоминаем цель для автоскролла; подписи покажем только когда цель встанет в центр
    targetIdxRef.current = next;

    slides[next]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
    // activeSlide/ displayIdx не трогаем — дождёмся факта скролла
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

      let best = 0;
      let min = Infinity;
      slides.forEach((child, i) => {
        const rect = child.getBoundingClientRect();
        const childCenter = rect.left + rect.width / 2;
        const d = Math.abs(childCenter - center);
        if (d < min) {
          min = d;
          best = i;
        }
      });

      setActiveSlide(best);

      // Порог «почти центр»
      const w =
        slides[best]?.getBoundingClientRect().width ??
        (slides[best] as HTMLElement | undefined)?.offsetWidth ??
        1;
      const enter = Math.min(28, w * 0.08); // ~8% ширины, макс 28px
      const margin = Math.min(18, w * 0.05); // гистерезис для ручного свайпа

      const currentIdx = displayIdxRef.current;

      if (targetIdxRef.current !== null) {
        // программная прокрутка (wrap/стрелки)
        if (best === targetIdxRef.current && min <= enter) {
          if (currentIdx !== best) setDisplayIdx(best);
          targetIdxRef.current = null; // цель достигнута
        }
      } else {
        // ручной свайп — не прячем подписи, просто переключаем, когда реально центр
        if (currentIdx !== best) {
          // текущая дистанция от центра у того, кто сейчас показан
          let currentDist = Infinity;
          const currentEl = slides[currentIdx];
          if (currentEl) {
            const r = currentEl.getBoundingClientRect();
            const c = r.left + r.width / 2;
            currentDist = Math.abs(c - center);
          }
          if (min <= enter || min + margin < currentDist) {
            setDisplayIdx(best);
          }
        }
      }

      rafRef.current = null;
    });
  };

  // Fallback: scrollend/дебаунс — страхуемся от редких случаев
  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;

    const commit = () => {
      if (targetIdxRef.current !== null) {
        setDisplayIdx(targetIdxRef.current);
        targetIdxRef.current = null;
      } else {
        setDisplayIdx(activeSlide);
      }
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

  // Центровка первого/последнего
  useEffect(() => {
    const measure = () => {
      const track = sliderRef.current;
      if (!track) return;
      const first = track.querySelector("[data-slide]") as HTMLElement | null;
      if (!first) return;
      const w = first.getBoundingClientRect().width;
      const pad = Math.max((window.innerWidth - w) / 2, 0);
      setSidePad(pad);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Arrow keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") scrollToSlide(activeSlide - 1);
      if (e.key === "ArrowRight") scrollToSlide(activeSlide + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSlide]);

  useEffect(() => {
    if (typeof window !== "undefined" && "matchMedia" in window) {
      isTouchRef.current = window.matchMedia("(hover: none)").matches;
    }
  }, []);

  const playStory = (i: number) => {
    const v = storyRefs.current[i];
    if (!v) return;
    v.muted = true;
    const p = v.play();

    if (p && typeof p.catch === "function") p.catch(() => {});
  };

  const pauseStory = (i: number, reset = false) => {
    const v = storyRefs.current[i];
    if (!v) return;

    v.pause();

    if (reset) {
      try {
        v.currentTime = 0;
      } catch {}
      // Форсим возврат к постеру:
      v.load(); // Safari/Chrome заново отрисует постер
    }
  };

  const setStoryRef = (idx: number) => (el: HTMLVideoElement | null) => {
    storyRefs.current[idx] = el; // callback-ref должен возвращать void
  };

  return (
    <div className="relative min-h-screen bg-black text-white">
      {/* HEADER */}
      <header
        className={
          "absolute inset-x-0 top-0 z-50 transition-colors duration-300 "
        }
      >
        <div className="px-4 sm:px-6 lg:px-10">
          <div className="flex h-16 items-center justify-between gap-6">
            <a href="#" className="shrink-0 font-bold tracking-wide text-lg">
              MINI2GO
            </a>

            <nav className="mx-auto hidden lg:block">
              <ul className="flex items-center gap-6 xl:gap-8 text-sm font-medium">
                {NAV.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="hover:text-white/90 text-white/80 transition"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="w-24 flex justify-end">
              <button className="hidden lg:inline-flex font-medium text-sm text-white/90 hover:text-white transition">
                Log In
              </button>
              <Burger
                opened={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                color="#fff"
                size="sm"
                aria-label="Toggle menu"
                className="lg:hidden h-10 w-10 rounded-md ring-1 ring-white/20 hover:ring-white/40"
              />
            </div>
          </div>
        </div>

        <Drawer
          opened={menuOpen}
          onClose={() => setMenuOpen(false)}
          position="left"
          size="100%"
          withCloseButton
          title={null}
          padding={0}
          radius={0}
          overlayProps={{ opacity: 0.55, blur: 2 }}
          styles={{
            content: {
              backgroundColor: "rgba(0,0,0,0.95)",
              border: "none",
              boxShadow: "none",
            },
            header: { background: "transparent", borderBottom: "none" },
            body: { padding: 0 },
            title: { color: "#fff" },
            close: { color: "white", marginRight: "14px", marginTop: "4px" },
          }}
        >
          <div className="text-white min-h-[100dvh] px-6 py-8">
            <ul className="flex flex-col gap-4 text-2xl">
              {NAV.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="block py-2 text-white/90 hover:text-white"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <button
                className="w-full rounded-xl ring-1 ring-white/20 px-4 py-3 text-base hover:ring-white/40"
                onClick={() => setMenuOpen(false)}
              >
                Log In
              </button>
            </div>
          </div>
        </Drawer>
      </header>

      {/* HERO */}
      <section className="relative flex items-center pt-16 md:pt-0 min-h-[100svh] md:min-h-[100dvh] lg:min-h-screen">
        <div
          aria-hidden
          className="absolute inset-0 z-0 bg-center bg-cover"
          style={{
            backgroundImage:
              "url('https://www.mini.es/es_ES/home/mini-editions/cabrio-seaside-edition/modelos-precios/jcr:content/main/par/stage/motion.narrow.1920w.j_1717083376826.jpg?q=80&w=2069&auto=format&fit=crop')",
          }}
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/30 via-black/10 to-white/10" />

        <div className="flex justify-center relative z-10 w-full px-4 sm:px-6 lg:px-10 pb-16">
          <div className="flex flex-col items-center max-w-3xl">
            <h1 className=" text-3xl sm:text-4xl lg:text-6xl font-openSans font-bold leading-tight">
              It's time to drive MINI
            </h1>

            <div className="hidden md:flex mt-6 flex-wrap items-center gap-3">
              <a
                href="#reservierung"
                className="inline-flex items-center justify-center rounded-full bg-white text-black px-5 py-2.5 text-sm font-semibold hover:bg-white/90 transition"
              >
                Book MINI now
              </a>
              <a
                href="#mehr"
                className="inline-flex items-center justify-center rounded-full ring-1 ring-white/30 px-5 py-2.5 text-sm font-semibold hover:ring-white/60 transition bg-gray-900/20"
              >
                More
              </a>
            </div>
          </div>
        </div>

        {/* Booking form */}
        <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-20 bottom-[max(16px,env(safe-area-inset-bottom))] sm:bottom-10">
          <div className="hidden mb-5 md:flex flex-wrap justify-center items-center gap-2 font-semibold text-sm text-white/90">
            {[
              "1. Select location",
              "2. Select period",
              "3. Choose your MINI",
              "4. Pick up and go!",
            ].map((html, idx) => (
              <span
                key={idx}
                className="rounded-full bg-black/30 px-4 py-2 backdrop-blur-md"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ))}
          </div>
          <form className="flex bg-white rounded-2xl shadow-xl flex-col sm:flex-row items-stretch md:items-center gap-2 p-4">
            <p className=" text-black font-bold">Book your MINI now</p>
            <input
              type="text"
              placeholder="Митстейшн / город"
              className="flex-1 rounded-md border border-gray-200 px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black"
            />
            <input
              type="date"
              className="flex-1 rounded-md border border-gray-200 px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black"
            />
            <button
              type="submit"
              className="rounded-md bg-black text-white px-6 py-3 text-sm font-medium hover:bg-black/80"
            >
              Book
            </button>
          </form>
        </div>
      </section>

      {/* Which one will it be today? */}
      <section id="models" className="relative bg-white text-black">
        <div className="px-4 sm:px-6 lg:px-10 py-24 sm:py-36">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-openSans font-bold">
              Which one will it be today?
            </h2>
            <p className="pt-4 md:text-lg">
              Our rental stations offer you a wide selection of models and are
              happy to fulfil your individual wishes.
            </p>
          </div>

          {/* Center-focused minimal slider */}
          <div className="relative mt-8">
            <div
              ref={sliderRef}
              onScroll={onSliderScroll}
              className=" flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth items-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden h-80 md:h-[456px]"
              style={{ paddingLeft: sidePad, paddingRight: sidePad }}
            >
              {CAR_CARDS.map((c, i) => (
                <a
                  key={c.title}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setLightboxIdx(i);
                    setLightboxOpen(true);
                  }}
                  data-slide
                  className="snap-center shrink-0 w-[70vw] sm:w-[50vw] lg:w-[560px] flex flex-col items-center justify-center no-underline"
                  aria-label={`Open ${c.title} preview`}
                >
                  {/* Название — всегда в DOM; видимость меняется без прыжков */}
                  <div
                    className={`-mb-6 text-4xl sm:text-6xl font-openSans font-bold text-neutral-300 z-50 transition-opacity duration-75 ${
                      i === displayIdx ? "opacity-100" : "opacity-0"
                    }`}
                    aria-hidden={i !== displayIdx}
                  >
                    {c.title}
                  </div>

                  <img
                    src={c.img}
                    alt={c.title}
                    className={` transition-transform duration-300 h-[220px] sm:h-[260px] lg:h-[320px] object-contain select-none cursor-zoom-in ${
                      i === activeSlide
                        ? "scale-110 sm:scale-[1.15] lg:scale-125"
                        : "scale-100"
                    }`}
                    draggable={false}
                    loading="lazy"
                  />

                  {/* Цена — всегда в DOM; видимость меняется без прыжков */}
                  <div
                    className={`text-center z-50 -mt-10 transition-opacity duration-75 ${
                      i === displayIdx ? "opacity-100" : "opacity-0"
                    }`}
                    aria-hidden={i !== displayIdx}
                  >
                    <div className=" md:text-2xl text-gray-800">{c.price}</div>
                  </div>
                </a>
              ))}
            </div>

            {/* Arrows */}
            <button
              type="button"
              aria-label="Previous"
              onClick={() => scrollToSlide(activeSlide - 1)}
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black text-white h-10 w-10 flex items-center justify-center opacity-20 hover:opacity-80 transition duration-300"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => scrollToSlide(activeSlide + 1)}
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black text-white h-10 w-10 flex items-center justify-center opacity-20 hover:opacity-80 transition duration-300"
            >
              ›
            </button>

            {/* Dots */}
            <div className="mt-0 flex justify-center gap-2">
              {CAR_CARDS.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => scrollToSlide(i)}
                  className={`h-1.5 w-1.5 rounded-full ${
                    i === activeSlide ? "bg-black" : "bg-black/30"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Video */}
      <section id="mini-stories" className="relative bg-white">
        <div className="px-4 sm:px-6 lg:px-10 py-16 sm:py-20">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-openSans font-bold text-black">
              Ihr MINI Abenteuer beginnt jetzt.
            </h2>
            <p className="pt-4 md:text-lg text-black/70">
              Vertical stories — hover to play (desktop) / tap (mobile).
            </p>
          </div>

          {/* Центр: слева 2 видео столбиком, справа 1, смещён вниз на ~22% на десктопе.
       На мобилке — всё в одну колонку по центру, без смещения. */}
          {/* MOBILE: горизонтальная карусель с центрированием карточек */}
          {/* MOBILE: простая горизонтальная карусель без motion */}
          {/* MOBILE: простая горизонтальная карусель без motion */}
          <div className="md:hidden mt-10">
            <div className="relative">
              <div
                className="flex overflow-x-auto snap-x snap-mandatory gap-4 px-4
                 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="snap-center shrink-0 w-[82vw] max-w-[420px]"
                  >
                    <div className="relative aspect-[9/16] overflow-hidden rounded-2xl ring-1 ring-black/10 bg-black">
                      {/* Видео */}
                      <video
                        ref={setStoryRef(i)}
                        className="absolute inset-0 h-full w-full object-cover"
                        src={VIDEO_TEASERS[i].src}
                        poster={VIDEO_TEASERS[i].poster}
                        muted
                        playsInline
                        controls={false}
                        preload="metadata"
                        onEnded={() => {
                          if (hoveredStory === i) setHoveredStory(null);
                          pauseStory(i, true); // стоп и вернуть постер
                        }}
                      />

                      {/* Прозрачная кнопка-перекрытие: гарантированный жест для iOS */}
                      <button
                        type="button"
                        aria-label="Play/Pause"
                        className="absolute inset-0"
                        style={{ touchAction: "manipulation" }}
                        onPointerUp={(e) => {
                          // иногда Safari «залипает» на pointer capture
                          (e.currentTarget as any).releasePointerCapture?.(
                            e.pointerId
                          );
                          const v = storyRefs.current[i];
                          if (!v) return;

                          // если уже играет — пауза и постер
                          if (hoveredStory === i && !v.paused) {
                            setHoveredStory(null);
                            pauseStory(i, true);
                            return;
                          }

                          // останавливаем предыдущий
                          if (hoveredStory !== null)
                            pauseStory(hoveredStory, true);

                          setHoveredStory(i);
                          v.muted = true; // на всякий случай перед play()
                          v.play().catch(() => {});
                        }}
                      />

                      {/* Затемнение — исчезает, когда видео играет */}
                      <div
                        className={`pointer-events-none absolute inset-0 bg-black/35 transition-opacity duration-200
                          ${hoveredStory === i ? "opacity-0" : "opacity-100"}`}
                      />

                      {/* Подпись — абсолютная, не влияет на высоту */}
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-3">
                        <span
                          className={`inline-block rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-black
                            transition-opacity duration-200
                            ${
                              hoveredStory === i ? "opacity-0" : "opacity-100"
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
          </div>

          {/* DESKTOP: двухколоночная версия со смещением вправо */}
          <div className="hidden md:flex justify-center mt-10">
            <div className="flex w-full max-w-[1200px] items-start justify-center gap-8">
              {/* Левая колонка: карточки #0 и #2 */}
              <div className="flex flex-col items-center gap-8">
                {/* CARD 0 */}
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ type: "spring", duration: 0.55, bounce: 0.28 }}
                  className="group relative w-[88vw] max-w-[440px] md:w-[340px] lg:w-[380px]
                   overflow-hidden rounded-2xl ring-1 ring-black/10
                   transition-[transform,box-shadow] duration-300
                   hover:shadow-xl md:hover:scale-[1.02]"
                  onMouseEnter={() => {
                    if (!isTouchRef.current) {
                      setHoveredStory(0);
                      playStory(0);
                    }
                  }}
                  onMouseLeave={() => {
                    if (!isTouchRef.current) {
                      setHoveredStory((p) => (p === 0 ? null : p));
                      pauseStory(0, true);
                    }
                  }}
                  onClick={() => {
                    if (!isTouchRef.current) return;
                    if (hoveredStory === 0) {
                      setHoveredStory(null);
                      pauseStory(0, true);
                    } else {
                      if (hoveredStory !== null) pauseStory(hoveredStory, true);
                      setHoveredStory(0);
                      playStory(0);
                    }
                  }}
                >
                  <div className="relative aspect-[9/16]">
                    <video
                      ref={setStoryRef(0)}
                      className="absolute inset-0 h-full w-full object-cover"
                      src={VIDEO_TEASERS[0].src}
                      poster={VIDEO_TEASERS[0].poster}
                      muted
                      playsInline
                      loop
                      preload="metadata"
                    />
                    <div
                      className={`pointer-events-none absolute inset-0 bg-black/35 transition-opacity duration-300
                        ${
                          hoveredStory === 0 ? "opacity-0" : "opacity-100"
                        } group-hover:opacity-0`}
                    />
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-4">
                      <span
                        className={`inline-block rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-black
                          transition-opacity duration-300
                          ${
                            hoveredStory === 0 ? "opacity-0" : "opacity-100"
                          } group-hover:opacity-0`}
                      >
                        {VIDEO_TEASERS[0].title}
                      </span>
                    </div>
                  </div>
                </motion.button>

                {/* CARD 2 */}
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    type: "spring",
                    duration: 0.55,
                    bounce: 0.28,
                    delay: 0.05,
                  }}
                  className="group relative w-[88vw] max-w-[440px] md:w-[340px] lg:w-[380px]
                   overflow-hidden rounded-2xl ring-1 ring-black/10
                   transition-[transform,box-shadow] duration-300
                   hover:shadow-xl md:hover:scale-[1.02]"
                  onMouseEnter={() => {
                    if (!isTouchRef.current) {
                      setHoveredStory(2);
                      playStory(2);
                    }
                  }}
                  onMouseLeave={() => {
                    if (!isTouchRef.current) {
                      setHoveredStory((p) => (p === 2 ? null : p));
                      pauseStory(2, true);
                    }
                  }}
                  onClick={() => {
                    if (!isTouchRef.current) return;
                    if (hoveredStory === 2) {
                      setHoveredStory(null);
                      pauseStory(2, true);
                    } else {
                      if (hoveredStory !== null) pauseStory(hoveredStory, true);
                      setHoveredStory(2);
                      playStory(2);
                    }
                  }}
                >
                  <div className="relative aspect-[9/16]">
                    <video
                      ref={setStoryRef(2)}
                      className="absolute inset-0 h-full w-full object-cover"
                      src={VIDEO_TEASERS[2].src}
                      poster={VIDEO_TEASERS[2].poster}
                      muted
                      playsInline
                      loop
                      preload="metadata"
                    />
                    <div
                      className={`pointer-events-none absolute inset-0 bg-black/35 transition-opacity duration-300
                        ${
                          hoveredStory === 2 ? "opacity-0" : "opacity-100"
                        } group-hover:opacity-0`}
                    />
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-4">
                      <span
                        className={`inline-block rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-black
                          transition-opacity duration-300
                          ${
                            hoveredStory === 2 ? "opacity-0" : "opacity-100"
                          } group-hover:opacity-0`}
                      >
                        {VIDEO_TEASERS[2].title}
                      </span>
                    </div>
                  </div>
                </motion.button>
              </div>

              {/* Правая колонка: карточка #1 со смещением вниз */}
              <div className="flex flex-col items-center gap-8 translate-y-[42%]">
                {/* CARD 1 */}
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    type: "spring",
                    duration: 0.55,
                    bounce: 0.28,
                    delay: 0.03,
                  }}
                  className="group relative w-[88vw] max-w-[440px] md:w-[340px] lg:w-[380px]
                   overflow-hidden rounded-2xl ring-1 ring-black/10
                   transition-[transform,box-shadow] duration-300
                   hover:shadow-xl md:hover:scale-[1.02]"
                  onMouseEnter={() => {
                    if (!isTouchRef.current) {
                      setHoveredStory(1);
                      playStory(1);
                    }
                  }}
                  onMouseLeave={() => {
                    if (!isTouchRef.current) {
                      setHoveredStory((p) => (p === 1 ? null : p));
                      pauseStory(1, true);
                    }
                  }}
                  onClick={() => {
                    if (!isTouchRef.current) return;
                    if (hoveredStory === 1) {
                      setHoveredStory(null);
                      pauseStory(1, true);
                    } else {
                      if (hoveredStory !== null) pauseStory(hoveredStory, true);
                      setHoveredStory(1);
                      playStory(1);
                    }
                  }}
                >
                  <div className="relative aspect-[9/16]">
                    <video
                      ref={setStoryRef(1)}
                      className="absolute inset-0 h-full w-full object-cover"
                      src={VIDEO_TEASERS[1].src}
                      poster={VIDEO_TEASERS[1].poster}
                      muted
                      playsInline
                      loop
                      preload="metadata"
                    />
                    <div
                      className={`pointer-events-none absolute inset-0 bg-black/35 transition-opacity duration-300
                        ${
                          hoveredStory === 1 ? "opacity-0" : "opacity-100"
                        } group-hover:opacity-0`}
                    />
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-4">
                      <span
                        className={`inline-block rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-black
                          transition-opacity duration-300
                          ${
                            hoveredStory === 1 ? "opacity-0" : "opacity-100"
                          } group-hover:opacity-0`}
                      >
                        {VIDEO_TEASERS[1].title}
                      </span>
                    </div>
                  </div>
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lightbox */}
      <Modal
        opened={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        centered
        size="auto"
        withCloseButton
        padding={0}
        radius="md"
        overlayProps={{ opacity: 0.85, blur: 2 }}
        styles={{
          content: {
            backgroundColor: "transparent",
            border: "none",
            boxShadow: "none",
          },
          header: { background: "transparent", borderBottom: "none" },
          body: { padding: 0 },
          title: { color: "#fff" },
          close: { color: "#fff" },
        }}
      >
        <div className="flex items-center justify-center">
          <img
            src={CAR_CARDS[lightboxIdx]?.img}
            alt={CAR_CARDS[lightboxIdx]?.title || "MINI"}
            className="max-h-[65vh] w-auto object-contain select-none rounded-sm"
            draggable={false}
          />
        </div>
      </Modal>
    </div>
  );
}
