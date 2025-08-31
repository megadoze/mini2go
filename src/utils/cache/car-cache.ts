import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { QK } from "@/queryKeys";

// если у тебя другой ключ списка авто — поправь условие ниже
const isCarsListKey = (key: QueryKey) =>
  Array.isArray(key) && key[0] === "carsList";

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

  // 2) любые списки авто (carsList ...)
  qc.setQueriesData(
    { predicate: (q) => isCarsListKey(q.queryKey) },
    (list: any[] | undefined) =>
      Array.isArray(list)
        ? list.map((c) =>
            String(c.id) === String(carId) ? { ...c, ...patch } : c
          )
        : list
  );

  // 3) активные окна большого календаря
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

/** Ресурсы, «привязанные» к авто: экстра/локации/цены — заменяем полностью */
export function replaceCarExtras(
  qc: QueryClient,
  carId: string,
  extras: any[]
) {
  qc.setQueryData(QK.carExtras(carId), extras);
}

/** Опционально: подтянуть консистентность с сервера после optimistic-патча */
export function invalidateCarEverywhere(qc: QueryClient, carId: string) {
  qc.invalidateQueries({ queryKey: QK.car(carId) });
  qc.invalidateQueries({ predicate: (q) => isCarsListKey(q.queryKey) });
  qc.invalidateQueries({
    predicate: (q) =>
      Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
  });
  qc.invalidateQueries({ queryKey: QK.carExtras(carId) });
}
