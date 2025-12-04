"use client";

import { useState, useEffect } from "react";
import { startOfDay } from "date-fns";
import { useRouter } from "next/navigation";
import { NativeSelect, Select } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { motion, AnimatePresence } from "framer-motion";
import RentalDateTimePicker from "@/components/RentalDateTimePicker";
import {
  fetchCountries,
  fetchLocationsByCountry,
} from "@/services/geo.service";
import Link from "next/link";
import Image from "next/image";
// import mainBanner from "/public/img/main_001.webp";
import mainBanner from "/public/img/main_001.webp";

export const HeroSection = () => {
  // Показываем NativeSelect на любом тач-устройстве (в т.ч. планшеты в landscape)
  const isTouch = useMediaQuery("(hover: none), (pointer: coarse)");

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

  // Блокируем прокрутку body, когда открыт пикер
  useEffect(() => {
    if (pickerVisible) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev || "";
      };
    }
  }, [pickerVisible]);

  // После загрузки стран — загрузить локации для каждой страны и собрать groupedData
  useEffect(() => {
    let cancelled = false;

    if (!countries || countries.length === 0) {
      // сбросим на следующий тик, чтобы не ругался линтер
      setTimeout(() => {
        if (!cancelled) setGroupedData([]);
      }, 0);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const results = await Promise.all(
          countries.map(async (c: any) => {
            try {
              const locs = await fetchLocationsByCountry(c.id);
              return { country: c, locations: locs || [] };
            } catch {
              return { country: c, locations: [] };
            }
          })
        );
        if (cancelled) return;

        const groups = results.map((r) => {
          const countryName = r.country.name || r.country.title || "Country";
          const items = (r.locations || []).map((l: any) => {
            const locationName = l.name || l.title || String(l);
            return {
              value: `${r.country.id}::${locationName}`,
              label: locationName,
            };
          });
          return { group: countryName, items };
        });

        setGroupedData(groups);
      } catch {
        if (!cancelled) setGroupedData([]);
      }
    })();

    return () => {
      cancelled = true;
    };
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

    const defaultStart = applyDefaultHour(startDate ?? startOfDay(new Date()));
    const defaultEnd = applyDefaultHour(endDate ?? startOfDay(new Date()));

    const startAt =
      startDate && !isMidnight(startDate) ? startDate : defaultStart;
    const endAt = endDate && !isMidnight(endDate) ? endDate : defaultEnd;

    return { startAt, endAt };
  };

  const handleCalendarChange = (next: {
    startAt: Date | null;
    endAt: Date | null;
  }) => {
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

  // helpers для value
  const buildSelectValue = (countryId: string | null, locationName: string) =>
    countryId && locationName ? `${countryId}::${locationName}` : undefined;

  const parseSelectValue = (value: string | null) => {
    if (!value) return { countryId: null, locationName: "" };
    const [countryId, ...rest] = value.split("::");
    const locationName = rest.join("::");
    return { countryId: countryId || null, locationName };
  };

  return (
    <section className="relative flex flex-col min-h-svh overflow-hidden">
      {/* Background (обрезаем эффекты по краям) */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src={mainBanner}
          alt="Black MINI driving through the city"
          fill
          priority
          quality={90}
          placeholder="blur" // LQIP — Next сгенерировал blurDataURL
          // aria-hidden={true}
          className="object-cover object-center saturate-90 blur-[0.9px] select-none"
          sizes="100vw"
        />
        {/* <div className="absolute inset-0 bg-linear-to-b from-black/20 via-black/30 to-black/20" /> */}
        <div className="absolute inset-0 bg-linear-to-b from-black/15 via-black/20 to-black/10" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-10 py-6 md:py-10 mt-20 md:mt-32 flex justify-center">
        <div className="flex flex-col items-center text-center max-w-4xl relative z-10">
          <motion.h1
            className="font-roboto-condensed font-extrabold  tracking-[0.01em] text-[clamp(3rem,6vw,4.5rem)] leading-[1.1] px-2 pt-3 w-auto max-w-full "
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.55 } }}
          >
            <span
              className="bg-linear-to-r from-violet-400 to-emerald-400 bg-clip-text text-transparent"
              style={{ WebkitBackgroundClip: "text" }}
            >
              It’s time to drive <span className="uppercase">MINI</span>
            </span>
          </motion.h1>

          <motion.p
            className="mt-4 text-white text-shadow-md font-boogaloo text-[clamp(1.4rem,2.4vw,1.75rem)] leading-8 md:leading-[1.45] max-w-3xl px-3"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { delay: 0.22, duration: 0.45 },
            }}
          >
            <span className="block px-0 tracking-wide ">
              Life’s too short for boring cars.{" "}
              <span className="font-semibold">
                Rent MINI — reach the stars.
              </span>
            </span>
          </motion.p>

          <motion.div
            className="mt-8 flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { delay: 0.38, duration: 0.45 },
            }}
          >
            <Link
              href="/cars"
              className="bg-[#ffcf00] hover:bg-[#ffd633] text-black
 inline-flex items-center justify-center rounded-full  px-5 py-2.5 font-roboto-condensed font-semibold focus:outline-none focus:ring-4 focus:ring-white/30 transition"
              aria-label="Book your MINI"
            >
              Book MINI now
            </Link>

            <Link
              href="#mehr"
              className="bg-transparent hover:bg-white/10 inline-flex items-center justify-center rounded-full ring-1 ring-white/30 px-4 py-2.5 font-roboto-condensed font-semibold hover:ring-white/60  text-white focus:outline-none focus:ring-4 focus:ring-white/30 transition"
              aria-label="More about MINI Drive"
            >
              More
            </Link>
          </motion.div>
        </div>
      </div>

      <div className="w-full z-20 mt-auto">
        {/* ---- Steps + Form (как раньше: один абсолютный блок у нижнего края) ---- */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-20 bottom-[max(16px,env(safe-area-inset-bottom))] sm:bottom-14"
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
          {/* Steps — в том же контейнере, сразу над формой */}
          {stepsVisible && (
            <motion.div
              className="hidden md:flex flex-wrap justify-center items-center gap-4 font-boogaloo tracking-wider text-shadow-md text-white mb-4"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
              }}
              initial="hidden"
              animate="visible"
            >
              {[
                "Pick location",
                "Set your dates",
                "Choose your MINI",
                "Drive away",
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

          {/* Form — без fixed/sticky/relative — просто как раньше */}
          <form
            className="flex flex-col font-roboto-condensed sm:flex-row text-black bg-white rounded-xl shadow-xl md:items-center gap-2 p-4"
            onSubmit={handleSubmit}
          >
            <p className=" font-roboto-condensed text-lg font-bold shrink-0">
              Book your MINI
            </p>

            {/* Location Select */}
            <div className="md:flex-1">
              {isTouch ? (
                <div className="relative">
                  <NativeSelect
                    aria-label="Location"
                    // placeholder-опция + группы как в твоём select
                    data={[
                      {
                        value: "",
                        label: "Choose location",
                        disabled: true,
                        hidden: true,
                      } as any,
                      ...(groupedData as any), // [{ group, items: [{ value, label }] }]
                    ]}
                    value={
                      buildSelectValue(selectedCountry, locationFilter) ?? ""
                    }
                    onChange={(e) => {
                      const val = e.currentTarget.value || null;
                      const parsed = parseSelectValue(val);
                      setSelectedCountry(parsed.countryId);
                      setLocationFilter(parsed.locationName);
                      if (parsed.locationName) setPickerVisible(true); // открыть календарь только при реальном выборе
                    }}
                    // Стилизуем под твой input
                    variant="unstyled"
                    className={`h-12 w-full rounded-md border border-gray-600 bg-white/90 outline-0 ${
                      locationFilter ? "text-black" : "text-neutral-500"
                    }`}
                    styles={{
                      input: {
                        height: "3rem", // 48px
                        lineHeight: "3rem",
                        paddingLeft: "10px",
                        fontSize: "16px",
                        fontFamily: "var(--font-roboto-condensed)",
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
                </div>
              ) : (
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
                  placeholder="Choose location"
                  clearButtonProps={{
                    onMouseDown: (e: React.MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedCountry(null);
                      setLocationFilter("");
                    },
                  }}
                  styles={{
                    input: {
                      paddingLeft: "10px",
                      fontSize: "16px",
                      fontFamily: "var(--font-roboto-condensed)",
                      cursor: "pointer",
                    },
                    dropdown: { maxHeight: 200, overflowY: "auto" },
                  }}
                />
              )}
            </div>

            {/* Dates input */}
            <input
              id="dates"
              type="text"
              value={
                start && end
                  ? `${new Date(start).toLocaleDateString()} → ${new Date(
                      end
                    ).toLocaleDateString()}`
                  : ""
              }
              placeholder="Set your dates"
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
              className={`h-12 rounded-md px-6 tracking-[0.04em] font-medium ${
                !locationFilter || !start || !end || !selectedCountry
                  ? "bg-black/80 text-white cursor-not-allowed"
                  : "bg-black/85 text-white hover:bg-black/90 cursor-pointer"
              }`}
            >
              Book
            </button>
          </form>
        </motion.div>
      </div>

      {/* Date picker modal / panel */}
      {pickerVisible &&
        (isTouch ? (
          <div
            className="fixed inset-0 flex items-center justify-center z-999 bg-white"
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
