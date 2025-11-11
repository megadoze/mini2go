/* eslint-disable @next/next/no-img-element */
import { WELCOME_FEATURES } from "@/constants/carOptions";

export const WelcomeSection = () => {
  return (
    <section id="welcome-mini-drive" className="bg-white">
      <div className=" lg:px-10 pt-24">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-6xl font-oleo-script font-bold text-black">
            Welcome to MINI Drive
          </h2>
          <p className="pt-4 text-lg md:text-2xl text-neutral-600 font-roboto-condensed">
            Small formats — big fun. Choose, book, drive.
          </p>
        </div>

        {/* центрируем контент как у видео */}
        <div className="mt-10 w-full max-w-[1200px] mx-auto space-y-12 md:space-y-16">
          {WELCOME_FEATURES.map((item, i) => {
            const reversed = i % 2 === 0; // зеркалим каждую вторую строку
            return (
              <div
                key={i}
                className={`md:flex md:items-center md:justify-center md:gap-8 ${
                  reversed ? "md:flex-row-reverse" : ""
                }`}
              >
                {/* КАРТИНКА (ширина как у видео-карточек) */}
                <div className="flex justify-center px-4 md:px-0">
                  <div className=" w-full md:max-w-[420px] md:w-[340px] lg:w-[380px]">
                    <div className="relative aspect-square md:aspect-9/16 overflow-hidden rounded-2xl ring-1 ring-black/10 bg-black">
                      <img
                        src={item.img}
                        alt={item.alt}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                {/* ТЕКСТ (ровно та же ширина, отцентрирован) */}
                <div className="mt-4 md:mt-0 flex justify-center">
                  <div className="w-[82vw] max-w-[420px] md:w-[340px] lg:w-[380px]">
                    <h3 className="text-2xl md:text-3xl font-boogaloo tracking-wide font-semibold text-black">
                      {item.title}
                    </h3>
                    <p className="mt-3 font-roboto-condensed text-stone-600 text-lg lg:text-xl">
                      {item.text}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
