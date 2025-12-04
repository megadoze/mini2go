// src/utils/cache/car-cache.ts  (или твой путь)
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { QK } from "@/queryKeys";

const isCarsListKey = (key: QueryKey) =>
  Array.isArray(key) && (key[0] === QK.cars[0] || key[0] === "carsList");

const isCarsByHostKey = (key: QueryKey) =>
  Array.isArray(key) && key[0] === "carsByHost";

const isCarsInfiniteKey = (key: QueryKey) =>
  Array.isArray(key) && key[0] === "carsInfinite";

const isAdminCarsKey = (key: QueryKey) =>
  Array.isArray(key) && key[0] === "adminCars";

export type CarPatch = Partial<any>;

// ===== helpers: универсальная правка/удаление для разных форматов =====
const idNE = (carId: string) => (c: any) => String(c?.id) !== String(carId);
const applyPatch = (carId: string, patch: any) => (c: any) =>
  String(c?.id) === String(carId) ? { ...c, ...patch } : c;

function removeFromListLike(list: any, carId: string) {
  if (!list) return list;

  if (Array.isArray(list)) return list.filter(idNE(carId));
  if (Array.isArray(list.items))
    return { ...list, items: list.items.filter(idNE(carId)) };
  if (Array.isArray(list.data))
    return { ...list, data: list.data.filter(idNE(carId)) };
  if (Array.isArray(list.rows))
    return { ...list, rows: list.rows.filter(idNE(carId)) };
  if (Array.isArray(list.results))
    return { ...list, results: list.results.filter(idNE(carId)) };

  return list;
}

function patchInListLike(list: any, carId: string, patch: any) {
  if (!list) return list;

  if (Array.isArray(list)) return list.map(applyPatch(carId, patch));
  if (Array.isArray(list.items))
    return { ...list, items: list.items.map(applyPatch(carId, patch)) };
  if (Array.isArray(list.data))
    return { ...list, data: list.data.map(applyPatch(carId, patch)) };
  if (Array.isArray(list.rows))
    return { ...list, rows: list.rows.map(applyPatch(carId, patch)) };
  if (Array.isArray(list.results))
    return { ...list, results: list.results.map(applyPatch(carId, patch)) };

  return list;
}

// ================== PATCH ==================
export function patchCarCaches(
  qc: QueryClient,
  carId: string,
  patch: CarPatch
) {
  if (!carId) return;

  // детальная карточка
  qc.setQueryData(QK.car(carId), (prev: any) =>
    prev ? { ...prev, ...patch } : prev
  );

  // cars / carsList / carsByHost / adminCars
  qc.setQueriesData(
    {
      predicate: (q) =>
        isCarsListKey(q.queryKey) ||
        isCarsByHostKey(q.queryKey) ||
        isAdminCarsKey(q.queryKey),
    },
    (old: any) => {
      if (!old) return old;
      if (old.pages) {
        return {
          ...old,
          pages: old.pages.map((p: any) => patchInListLike(p, carId, patch)),
        };
      }
      return patchInListLike(old, carId, patch);
    }
  );

  // calendarWindow
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
            cars: Array.isArray(win.cars)
              ? win.cars.map(applyPatch(carId, patch))
              : win.cars,
          }
  );

  // carsInfinite (на всякий)
  qc.setQueriesData(
    { predicate: (q) => isCarsInfiniteKey(q.queryKey) },
    (old: any) =>
      !old?.pages
        ? old
        : {
            ...old,
            pages: old.pages.map((p: any) => patchInListLike(p, carId, patch)),
          }
  );
}

// ================== REMOVE ==================
export function removeCarEverywhere(qc: QueryClient, carId: string) {
  if (!carId) return;

  // деталька
  qc.removeQueries({ queryKey: QK.car(carId), exact: true });

  // cars / carsList / carsByHost
  qc.setQueriesData(
    {
      predicate: (q) =>
        isCarsListKey(q.queryKey) || isCarsByHostKey(q.queryKey),
    },
    (old: any) => {
      if (!old) return old;
      // ВАЖНО: поддержка infinite-формы у carsByHost -> { pages: [...] }
      if (old.pages) {
        return {
          ...old,
          pages: old.pages.map((p: any) => removeFromListLike(p, carId)),
        };
      }
      // обычные списки
      return removeFromListLike(old, carId);
    }
  );

  // calendarWindow
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
            cars: Array.isArray(win.cars)
              ? win.cars.filter(idNE(carId))
              : win.cars,
          }
  );

  // carsInfinite (на всякий, если где-то используется)
  qc.setQueriesData(
    { predicate: (q) => isCarsInfiniteKey(q.queryKey) },
    (old: any) =>
      !old?.pages
        ? old
        : {
            ...old,
            pages: old.pages.map((p: any) => removeFromListLike(p, carId)),
          }
  );

  // связанные ресурсы
  qc.removeQueries({ queryKey: QK.carExtras(carId), exact: true });
  if (QK.carFeatures)
    qc.removeQueries({ queryKey: QK.carFeatures(carId), exact: true });
  qc.removeQueries({ queryKey: QK.bookingsByCarId(carId), exact: true });
}

// ================== INVALIDATE (по желанию) ==================
export function invalidateCarEverywhere(qc: QueryClient, carId: string) {
  qc.invalidateQueries({ queryKey: QK.car(carId) });

  qc.invalidateQueries({
    predicate: (q) => isCarsListKey(q.queryKey) || isCarsByHostKey(q.queryKey),
  });

  qc.invalidateQueries({
    predicate: (q) =>
      Array.isArray(q.queryKey) && q.queryKey[0] === "calendarWindow",
  });

  qc.invalidateQueries({
    predicate: (q) => isCarsInfiniteKey(q.queryKey),
  });

  qc.invalidateQueries({ queryKey: QK.carExtras(carId) });
  if (QK.carFeatures) qc.invalidateQueries({ queryKey: QK.carFeatures(carId) });
  qc.invalidateQueries({ queryKey: QK.bookingsByCarId(carId) });
}
