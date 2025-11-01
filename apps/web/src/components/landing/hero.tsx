export const HeroSection = () => {
  const mainBanner = "/img/main2.webp";
  return (
    <section className="relative flex items-center pt-16 md:pt-0 min-h-svh md:min-h-dvh lg:min-h-screen">
      {/* Background */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-center bg-cover"
        style={{ backgroundImage: `url(${mainBanner})` }}
      />
      {/* Stronger overlay for contrast */}
      <div className="absolute inset-0 z-0 bg-linear-to-b from-black/20 via-black/10 to-black/10" />

      {/* Content */}
      <div className="flex justify-center relative z-10 w-full px-4 sm:px-6 lg:px-10 pb-52 md:pb-20">
        <div className="flex flex-col items-center text-center max-w-4xl">
          <h1 className="font-robotoCondensed font-bold tracking-[0.01em] leading-tight text-white text-4xl sm:text-5xl lg:text-7xl text-shadow ">
            It’s time to drive
            <span className="inline-block ">
              <span className="px-2 bg-white/20 ml-1 ">MINI</span>
            </span>
          </h1>

          <p className="mt-4 text-white font-robotoCondensed text-lg sm:text-xl lg:text-2xl max-w-3xl ">
            <span className="bg-linear-to-r from-black/80 to-transparent px-2 py-1 ">
              Life’s too short for boring cars.
            </span>

            <strong className="  text-shadow">
              Rent MINI Cooper — enjoy the ride.
            </strong>
          </p>

          {/* CTAs */}
          <div className=" hidden mt-6 md:flex flex-wrap items-center gap-3">
            <a
              href="#reservierung"
              className="inline-flex items-center justify-center rounded-full bg-white text-black px-5 py-2.5 font-robotoCondensed font-semibold hover:bg-white/90 focus:outline-none focus:ring-4 focus:ring-white/30 transition"
            >
              Book MINI now
            </a>
            <a
              href="#mehr"
              className="inline-flex items-center justify-center rounded-full ring-1 ring-white/40 px-5 py-2.5 font-robotoCondensed font-semibold hover:ring-white/70 bg-black/20 text-white focus:outline-none focus:ring-4 focus:ring-white/30 transition"
            >
              More
            </a>
          </div>
        </div>
      </div>

      {/* Booking form */}
      <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-20 bottom-[max(16px,env(safe-area-inset-bottom))] sm:bottom-10">
        <div className="hidden mb-5 md:flex flex-wrap justify-center items-center gap-4 font-robotoCondensed text-shadow text-white">
          {[
            "Select location",
            "Select period",
            "Choose your MINI",
            "Pick up and go",
          ].map((html, idx) => (
            <p
              key={idx}
              className="flex bg-linear-to-r from-neutral-800/50 to-neutral-400/0 px-1 py-1 rounded-full "
            >
              <span className=" text-center bg-neutral-200/30 rounded-full w-6 h-6 mr-1">
                {idx + 1}
              </span>
              <span
                // className="bg-gradient-to-r from-neutral-700/40 to-neutral-400/0 px-3 py-1 rounded-full text-shadow"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </p>
          ))}
        </div>

        <form className="flex bg-white rounded-xl shadow-xl flex-col sm:flex-row items-stretch md:items-center gap-2 p-4">
          <p className="text-black font-robotoCondensed text-lg font-bold shrink-0">
            Book your MINI
          </p>
          <input
            type="text"
            placeholder="Location"
            aria-label="Location"
            className="h-12 flex-1 rounded-md border border-neutral-500 px-4 py-3 text-sm text-black focus:outline-none focus:ring-4 focus:ring-neutral-400/20"
          />
          <input
            type="text"
            placeholder="Dates"
            aria-label="Dates"
            className="h-12 flex-1 rounded-md border border-neutral-500 px-4 py-3 text-sm text-black focus:outline-none focus:ring-4 focus:ring-neutral-400/20"
          />
          <button
            type="submit"
            className="h-12 rounded-md bg-black text-white px-6 tracking-[0.04em] uppercase font-robotoCondensed font-medium hover:bg-black/85 focus:outline-none focus:ring-4 focus:ring-black/30"
          >
            Book
          </button>
        </form>
      </div>
    </section>
  );
};
