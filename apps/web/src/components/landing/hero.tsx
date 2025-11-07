"use client";

import { useState, useEffect } from "react";
import { startOfDay } from "date-fns";
import { useRouter } from "next/navigation";
import { NativeSelect, Select } from "@mantine/core";
import { motion, AnimatePresence } from "framer-motion";
import RentalDateTimePicker from "@/components/RentalDateTimePicker";
import {
  fetchCountries,
  fetchLocationsByCountry,
} from "@/services/geo.service";

export const HeroSection = () => {
  const mainBanner = "/img/main2.webp";
  const router = useRouter();

  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [pickerVisible, setPickerVisible] = useState(false);

  // location state
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState("");
  const [countries, setCountries] = useState<any[]>([]);
  const [locationsByCountry, setLocationsByCountry] = useState<
    Record<string, any[]>
  >({});
  // groupedData: [{ group: 'Country name', items: [{ value: 'countryId::locationName', label: 'Location' }] }]
  const [groupedData, setGroupedData] = useState<
    Array<{ group: string; items: Array<{ value: string; label: string }> }>
  >([]);

  const [stepsVisible, setStepsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768); // md breakpoint
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Получение стран
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchCountries();
        setCountries(data || []);
      } catch {
        setCountries([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (pickerVisible) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev || "";
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerVisible]);

  // После загрузки стран — загрузить локации для каждой страны и собрать groupedData
  useEffect(() => {
    if (!countries || countries.length === 0) {
      setGroupedData([]);
      setLocationsByCountry({});
      return;
    }

    (async () => {
      try {
        // fetch all locations in parallel
        const promises = countries.map(async (c: any) => {
          try {
            const locs = await fetchLocationsByCountry(c.id);
            return { country: c, locations: locs || [] };
          } catch {
            return { country: c, locations: [] };
          }
        });

        const results = await Promise.all(promises);
        const byCountry: Record<string, any[]> = {};
        const groups: Array<{
          group: string;
          items: Array<{ value: string; label: string }>;
        }> = [];

        results.forEach((r) => {
          const countryId = r.country.id;
          const countryName = r.country.name || r.country.title || "Country";
          const items = (r.locations || []).map((l: any) => {
            const locationName = l.name || l.title || String(l);
            // value encodes countryId and locationName so we can reconstruct both later
            const value = `${countryId}::${locationName}`;
            return { value, label: locationName };
          });
          byCountry[countryId] = r.locations || [];
          groups.push({ group: countryName, items });
        });

        setLocationsByCountry(byCountry);
        setGroupedData(groups);
      } catch {
        setLocationsByCountry({});
        setGroupedData([]);
      }
    })();
  }, [countries]);

  const closeDatePicker = () => setPickerVisible(false);

  const handleCalendarChange = (next: {
    startAt: Date | null;
    endAt: Date | null;
  }) => {
    setStart(next.startAt ? next.startAt.toISOString() : "");
    setEnd(next.endAt ? next.endAt.toISOString() : "");
    closeDatePicker();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = new URLSearchParams();
    if (start) query.set("start", start);
    if (end) query.set("end", end);
    if (locationFilter) query.set("location", locationFilter);
    if (selectedCountry) query.set("country", selectedCountry);
    router.push(`/cars?${query.toString()}`);
  };

  // build encoded value for Select from current state (or undefined)
  const buildSelectValue = (countryId: string | null, locationName: string) =>
    countryId && locationName ? `${countryId}::${locationName}` : undefined;

  const parseSelectValue = (value: string | null) => {
    if (!value) return { countryId: null, locationName: "" };
    const [countryId, ...rest] = value.split("::");
    const locationName = rest.join("::");
    return { countryId: countryId || null, locationName };
  };

  return (
    <section className="relative flex items-center pt-16 md:pt-0 min-h-svh md:min-h-dvh lg:min-h-screen">
      {/* Background */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-center bg-cover"
        style={{ backgroundImage: `url(${mainBanner})` }}
      />
      <div className="absolute inset-0 z-0 bg-linear-to-b from-black/20 via-black/10 to-black/10" />

      {/* Content */}
      <div className="flex justify-center relative z-10 w-full px-4 sm:px-6 lg:px-10 pb-52 md:pb-20">
        <div className="flex flex-col items-center text-center max-w-4xl">
          <motion.h1
            className="font-robotoCondensed font-bold tracking-[0.01em] leading-tight text-white text-4xl sm:text-5xl lg:text-7xl text-shadow"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.5 } }}
          >
            It’s time to drive
            <span className="inline-block ">
              <span className="px-2 bg-white/20 ml-1">MINI</span>
            </span>
          </motion.h1>

          <motion.p
            className="mt-4 text-white font-robotoCondensed text-lg sm:text-xl lg:text-2xl max-w-3xl "
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.2 } }}
          >
            <span className="bg-linear-to-r from-black/80 to-transparent px-2 py-1 ">
              Life’s too short for boring cars.
            </span>
            <strong className="text-shadow">
              Rent MINI Cooper — enjoy the ride.
            </strong>
          </motion.p>
          {/* CTA buttons */}
          <motion.div
            className="hidden mt-6 md:flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.4 } }}
          >
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
          </motion.div>
        </div>
      </div>

      {/* Booking form */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-20 bottom-[max(16px,env(safe-area-inset-bottom))] sm:bottom-10"
        variants={{
          hidden: { opacity: 0, y: 30 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { delay: 0.3, duration: 0.5 },
          },
        }}
        initial="hidden"
        animate="visible"
        onAnimationComplete={() => setStepsVisible(true)}
      >
        {stepsVisible && (
          <motion.div
            className="hidden mb-5 md:flex flex-wrap justify-center items-center gap-4 font-robotoCondensed text-shadow text-white mt-4"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
            }}
            initial="hidden"
            animate="visible"
          >
            {[
              "Select location",
              "Select period",
              "Choose your MINI",
              "Pick up and go",
            ].map((text, idx) => (
              <motion.p
                key={idx}
                className="flex bg-linear-to-r from-neutral-800/90 to-neutral-600/40 pl-1 pr-2 py-1 rounded-full"
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <span className="text-center bg-neutral-200/30 rounded-full w-6 h-6 mr-1">
                  {idx + 1}
                </span>
                <span dangerouslySetInnerHTML={{ __html: text }} />
              </motion.p>
            ))}
          </motion.div>
        )}

        <form
          className="flex flex-col sm:flex-row bg-white rounded-xl shadow-xl md:items-center gap-2 p-4"
          onSubmit={handleSubmit}
        >
          <p className="text-black font-robotoCondensed text-lg font-bold shrink-0">
            Book your MINI
          </p>

          {/* Mantine Select (grouped by country -> locations) */}
          {/* <div className="md:flex-1">
            <Select
              data={groupedData as any}
              searchable
              nothingFoundMessage="No locations"
              clearable
              value={buildSelectValue(selectedCountry, locationFilter)}
              onChange={(val) => {
                const parsed = parseSelectValue(val ?? null);
                setSelectedCountry(parsed.countryId);
                setLocationFilter(parsed.locationName);
              }}
              comboboxProps={{
                transitionProps: { transition: "pop", duration: 200 },
                dropdownPadding: 2,
                offset: 10,
              }}
              withScrollArea={false}
              variant="unstyled"
              className="h-12 border border-gray-600 rounded-md content-center"
              placeholder="Location"
              // ---- FIX: перехват клика по крестику, чтобы очистка сработала сразу без открытия дропдауна ----
              clearButtonProps={{
                onMouseDown: (e: React.MouseEvent) => {
                  // предотвращаем фокус/открытие дропдауна и всплытие события
                  e.preventDefault();
                  e.stopPropagation();
                  // сразу очищаем состояние (Select тоже вызовет onChange -> дубль нестрашен)
                  setSelectedCountry(null);
                  setLocationFilter("");
                },
              }}
              styles={{
                input: { paddingLeft: "10px" },
                dropdown: { maxHeight: 200, overflowY: "auto" },
              }}
            />
          </div> */}
          <div className="md:flex-1">
            {isMobile ? (
              // На мобилке используем нативный селект — лучше UX и системный picker
              <select
                aria-label="Location"
                value={buildSelectValue(selectedCountry, locationFilter) ?? ""}
                onChange={(e) => {
                  const val = e.target.value || null;
                  const parsed = parseSelectValue(val);
                  setSelectedCountry(parsed.countryId);
                  setLocationFilter(parsed.locationName);
                }}
                className="w-full h-12 rounded-md border border-gray-600 px-3 text-sm"
                // На мобильных браузерах placeholder option будет служить как "clear"
              >
                {/* Placeholder / empty option — служит как 'очистить' */}
                <option
                  className=" font-light text-gray-200"
                  value=""
                  disabled
                  hidden
                >
                  Location
                </option>

                {/* Группы с optgroup */}
                {groupedData.map((g) => (
                  <optgroup label={g.group} key={g.group}>
                    {g.items.map((it) => (
                      <option value={it.value} key={it.value}>
                        {/* Показываем "Location — Country" или только locationName, на твой выбор */}
                        {it.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : (
              // Десктоп: Mantine Select — с контролем ширины дропдауна и flip middleware
              <Select
                data={groupedData as any}
                searchable
                nothingFoundMessage="No locations"
                clearable
                value={buildSelectValue(selectedCountry, locationFilter)}
                onChange={(val) => {
                  const parsed = parseSelectValue(val ?? null);
                  setSelectedCountry(parsed.countryId);
                  setLocationFilter(parsed.locationName);
                }}
                comboboxProps={{
                  transitionProps: { transition: "pop", duration: 200 },
                  dropdownPadding: 2,
                  offset: 10,
                }}
                withScrollArea={false}
                variant="unstyled"
                className="h-12 border border-gray-600 rounded-md content-center"
                placeholder="Location"
                // ---- FIX: перехват клика по крестику, чтобы очистка сработала сразу без открытия дропдауна ----
                clearButtonProps={{
                  onMouseDown: (e: React.MouseEvent) => {
                    // предотвращаем фокус/открытие дропдауна и всплытие события
                    e.preventDefault();
                    e.stopPropagation();
                    // сразу очищаем состояние (Select тоже вызовет onChange -> дубль нестрашен)
                    setSelectedCountry(null);
                    setLocationFilter("");
                  },
                }}
                styles={{
                  input: { paddingLeft: "10px" },
                  dropdown: { maxHeight: 200, overflowY: "auto" },
                }}
              />
            )}
          </div>

          {/* Dates input (same behavior) */}
          <input
            type="text"
            value={
              start && end
                ? `${new Date(start).toLocaleDateString()} → ${new Date(
                    end
                  ).toLocaleDateString()}`
                : ""
            }
            placeholder="Dates"
            aria-label="Dates"
            readOnly
            onClick={() => locationFilter && setPickerVisible(true)}
            className={`h-12 flex-1 rounded-md border border-gray-600 py-3 px-4 text-sm text-black focus:outline-none  ${
              !locationFilter
                ? "bg-neutral-50 cursor-not-allowed"
                : "cursor-pointer"
            }`}
          />

          <button
            type="submit"
            disabled={!locationFilter || !start || !end || !selectedCountry}
            className={`h-12 rounded-md px-6 tracking-[0.04em] uppercase font-robotoCondensed font-medium ${
              !locationFilter || !start || !end || !selectedCountry
                ? "bg-neutral-50 text-neutral-700 cursor-not-allowed border"
                : "bg-black text-white hover:bg-black/85 cursor-pointer"
            }`}
          >
            Book
          </button>
        </form>
      </motion.div>

      {/* Date picker modal / panel (unchanged) */}
      {pickerVisible &&
        (isMobile ? (
          // мобильный — простой div, без анимации
          <div
            className="fixed inset-0 flex items-center justify-center z-999  bg-white"
            onClick={closeDatePicker}
          >
            <div
              className="bg-white rounded-2xl w-full max-w-md p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <RentalDateTimePicker
                value={{
                  startAt: start ? new Date(start) : null,
                  endAt: end ? new Date(end) : null,
                }}
                onChange={handleCalendarChange}
                minuteStep={30}
                minDate={startOfDay(new Date())}
                mobileStartOpen
              />
            </div>
          </div>
        ) : (
          // десктоп — с motion и AnimatePresence
          <AnimatePresence>
            <motion.div
              className="fixed inset-0 flex items-center justify-center z-50 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDatePicker}
            >
              <motion.div
                className="bg-white rounded-2xl w-full max-w-md p-4"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <RentalDateTimePicker
                  value={{
                    startAt: start ? new Date(start) : null,
                    endAt: end ? new Date(end) : null,
                  }}
                  onChange={handleCalendarChange}
                  minuteStep={30}
                  minDate={startOfDay(new Date())}
                  mobileStartOpen
                />
              </motion.div>
            </motion.div>
          </AnimatePresence>
        ))}
    </section>
  );
};

// "use client";

// import { useState, useEffect } from "react";
// import { startOfDay } from "date-fns";
// import { useRouter } from "next/navigation";
// import { Modal } from "@mantine/core";
// import { motion, AnimatePresence } from "framer-motion";
// import RentalDateTimePicker from "@/components/RentalDateTimePicker";
// import CarFilters from "@/components/carFilters";
// import {
//   fetchCountries,
//   fetchLocationsByCountry,
// } from "@/services/geo.service";

// export const HeroSection = () => {
//   const mainBanner = "/img/main2.webp";
//   const router = useRouter();

//   const [start, setStart] = useState<string>("");
//   const [end, setEnd] = useState<string>("");
//   const [pickerVisible, setPickerVisible] = useState(false);

//   const [locationModalOpen, setLocationModalOpen] = useState(false);
//   const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
//   const [locationFilter, setLocationFilter] = useState("");
//   const [countries, setCountries] = useState<any[]>([]);
//   const [locations, setLocations] = useState<any[]>([]);

//   const [stepsVisible, setStepsVisible] = useState(false);
//   const [isMobile, setIsMobile] = useState(false);

//   useEffect(() => {
//     const checkMobile = () => setIsMobile(window.innerWidth < 768); // md breakpoint
//     checkMobile();
//     window.addEventListener("resize", checkMobile);
//     return () => window.removeEventListener("resize", checkMobile);
//   }, []);

//   // Получение стран
//   useEffect(() => {
//     (async () => {
//       try {
//         const data = await fetchCountries();
//         setCountries(data);
//       } catch {
//         setCountries([]);
//       }
//     })();
//   }, []);

//   // Получение локаций по стране
//   useEffect(() => {
//     if (!selectedCountry) {
//       setLocations([]);
//       return;
//     }
//     (async () => {
//       try {
//         const data = await fetchLocationsByCountry(selectedCountry);
//         setLocations(data);
//       } catch {
//         setLocations([]);
//       }
//     })();
//   }, [selectedCountry]);

//   const closeDatePicker = () => setPickerVisible(false);

//   const handleCalendarChange = (next: {
//     startAt: Date | null;
//     endAt: Date | null;
//   }) => {
//     setStart(next.startAt ? next.startAt.toISOString() : "");
//     setEnd(next.endAt ? next.endAt.toISOString() : "");
//     closeDatePicker();
//   };

//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault();
//     const query = new URLSearchParams();
//     if (start) query.set("start", start);
//     if (end) query.set("end", end);
//     if (locationFilter) query.set("location", locationFilter);
//     if (selectedCountry) query.set("country", selectedCountry);
//     router.push(`/cars?${query.toString()}`);
//   };

//   // Шаги бронирования
//   const steps = [
//     "Select location",
//     "Select period",
//     "Choose your MINI",
//     "Pick up and go",
//   ];

//   const containerVariants = {
//     hidden: { opacity: 0 },
//     visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
//   };

//   const itemVariants = {
//     hidden: { opacity: 0, y: 10 },
//     visible: { opacity: 1, y: 0 },
//   };

//   const formVariants = {
//     hidden: { opacity: 0, y: 30 },
//     visible: { opacity: 1, y: 0, transition: { delay: 0.3, duration: 0.5 } },
//   };

//   return (
//     <section className="relative flex items-center pt-16 md:pt-0 min-h-svh md:min-h-dvh lg:min-h-screen">
//       {/* Background */}
//       <div
//         aria-hidden
//         className="absolute inset-0 z-0 bg-center bg-cover"
//         style={{ backgroundImage: `url(${mainBanner})` }}
//       />
//       <div className="absolute inset-0 z-0 bg-linear-to-b from-black/20 via-black/10 to-black/10" />

//       {/* Content */}
//       <div className="flex justify-center relative z-10 w-full px-4 sm:px-6 lg:px-10 pb-52 md:pb-20">
//         <div className="flex flex-col items-center text-center max-w-4xl">
//           <motion.h1
//             className="font-robotoCondensed font-bold tracking-[0.01em] leading-tight text-white text-4xl sm:text-5xl lg:text-7xl text-shadow"
//             initial={{ opacity: 0, y: -20 }}
//             animate={{ opacity: 1, y: 0, transition: { duration: 0.5 } }}
//           >
//             It’s time to drive
//             <span className="inline-block ">
//               <span className="px-2 bg-white/20 ml-1">MINI</span>
//             </span>
//           </motion.h1>

//           <motion.p
//             className="mt-4 text-white font-robotoCondensed text-lg sm:text-xl lg:text-2xl max-w-3xl "
//             initial={{ opacity: 0 }}
//             animate={{ opacity: 1, transition: { delay: 0.2 } }}
//           >
//             <span className="bg-linear-to-r from-black/80 to-transparent px-2 py-1 ">
//               Life’s too short for boring cars.
//             </span>
//             <strong className="text-shadow">
//               Rent MINI Cooper — enjoy the ride.
//             </strong>
//           </motion.p>
//           {/* CTA buttons */}
//           <motion.div
//             className="hidden mt-6 md:flex flex-wrap items-center gap-3"
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0, transition: { delay: 0.4 } }}
//           >
//             <a
//               href="#reservierung"
//               className="inline-flex items-center justify-center rounded-full bg-white text-black px-5 py-2.5 font-robotoCondensed font-semibold hover:bg-white/90 focus:outline-none focus:ring-4 focus:ring-white/30 transition"
//             >
//               Book MINI now
//             </a>
//             <a
//               href="#mehr"
//               className="inline-flex items-center justify-center rounded-full ring-1 ring-white/40 px-5 py-2.5 font-robotoCondensed font-semibold hover:ring-white/70 bg-black/20 text-white focus:outline-none focus:ring-4 focus:ring-white/30 transition"
//             >
//               More
//             </a>
//           </motion.div>
//         </div>
//       </div>

//       {/* Booking form */}
//       <motion.div
//         className="absolute left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-20 bottom-[max(16px,env(safe-area-inset-bottom))] sm:bottom-10"
//         variants={formVariants}
//         initial="hidden"
//         animate="visible"
//         onAnimationComplete={() => setStepsVisible(true)}
//       >
//         {stepsVisible && (
//           <motion.div
//             className="hidden mb-5 md:flex flex-wrap justify-center items-center gap-4 font-robotoCondensed text-shadow text-white mt-4"
//             variants={containerVariants}
//             initial="hidden"
//             animate="visible"
//           >
//             {steps.map((text, idx) => (
//               <motion.p
//                 key={idx}
//                 className="flex bg-linear-to-r from-neutral-800/90 to-neutral-600/40 px-1 py-1 rounded-full"
//                 variants={itemVariants}
//               >
//                 <span className="text-center bg-neutral-200/30 rounded-full w-6 h-6 mr-1">
//                   {idx + 1}
//                 </span>
//                 <span dangerouslySetInnerHTML={{ __html: text }} />
//               </motion.p>
//             ))}
//           </motion.div>
//         )}

//         <form
//           className="flex bg-white rounded-xl shadow-xl flex-col sm:flex-row items-stretch md:items-center gap-2 p-4"
//           onSubmit={handleSubmit}
//         >
//           <p className="text-black font-robotoCondensed text-lg font-bold shrink-0">
//             Book your MINI
//           </p>

//           <input
//             type="text"
//             value={locationFilter}
//             placeholder="Location"
//             aria-label="Location"
//             onClick={() => setLocationModalOpen(true)}
//             readOnly
//             className="h-12 flex-1 rounded-md border border-neutral-500 px-4 py-3 text-sm text-black cursor-pointer focus:outline-none focus:ring-4 focus:ring-neutral-400/20"
//           />

//           <input
//             type="text"
//             value={
//               start && end
//                 ? `${new Date(start).toLocaleDateString()} → ${new Date(
//                     end
//                   ).toLocaleDateString()}`
//                 : ""
//             }
//             placeholder="Dates"
//             aria-label="Dates"
//             readOnly
//             onClick={() => locationFilter && setPickerVisible(true)}
//             className={`h-12 flex-1 rounded-md border px-4 py-3 text-sm text-black focus:outline-none focus:ring-4 focus:ring-neutral-100/20 ${
//               !locationFilter
//                 ? "bg-neutral-50 cursor-not-allowed"
//                 : "cursor-pointer"
//             }`}
//           />

//           <button
//             type="submit"
//             disabled={!locationFilter || !start || !end}
//             className={`h-12 rounded-md px-6 tracking-[0.04em] uppercase font-robotoCondensed font-medium ${
//               !locationFilter || !start || !end
//                 ? "bg-neutral-50 text-neutral-700 cursor-not-allowed border"
//                 : "bg-black text-white hover:bg-black/85 cursor-pointer"
//             }`}
//           >
//             Book
//           </button>
//         </form>
//       </motion.div>

//       {/* Date picker modal */}
//       {pickerVisible &&
//         (isMobile ? (
//           // мобильный — простой div, без анимации
//           <div
//             className="fixed inset-0 flex items-center justify-center z-50  bg-white"
//             onClick={closeDatePicker}
//           >
//             <div
//               className="bg-white rounded-2xl w-full max-w-md p-4"
//               onClick={(e) => e.stopPropagation()}
//             >
//               <RentalDateTimePicker
//                 value={{
//                   startAt: start ? new Date(start) : null,
//                   endAt: end ? new Date(end) : null,
//                 }}
//                 onChange={handleCalendarChange}
//                 minuteStep={30}
//                 minDate={startOfDay(new Date())}
//                 mobileStartOpen
//               />
//             </div>
//           </div>
//         ) : (
//           // десктоп — с motion и AnimatePresence
//           <AnimatePresence>
//             <motion.div
//               className="fixed inset-0 flex items-center justify-center z-50 bg-black/40"
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               exit={{ opacity: 0 }}
//               onClick={closeDatePicker}
//             >
//               <motion.div
//                 className="bg-white rounded-2xl w-full max-w-md p-4"
//                 initial={{ y: 50, opacity: 0 }}
//                 animate={{ y: 0, opacity: 1 }}
//                 exit={{ y: 50, opacity: 0 }}
//                 onClick={(e) => e.stopPropagation()}
//               >
//                 <RentalDateTimePicker
//                   value={{
//                     startAt: start ? new Date(start) : null,
//                     endAt: end ? new Date(end) : null,
//                   }}
//                   onChange={handleCalendarChange}
//                   minuteStep={30}
//                   minDate={startOfDay(new Date())}
//                   mobileStartOpen
//                 />
//               </motion.div>
//             </motion.div>
//           </AnimatePresence>
//         ))}

//       {/* Location modal */}
//       <Modal
//         opened={locationModalOpen}
//         onClose={() => setLocationModalOpen(false)}
//         title="Select your location"
//         size="auto"
//         centered
//         withCloseButton
//         overlayProps={{ opacity: 0.4, blur: 2 }}
//       >
//         <div className="flex flex-col md:flex-row items-center gap-4 w-full">
//           <CarFilters
//             countries={countries}
//             locations={locations}
//             countryId={selectedCountry}
//             locationFilter={locationFilter}
//             onChangeCountry={setSelectedCountry}
//             onChangeLocation={setLocationFilter}
//             hideStatus
//           />
//           <button
//             onClick={() => setLocationModalOpen(false)}
//             className="px-4 py-2 bg-black text-white rounded-xl hover:bg-black/85"
//             disabled={!locationFilter}
//           >
//             OK
//           </button>
//         </div>
//       </Modal>
//     </section>
//   );
// };
