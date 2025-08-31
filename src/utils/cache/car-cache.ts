// src/cache/patchCarCaches.ts
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { QK } from "@/queryKeys";

// единый предикат для списков машин
const isCarsListKey = (key: QueryKey) =>
  Array.isArray(key) && (key[0] === QK.cars[0] || key[0] === "carsList");

const isCarsByHostKey = (key: QueryKey) =>
  Array.isArray(key) && key[0] === "carsByHost";

export type CarPatch = Partial<any>;

/** Мгновенно пропатчить авто во всех местах кэша */
export function patchCarCaches(
  qc: QueryClient,
  carId: string,
  patch: CarPatch
) {
  if (!carId) return;

  // 1) детальная карточка
  qc.setQueryData(QK.car(carId), (prev: any) =>
    prev ? { ...prev, ...patch } : prev
  );

  // 2) любые списки авто
  qc.setQueriesData(
    {
      predicate: (q) =>
        isCarsListKey(q.queryKey) || isCarsByHostKey(q.queryKey),
    },
    (list: any[] | undefined) =>
      Array.isArray(list)
        ? list.map((c) =>
            String(c.id) === String(carId) ? { ...c, ...patch } : c
          )
        : list
  );

  // 3) окна большого календаря (если где-то показывается info об авто)
  qc.setQueriesData(
    {
      predicate: (q) =>
        Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
    },
    (win: any) =>
      !win
        ? win
        : {
            ...win,
            cars: (win.cars ?? []).map((c: any) =>
              String(c.id) === String(carId) ? { ...c, ...patch } : c
            ),
          }
  );
}

/** Удалить авто из всех мест кэша */
export function removeCarEverywhere(qc: QueryClient, carId: string) {
  if (!carId) return;

  // 1) убрать детальную запись
  qc.removeQueries({ queryKey: QK.car(carId), exact: true });

  // 2) убрать из любых списков машин
  qc.setQueriesData(
    {
      predicate: (q) =>
        isCarsListKey(q.queryKey) || isCarsByHostKey(q.queryKey),
    },
    (list: any[] | undefined) =>
      Array.isArray(list)
        ? list.filter((c) => String(c.id) !== String(carId))
        : list
  );

  // 3) убрать из активных окон календаря
  qc.setQueriesData(
    {
      predicate: (q) =>
        Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
    },
    (win: any) =>
      !win
        ? win
        : {
            ...win,
            cars: (win.cars ?? []).filter(
              (c: any) => String(c.id) !== String(carId)
            ),
          }
  );

  // 4) привязанные к авто ресурсы
  qc.removeQueries({ queryKey: QK.carExtras(carId), exact: true }); // extras (если есть)
  // если у тебя есть ключ фич: QK.carFeatures

  qc.removeQueries({ queryKey: QK.carFeatures?.(carId), exact: true });

  // 5) связанные брони по машине
  qc.removeQueries({ queryKey: QK.bookingsByCarId(carId), exact: true });
}

/** Опционально подтянуть консистентность после optimistic-патча */
export function invalidateCarEverywhere(qc: QueryClient, carId: string) {
  qc.invalidateQueries({ queryKey: QK.car(carId) });
  qc.invalidateQueries({
    predicate: (q) => isCarsListKey(q.queryKey) || isCarsByHostKey(q.queryKey),
  });
  qc.invalidateQueries({
    predicate: (q) =>
      Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
  });
  qc.invalidateQueries({ queryKey: QK.carExtras(carId) });
  // если есть ключ фич:

  qc.invalidateQueries({ queryKey: QK.carFeatures?.(carId) });
  qc.invalidateQueries({ queryKey: QK.bookingsByCarId(carId) });
}
