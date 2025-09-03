import { useCarContext } from "@/context/carContext";
import { Link } from "react-router-dom";

const Location = () => {
  const { car, parkingAddress, isDelivery } = useCarContext();

  if (!car) return null;

  return (
    <div className="mb-4 w-full xl:max-w-2xl">
      <div className="font-roboto text-xl md:text-2xl font-medium">
        Location & delivery
      </div>
      <div className="border-b border-gray-100 mt-5 shadow-sm"></div>
      <div id="location">
        <div className="mt-5">
          <p className="text-lg font-medium text-gray-800">Location</p>
          <p className="mt-2 text-gray-600">
            Where your car is normally parked, parking space and instructions.
          </p>
          <p className="mt-2 text-fuchsia-800 font-medium">
            Instruction for location?
          </p>
          <Link
            to={{
              pathname: `/cars/${car.id}/location/parking`,
            }}
          >
            <div className="border rounded-3xl h-20 flex items-center mt-5 hover:border-gray-400">
              <p className="pl-5 line-clamp-2">
                {parkingAddress ?? "Set the location of your car"}
              </p>
              <p className="ml-auto mr-5 text-fuchsia-700">Change</p>
            </div>
          </Link>
        </div>
        <div className="mt-5">
          <p className="text-lg font-medium text-gray-800">Delivery</p>
          <p className="mt-2">
            Earn more by offering to deliver and collect your car at a location
            of the renter’s choosing.
          </p>
          <p className="mt-2 text-fuchsia-800 font-medium">
            Instruction for delivery?
          </p>
          <Link
            to={{
              pathname: `/cars/${car.id}/location/delivery`,
            }}
          >
            <div className="border rounded-3xl h-20 flex items-center mt-5 hover:border-gray-400">
              <div className="ml-5 text-left">
                <p className="font-medium">Delivery to guest location </p>
                <p
                  className={`${
                    isDelivery ? "text-green-500" : ""
                  } text-gray-500`}
                >
                  {isDelivery ? "On" : "Off"}
                </p>
              </div>
              <div className="ml-auto mr-5 text-fuchsia-700">Change</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Location;
