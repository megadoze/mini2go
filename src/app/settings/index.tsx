import { useEffect, useMemo, useState } from "react";
import { Select } from "@mantine/core";
import { useForm } from "@mantine/form";
import { motion } from "framer-motion";
import type { AppSettings } from "@/types/setting";
import {
  getGlobalSettings,
  upsertGlobalSettings,
} from "@/services/settings.service";
import { toast } from "sonner";

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

export default function SettingsGlobal() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // initial — безопасные дефолты (будут перезаписаны после загрузки)
  const initial = useMemo(
    () => ({
      currency: (settings as any)?.currency ?? "EUR",
      openTimeMin: String(settings?.openTime ?? 540),
      closeTimeMin: String(settings?.closeTime ?? 1260),
      minDays: String(settings?.minRentPeriod ?? 1),
      maxDays: String(settings?.maxRentPeriod ?? 90),
      bufferMinutes: String(settings?.intervalBetweenBookings ?? 0),
      minAge: String(settings?.ageRenters ?? 21),
      minLicenseYears: String(settings?.minDriverLicense ?? 2),
    }),
    [settings]
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

  // Локальные свитчи для глобальных флагов (как в твоих компонентах)
  const [instantBooking, setInstantBooking] = useState(false);
  const [allowSmoking, setAllowSmoking] = useState(false);
  const [allowPets, setAllowPets] = useState(false);
  const [allowAbroad, setAllowAbroad] = useState(false);

  // базовый снимок свитчей для dirty
  const [baseToggles, setBaseToggles] = useState({
    instantBooking: false,
    allowSmoking: false,
    allowPets: false,
    allowAbroad: false,
  });

  const [saved, setSaved] = useState(false);

  // загрузка текущих глобальных настроек
  useEffect(() => {
    (async () => {
      setLoading(true);
      const gs = await getGlobalSettings();
      setSettings(gs);
      setLoading(false);
    })();
  }, []);

  // когда settings обновились — переливаем в форму и локальные свитчи
  useEffect(() => {
    form.setValues(initial);
    form.resetDirty(initial);

    const ib = Boolean(settings?.isInstantBooking ?? false);
    const sm = Boolean(settings?.isSmoking ?? false);
    const pt = Boolean(settings?.isPets ?? false);
    const ab = Boolean(settings?.isAbroad ?? false);

    setInstantBooking(ib);
    setAllowSmoking(sm);
    setAllowPets(pt);
    setAllowAbroad(ab);
    setBaseToggles({
      instantBooking: ib,
      allowSmoking: sm,
      allowPets: pt,
      allowAbroad: ab,
    });
  }, [initial]); // зависимость от initial (который зависит от settings)

  const togglesChanged =
    instantBooking !== baseToggles.instantBooking ||
    allowSmoking !== baseToggles.allowSmoking ||
    allowPets !== baseToggles.allowPets ||
    allowAbroad !== baseToggles.allowAbroad;

  const dirty = form.isDirty() || togglesChanged;

  const handleSave = async () => {
    const res = form.validate();
    if (res.hasErrors) return;

    const currency = form.values.currency as (typeof CURRENCY_OPTIONS)[number];
    const minDays = Number(form.values.minDays);
    const maxDays = Number(form.values.maxDays);
    const openTime = Number(form.values.openTimeMin);
    const closeTime = Number(form.values.closeTimeMin);

    if (minDays > maxDays) {
      form.setFieldError("minDays", "Minimum period must be ≤ maximum");
      return;
    }

    const payload: Partial<AppSettings> & {
      currency?: string;
      open_time: number;
      close_time: number;
      min_rent_period: number;
      max_rent_period: number;
      interval_between_bookings: number;
      age_renters: number;
      min_driver_license: number;
      is_instant_booking: boolean;
      is_smoking: boolean;
      is_pets: boolean;
      is_abroad: boolean;
    } = {
      currency,
      open_time: openTime,
      close_time: closeTime,
      min_rent_period: minDays,
      max_rent_period: maxDays,
      interval_between_bookings: Number(form.values.bufferMinutes),
      age_renters: Number(form.values.minAge),
      min_driver_license: Number(form.values.minLicenseYears),
      is_instant_booking: instantBooking,
      is_smoking: allowSmoking,
      is_pets: allowPets,
      is_abroad: allowAbroad,
    };

    try {
      const saved = await upsertGlobalSettings(payload);
      setSettings(saved);

      // сброс dirty
      form.resetDirty({
        ...form.values,
        openTimeMin: String(openTime),
        closeTimeMin: String(closeTime),
        minDays: String(minDays),
        maxDays: String(maxDays),
      });
      setBaseToggles({ instantBooking, allowSmoking, allowPets, allowAbroad });

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Booking settings saved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save app settings");
    }
  };

  return (
    <main className="mb-4 w-full xl:max-w-2xl">
      <h2 className="text-2xl font-semibold text-gray-900">
        Global booking settings
      </h2>
      <hr className="border-gray-200 my-4" />

      {/* Currency */}
      <section className="mt-6 mb-8">
        <p className="text-lg font-medium text-gray-900">Currency</p>
        <p className="mt-2 text-gray-600">
          Base accounting currency for your fleet.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <Select
            data={CURRENCY_OPTIONS as unknown as string[]}
            searchable={false}
            {...form.getInputProps("currency")}
            disabled={loading /* пока грузим */}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          All base prices and deposits are assumed to be in this currency.
        </p>
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
            <label className="block mb-1 text-sm font-medium text-gray-700">
              From
            </label>
            <Select
              data={timeOptions}
              searchable={false}
              {...form.getInputProps("openTimeMin")}
              disabled={loading}
            />
          </div>
          <div className="w-[220px]">
            <label className="block mb-1 text-sm font-medium text-gray-700">
              To
            </label>
            <Select
              data={timeOptions}
              searchable={false}
              {...form.getInputProps("closeTimeMin")}
              disabled={loading}
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
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Minimum rental period
            </label>
            <Select
              data={minPeriodOptions}
              searchable={false}
              {...form.getInputProps("minDays")}
              disabled={loading}
            />
          </div>
          <div className="w-[220px]">
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Maximum rental period
            </label>
            <Select
              data={maxPeriodOptions}
              searchable={false}
              {...form.getInputProps("maxDays")}
              disabled={loading}
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
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Time interval
            </label>
            <Select
              data={bufferOptions}
              searchable={false}
              {...form.getInputProps("bufferMinutes")}
              disabled={loading}
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
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Minimum age renter's
            </label>
            <Select
              data={ageOptions}
              searchable={false}
              {...form.getInputProps("minAge")}
              disabled={loading}
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
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Minimum driver's license
            </label>
            <Select
              data={licenseOptions}
              searchable={false}
              {...form.getInputProps("minLicenseYears")}
              disabled={loading}
            />
          </div>
        </div>
      </section>

      {/* Toggles */}
      <MotionToggle
        label="Instant Booking"
        description="Allow renters to book your car without waiting for approval."
        checked={instantBooking}
        onChange={setInstantBooking}
        disabled={loading}
      />
      <MotionToggle
        label="Smoking"
        description="You can allow or disallow smoking in the car."
        checked={allowSmoking}
        onChange={setAllowSmoking}
        disabled={loading}
      />
      <MotionToggle
        label="Pets"
        description="Let renters know if you allow pets."
        checked={allowPets}
        onChange={setAllowPets}
        disabled={loading}
      />
      <MotionToggle
        label="Driving abroad"
        description="Allow driving abroad in permitted countries."
        checked={allowAbroad}
        onChange={setAllowAbroad}
        disabled={loading}
      />

      {/* Save */}
      <div className="mt-8 text-right">
        <button
          className={`${
            dirty ? "border-green-300" : "border-gray-300 cursor-not-allowed"
          } border rounded-md px-8 py-2`}
          disabled={!dirty}
          onClick={handleSave}
        >
          Save
        </button>
        {saved && (
          <span className="text-green-500 font-medium text-sm animate-fade-in pl-2">
            ✓ Saved
          </span>
        )}
      </div>
    </main>
  );
}

function MotionToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`${
        checked ? "border-green-200 bg-green-50/40" : ""
      } flex justify-between items-center mt-8 rounded-2xl border bg-gray-50 py-5 px-6 ${
        disabled ? "opacity-60" : ""
      }`}
      aria-disabled={disabled}
    >
      <div className="flex-1">
        <p className={`${checked ? "text-green-500" : ""} text-lg font-medium`}>
          {label}
        </p>
        <p className="text-gray-600 mt-1 text-sm">{description}</p>
      </div>
      <div
        className={`${
          checked ? "bg-green-400 justify-end" : "justify-start bg-gray-300"
        } ${
          disabled ? "pointer-events-none" : "cursor-pointer"
        } w-16 h-10 flex items-center rounded-full p-1`}
        onClick={() => !disabled && onChange(!checked)}
      >
        <motion.div
          layout
          transition={spring}
          className="bg-white w-8 h-8 rounded-full shadow-md"
        />
      </div>
    </div>
  );
}
