import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { motion, type Transition } from "framer-motion";
import { NativeSelect } from "@mantine/core";
import { useCarContext } from "@/context/carContext";
import { upsertCarExtra } from "@/services/car.service";
import { toast } from "sonner";
import { optionsExtraPrices } from "@/constants/carOptions";
import { getCurrencySymbol } from "@/lib/currency";

const ExtraComponent = () => {
  const { carId, extraId } = useParams();

  const navigate = useNavigate();
  const { extras, setExtras, effectiveCurrency } = useCarContext();

  const [isAvailable, setIsAvailable] = useState(false);
  const [price, setPrice] = useState(0);
  const [saved, setSaved] = useState(false);

  const extra = extras.find((e) => e.extra_id === extraId);
  const extraName = extra?.meta.name || "";
  const priceType = extra?.meta.price_type || "per_rental";

  const spring: Transition = {
    type: "spring",
    stiffness: 700,
    damping: 30,
  };

  useEffect(() => {
    if (extra) {
      setIsAvailable(extra.is_available);
      setPrice(extra.price);
    }
  }, [extra]);

  const isChanged = useMemo(() => {
    return (
      extra && (isAvailable !== extra.is_available || price !== extra.price)
    );
  }, [extra, isAvailable, price]);

  const handleSwitch = () => {
    setIsAvailable(!isAvailable);
    setPrice(0);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPrice(Number(e.target.value));
  };

  const handleSubmit = async () => {
    if (!carId || !extraId || !extra) return;

    try {
      await upsertCarExtra({
        car_id: carId,
        extra_id: extraId,
        price: isAvailable ? price : 0,
        is_available: isAvailable,
      });

      // 👇 мгновенная рассылка в другие вкладки
      const bc = new BroadcastChannel("car-extras");
      bc.postMessage({ carId, extraId, isAvailable, price });
      bc.close();

      // обновляем контекст
      setExtras((prev) =>
        prev.map((e) =>
          e.extra_id === extraId
            ? {
                ...e,
                is_available: isAvailable,
                price: isAvailable ? price : 0,
              }
            : e
        )
      );

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Extra saved!");
    } catch (err) {
      console.error(err);
      toast.error("Error saving extra");
    }
  };

  if (!extra) return null;

  if (!extra?.meta?.is_active) {
    return (
      <div className="text-center text-gray-500 mt-10">
        This extra is currently disabled and cannot be edited.
      </div>
    );
  }

  return (
    <div className="mb-4 w-full xl:max-w-2xl">
      <div className="font-roboto text-xl md:text-2xl font-medium">{extraName}</div>
      <div className="border-b border-gray-100 mt-5 shadow-sm"></div>

      <div className="mt-5">
        <p className="text-lg font-medium text-gray-800">Extra service</p>
        <p className="mt-2 text-gray-600">{extra.meta.description}</p>

        <div
          className={`${
            isAvailable ? "border-green-300 bg-white" : ""
          } flex justify-between items-center mt-8 rounded-2xl border bg-gray-50 py-5 px-6`}
        >
          <p
            className={`${
              isAvailable ? "text-green-500" : ""
            } text-lg text-gray-500`}
          >
            Enable extra
          </p>
          <div
            className={`${
              isAvailable
                ? "bg-green-400 justify-end"
                : "justify-start bg-gray-300"
            } cursor-pointer w-16 h-10 flex items-center rounded-full p-1`}
            onClick={handleSwitch}
          >
            <motion.div
              layout
              transition={spring}
              className="bg-white w-8 h-8 rounded-full shadow-md"
            />
          </div>
        </div>

        <div className="mt-8">
          <div className="flex flex-col">
            <p className=" text-sm mb-1">Price</p>
            <div className="flex">
              <NativeSelect
                leftSection={
                  effectiveCurrency &&
                  (getCurrencySymbol(effectiveCurrency) || "€")
                }
                value={price}
                onChange={handlePriceChange}
                data={optionsExtraPrices}
                disabled={!isAvailable}
                styles={{
                  input: {
                    color: "black",
                    width: "180px",
                  },
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              price per {priceType.replace("per_", "")}
            </p>
          </div>
        </div>

        <div className="flex justify-between items-centermt-8 text-right mt-10">
          <button
            type="button"
            className={`border-gray-300 border rounded-md px-6 py-2 mr-2`}
            onClick={() => navigate(-1)}
          >
            Back
          </button>
          <div>
            {saved && (
              <span className="text-green-500 font-medium text-sm animate-fade-in mr-2">
                ✓ Saved
              </span>
            )}
            <button
              className={`${
                isChanged
                  ? "border-gray-600 text-gray-700"
                  : "border-gray-300 text-gray-400 cursor-not-allowed"
              } border rounded-md px-8 py-2`}
              disabled={!isChanged}
              onClick={handleSubmit}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtraComponent;
