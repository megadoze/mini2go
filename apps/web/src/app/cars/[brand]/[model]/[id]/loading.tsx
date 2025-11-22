// app/cars/[id]/loading.tsx

export default function Loading() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 relative">
      {/* --- FAKE HeaderSection (без Mantine, только скелет) --- */}
      <header className="absolute inset-x-0 top-0 z-50">
        <div className="flex justify-between items-center px-4 sm:px-6 lg:px-10 mt-3">
          {/* burger */}
          <div className="h-10 w-10 rounded-md bg-neutral-100 animate-pulse" />

          {/* logo + MINI2GO */}
          {/* <div className="w-14 md:w-20 flex flex-col items-center">
            <div className="w-14 md:w-20 h-8 md:h-11 rounded-md bg-neutral-100 animate-pulse" />
            <div className="mt-1 h-3 w-12 md:w-16 rounded-full bg-neutral-100 animate-pulse" />
          </div> */}

          {/* fingerprint button */}
          <div className="h-8 w-8 rounded-full bg-neutral-100 animate-pulse" />
        </div>
      </header>

      {/* --- CONTENT (то, что рисует ClientCarLanding сверху) --- */}
      <main>
        {/* section overview, как у тебя */}
        <section id="overview" className="scroll-mt-24">
          {/* back-кнопка на sticky-полоске */}
          <div className="sticky top-20 z-20 ml-4 md:ml-10 pt-6 font-roboto-condensed">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-xs md:text-sm text-gray-700 shadow border border-neutral-200 animate-pulse">
              <div className="h-4 w-4 rounded-full bg-neutral-200" />
              <div className="h-3 w-10 rounded-full bg-neutral-200" />
            </div>
          </div>

          {/* hero + header, как в ClientCarLanding */}
          <div className="mx-auto max-w-5xl px-4 grid grid-cols-1 mt-18 gap-6">
            {/* hero-картинка */}
            <div className="overflow-hidden">
              <div className="relative">
                <div className="w-full h-44 md:h-80 lg:h-96 rounded-2xl bg-neutral-100 animate-pulse" />
              </div>
            </div>

            {/* title, mini specs, description, кнопка Book */}
            <header className="flex flex-col items-center text-center z-10 gap-3">
              {/* title */}
              <div className="h-8 w-56 rounded-full bg-neutral-100 animate-pulse" />
              {/* bodyType · fuel · transmission */}
              <div className="h-5 w-72 max-w-full rounded-md bg-neutral-100 animate-pulse" />
              {/* description */}
              {/* <div className="h-4 w-64 max-w-full rounded-full bg-neutral-100 mt-2 animate-pulse" /> */}
              {/* кнопка Book */}
              {/* <div className="mt-5 h-11 w-32 rounded-full bg-neutral-900/90 animate-pulse" /> */}
            </header>
          </div>
        </section>

        {/* блок с CountUp (4 карточки) */}
        <section>
          <div className="mx-auto max-w-5xl px-4 pt-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-roboto-condensed animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl ring-1 ring-black/5 bg-white p-4 flex flex-col gap-3"
                >
                  <div className="h-6 w-20 rounded-full bg-neutral-100" />
                  <div className="h-3 w-24 rounded-full bg-neutral-100" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* видео-блок (LazyAutoplayVideo placeholder) */}
        <section className="mx-auto max-w-5xl px-4 py-10">
          <div className="aspect-9/16 md:aspect-video rounded-2xl overflow-hidden bg-neutral-100 animate-pulse" />
        </section>
      </main>
    </div>
  );
}
