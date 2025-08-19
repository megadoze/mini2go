const HeroSection = () => {
  const mainBanner = "/img/main.webp";
  return (
    <section className="relative flex items-center pt-16 md:pt-0 min-h-[100svh] md:min-h-[100dvh] lg:min-h-screen">
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-center bg-cover"
        style={{
          backgroundImage: `url(${mainBanner})`,
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
            placeholder="Location"
            className="flex-1 rounded-md border border-gray-200 px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black"
          />
          <input
            type="text"
            placeholder="Dates"
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
  );
};

export default HeroSection;
