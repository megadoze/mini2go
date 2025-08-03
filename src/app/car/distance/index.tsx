import { optionsDistance } from "@/constants/carOptions";
import { useCarContext } from "@/context/carContext";
import { updateCar } from "@/services/car.service";
import { NativeSelect } from "@mantine/core";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const Distance = () => {
  const { car, setIncludeMileage, includeMileage } = useCarContext();

  const [distance, setDistance] = useState(includeMileage ?? 100);
  const [saved, setSaved] = useState(false);

  const isChanged = useMemo(() => {
    return distance !== includeMileage;
  }, [distance, includeMileage]);

  const carId = car.id;

  const handleChangeDistance = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDistance(Number(e.target.value));
  };

  const handleDistanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!carId) return null;
      await updateCar(carId, { includeMileage: distance });

      setSaved(true);
      setIncludeMileage(distance);

      setTimeout(() => setSaved(false), 2000);
      toast.success("Location saved successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong while saving!");
    }
  };

  return (
    <div className="mb-4 w-full xl:max-w-2xl">
      <div className="font-semibold text-2xl text-gray-800">
        Distance included
      </div>
      <div className="border-b border-gray-100 mt-5 shadow-sm"></div>
      <div className="mt-8">
        <p className=" text-lg font-medium text-gray-800">
          Daily distance included
        </p>
        <p className="mt-2">
          Decide how far you’ll allow your guests to drive — the minimum
          distance per day is determined based on the value of your vehicle.
          Higher value vehicles that qualify for Deluxe and Super Deluxe Class
          can set lower daily distances.
        </p>
        <p className="mt-2 text-violet-500 font-medium">
          How daily distance calculated?
        </p>
        <div className="mt-5">
          <p className=" text-sm mb-1">Km included per day</p>
          <div className="flex">
            <NativeSelect
              // leftSection={<p className="">km</p>}
              value={distance}
              onChange={(data) => handleChangeDistance(data)}
              data={optionsDistance}
              styles={{
                input: {
                  color: "black",
                  width: "180px",
                },
              }}
            />
          </div>
        </div>
        <div className="mt-8">
          <p className=" text-lg font-medium text-gray-800">
            Additional distance fee
          </p>
          <p className="mt-2">
            If your guest drives farther than the distance included, they’ll be
            charged a fee per mile calculated using your daily price.
          </p>
          <p className="mt-2 text-violet-500 font-medium">
            How additional distance calculated?
          </p>
        </div>
        <div className="mt-8 text-right">
          <button
            className={`${
              isChanged
                ? "border-green-300"
                : "border-gray-300 cursor-not-allowed"
            } border rounded-md px-8 py-2`}
            disabled={!isChanged}
            onClick={handleDistanceSubmit}
          >
            Save
          </button>
          {saved && (
            <span className="text-green-500 font-medium text-sm animate-fade-in pl-2">
              ✓ Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
export default Distance;
