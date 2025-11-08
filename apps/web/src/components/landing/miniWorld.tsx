/* eslint-disable @next/next/no-img-element */
import { MINI_WORLD_POSTS } from "@/constants/carOptions";

export function MiniWorld() {
  const items = MINI_WORLD_POSTS;

  return (
    <section id="mini-world" className="bg-white">
      <div className="w-full max-w-[1200px] mx-auto px-[3vw] pt-24 pb-6">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-6xl font-pacifico font-extrabold tracking-wide">
            MINI World
          </h2>
          <p className="pt-4 text-lg font-roboto md:text-xl text-stone-600">
            News, stories and technologies - everything about MINI and around
            it.
          </p>
        </div>

        {/* MOBILE: карусель */}
        <div className="md:hidden mt-10 -mx-[3vw] pl-[3vw] pr-3">
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((p, i) => (
              <a
                key={i}
                href={p.href}
                className="snap-start block shrink-0 w-[82vw] max-w-[420px]"
              >
                <div className="rounded-2xl overflow-hidden bg-white border border-black/20 flex flex-col h-[400px]">
                  <div className="relative overflow-hidden aspect-video shrink-0">
                    <img
                      src={p.img}
                      alt={p.title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500"
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="absolute left-3 top-3 z-10 inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-black">
                      {p.tag}
                    </span>
                  </div>

                  <div className="p-4 flex flex-col h-full">
                    <h3 className="text-lg font-robotoCondensed font-semibold text-black line-clamp-2">
                      {p.title}
                    </h3>
                    <p className="mt-2 font-roboto text-sm text-black/70 line-clamp-3">
                      {p.excerpt}
                    </p>

                    {/* CTA прижат вниз */}
                    <div className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-black/90">
                      Read
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        strokeWidth="1"
                        stroke="currentColor"
                        className="size-6"
                        fill="none"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* DESKTOP/TABLET: сетка 3 колонки */}
        <div className="hidden md:grid mt-10 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {items.map((p, i) => (
            <a
              key={i}
              href={p.href}
              className="group block rounded-2xl overflow-hidden ring-1 ring-black/10 bg-white"
            >
              <div className="relative overflow-hidden aspect-video">
                <img
                  src={p.img}
                  alt={p.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                  decoding="async"
                  sizes="100vw"
                />

                <span className="absolute left-3 top-3 z-10 inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-black">
                  {p.tag}
                </span>
              </div>
              <div className="p-4 md:p-5">
                <h3 className="text-lg md:text-xl font-robotoCondensed font-semibold text-black">
                  {p.title}
                </h3>
                <p className="mt-2 font-roboto text-sm md:text-base text-black/70 line-clamp-3">
                  {p.excerpt}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-black/90 group-hover:text-black">
                  Read
                  <div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1"
                      stroke="currentColor"
                      className="size-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10 flex justify-center">
          <a
            href="#"
            className="inline-flex items-center gap-2 rounded-full border border-black/15 px-4 py-2 text-sm font-medium text-black hover:bg-black hover:text-white transition"
          >
            Read more
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1"
              stroke="currentColor"
              className="size-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3"
              />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
