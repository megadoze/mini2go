import { useEffect, useRef, useState } from "react";
import { Burger, Drawer, Modal } from "@mantine/core";

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
    subtitle: "Urban go‑kart feel",
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

export default function MiniRentalHero() {
  const [menuOpen, setMenuOpen] = useState(false);

  // Slider refs/state for "Which one will it be today?"
  const sliderRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [displayIdx, setDisplayIdx] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollIdleTimerRef = useRef<number | null>(null);

  const rafRef = useRef<number | null>(null);
  const [sidePad, setSidePad] = useState(0);

  // Lightbox for enlarged center photo
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  const scrollToSlide = (idx: number) => {
    const track = sliderRef.current;
    if (!track) return;

    setIsScrolling(true); // ← мгновенно скрываем подписи

    const slides = Array.from(
      track.querySelectorAll("[data-slide]")
    ) as HTMLElement[];
    const count = slides.length;
    const next = (idx + count) % count;

    slides[next]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });

    // ВАЖНО: не вызываем setActiveSlide здесь
  };

  const onSliderScroll = () => {
    setIsScrolling(true); // ← как только есть скролл — подписи прячем

    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      const track = sliderRef.current;
      if (!track) {
        rafRef.current = null;
        return;
      }

      const center = track.getBoundingClientRect().left + track.clientWidth / 2;
      let best = 0;
      let min = Infinity;
      const slides = Array.from(
        track.querySelectorAll("[data-slide]")
      ) as HTMLElement[];
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

      // дебаунс конца прокрутки → показать подписи быстро (90мс)
      if (scrollIdleTimerRef.current)
        window.clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = window.setTimeout(() => {
        setDisplayIdx(best);
        setIsScrolling(false);
      }, 16);

      rafRef.current = null;
    });
  };

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;

    const commit = () => setDisplayIdx(activeSlide);

    el.addEventListener("scrollend", commit);

    // Fallback через дебаунс scroll
    let t: any;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(commit, 140);
    };
    el.addEventListener("scroll", onScroll);

    return () => {
      el.removeEventListener("scrollend", commit);
      el.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };
  }, [activeSlide]);

  // Keep the center slide truly centered on any viewport
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

  // Optional: arrow-key navigation for convenience
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") scrollToSlide(activeSlide - 1);
      if (e.key === "ArrowRight") scrollToSlide(activeSlide + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSlide]);

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

            {/* Center nav (desktop) */}
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

            {/* Actions right */}
            <div className="w-24 flex justify-end">
              <button className="hidden lg:inline-flex font-medium text-sm text-white/90 hover:text-white transition">
                Log In
              </button>
              {/* Burger */}
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

        {/* Mobile menu – Mantine Drawer full-screen from left */}
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
      <section className="relative min-h-screen flex items-center">
        <div
          aria-hidden
          className="absolute inset-0 z-0 bg-center bg-cover"
          style={{
            backgroundImage:
              "url('https://www.mini.es/es_ES/home/mini-editions/cabrio-seaside-edition/modelos-precios/jcr:content/main/par/stage/motion.narrow.1920w.j_1717083376826.jpg?q=80&w=2069&auto=format&fit=crop')",
          }}
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/30 via-black/10 to-white/20" />

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

        {/* Booking form centered at bottom */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-20">
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
        <div className="px-4 sm:px-6 lg:px-10 py-16 sm:py-20">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-openSans font-bold">
              Which one will it be today?
            </h2>
            <p className="pt-4 md:text-lg">
              Our rental stations offer you a wide selection of models and are
              happy to fulfil your individual wishes.
            </p>
          </div>

          {/* Center-focused minimal slider: only the model image, no frame/background */}
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
                  <div
                    className={`-mb-6 text-4xl sm:text-6xl font-openSans font-bold text-neutral-300 z-50
              transition-opacity duration-100 ${
                !isScrolling && i === displayIdx ? "opacity-100" : "opacity-0"
              }
              pointer-events-none select-none`}
                    aria-hidden={!(!isScrolling && i === displayIdx)}
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
                  <div
                    className={`text-center z-50 -mt-10 transition-opacity duration-100
              ${!isScrolling && i === displayIdx ? "opacity-100" : "opacity-0"}
              pointer-events-none select-none`}
                    aria-hidden={!(!isScrolling && i === displayIdx)}
                  >
                    <div className=" text-xl md:text-2xl text-gray-800">
                      {c.price}
                    </div>
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
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black text-white h-10 w-10 flex items-center justify-center opacity-20 hover:opacity-80 duration-300"
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

      {/* Lightbox modal for enlarged model photo */}
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
