import { useMemo, useState } from "react";
import { motion, type Transition } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useCarContext } from "@/context/carContext";
import { updateCar } from "@/services/car.service";
import { toast } from "sonner";
import { NativeSelect } from "@mantine/core";
import { optionsDeliveryFee } from "@/constants/carOptions";
import { useCarCache } from "@/hooks/useCarCache";

const Delivery = () => {
  const { car, setIsDelivery, setDeliveryFee, isDelivery, deliveryFee } =
    useCarContext();

  const { patchCar } = useCarCache();

  const navigate = useNavigate();

  const [deliveryState, setDeliveryState] = useState(isDelivery ?? false);
  const [fee, setFee] = useState<number>(deliveryFee ?? 0);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const spring: Transition = {
    type: "spring",
    stiffness: 700,
    damping: 30,
  };

  const isChanged = useMemo(() => {
    return deliveryState !== isDelivery || fee !== deliveryFee;
  }, [deliveryState, fee, deliveryFee, isDelivery]);

  const carId = car.id;

  const handleSwitch = () => {
    setDeliveryState((v) => {
      const next = !v;
      if (!next) setFee(0);
      return next;
    });
  };

  const handleChangeDeliveryFee = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFee(Number(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    try {
      if (!carId) return null;
      await updateCar(carId, {
        isDelivery: deliveryState,
        deliveryFee: Number(fee),
      });

      // обновляем в кеше
      patchCar(carId, { isDelivery: deliveryState, deliveryFee: Number(fee) });

      setIsDelivery(deliveryState);
      setDeliveryFee(fee);

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Delivery saved successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong while saving!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4 w-full xl:max-w-2xl">
      <div className="font-roboto text-xl md:text-2xl font-medium">
        Location & delivery
      </div>
      <div className="border-b border-gray-100 mt-5 shadow-sm"></div>

      <div className="mt-5">
        <p className="text-lg font-medium text-gray-800">Delivery</p>
        <p className="mt-2 text-gray-600">
          Offering delivery is a great way to promote your car on search results
          and makes renting cars even more convenient for our members.
        </p>
        <div
          className={`${
            deliveryState ? "border-green-300 bg-white" : ""
          } flex justify-between items-center mt-8 rounded-2xl border bg-gray-50 py-5 px-6`}
        >
          <p
            className={`${
              deliveryState ? "text-green-500" : ""
            } text-lg text-gray-500`}
          >
            Enable delivery
          </p>
          <div
            // data-ison={isSelected}
            className={`${
              deliveryState
                ? "bg-green-400 justify-end"
                : "justify-start bg-gray-300"
            } cursor-pointer w-16 h-10 flex items-center rounded-full p-1`}
            onClick={() => handleSwitch()}
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
            <p className=" text-sm mb-1">Delivery fee</p>
            <div className="flex  ">
              <NativeSelect
                leftSection={"$"}
                value={fee}
                onChange={(data) => handleChangeDeliveryFee(data)}
                data={optionsDeliveryFee}
                disabled={!deliveryState}
                styles={{
                  input: {
                    color: "black",
                    width: "180px",
                  },
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              includes pickup & return
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
              <span className="text-lime-500 font-medium text-sm animate-fade-in mr-2">
                ✓ Saved
              </span>
            )}
            <button
              className={`${
                isChanged
                  ? "border-gray-600 text-gray-700"
                  : "border-gray-300 text-gray-400 cursor-not-allowed"
              } border rounded-md px-8 py-2`}
              disabled={!isChanged || loading}
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

export default Delivery;
