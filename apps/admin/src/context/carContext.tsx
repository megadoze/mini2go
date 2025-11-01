import { createContext, useContext } from "react";
import type { CarWithModelRelations } from "@/types/carWithModelRelations";
import type { CarExtraWithMeta } from "@/types/carExtra";
import type { PricingRule, SeasonalRate } from "@/services/pricing.service";
import type { AppSettings } from "@/types/setting";

type CarContextType = {
  car: CarWithModelRelations;
  setCar: React.Dispatch<React.SetStateAction<CarWithModelRelations>>;
  parkingAddress: string;
  setParkingAddress: React.Dispatch<React.SetStateAction<string>>;
  parkingCoords: { latitude: number; longitude: number };
  setCoords: (coords: { latitude: number; longitude: number }) => void;
  pickupInfo: { pickupInfo: string; returnInfo: string };
  setPickupInfo: (info: { pickupInfo: string; returnInfo: string }) => void;
  isDelivery: boolean;
  setIsDelivery: (isDelivery: boolean) => void;
  deliveryFee: number;
  setDeliveryFee: (deliveryFee: number) => void;
  includeMileage: number;
  setIncludeMileage: (includeMileage: number) => void;
  extras: CarExtraWithMeta[];
  setExtras: React.Dispatch<React.SetStateAction<CarExtraWithMeta[]>>;
  pricingRules: PricingRule[];
  setPricingRules: React.Dispatch<React.SetStateAction<PricingRule[]>>;
  seasonalRates: SeasonalRate[];
  setSeasonalRates: React.Dispatch<React.SetStateAction<SeasonalRate[]>>;
  getCachedUser?: (id: string) => any | undefined;
  setCachedUser?: (id: string, u: any) => void;

  refreshPricingData: () => Promise<void>; // ручной рефреш

  // ===== Новое: глобальные настройки =====
  globalSettings: AppSettings | null;

  // ===== Новое: effective-значения (car override -> иначе global) =====
  effectiveCurrency?: string;
  effectiveOpenTime?: number;
  effectiveCloseTime?: number;
  effectiveMinRentPeriod?: number;
  effectiveMaxRentPeriod?: number;
  effectiveIntervalBetweenBookings?: number;
  effectiveAgeRenters?: number;
  effectiveMinDriverLicense?: number;
  effectiveIsInstantBooking?: boolean;
  effectiveIsSmoking?: boolean;
  effectiveIsPets?: boolean;
  effectiveIsAbroad?: boolean;

  // ===== Новое: состояния загрузки =====
  loadingCar: boolean;
  loadingGlobal: boolean;

  // ===== Новое: рефрешеры =====
  refreshCar: () => Promise<void>;
  refreshGlobal: () => Promise<void>;

  // Полезный флаг
  hasGlobalSettings: boolean;
};

export const CarContext = createContext<CarContextType | null>(null);

export function useCarContext() {
  const context = useContext(CarContext);
  if (!context)
    throw new Error("useCarContext must be used within CarContext.Provider");
  return context;
}
