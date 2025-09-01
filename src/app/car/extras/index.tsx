// src/app/car/extras/Extras.tsx
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QK } from "@/queryKeys";
import { fetchExtras, fetchCarExtras } from "@/services/car.service";
import { useCarContext } from "@/context/carContext";
import type { CarExtraWithMeta } from "@/types/carExtra";
import { useMemo } from "react";
import { useCarExtrasRealtimeRQ } from "@/hooks/useCarExtrasRealtime";
// import { useCarExtrasRealtimeRQ } from "@/realtime/useCarExtrasRealtimeRQ";

export default function Extras() {
  const { car } = useCarContext();
  const { carId: routeCarId } = useParams();
  const carId = String(car?.id ?? routeCarId ?? "");

  // Realtime для таблицы car_extras
  useCarExtrasRealtimeRQ(carId || null);

  // Все активные extras (справочник)
  const { data: allExtras = [] } = useQuery({
    queryKey: QK.extras,
    queryFn: fetchExtras, // -> Extra[]
    staleTime: 5 * 60_000,
  });

  // Только extras, подключённые к машине (с ценами)
  const { data: carExtras = [] } = useQuery({
    queryKey: QK.carExtras(carId),
    queryFn: () => fetchCarExtras(carId),
    enabled: !!carId,
    staleTime: 30_000, // ✅ считаем кэш моментально несвежим
    refetchOnMount: "always", // ✅ принудительно рефетчим на маунте
  });

  // Мерджим: полный список показываем всегда, помечая включённые/выключенные
  const merged: CarExtraWithMeta[] = useMemo(() => {
    const map = new Map(carExtras.map((e) => [e.extra_id, e]));
    return allExtras
      .filter((e) => e.is_active) // только активные в справочнике
      .map((meta) => {
        const enabled = map.get(meta.id);
        return {
          extra_id: meta.id,
          price: enabled ? enabled.price : 0,
          is_available: Boolean(enabled),
          meta: {
            id: meta.id,
            name: meta.name,
            description: meta.description,
            price_type: meta.price_type,
            is_active: meta.is_active,
          },
        } as CarExtraWithMeta;
      });
  }, [allExtras, carExtras]);

  return (
    <div className="mb-4 w-full xl:max-w-2xl">
      <h1 className="font-semibold text-2xl text-gray-800">Extra</h1>
      <div className="border-b border-gray-100 mt-5 shadow-sm"></div>

      <div className="mt-5">
        <p className="mt-2 text-gray-600">
          Offering extra equipment and service is a great way to earn more and
          help renters.
        </p>

        {merged.map((e) => (
          <Link key={e.extra_id} to={`/cars/${carId}/extra/${e.extra_id}`}>
            <div
              className={`${
                e.is_available
                  ? "border-green-300 bg-green-50/10"
                  : "hover:border-gray-400/50"
              } border rounded-3xl h-20 flex items-center mt-5`}
            >
              <div className="ml-8 text-left">
                <p className="font-medium">{e.meta.name}</p>
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
}

// import { Link, useParams } from "react-router-dom";
// import { useCarContext } from "@/context/carContext";

// const Extras = () => {
//   const { carId } = useParams();

//   const { extras } = useCarContext();

//   return (
//     <div className="mb-4 w-full xl:max-w-2xl">
//       <h1 className="font-semibold text-2xl text-gray-800">Extra</h1>
//       <div className="border-b border-gray-100 mt-5 shadow-sm"></div>

//       <div className="mt-5">
//         <p className="mt-2 text-gray-600">
//           Offering extra equipment and service is a great way to earn more and
//           help renters.
//         </p>
//         {extras
//           .filter((e) => e.meta.is_active)
//           .map((e) => (
//             <Link
//               key={e.extra_id}
//               to={{
//                 pathname: `/cars/${carId}/extra/${e.extra_id}`,
//               }}
//             >
//               <div
//                 className={`${
//                   e.is_available
//                     ? "border-green-300 bg-green-50/10"
//                     : " hover:border-gray-400/50"
//                 } border rounded-3xl h-20 flex items-center mt-5 `}
//               >
//                 <div className="ml-8 text-left">
//                   <p className="font-medium">{e.meta?.name}</p>
//                   <div className="inline-flex">
//                     <p
//                       className={`${
//                         e.is_available ? "text-green-500" : ""
//                       } text-gray-500`}
//                     >
//                       {e.is_available ? "On" : "Off"}
//                     </p>
//                   </div>
//                 </div>
//                 {e.is_available && (
//                   <div className="ml-auto mr-8 font-medium text-lg">
//                     <span>
//                       {e.price} € /{" "}
//                       {e.meta.price_type === "per_day"
//                         ? "day"
//                         : e.meta.price_type === "per_unit"
//                         ? "unit"
//                         : "rental"}
//                     </span>
//                   </div>
//                 )}
//               </div>
//             </Link>
//           ))}
//       </div>
//     </div>
//   );
// };

// export default Extras;
