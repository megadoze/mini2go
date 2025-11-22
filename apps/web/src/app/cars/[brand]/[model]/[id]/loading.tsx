// app/cars/[id]/loading.tsx

export default function Loading() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Хедер (место для HeaderSection) */}
      <header className="border-b border-neutral-200/80">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between animate-pulse">
          <div className="h-6 w-32 rounded-full bg-neutral-100" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-neutral-100" />
            <div className="h-8 w-20 rounded-full bg-neutral-100" />
          </div>
        </div>
      </header>

      {/* Кнопка Back + основной контент */}
      <main className="mx-auto max-w-5xl px-4 pb-16">
        {/* Back */}
        <div className="sticky top-20 z-10 pt-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/90 border border-neutral-200 px-3 py-1.5 shadow-sm animate-pulse">
            <div className="h-4 w-4 rounded-full bg-neutral-200" />
            <div className="h-3 w-12 rounded-full bg-neutral-200" />
          </div>
        </div>

        {/* Hero + заголовок */}
        <section className="mt-10 grid grid-cols-1 gap-6">
          {/* Hero */}
          <div className="overflow-hidden rounded-2xl">
            <div className="h-44 md:h-80 lg:h-96 w-full bg-neutral-100 animate-pulse" />
          </div>

          {/* Заголовок и кнопка Book */}
          <header className="flex flex-col items-center text-center gap-3">
            <div className="h-8 w-56 rounded-full bg-neutral-100 animate-pulse" />
            <div className="h-6 w-40 rounded-full bg-neutral-100 animate-pulse" />
            <div className="h-4 w-64 rounded-full bg-neutral-100 animate-pulse mt-2" />

            <div className="mt-4 h-11 w-32 rounded-full bg-neutral-900/90 animate-pulse" />
          </header>
        </section>

        {/* Цифры (price/day, mileage и т.п.) */}
        <section className="mt-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-neutral-200 bg-white p-4 flex flex-col gap-3"
              >
                <div className="h-6 w-16 rounded-full bg-neutral-100" />
                <div className="h-3 w-24 rounded-full bg-neutral-100" />
              </div>
            ))}
          </div>
        </section>

        {/* Видео блок */}
        <section className="mt-10">
          <div className="aspect-[9/16] md:aspect-video rounded-2xl overflow-hidden bg-neutral-100 animate-pulse" />
        </section>

        {/* Highlights skeleton */}
        <section className="mt-12">
          <div className="text-center mb-8 animate-pulse">
            <div className="h-8 w-40 mx-auto rounded-full bg-neutral-100" />
            <div className="h-4 w-64 mx-auto mt-2 rounded-full bg-neutral-100" />
          </div>

          <div className="space-y-10 md:space-y-12">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={`md:flex md:items-center md:gap-8 ${
                  i % 2 === 0 ? "md:flex-row-reverse" : ""
                }`}
              >
                <div className="flex justify-center mb-4 md:mb-0">
                  <div className="w-full md:max-w-[420px] md:w-[340px] lg:w-[380px]">
                    <div className="aspect-square rounded-2xl bg-neutral-100 animate-pulse" />
                  </div>
                </div>

                <div className="flex justify-center">
                  <div className="w-[82vw] max-w-[420px] md:w-[340px] lg:w-[380px] space-y-3 animate-pulse">
                    <div className="h-6 w-40 rounded-full bg-neutral-100" />
                    <div className="h-4 w-full rounded-full bg-neutral-100" />
                    <div className="h-4 w-5/6 rounded-full bg-neutral-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Services skeleton */}
        <section className="mt-14">
          <div className="text-center mb-8 animate-pulse">
            <div className="h-8 w-48 mx-auto rounded-full bg-neutral-100" />
            <div className="h-4 w-72 mx-auto mt-2 rounded-full bg-neutral-100" />
          </div>

          <div className="flex flex-wrap justify-center gap-6 md:gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="w-[94vw] max-w-[420px] md:w-[340px] lg:w-[380px]"
              >
                <div className="h-full rounded-2xl ring-1 ring-black/5 bg-white p-5 md:p-6 space-y-3 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-neutral-900/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-40 rounded-full bg-neutral-100" />
                      <div className="h-3 w-full rounded-full bg-neutral-100" />
                      <div className="h-3 w-5/6 rounded-full bg-neutral-100" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BookingBar skeleton */}
        <section className="mt-16">
          <div className="fixed inset-x-0 bottom-0 z-30 bg-white/95 border-t border-neutral-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
            <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between gap-4 animate-pulse">
              <div className="space-y-2 w-full">
                <div className="h-4 w-28 rounded-full bg-neutral-100" />
                <div className="h-5 w-40 rounded-full bg-neutral-100" />
              </div>
              <div className="h-11 w-32 rounded-full bg-neutral-900/90" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
