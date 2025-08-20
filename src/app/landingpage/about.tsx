export const AboutSection = () => {
  return (
    <section id="minimum-requirements" className="bg-white">
      <div className="px-[3vw] sm:px-6 lg:px-10 pt-24">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-6xl font-robotoCondensed font-bold text-black">
            About
          </h2>
          <p className="pt-4 text-lg md:text-xl text-stone-600 font-roboto">
            What you need to rent a MINI.
          </p>
        </div>

        {/* центр и ширины — как у видео/карточек */}
        <div className="mt-10 w-full max-w-[1200px] mx-auto flex flex-wrap justify-center gap-6 md:gap-8">
          <p className="text-neutral-500 text-sm text-justify">
            Fuel consumption and CO₂ emissions are determined according to the
            WLTP test cycle. The energy or fuel consumption values and CO₂
            emissions for the shown models are as follows: 911 Carrera GTS
            (992.2, WLTP): Fuel consumption combined: 11,0 – 10,5 l/100 km; CO₂
            emissions combined: 251 – 239 g/km; CO₂ class: G; Status 01/2025 |
            911 Carrera (992.2, WLTP): Fuel consumption combined: 10,7 – 10,1
            l/100 km; CO₂ emissions combined: 244 – 230 g/km; CO₂ class: G;
            Status 01/2025 | 911 Carrera Cabriolet (992.2, WLTP): Fuel
            consumption combined: 10,6 – 10,3 l/100 km, CO₂ emissions combined:
            242 – 235 g/km, CO₂ class: G; Status 01/2025 | 911 GT3 (992.2,
            WLTP): Fuel consumption combined: 13,8 – 13,7 l/100 km, CO₂
            emissions combined: 312 – 310 g/km, CO₂ class: G; Status 01/2025 |
            718 Cayman (PDK,WLTP): Fuel consumption combined: 9,2 – 8,9 l/100
            km, CO₂ emissions combined: 208 – 201 g/km, CO₂ class: G; Status
            01/2025 | Taycan (J2,WLTP): Electrical consumption (performance
            battery) combined: 19,7 – 16,7 kWh/100 km; CO₂ emissions combined: 0
            g/km; Status 01/2025 | Taycan Turbo (J2, WLTP): Electrical
            consumption: 20,5 – 18,0 kWh/100 km, CO₂ emissions combined: 0 g/km,
            CO₂ class: A; Status 01/2025 | Macan BEV (WLTP): Electrical
            consumption: 19,8 – 17,0 kWh/100 km, CO₂ emissions combined: 0 g/km,
            CO₂-Klasse: A; Status 01/2025 Please note that actual consumption
            and emissions may vary based on driving conditions and other
            factors.
          </p>
        </div>
      </div>
    </section>
  );
};
