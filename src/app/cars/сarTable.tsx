import type { CarWithRelations } from "@/types/carWithRelations";
import { highlightMatch } from "@/utils/highlightMatch";
import { NavLink } from "react-router-dom";

type Props = {
  cars: CarWithRelations[];
  search: string;
};

export default function CarListView({ cars, search }: Props) {
  return (
    <>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {cars.map((car) => (
          <NavLink
            key={car.id}
            to={`/cars/${car.id}`}
            className="block border border-gray-600 p-2 shadow-sm bg-white hover:shadow-md transition cursor-pointer relative"
          >
            <div className="flex gap-4 h-28">
              <div className="  ">
                {car.photos?.[0] ? (
                  <img
                    src={car.photos[0]}
                    alt="Фото авто"
                    className=" w-40 h-28 object-cover"
                  />
                ) : (
                  <div className="w-40 h-full bg-gray-100 rounded-md flex items-center justify-center">
                    —
                  </div>
                )}
              </div>

              <div className=" flex-1">
                <p className="font-bold text-base leading-5">
                  {highlightMatch(car.models?.brands?.name, search)}{" "}
                  {highlightMatch(car.models?.name, search)}
                </p>
                <p className=" border border-black text-black font-medium px-1 w-fit text-sm  mt-1">
                  {highlightMatch(car.licensePlate ?? "", search)}
                </p>
                <p className="text-sm text-zinc-600 pt-1">
                  {car.locations?.name}
                </p>
                <p
                  className={`text-sm leading-6 ${
                    car.status === "available"
                      ? "text-lime-500"
                      : "text-zinc-500"
                  }`}
                >
                  ◉ {car.status}
                </p>
              </div>
            </div>
          </NavLink>
        ))}
      </div>
    </>
  );
}
