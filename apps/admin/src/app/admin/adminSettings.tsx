import { useState } from "react";
import { Select } from "@mantine/core";
import { useForm } from "@mantine/form";
import { toast } from "sonner";
// import { useQueryClient } from "@tanstack/react-query";
// import { QK } from "@/queryKeys";

const CURRENCY_OPTIONS = ["EUR", "USD", "GBP"] as const;

/* ================= Component ================= */

export default function AdminSettings() {
  // const qc = useQueryClient();

  const loading = false;

  // ------- форма: исходные значения основаны на settings -------
  // const initial = useMemo(
  //   () => ({
  //     currency: (settings as any)?.currency ?? "EUR",
  //   }),
  //   [settings]
  // );

  const form = useForm({
    // initialValues: initial,
    validate: {
      currency: (v) => (!v ? "Required" : null),
    },
  });

  const [saved, setSaved] = useState(false);

  const dirty = form.isDirty();

  // Когда settings приходят (из кэша/сети), переливаем в форму и свитчи
  // useEffect(() => {
  //   form.setValues(initial);
  //   form.resetDirty(initial);

  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [initial]);

  /* ================= Save ================= */

  const handleSave = async () => {
    const res = form.validate();
    if (res.hasErrors) return;

    // const currency = form.values.currency as (typeof CURRENCY_OPTIONS)[number];

    // const payload: AppSettingsUpdatePayload = {
    //   currency,
    // };

    try {
      // const saved = await upsertAdminSettings(payload);

      // мгновенно обновляем кэш и лёгкая инвалидизация
      // qc.setQueryData(QK.appSettingsAdmin(), saved);
      // qc.invalidateQueries({ queryKey: QK.appSettingsAdmin() });

      // сбрасываем dirty
      form.resetDirty({
        ...form.values,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Booking settings saved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save app settings");
    }
  };

  /* ================= Render ================= */

  return (
    <main className="mb-4 w-full xl:max-w-2xl">
      <h2 className="font-roboto text-xl md:text-2xl font-medium md:font-bold">
        Settings
      </h2>

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
            disabled={loading}
            allowDeselect={false}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          All base prices and deposits are assumed to be in this currency.
        </p>
      </section>

      {/* Save */}
      <div className="mt-8 text-right">
        {saved && (
          <span className="text-green-500 font-medium text-sm animate-fade-in mr-2">
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
