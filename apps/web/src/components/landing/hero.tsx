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
import Link from "next/link";

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

  const [groupedData, setGroupedData] = useState<
    Array<{ group: string; items: Array<{ value: string; label: string }> }>
  >([]);

  const [stepsVisible, setStepsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024); // md breakpoint
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

        setGroupedData(groups);
      } catch {
        setGroupedData([]);
      }
    })();
  }, [countries]);

  const closeDatePicker = () => setPickerVisible(false);

  // helper: если date === null -> null; иначе возвращаем новый Date с часами hour (по умолчанию 10)
  const applyDefaultHour = (date: Date | null, hour = 10): Date | null => {
    if (!date) return null;
    const d = new Date(date.getTime());
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  // helper: проверка — действительно ли в дате время "00:00:00"
  const isMidnight = (date: Date | null) => {
    if (!date) return false;
    return (
      date.getHours() === 0 &&
      date.getMinutes() === 0 &&
      date.getSeconds() === 0
    );
  };

  // Формируем value для RentalDateTimePicker так, чтобы при открытии времени по умолчанию стояло 10:00 (если не задано)
  const getPickerValue = () => {
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;

    // если нет start/end — по умолчанию показываем сегодня 10:00
    const defaultStart = applyDefaultHour(startDate ?? startOfDay(new Date()));
    const defaultEnd = applyDefaultHour(endDate ?? startOfDay(new Date()));

    // Если пользователь уже имеет дату, но она в 00:00 — заменяем на 10:00
    const startAt =
      startDate && !isMidnight(startDate) ? startDate : defaultStart;
    const endAt = endDate && !isMidnight(endDate) ? endDate : defaultEnd;

    return { startAt, endAt };
  };

  const handleCalendarChange = (next: {
    startAt: Date | null;
    endAt: Date | null;
  }) => {
    // если пользователь выбрал дату без времени (00:00) — ставим 10:00
    const normalizedStart =
      next.startAt === null
        ? null
        : isMidnight(next.startAt)
        ? applyDefaultHour(next.startAt)
        : next.startAt;

    const normalizedEnd =
      next.endAt === null
        ? null
        : isMidnight(next.endAt)
        ? applyDefaultHour(next.endAt)
        : next.endAt;

    setStart(normalizedStart ? normalizedStart.toISOString() : "");
    setEnd(normalizedEnd ? normalizedEnd.toISOString() : "");
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
        className="absolute inset-0 z-0 bg-center bg-cover saturate-80 blur-[1px]"
        style={{ backgroundImage: `url(${mainBanner})` }}
      />
      <div className="absolute inset-0 z-0 bg-linear-to-b from-black/20 from-10% via-black/40 to-100% to-black/10" />

      {/* Content */}
      <div className="flex justify-center relative z-10 w-full px-4 sm:px-6 lg:px-10 pb-52 md:pb-40">
        <div className=" flex flex-col items-center text-center max-w-4xl pb-4">
          <motion.h1
            className=" font-roboto-condensed font-bold tracking-[0.01em] leading-tight text-5xl sm:text-5xl lg:text-7xl text-shadow  px-2 py-3 rounded w-dvw md:w-fit"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.5 } }}
          >
            <span className=" bg-linear-to-r from-violet-400 to-emerald-500/80  bg-clip-text text-transparent">
              It’s time to drive MINI
            </span>
          </motion.h1>

          <motion.p
            className=" text-white font-bold font-roboto-condensed text-xl lg:text-2xl max-w-3xl px-3 md:w-fit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.2 } }}
          >
            <span className=" px-2 leading-8 tracking-wide ">
              Life’s too short for boring cars. Rent MINI — reach the stars.
            </span>
          </motion.p>
          {/* CTA buttons */}
          <motion.div
            className="hidden mt-6 md:flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.4 } }}
          >
            <Link
              href="/cars"
              className="inline-flex items-center justify-center rounded-full bg-white text-black px-5 py-2.5 font-roboto-condensed font-semibold hover:bg-white/90 focus:outline-none focus:ring-4 focus:ring-white/30 transition"
            >
              Book MINI now
            </Link>
            <a
              href="#mehr"
              className="inline-flex items-center justify-center rounded-full ring-1 ring-white/40 px-5 py-2.5 font-roboto-condensed font-semibold hover:ring-white/70 bg-black/20 text-white focus:outline-none focus:ring-4 focus:ring-white/30 transition"
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
            className="hidden mb-5 md:flex flex-wrap justify-center items-center gap-4 font-roboto-condensed text-shadow text-white mt-4"
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
          className="flex flex-col sm:flex-row bg-black/60 rounded-xl shadow-xl md:items-center gap-2 p-4"
          onSubmit={handleSubmit}
        >
          <p className="text-white font-roboto-condensed text-lg font-bold shrink-0">
            Book your MINI
          </p>

          {/* Mantine Select (grouped by country -> locations) */}
          <div className="md:flex-1">
            {isMobile ? (
              // На мобилке используем нативный селект — лучше UX и системный picker
              <NativeSelect
                aria-label="Location"
                // placeholder-опция + группы как в твоём select
                data={[
                  {
                    value: "",
                    label: "Select location",
                    disabled: true,
                    hidden: true,
                  } as any,
                  ...(groupedData as any), // [{ group, items: [{ value, label }] }]
                ]}
                value={buildSelectValue(selectedCountry, locationFilter) ?? ""}
                onChange={(e) => {
                  const val = e.currentTarget.value || null;
                  const parsed = parseSelectValue(val);
                  setSelectedCountry(parsed.countryId);
                  setLocationFilter(parsed.locationName);
                  if (parsed.locationName) setPickerVisible(true); // открыть календарь только при реальном выборе
                }}
                // Стилизуем под твой input
                variant="unstyled"
                className={`h-12 w-full rounded-md border border-gray-600 bg-white/90 outline-0 px-1 ${
                  locationFilter ? "text-black" : "text-neutral-500"
                }`}
                styles={{
                  input: {
                    height: "3rem", // 48px
                    lineHeight: "3rem",
                    paddingLeft: "10px",
                    fontSize: "16px",
                    fontFamily: "Montserrat",
                  },
                }}
                // Крестик очистки справа (виден только когда есть значение)
                rightSection={
                  locationFilter ? (
                    <button
                      type="button"
                      aria-label="Clear location"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedCountry(null);
                        setLocationFilter("");
                      }}
                      className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
                    >
                      ✕
                    </button>
                  ) : null
                }
                rightSectionPointerEvents="all"
              />
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
                  // Открыть календарь только если реально выбрали локацию (не очистили)
                  if (parsed.locationName) setPickerVisible(true);
                }}
                comboboxProps={{
                  transitionProps: { transition: "pop", duration: 200 },
                  dropdownPadding: 2,
                  offset: 10,
                }}
                withScrollArea={false}
                variant="unstyled"
                className="h-12 border border-gray-600 bg-white rounded-md content-center"
                placeholder="Select location"
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
                  input: {
                    paddingLeft: "10px",
                    fontSize: "16px",
                    fontFamily: "Montserrat",
                  },
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
            className={`h-12 flex-1 font-montserrat rounded-md border bg-white border-gray-600 py-3 px-3 text-sm text-black focus:outline-none placeholder-neutral-600 ${
              !locationFilter
                ? "bg-neutral-50 cursor-not-allowed"
                : "cursor-pointer"
            }`}
          />

          <button
            type="submit"
            disabled={!locationFilter || !start || !end || !selectedCountry}
            className={`h-12 rounded-md px-6 tracking-[0.04em] font-medium font-poppins! ${
              !locationFilter || !start || !end || !selectedCountry
                ? "bg-black/60 text-white cursor-not-allowed"
                : "bg-black/80 text-white hover:bg-black/85 cursor-pointer"
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
                value={getPickerValue()}
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
                  value={getPickerValue()}
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
