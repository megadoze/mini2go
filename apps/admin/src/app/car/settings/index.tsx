import { useEffect, useMemo, useRef, useState } from "react";
import { Select, Checkbox } from "@mantine/core";
import { useForm } from "@mantine/form";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useCarContext } from "@/context/carContext";
import { updateCar } from "@/services/car.service";
import type { CarWithModelRelations } from "@/types/carWithModelRelations";
import { useGlobalToggleWithDraft } from "@/utils/useGlobalToggleWithDraft";

// ===== Helpers =====
const minutesToLabel = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${mm === 0 ? "00" : "30"}`;
};
const buildTimeOptions = () => {
  const out: { value: string; label: string }[] = [];
  for (let m = 0; m <= 23 * 60 + 30; m += 30)
    out.push({ value: String(m), label: minutesToLabel(m) });
  return out;
};

const timeOptions = buildTimeOptions();
const minPeriodOptions = [1, 2, 3].map((d) => ({
  value: String(d),
  label: `${d} day${d > 1 ? "s" : ""}`,
}));
const maxPeriodOptions = [14, 30, 60, 90, 1000].map((d) => ({
  value: String(d),
  label: d === 1000 ? "unlimited" : `${d} days`,
}));
const bufferOptions = [0, 60, 120, 180, 240, 300, 360, 420, 480].map((m) => ({
  value: String(m),
  label: m === 0 ? "No buffer" : `${m / 60} h`,
}));
const ageOptions = Array.from({ length: 8 }, (_, i) => 18 + i).map((a) => ({
  value: String(a),
  label: `${a} years`,
}));
const licenseOptions = Array.from({ length: 5 }, (_, i) => 1 + i).map((y) => ({
  value: String(y),
  label: `${y} year${y > 1 ? "s" : ""}`,
}));
const CURRENCY_OPTIONS = ["EUR", "USD", "GBP"] as const;
const spring = { type: "spring", stiffness: 700, damping: 30 } as const;

export default function BookingSettingsSection() {
  const { car, setCar, globalSettings } = useCarContext();

  const carId = car.id;

  // === Form initial values (override → иначе global → иначе дефолт)
  const initial = useMemo(
    () => ({
      currency: car.currency ?? globalSettings?.currency ?? "EUR",
      openTimeMin: String(car.openTime ?? globalSettings?.openTime ?? 540),
      closeTimeMin: String(car.closeTime ?? globalSettings?.closeTime ?? 1260),
      minDays: String(car.minRentPeriod ?? globalSettings?.minRentPeriod ?? 1),
      maxDays: String(car.maxRentPeriod ?? globalSettings?.maxRentPeriod ?? 90),
      bufferMinutes: String(
        car.intervalBetweenBookings ??
          globalSettings?.intervalBetweenBookings ??
          0
      ),
      minAge: String(car.ageRenters ?? globalSettings?.ageRenters ?? 21),
      minLicenseYears: String(
        car.minDriverLicense ?? globalSettings?.minDriverLicense ?? 2
      ),
    }),
    [car, globalSettings]
  );

  const form = useForm({
    initialValues: initial,
    validate: {
      currency: (v) => (!v ? "Required" : null),
      openTimeMin: (v) => (!v ? "Required" : null),
      closeTimeMin: (v) => (!v ? "Required" : null),
      minDays: (v) => (!v ? "Required" : null),
      maxDays: (v) => (!v ? "Required" : null),
      bufferMinutes: (v) => (v === undefined || v === null ? "Required" : null),
      minAge: (v) => (!v ? "Required" : null),
      minLicenseYears: (v) => (!v ? "Required" : null),
    },
  });

  // === Use global flags (NULL ⇒ true)
  const [useGlobalCurrency, setUseGlobalCurrency] = useState(
    car.currency == null
  );
  const [useGlobalOpenTime, setUseGlobalOpenTime] = useState(
    car.openTime == null
  );
  const [useGlobalCloseTime, setUseGlobalCloseTime] = useState(
    car.closeTime == null
  );
  const [useGlobalMinDays, setUseGlobalMinDays] = useState(
    car.minRentPeriod == null
  );
  const [useGlobalMaxDays, setUseGlobalMaxDays] = useState(
    car.maxRentPeriod == null
  );
  const [useGlobalBuffer, setUseGlobalBuffer] = useState(
    car.intervalBetweenBookings == null
  );
  const [useGlobalMinAge, setUseGlobalMinAge] = useState(
    car.ageRenters == null
  );
  const [useGlobalLicense, setUseGlobalLicense] = useState(
    car.minDriverLicense == null
  );
  const [useGlobalIB, setUseGlobalIB] = useState(car.isInstantBooking == null);
  const [useGlobalSmoking, setUseGlobalSmoking] = useState(
    car.isSmoking == null
  );
  const [useGlobalPets, setUseGlobalPets] = useState(car.isPets == null);
  const [useGlobalAbroad, setUseGlobalAbroad] = useState(car.isAbroad == null);

  // === Подсказки из globalSettings (для чекбоксов)
  const hintCurrency = globalSettings?.currency;
  const hintOpen = globalSettings?.openTime;
  const hintClose = globalSettings?.closeTime;
  const hintMinDays = globalSettings?.minRentPeriod;
  const hintMaxDays = globalSettings?.maxRentPeriod;
  const hintBuffer = globalSettings?.intervalBetweenBookings;
  const hintAge = globalSettings?.ageRenters;
  const hintLicense = globalSettings?.minDriverLicense;
  const hintIB = globalSettings?.isInstantBooking;
  const hintSmoking = globalSettings?.isSmoking;
  const hintPets = globalSettings?.isPets;
  const hintAbroad = globalSettings?.isAbroad;

  // === ЭФФЕКТИВНЫЕ БУЛЕВЫЕ ЗНАЧЕНИЯ (что реально действует)
  const effIB = Boolean(
    car.isInstantBooking ?? globalSettings?.isInstantBooking ?? false
  );
  const effSmoke = Boolean(car.isSmoking ?? globalSettings?.isSmoking ?? false);
  const effPets = Boolean(car.isPets ?? globalSettings?.isPets ?? false);
  const effAbroad = Boolean(car.isAbroad ?? globalSettings?.isAbroad ?? false);

  // === useGlobalToggleWithDraft для всех полей формы
  const { toggle: toggleCurrency } = useGlobalToggleWithDraft(
    form,
    "currency",
    useGlobalCurrency,
    setUseGlobalCurrency,
    hintCurrency ?? null
  );
  const { toggle: toggleOpen } = useGlobalToggleWithDraft(
    form,
    "openTimeMin",
    useGlobalOpenTime,
    setUseGlobalOpenTime,
    hintOpen != null ? String(hintOpen) : null
  );
  const { toggle: toggleClose } = useGlobalToggleWithDraft(
    form,
    "closeTimeMin",
    useGlobalCloseTime,
    setUseGlobalCloseTime,
    hintClose != null ? String(hintClose) : null
  );
  const { toggle: toggleMinDays } = useGlobalToggleWithDraft(
    form,
    "minDays",
    useGlobalMinDays,
    setUseGlobalMinDays,
    hintMinDays != null ? String(hintMinDays) : null
  );
  const { toggle: toggleMaxDays } = useGlobalToggleWithDraft(
    form,
    "maxDays",
    useGlobalMaxDays,
    setUseGlobalMaxDays,
    hintMaxDays != null ? String(hintMaxDays) : null
  );
  const { toggle: toggleBuffer } = useGlobalToggleWithDraft(
    form,
    "bufferMinutes",
    useGlobalBuffer,
    setUseGlobalBuffer,
    hintBuffer != null ? String(hintBuffer) : null
  );
  const { toggle: toggleMinAge } = useGlobalToggleWithDraft(
    form,
    "minAge",
    useGlobalMinAge,
    setUseGlobalMinAge,
    hintAge != null ? String(hintAge) : null
  );
  const { toggle: toggleLicense } = useGlobalToggleWithDraft(
    form,
    "minLicenseYears",
    useGlobalLicense,
    setUseGlobalLicense,
    hintLicense != null ? String(hintLicense) : null
  );

  // === Локальные переключатели (редактируемые значения)
  const [instantBooking, setInstantBooking] = useState<boolean>(
    Boolean(car.isInstantBooking ?? false)
  );
  const [allowSmoking, setAllowSmoking] = useState<boolean>(
    Boolean(car.isSmoking ?? false)
  );
  const [allowPets, setAllowPets] = useState<boolean>(
    Boolean(car.isPets ?? false)
  );
  const [allowAbroad, setAllowAbroad] = useState<boolean>(
    Boolean(car.isAbroad ?? false)
  );

  const [baseToggles, setBaseToggles] = useState({
    instantBooking: effIB,
    allowSmoking: effSmoke,
    allowPets: effPets,
    allowAbroad: effAbroad,
  });

  // === База для dirty
  const [baseUseGlobal, setBaseUseGlobal] = useState({
    currency: useGlobalCurrency,
    openTime: useGlobalOpenTime,
    closeTime: useGlobalCloseTime,
    minDays: useGlobalMinDays,
    maxDays: useGlobalMaxDays,
    buffer: useGlobalBuffer,
    minAge: useGlobalMinAge,
    license: useGlobalLicense,
    ib: useGlobalIB,
    smoking: useGlobalSmoking,
    pets: useGlobalPets,
    abroad: useGlobalAbroad,
  });

  const lastSnapshotRef = useRef<string>("");

  // === Синхронизация при смене car/globalSettings
  useEffect(() => {
    // Формируем следующее состояние формы из car + globalSettings
    const next = {
      currency: car.currency ?? globalSettings?.currency ?? "EUR",
      openTimeMin: String(car.openTime ?? globalSettings?.openTime ?? 540),
      closeTimeMin: String(car.closeTime ?? globalSettings?.closeTime ?? 1260),
      minDays: String(car.minRentPeriod ?? globalSettings?.minRentPeriod ?? 1),
      maxDays: String(car.maxRentPeriod ?? globalSettings?.maxRentPeriod ?? 90),
      bufferMinutes: String(
        car.intervalBetweenBookings ??
          globalSettings?.intervalBetweenBookings ??
          0
      ),
      minAge: String(car.ageRenters ?? globalSettings?.ageRenters ?? 21),
      minLicenseYears: String(
        car.minDriverLicense ?? globalSettings?.minDriverLicense ?? 2
      ),
    };

    const key = JSON.stringify(next);
    if (lastSnapshotRef.current === key) return;
    lastSnapshotRef.current = key;

    form.setValues(next);
    form.resetDirty(next);

    // флаги useGlobal из car.*
    setUseGlobalCurrency(car.currency == null);
    setUseGlobalOpenTime(car.openTime == null);
    setUseGlobalCloseTime(car.closeTime == null);
    setUseGlobalMinDays(car.minRentPeriod == null);
    setUseGlobalMaxDays(car.maxRentPeriod == null);
    setUseGlobalBuffer(car.intervalBetweenBookings == null);
    setUseGlobalMinAge(car.ageRenters == null);
    setUseGlobalLicense(car.minDriverLicense == null);
    setUseGlobalIB(car.isInstantBooking == null);
    setUseGlobalSmoking(car.isSmoking == null);
    setUseGlobalPets(car.isPets == null);
    setUseGlobalAbroad(car.isAbroad == null);

    // локальные редактируемые из car.*
    setInstantBooking(Boolean(car.isInstantBooking ?? false));
    setAllowSmoking(Boolean(car.isSmoking ?? false));
    setAllowPets(Boolean(car.isPets ?? false));
    setAllowAbroad(Boolean(car.isAbroad ?? false));

    // база для dirty — ЭФФЕКТИВНЫЕ значения (car ?? global)
    setBaseToggles({
      instantBooking: Boolean(
        car.isInstantBooking ?? globalSettings?.isInstantBooking ?? false
      ),
      allowSmoking: Boolean(
        car.isSmoking ?? globalSettings?.isSmoking ?? false
      ),
      allowPets: Boolean(car.isPets ?? globalSettings?.isPets ?? false),
      allowAbroad: Boolean(car.isAbroad ?? globalSettings?.isAbroad ?? false),
    });

    // база флагов useGlobal
    setBaseUseGlobal({
      currency: car.currency == null,
      openTime: car.openTime == null,
      closeTime: car.closeTime == null,
      minDays: car.minRentPeriod == null,
      maxDays: car.maxRentPeriod == null,
      buffer: car.intervalBetweenBookings == null,
      minAge: car.ageRenters == null,
      license: car.minDriverLicense == null,
      ib: car.isInstantBooking == null,
      smoking: car.isSmoking == null,
      pets: car.isPets == null,
      abroad: car.isAbroad == null,
    });
  }, [car, globalSettings]); // eslint-disable-line

  // === Dirty для тумблеров — сравниваем с ЭФФЕКТИВНЫМИ
  const togglesChanged =
    (useGlobalIB ? effIB : instantBooking) !== baseToggles.instantBooking ||
    (useGlobalSmoking ? effSmoke : allowSmoking) !== baseToggles.allowSmoking ||
    (useGlobalPets ? effPets : allowPets) !== baseToggles.allowPets ||
    (useGlobalAbroad ? effAbroad : allowAbroad) !== baseToggles.allowAbroad;

  const globalsChanged =
    useGlobalCurrency !== baseUseGlobal.currency ||
    useGlobalOpenTime !== baseUseGlobal.openTime ||
    useGlobalCloseTime !== baseUseGlobal.closeTime ||
    useGlobalMinDays !== baseUseGlobal.minDays ||
    useGlobalMaxDays !== baseUseGlobal.maxDays ||
    useGlobalBuffer !== baseUseGlobal.buffer ||
    useGlobalMinAge !== baseUseGlobal.minAge ||
    useGlobalLicense !== baseUseGlobal.license ||
    useGlobalIB !== baseUseGlobal.ib ||
    useGlobalSmoking !== baseUseGlobal.smoking ||
    useGlobalPets !== baseUseGlobal.pets ||
    useGlobalAbroad !== baseUseGlobal.abroad;

  const dirty = form.isDirty() || togglesChanged || globalsChanged;

  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const res = form.validate();
    if (res.hasErrors) return;
    if (!carId) return;

    const currency = form.values.currency as (typeof CURRENCY_OPTIONS)[number];
    const minDays = Number(form.values.minDays);
    const maxDays = Number(form.values.maxDays);
    const openTime = Number(form.values.openTimeMin);
    const closeTime = Number(form.values.closeTimeMin);
    const buffer = Number(form.values.bufferMinutes);
    const minAge = Number(form.values.minAge);
    const minLicenseYears = Number(form.values.minLicenseYears);

    if (minDays > maxDays) {
      form.setFieldError("minDays", "Minimum period must be ≤ maximum");
      return;
    }
    const payload = {
      currency: useGlobalCurrency ? null : currency,
      openTime: useGlobalOpenTime ? null : openTime,
      closeTime: useGlobalCloseTime ? null : closeTime,
      minRentPeriod: useGlobalMinDays ? null : minDays,
      maxRentPeriod: useGlobalMaxDays ? null : maxDays,
      intervalBetweenBookings: useGlobalBuffer ? null : buffer,
      ageRenters: useGlobalMinAge ? null : minAge,
      minDriverLicense: useGlobalLicense ? null : minLicenseYears,
      isInstantBooking: useGlobalIB ? null : instantBooking,
      isSmoking: useGlobalSmoking ? null : allowSmoking,
      isPets: useGlobalPets ? null : allowPets,
      isAbroad: useGlobalAbroad ? null : allowAbroad,
    } as const;

    try {
      await updateCar(carId, payload);

      // оптимистичное обновление — храним NULL там, где useGlobal=true
      setCar((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currency: payload.currency ?? undefined,
          openTime: payload.openTime ?? null,
          closeTime: payload.closeTime ?? null,
          minRentPeriod: payload.minRentPeriod ?? null,
          maxRentPeriod: payload.maxRentPeriod ?? null,
          intervalBetweenBookings: payload.intervalBetweenBookings ?? null,
          ageRenters: payload.ageRenters ?? null,
          minDriverLicense: payload.minDriverLicense ?? null,
          isInstantBooking: payload.isInstantBooking ?? null,
          isSmoking: payload.isSmoking ?? null,
          isPets: payload.isPets ?? null,
          isAbroad: payload.isAbroad ?? null,
        } as CarWithModelRelations;
      });

      form.resetDirty({
        ...form.values,
        currency,
        openTimeMin: String(openTime),
        closeTimeMin: String(closeTime),
        minDays: String(minDays),
        maxDays: String(maxDays),
        bufferMinutes: String(buffer),
        minAge: String(minAge),
        minLicenseYears: String(minLicenseYears),
      });

      // базовые «эффективные» значения после сохранения
      setBaseToggles({
        instantBooking: useGlobalIB ? effIB : instantBooking,
        allowSmoking: useGlobalSmoking ? effSmoke : allowSmoking,
        allowPets: useGlobalPets ? effPets : allowPets,
        allowAbroad: useGlobalAbroad ? effAbroad : allowAbroad,
      });
      setBaseUseGlobal({
        currency: useGlobalCurrency,
        openTime: useGlobalOpenTime,
        closeTime: useGlobalCloseTime,
        minDays: useGlobalMinDays,
        maxDays: useGlobalMaxDays,
        buffer: useGlobalBuffer,
        minAge: useGlobalMinAge,
        license: useGlobalLicense,
        ib: useGlobalIB,
        smoking: useGlobalSmoking,
        pets: useGlobalPets,
        abroad: useGlobalAbroad,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Booking settings saved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save booking settings");
    }
  };

  return (
    <main className="mb-4 w-full xl:max-w-2xl">
      <h2 className="font-roboto text-xl md:text-2xl font-medium">
        Booking settings
      </h2>
      <hr className="border-gray-200 my-4" />

      {/* Currency */}
      <section className="mt-6 mb-8">
        <p className="text-lg font-medium text-gray-900">Currency</p>
        <p className="mt-2 text-gray-600">
          Base accounting currency for this car (or inherit global).
        </p>

        <div className="mt-4 w-[220px]">
          <div className="mb-2">
            <Checkbox
              color="black"
              label={
                <span className="text-sm text-gray-600">
                  Use global{" "}
                  {useGlobalCurrency && hintCurrency ? `(${hintCurrency})` : ""}
                </span>
              }
              checked={useGlobalCurrency}
              onChange={(e) => toggleCurrency(e.currentTarget.checked)}
            />
          </div>
          <Select
            data={[...CURRENCY_OPTIONS]}
            searchable={false}
            disabled={useGlobalCurrency}
            {...form.getInputProps("currency")}
            allowDeselect={false}
          />
        </div>
      </section>

      {/* Opening hours */}
      <section className="mb-8">
        <div>
          <h4 className="text-lg font-medium text-gray-900">Opening hours</h4>
          <p className="text-sm text-gray-500 mt-1">
            Set the times when you are available to hand over or receive your
            car.
          </p>
        </div>
        <div className="flex gap-4 mt-4">
          <div className="w-[220px]">
            <div className="mb-2">
              <Checkbox
                color="black"
                label={
                  <span className="text-sm text-gray-600">
                    Use global{" "}
                    {useGlobalOpenTime && hintOpen != null
                      ? `(${minutesToLabel(hintOpen)})`
                      : ""}
                  </span>
                }
                checked={useGlobalOpenTime}
                onChange={(e) => toggleOpen(e.currentTarget.checked)}
              />
            </div>
            <Select
              data={timeOptions}
              searchable={false}
              disabled={useGlobalOpenTime}
              {...form.getInputProps("openTimeMin")}
              allowDeselect={false}
            />
          </div>

          <div className="w-[220px]">
            <div className="mb-2">
              <Checkbox
                color="black"
                label={
                  <span className="text-sm text-gray-600">
                    Use global{" "}
                    {useGlobalCloseTime && hintClose != null
                      ? `(${minutesToLabel(hintClose)})`
                      : ""}
                  </span>
                }
                checked={useGlobalCloseTime}
                onChange={(e) => toggleClose(e.currentTarget.checked)}
              />
            </div>
            <Select
              data={timeOptions}
              searchable={false}
              disabled={useGlobalCloseTime}
              {...form.getInputProps("closeTimeMin")}
              allowDeselect={false}
            />
          </div>
        </div>
      </section>

      {/* Rental duration */}
      <section className="mb-8">
        <div>
          <h4 className="text-lg font-medium text-gray-900">Rental duration</h4>
          <p className="text-sm text-gray-500 mt-1">
            Maximum rental period allowed is 90 days.
          </p>
        </div>
        <div className="flex gap-4 mt-4">
          <div className="w-[220px]">
            <div className="mb-2">
              <Checkbox
                color="black"
                label={
                  <span className="text-sm text-gray-600">
                    Use global{" "}
                    {useGlobalMinDays && hintMinDays != null
                      ? `(${hintMinDays} d)`
                      : ""}
                  </span>
                }
                checked={useGlobalMinDays}
                onChange={(e) => toggleMinDays(e.currentTarget.checked)}
              />
            </div>
            <Select
              data={minPeriodOptions}
              searchable={false}
              disabled={useGlobalMinDays}
              {...form.getInputProps("minDays")}
              allowDeselect={false}
            />
          </div>

          <div className="w-[220px]">
            <div className="mb-2">
              <Checkbox
                color="black"
                label={
                  <span className="text-sm text-gray-600">
                    Use global{" "}
                    {useGlobalMaxDays && hintMaxDays != null
                      ? `(${hintMaxDays} d)`
                      : ""}
                  </span>
                }
                checked={useGlobalMaxDays}
                onChange={(e) => toggleMaxDays(e.currentTarget.checked)}
              />
            </div>
            <Select
              data={maxPeriodOptions}
              searchable={false}
              disabled={useGlobalMaxDays}
              {...form.getInputProps("maxDays")}
              allowDeselect={false}
            />
          </div>
        </div>
      </section>

      {/* Trip buffer */}
      <section className="mb-8">
        <div>
          <h4 className="text-lg font-medium text-gray-900">Trip buffer</h4>
          <p className="text-sm text-gray-500 mt-1">
            Automatically block requests before and after every trip.
          </p>
        </div>
        <div className="flex gap-4 mt-4">
          <div className="w-[220px]">
            <div className="mb-2">
              <Checkbox
                color="black"
                label={
                  <span className="text-sm text-gray-600">
                    Use global{" "}
                    {useGlobalBuffer && hintBuffer != null
                      ? hintBuffer === 0
                        ? "(No buffer)"
                        : `(${Math.round(hintBuffer / 60)} h)`
                      : ""}
                  </span>
                }
                checked={useGlobalBuffer}
                onChange={(e) => toggleBuffer(e.currentTarget.checked)}
              />
            </div>
            <Select
              data={bufferOptions}
              searchable={false}
              disabled={useGlobalBuffer}
              {...form.getInputProps("bufferMinutes")}
              allowDeselect={false}
            />
          </div>
        </div>
      </section>

      {/* Age */}
      <section className="mb-8">
        <div>
          <h4 className="text-lg font-medium text-gray-900">Age renter's</h4>
          <p className="text-sm text-gray-500 mt-1">
            Minimum age of the renter required to rent a car.
          </p>
        </div>
        <div className="flex gap-4 mt-4">
          <div className="w-[220px]">
            <div className="mb-2">
              <Checkbox
                color="black"
                label={
                  <span className="text-sm text-gray-600">
                    Use global{" "}
                    {useGlobalMinAge && hintAge != null ? `(${hintAge} y)` : ""}
                  </span>
                }
                checked={useGlobalMinAge}
                onChange={(e) => toggleMinAge(e.currentTarget.checked)}
              />
            </div>
            <Select
              data={ageOptions}
              searchable={false}
              disabled={useGlobalMinAge}
              {...form.getInputProps("minAge")}
              allowDeselect={false}
            />
          </div>
        </div>
      </section>

      {/* License */}
      <section className="mb-8">
        <div>
          <h4 className="text-lg font-medium text-gray-900">
            Minimum driver's license
          </h4>
          <p className="text-sm text-gray-500 mt-1">
            Minimum driver's license required to rent a car.
          </p>
        </div>
        <div className="flex gap-4 mt-4">
          <div className="w-[220px]">
            <div className="mb-2">
              <Checkbox
                color="black"
                label={
                  <span className="text-sm text-gray-600">
                    Use global{" "}
                    {useGlobalLicense && hintLicense != null
                      ? `(${hintLicense} y)`
                      : ""}
                  </span>
                }
                checked={useGlobalLicense}
                onChange={(e) => toggleLicense(e.currentTarget.checked)}
              />
            </div>
            <Select
              data={licenseOptions}
              searchable={false}
              disabled={useGlobalLicense}
              {...form.getInputProps("minLicenseYears")}
              allowDeselect={false}
            />
          </div>
        </div>
      </section>

      {/* Toggles */}
      <ToggleWithGlobal
        label="Instant Booking"
        description="Allow renters to book your car without waiting for approval."
        checked={useGlobalIB ? effIB : instantBooking}
        useGlobal={useGlobalIB}
        onChangeChecked={setInstantBooking}
        onChangeUseGlobal={setUseGlobalIB}
        effectiveHint={
          useGlobalIB && hintIB != null ? (hintIB ? "On" : "Off") : undefined
        }
      />

      <ToggleWithGlobal
        label="Smoking"
        description="You can allow or disallow smoking in the car."
        checked={useGlobalSmoking ? effSmoke : allowSmoking}
        useGlobal={useGlobalSmoking}
        onChangeChecked={setAllowSmoking}
        onChangeUseGlobal={setUseGlobalSmoking}
        effectiveHint={
          useGlobalSmoking && hintSmoking != null
            ? hintSmoking
              ? "On"
              : "Off"
            : undefined
        }
      />

      <ToggleWithGlobal
        label="Pets"
        description="Let renters know if you allow pets."
        checked={useGlobalPets ? effPets : allowPets}
        useGlobal={useGlobalPets}
        onChangeChecked={setAllowPets}
        onChangeUseGlobal={setUseGlobalPets}
        effectiveHint={
          useGlobalPets && hintPets != null
            ? hintPets
              ? "On"
              : "Off"
            : undefined
        }
      />

      <ToggleWithGlobal
        label="Driving abroad"
        description="Allow driving abroad in permitted countries."
        checked={useGlobalAbroad ? effAbroad : allowAbroad}
        useGlobal={useGlobalAbroad}
        onChangeChecked={setAllowAbroad}
        onChangeUseGlobal={setUseGlobalAbroad}
        effectiveHint={
          useGlobalAbroad && hintAbroad != null
            ? hintAbroad
              ? "On"
              : "Off"
            : undefined
        }
      />

      {/* Save */}
      <div className="mt-8 text-right">
        {saved && (
          <span className="text-green-400 font-medium text-sm animate-fade-in mr-2">
            ✓ Saved
          </span>
        )}
        <button
          className={`${
            dirty
              ? "border-gray-600 text-gray-700"
              : "border-gray-300 text-gray-400 cursor-not-allowed"
          } border rounded-md px-8 py-2`}
          disabled={!dirty}
          onClick={handleSave}
        >
          Save
        </button>
      </div>
    </main>
  );
}

// === Toggle + Mantine Checkbox “Use global”
function ToggleWithGlobal({
  label,
  description,
  checked,
  useGlobal,
  onChangeChecked,
  onChangeUseGlobal,
  effectiveHint,
}: {
  label: string;
  description: string;
  checked: boolean;
  useGlobal: boolean;
  onChangeChecked: (v: boolean) => void;
  onChangeUseGlobal: (v: boolean) => void;
  effectiveHint?: string;
}) {
  const disabled = useGlobal;

  return (
    <div
      className={`${
        checked && !useGlobal ? "border-green-400 bg-white" : ""
      } mt-8 rounded-2xl border bg-gray-50 p-4`}
      aria-disabled={disabled}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p
            className={`${
              checked && !useGlobal ? "text-green-600" : ""
            } text-lg font-medium`}
          >
            {label}
          </p>
          <p className="text-gray-600 mt-1 text-sm">{description}</p>
          <div className="mt-3">
            <Checkbox
              color="black"
              label={
                <span className="text-sm text-gray-600">
                  Use global{" "}
                  {useGlobal && effectiveHint ? `(${effectiveHint})` : ""}
                </span>
              }
              checked={useGlobal}
              onChange={(e) => onChangeUseGlobal(e.currentTarget.checked)}
            />
          </div>
        </div>

        <div
          className={`${
            checked ? "bg-green-500 justify-end" : "justify-start bg-gray-300"
          } w-16 h-10 flex items-center rounded-full p-1 ${
            disabled ? "opacity-50 pointer-events-none" : "cursor-pointer"
          }`}
          onClick={() => !disabled && onChangeChecked(!checked)}
        >
          <motion.div
            layout
            transition={spring}
            className="bg-white w-8 h-8 rounded-full shadow-md"
          />
        </div>
      </div>
    </div>
  );
}
