import { Link, useParams } from "react-router-dom";
import { useCarContext } from "@/context/carContext";

const Extras = () => {
  const { carId } = useParams();

  const { extras } = useCarContext();

  return (
    <div className="mb-4 w-full xl:max-w-2xl">
      <h1 className="font-roboto text-xl md:text-2xl font-medium">Extra</h1>
      <div className="border-b border-gray-100 mt-5 shadow-sm"></div>

      <div className="mt-5">
        <p className="mt-2 text-gray-600">
          Offering extra equipment and service is a great way to earn more and
          help renters.
        </p>
        {extras
          .filter((e) => e.meta.is_active)
          .map((e) => (
            <Link
              key={e.extra_id}
              to={{
                pathname: `/cars/${carId}/extra/${e.extra_id}`,
              }}
            >
              <div
                className={`${
                  e.is_available
                    ? "border-green-300 bg-green-50/10"
                    : " hover:border-gray-400/50"
                } border rounded-3xl h-20 flex items-center mt-5 `}
              >
                <div className="ml-8 text-left">
                  <p className="font-medium">{e.meta?.name}</p>
                  <div className="inline-flex">
                    <p
                      className={`${
                        e.is_available ? "text-green-500" : ""
                      } text-gray-500`}
                    >
                      {e.is_available ? "On" : "Off"}
                    </p>
                  </div>
                </div>
                {e.is_available && (
                  <div className="ml-auto mr-8 font-medium text-lg">
                    <span>
                      {e.price} € /{" "}
                      {e.meta.price_type === "per_day"
                        ? "day"
                        : e.meta.price_type === "per_unit"
                        ? "unit"
                        : "rental"}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          ))}
      </div>
    </div>
  );
};

export default Extras;
