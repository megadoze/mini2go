import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  FaceSmileIcon,
  HandThumbUpIcon,
  TrashIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import {
  upsertPricingRule,
  upsertSeasonalRate,
  deletePricingRule,
  deleteSeasonalRate,
} from "../../../services/pricing.service";
import { useCarContext } from "@/context/carContext";
import { updateCar } from "@/services/car.service";
import { getCurrencySymbol } from "@/lib/currency";
import { toast } from "sonner";
import { DatePickerInput } from "@mantine/dates";
import "dayjs/locale/ru";
import { useCarCache } from "@/hooks/useCarCache";

// Валидация дат (start <= end)
const isValidDateRange = (start: string, end: string) =>
  new Date(start) <= new Date(end);

const toISODate = (d: any) => {
  if (!d) return "";
  const jsDate: Date =
    d instanceof Date
      ? d
      : typeof d.toDate === "function"
      ? d.toDate()
      : new Date(d);
  if (isNaN(jsDate.getTime())) return "";
  return jsDate.toISOString().slice(0, 10); // YYYY-MM-DD
};

const fromISODate = (iso?: string) =>
  iso ? new Date(`${iso}T00:00:00`) : null;

const Pricing = () => {
  const { carId } = useParams();

  const { patchCar } = useCarCache();

  const {
    car,
    setCar,
    pricingRules,
    setPricingRules,
    seasonalRates,
    setSeasonalRates,
    effectiveCurrency,
  } = useCarContext();

  const currency = effectiveCurrency ?? "EUR";

  const sym = getCurrencySymbol(currency);

  const [price, setPrice] = useState<number>(car?.price ?? 48);
  const [deposit, setDeposit] = useState<number>(car?.deposit ?? 0);

  const [savingPrice, setSavingPrice] = useState(false);
  const [savingDeposit, setSavingDeposit] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [savingSeason, setSavingSeason] = useState(false);

  // Локальные формы для добавления/редактирования записи
  const [ruleDraft, setRuleDraft] = useState<{
    car_id: string;
    min_days: number;
    discount_percent: string;
  }>({
    car_id: carId || "",
    min_days: 3,
    discount_percent: "-10",
  });

  const [seasonDraft, setSeasonDraft] = useState<{
    car_id: string;
    start_date: string;
    end_date: string;
    adjustment_percent: string;
  }>({
    car_id: carId || "",
    start_date: "",
    end_date: "",
    adjustment_percent: "25",
  });

  const seasonRange = useMemo<[Date | null, Date | null]>(() => {
    return [
      fromISODate(seasonDraft.start_date),
      fromISODate(seasonDraft.end_date),
    ];
  }, [seasonDraft.start_date, seasonDraft.end_date]);

  useEffect(() => {
    if (car) {
      setPrice(car.price ?? 48);
      setDeposit(car.deposit ?? 0);
    }
  }, [car]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
      value
    );

  const isChangedDeposit = useMemo(() => {
    return deposit !== car.deposit;
  }, [deposit, car.deposit]);

  const isChangedPrice = useMemo(() => {
    return price !== car.price;
  }, [price, car.price]);

  // Пример рекомендованной цены (можно заменить своей логикой)
  const recommendedPrice = useMemo(
    () => Math.max(30, Math.round((price ?? 40) * 0.9)),
    [price]
  );

  const handleSavePrice = async () => {
    if (!carId) return;
    try {
      await updateCar(carId, { price });
      setCar((prev) => (prev ? { ...prev, price } : prev));
      patchCar(carId, { price });
      setSavingPrice(true);
      setTimeout(() => setSavingPrice(false), 2000);
      toast.success("Price saved!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save price");
    }
  };

  const handleSaveDeposit = async () => {
    if (!carId) return;

    try {
      setSavingDeposit(true);
      await updateCar(carId, { deposit });
      setCar((prev) => (prev ? { ...prev, deposit } : prev));
      patchCar(carId, { deposit });
      toast.success("Deposit saved!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save deposit");
    } finally {
      setTimeout(() => setSavingDeposit(false), 2000);
    }
  };

  const handleAddOrUpdateRule = async () => {
    if (!carId) return;
    setSavingRule(true);
    try {
      const saved = await upsertPricingRule({
        ...ruleDraft,
        car_id: carId,
        discount_percent: parseFloat(ruleDraft.discount_percent) || 0,
      });
      setPricingRules((prev) => {
        const exists = prev.some((r) => r.id === saved.id);
        const list = exists
          ? prev.map((r) => (r.id === saved.id ? saved : r))
          : [...prev, saved];
        return [...list].sort((a, b) => a.min_days - b.min_days);
      });

      setRuleDraft({ car_id: carId, min_days: 3, discount_percent: "-10" });
      toast.success("Discount rule saved");
    } catch (e) {
      console.log(e);

      toast.error("Failed to save rule");
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async (id?: string) => {
    if (!id) return;
    try {
      await deletePricingRule(id);
      setPricingRules((prev) => prev.filter((r) => r.id !== id));
      toast.success("Discount rule deleted");
    } catch (e) {
      console.log(e);

      toast.error("Failed to delete rule");
    }
  };

  const handleAddOrUpdateSeason = async () => {
    if (!carId) return;

    const parsedPercent = parseFloat(seasonDraft.adjustment_percent);
    const isValidPercent = !isNaN(parsedPercent);

    if (
      !seasonDraft.start_date ||
      !seasonDraft.end_date ||
      !isValidDateRange(seasonDraft.start_date, seasonDraft.end_date) ||
      !isValidPercent
    ) {
      toast.error("Проверь корректность данных");
      return;
    }

    setSavingSeason(true);
    try {
      const toDay = (iso: string) => new Date(`${iso}T00:00:00Z`);

      const overlaps = seasonalRates.some((s) => {
        const start = toDay(seasonDraft.start_date);
        const end = toDay(seasonDraft.end_date);
        const sStart = toDay(s.start_date);
        const sEnd = toDay(s.end_date);
        const disjoint = end <= sStart || start >= sEnd;
        return !disjoint;
      });

      if (overlaps) {
        toast.warning("Новый сезон пересекается с существующим периодом");
        return;
      }

      const saved = await upsertSeasonalRate({
        ...seasonDraft,
        car_id: carId,
        adjustment_percent: parsedPercent, // <-- преобразование тут
      });

      setSeasonalRates((prev) => {
        const exists = prev.some((r) => r.id === saved.id);
        const list = exists
          ? prev.map((r) => (r.id === saved.id ? saved : r))
          : [...prev, saved];
        return [...list].sort((a, b) =>
          a.start_date.localeCompare(b.start_date)
        );
      });

      setSeasonDraft({
        car_id: carId,
        start_date: "",
        end_date: "",
        adjustment_percent: "25", // потому что теперь это string
      });

      toast.success("Season saved");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save season");
    } finally {
      setSavingSeason(false);
    }
  };

  const handleDeleteSeason = async (id?: string) => {
    if (!id) return;
    try {
      await deleteSeasonalRate(id);
      setSeasonalRates((prev) => prev.filter((r) => r.id !== id));
      toast.success("Season deleted");
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete season");
    }
  };

  return (
    <div className="mb-4 w-full xl:max-w-2xl">
      <h1 className="font-roboto text-xl md:text-2xl font-medium">Pricing</h1>
      <div className="border-b border-gray-100 mt-5 shadow-sm"></div>

      {/* Базовая цена */}
      <section className="mt-6">
        <p className="text-lg font-medium text-gray-800">Daily price</p>
        <p className="mt-2 text-gray-600">
          Set your default daily price. Prices are before any applicable
          discounts.
        </p>

        <div className="flex flex-col mt-5 gap-6">
          <div className="flex flex-wrap justify-between ">
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">Base price</label>
              <div className="flex border border-gray-300 rounded-md overflow-hidden ">
                <span className="py-1 border-r border-gray-300 px-3 bg-gray-50 select-none">
                  {sym}
                </span>
                <input
                  id="price"
                  className=" outline-none text-center w-40 "
                  value={price}
                  min={0}
                  onChange={(e) =>
                    setPrice(Math.max(0, Number(e.target.value) || 0))
                  }
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Recommended: {formatCurrency(recommendedPrice)}
              </p>
            </div>
            <div className=" w-full  ml-auto mt-4 rounded-xl p-4 bg-green-50 text-sm flex items-center h-fit md:w-80">
              <FaceSmileIcon className="w-5 h-5 mx-2 text-green-700" />
              <p className="pl-2 flex-1 text-green-700">
                That's a really good price! Your car is very likely to get
                rented out
              </p>
            </div>
          </div>
          <div>
            <button
              className={`${
                isChangedPrice
                  ? "border-gray-600 text-gray-700"
                  : "border-gray-300 text-gray-400 cursor-not-allowed"
              } border rounded-md px-8 py-2`}
              disabled={!isChangedPrice}
              onClick={handleSavePrice}
            >
              {savingPrice ? "Saving..." : "Save price"}
            </button>
            <span
              className={`text-lime-500 font-medium text-sm transition-opacity duration-500 ml-2 ${
                savingPrice ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              ✓ Saved
            </span>
          </div>
        </div>
      </section>

      {/* Скидки по длительности */}
      <section className="mt-10">
        <p className="text-lg font-medium text-gray-800">Discounts by length</p>
        <p className="mt-2 text-gray-600">
          Encourage longer trips with automatic discounts.
        </p>

        <div className="mt-4 grid md:grid-cols-[1fr_auto] gap-4 items-end">
          <div className="flex items-end gap-2 w-full">
            <div>
              <label className="text-xs text-gray-500">Min days</label>
              <input
                // type="number"
                min={1}
                value={ruleDraft.min_days}
                onChange={(e) =>
                  setRuleDraft((p) => ({
                    ...p,
                    min_days: Number(e.target.value),
                  }))
                }
                className="h-9 block border border-gray-300 outline-none rounded-md px-3 py-1 w-24 text-center"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Discount %</label>
              <input
                type="number"
                value={ruleDraft.discount_percent}
                onChange={(e) =>
                  setRuleDraft((p) => ({
                    ...p,
                    discount_percent: e.target.value,
                  }))
                }
                className="h-9 block border outline-none border-gray-300 rounded-md px-3 py-1 w-24 text-center"
              />
            </div>

            <button
              className={` h-9 bg-black text-white text-sm rounded-md px-4 py-2 flex items-center gap-1 ${
                savingRule ? "opacity-60" : ""
              }`}
              onClick={handleAddOrUpdateRule}
              disabled={savingRule}
            >
              <PlusIcon className="w-4" /> {savingRule ? "Saving..." : "Add"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 mt-2">
          <div className="flex-1 mt-4 space-y-2">
            {pricingRules.length === 0 && (
              <p className="text-sm text-gray-500">No discounts yet.</p>
            )}
            {pricingRules.map((r) => (
              <div
                key={r.id ?? `${r.min_days}-${r.discount_percent}`}
                className="flex items-center justify-between border rounded-md px-3 py-2"
              >
                <div className="text-sm">
                  <span className="font-medium">{r.min_days}+ days</span>
                  <span className="ml-3 text-gray-600">
                    {r.discount_percent}%
                  </span>
                </div>
                <button
                  className="text-rose-700 hover:text-rose-800"
                  onClick={() => handleDeleteRule(r.id)}
                  disabled={savingRule}
                >
                  <TrashIcon className="w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl p-4 bg-green-50 text-sm flex items-center h-fit w-full md:w-80">
            <HandThumbUpIcon className="w-5 h-5 mx-2 text-green-700" />
            <p className="pl-2 flex-1 text-green-700">
              Offer weekly/monthly discounts to increase occupancy
            </p>
          </div>
        </div>
      </section>

      {/* Сезонные ставки */}
      <section className="mt-10">
        <p className="text-lg font-medium text-gray-800">
          Seasonal adjustments
        </p>
        <p className="mt-2 text-gray-600">
          Raise or lower prices for specific seasons.
        </p>

        <div className="mt-4 flex items-end gap-2 w-full">
          <div className="flex-1 md:flex-none">
            <label className="text-xs text-gray-500">Season dates</label>
            <DatePickerInput
              type="range"
              value={seasonRange}
              onChange={(value) => {
                const [start, end] = Array.isArray(value)
                  ? value
                  : [null, null];
                setSeasonDraft((p) => ({
                  ...p,
                  start_date: start ? toISODate(start) : "",
                  end_date: end ? toISODate(end) : "",
                }));
              }}
              valueFormat="DD.MM.YY"
              locale="ru"
              placeholder="Choose dates"
              allowSingleDateInRange
            />
          </div>
          <div className=" flex flex-col gap-1">
            <label className="text-xs text-gray-500">Adjustment %</label>
            <input
              type="number"
              value={seasonDraft.adjustment_percent}
              onChange={(e) =>
                setSeasonDraft((p) => ({
                  ...p,
                  adjustment_percent: e.target.value,
                }))
              }
              className=" h-9 w-20 border outline-none border-gray-300 rounded-md px-3 py-1 text-center"
            />
          </div>

          <button
            className={`h-9 bg-black text-white text-sm rounded-md px-4 flex items-center gap-1 ${
              savingSeason ? "opacity-60" : ""
            }`}
            onClick={handleAddOrUpdateSeason}
            disabled={
              savingSeason ||
              !seasonDraft.start_date ||
              !seasonDraft.end_date ||
              !isValidDateRange(seasonDraft.start_date, seasonDraft.end_date)
            }
          >
            <PlusIcon className="w-4" /> {savingSeason ? "Saving..." : "Add"}
          </button>
        </div>
        <div className="flex flex-wrap gap-x-5">
          <div className="flex-1 mt-4 space-y-2">
            {seasonalRates.length === 0 && (
              <p className="text-sm text-gray-500">
                No seasonal adjustments yet.
              </p>
            )}
            {seasonalRates.map((s) => (
              <div
                key={s.id ?? `${s.start_date}-${s.end_date}`}
                className="flex items-center justify-between border rounded-md px-3 py-2"
              >
                <div className="text-sm">
                  <span className="font-medium">
                    {s.start_date} → {s.end_date}
                  </span>
                  <span className="ml-3 text-gray-600">
                    {s.adjustment_percent}%
                  </span>
                </div>
                <button
                  className="text-rose-700 hover:text-rose-800"
                  onClick={() => handleDeleteSeason(s.id)}
                  disabled={savingSeason}
                >
                  <TrashIcon className="w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl p-4 bg-green-50 text-sm flex items-center h-fit w-full md:w-80">
            <HandThumbUpIcon className="w-5 h-5 mx-2 text-green-700" />
            <p className="pl-2 flex-1 text-green-700">
              Offer seasonal discounts to increase occupancy
            </p>
          </div>
        </div>
      </section>

      {/* Депозит */}
      <section className="mt-10">
        <p className=" text-lg font-medium text-gray-800">Deposit</p>
        <p className="mt-2 text-gray-600">
          Set the deposit amount for your car.
        </p>
        <div className="flex flex-col mt-5 gap-6">
          <div className="flex flex-wrap justify-between">
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">Deposit</label>
              <div className="flex border border-gray-300 rounded-md overflow-hidden">
                <span className="py-1 border-r border-gray-300 px-3 bg-gray-50 select-none">
                  {sym}
                </span>
                <input
                  id="deposit"
                  className="w-40 py-1 outline-none text-center"
                  value={deposit}
                  min={0}
                  onChange={(e) => {
                    setDeposit(
                      Math.max(0, Math.trunc(Number(e.target.value) || 0))
                    );
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Recommended: {formatCurrency(400)}
              </p>
            </div>
            <div className=" w-full md:w-80 mt-4 ml-auto rounded-xl p-4 bg-green-50 text-sm flex items-center h-fit ">
              <FaceSmileIcon className="w-5 mx-2 text-green-700" />
              <p className="pl-2 flex-1 text-green-700">
                A smaller deposit often increases conversion
              </p>
            </div>
          </div>
          <div>
            <button
              className={`${
                isChangedDeposit
                  ? "border-gray-600 text-gray-700"
                  : "border-gray-300 text-gray-400 cursor-not-allowed"
              } border rounded-md px-8 py-2`}
              disabled={!isChangedDeposit}
              onClick={handleSaveDeposit}
            >
              {savingDeposit ? "Saving..." : "Save deposit"}
            </button>
            <span
              className={`text-lime-500 font-medium text-sm transition-opacity duration-500 ml-2 ${
                savingDeposit ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              ✓ Saved
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
