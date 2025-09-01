import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useParams, useLoaderData } from "react-router-dom";
import { AppShell, Burger } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  AdjustmentsHorizontalIcon,
  CalendarDateRangeIcon,
  CameraIcon,
  Cog8ToothIcon,
  CurrencyEuroIcon,
  MapIcon,
  MapPinIcon,
  SquaresPlusIcon,
} from "@heroicons/react/24/outline";
import UserMenu from "@/components/userMenu";
import { CarContext } from "@/context/carContext";
import type { CarWithModelRelations } from "@/types/carWithModelRelations";
import type { CarExtraWithMeta } from "@/types/carExtra";
import {
  fetchPricingRules,
  fetchSeasonalRates,
  type PricingRule,
  type SeasonalRate,
} from "@/app/car/pricing/pricing.service";
import { getGlobalSettings } from "@/services/settings.service";
import type { AppSettings } from "@/types/setting";
import { fetchCarById, fetchCarExtras } from "@/services/car.service";
import { fetchBookingsByCarId } from "@/app/car/calendar/calendar.service"; // ⬅️ добавлено
import { useQueryClient } from "@tanstack/react-query";
import { useCarsRealtime } from "@/hooks/useCarsRealtime";
import { useCarFeaturesRealtimeRQ } from "@/hooks/useCarFeaturesRealtime";
import { useCarExtrasRealtime } from "@/hooks/useCarExtrasRealtime";

type LoaderData = {
  car: CarWithModelRelations;
  globalSettings: AppSettings;
  extras: CarExtraWithMeta[];
  pricingRules: PricingRule[];
  seasonalRates: SeasonalRate[];
};

export default function CarPageLayout() {
  const [opened, { toggle }] = useDisclosure();
  const { carId } = useParams();

  const qc = useQueryClient();

  const userCache = useRef(new Map<string, any>());

  // 1) Из loader
  const {
    car: loaderCar,
    globalSettings: loaderGS,
    extras: loaderExtras,
    pricingRules: loaderPR,
    seasonalRates: loaderSR,
  } = useLoaderData() as LoaderData;

  // 2) Локальные состояния (с безопасными bookings)
  const [car, setCar] = useState<CarWithModelRelations>({
    ...loaderCar,
    bookings: (loaderCar as any)?.bookings ?? [],
  } as any);

  const [globalSettings, setGlobalSettings] = useState<AppSettings | null>(
    loaderGS
  );
  const [extras, setExtras] = useState<CarExtraWithMeta[]>(loaderExtras);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>(loaderPR);
  const [seasonalRates, setSeasonalRates] = useState<SeasonalRate[]>(loaderSR);

  const [parkingAddress, setParkingAddress] = useState<string>(
    loaderCar.address ?? ""
  );
  const [parkingCoords, setCoords] = useState<{
    latitude: number;
    longitude: number;
  }>({
    latitude: loaderCar.lat ?? 0,
    longitude: loaderCar.long ?? 0,
  });
  // console.log(parkingCoords);

  const [pickupInfo, setPickupInfo] = useState({
    pickupInfo: loaderCar.pickupInfo,
    returnInfo: loaderCar.returnInfo,
  });
  const [isDelivery, setIsDelivery] = useState(loaderCar.isDelivery);
  const [deliveryFee, setDeliveryFee] = useState(loaderCar.deliveryFee);
  const [includeMileage, setIncludeMileage] = useState(
    loaderCar.includeMileage
  );

  // 3) Флаги загрузки
  const [loadingCar, setLoadingCar] = useState(false);
  const [loadingGlobal, setLoadingGlobal] = useState(false);

  const getCarId = () => String((car as any)?.id ?? carId);

  useCarFeaturesRealtimeRQ(carId || null);
  useCarExtrasRealtime(carId ?? null, setExtras);

  useCarsRealtime((id, patch) => {
    const currentId = String(car?.id ?? carId ?? "");
    if (!currentId || String(id) !== currentId) return;

    //   // Обновляем объект авто в контексте
    setCar((prev: any) => (prev ? { ...prev, ...patch } : prev));

    //   // Точечно синкаем поля, которые у тебя лежат отдельными стейтами
    if ("includeMileage" in patch) setIncludeMileage(patch.includeMileage);
    if ("isDelivery" in patch) setIsDelivery(patch.isDelivery);
    if ("deliveryFee" in patch) setDeliveryFee(patch.deliveryFee);
    if ("address" in patch) setParkingAddress(patch.address ?? "");
    if ("lat" in patch || "long" in patch) {
      setCoords({
        latitude: patch.lat ?? parkingCoords.latitude,
        longitude: patch.long ?? parkingCoords.longitude,
      });
    }
  });

  // Синхронизация из loader без перетирания bookings
  useEffect(() => {
    setCar((prev) => ({
      ...prev,
      ...loaderCar,
      bookings: (loaderCar as any)?.bookings ?? prev.bookings ?? [],
    }));
    setGlobalSettings(loaderGS);
    setExtras(loaderExtras);
    setPricingRules(loaderPR);
    setSeasonalRates(loaderSR);

    setParkingAddress(loaderCar.address);
    setCoords({ latitude: loaderCar.lat ?? 0, longitude: loaderCar.long ?? 0 });
    setPickupInfo({
      pickupInfo: loaderCar.pickupInfo,
      returnInfo: loaderCar.returnInfo,
    });
    setIsDelivery(loaderCar.isDelivery);
    setDeliveryFee(loaderCar.deliveryFee);
    setIncludeMileage(loaderCar.includeMileage);
  }, [loaderCar?.id, loaderGS, loaderExtras, loaderPR, loaderSR]);

  // 4) Рефетчи
  const refreshPricingData = async () => {
    const carId = getCarId();
    if (!carId) return;
    const [rules, seasons] = await Promise.all([
      fetchPricingRules(carId),
      fetchSeasonalRates(carId),
    ]);
    setPricingRules(rules);
    setSeasonalRates(seasons);
  };

  const refreshGlobal = async () => {
    setLoadingGlobal(true);
    try {
      const gs = await getGlobalSettings();
      setGlobalSettings(gs);
    } finally {
      setLoadingGlobal(false);
    }
  };

  const refreshCar = async () => {
    const carId = getCarId();
    if (!carId) return;
    setLoadingCar(true);
    try {
      const [data, bookings, carExtras] = await Promise.all([
        fetchCarById(carId),
        fetchBookingsByCarId(carId), // ⬅️ тянем брони вместе с машиной
        fetchCarExtras(carId),
      ]);

      setCar((prev) => ({
        ...prev,
        ...data,
        bookings: bookings ?? prev.bookings ?? [],
      }));

      setParkingAddress(data.address);
      setCoords({ latitude: data.lat, longitude: data.long });
      setPickupInfo({
        pickupInfo: data.pickupInfo,
        returnInfo: data.returnInfo,
      });
      setIsDelivery(data.isDelivery);
      setDeliveryFee(data.deliveryFee);
      setIncludeMileage(data.includeMileage);

      const allExtras = qc.getQueryData<any[]>(["extras"]) ?? [];
      const extrasWithState = allExtras.map((extra) => {
        const match = carExtras.find((ce) => ce.extra_id === extra.id);
        return {
          extra_id: extra.id,
          price: match?.price ?? 0,
          is_available: !!match,
          meta: extra,
        };
      });
      setExtras(extrasWithState);
    } finally {
      setLoadingCar(false);
    }
  };

  // 5) Меню
  const menuItems = useMemo(
    () => [
      {
        to: "cardetails",
        icon: <Cog8ToothIcon className="size-5" />,
        label: "Car Details",
        exact: true,
        onClick: toggle,
      },
      {
        to: "calendar",
        icon: <CalendarDateRangeIcon className="size-5" />,
        label: "Calendar",
        onClick: toggle,
      },
      {
        to: "pricing",
        icon: <CurrencyEuroIcon className="size-5" />,
        label: "Pricing",
        onClick: toggle,
      },
      {
        to: "distance",
        icon: <MapIcon className="size-5" />,
        label: "Distance",
        onClick: toggle,
      },
      {
        to: "photos",
        icon: <CameraIcon className="size-5" />,
        label: "Photos",
        onClick: toggle,
      },
      {
        to: "extra",
        icon: <SquaresPlusIcon className="size-5" />,
        label: "Extra",
        onClick: toggle,
      },
      {
        to: "location",
        icon: <MapPinIcon className="size-5" />,
        label: "Location & delivery",
        onClick: toggle,
      },
      {
        to: "settings",
        icon: <AdjustmentsHorizontalIcon className="size-5" />,
        label: "Booking settings",
        onClick: toggle,
      },
    ],
    [toggle]
  );

  const SidebarMenu = () => (
    <>
      <div className="flex items-center gap-3">
        <img
          src={car?.photos?.[0]}
          alt=""
          className="rounded-full w-20 h-20 object-cover object-left"
        />
        <div>
          <p className="font-medium leading-4">
            {car?.model?.brands?.name} {car?.model?.name}
          </p>
          <p className="mt-2 px-1 rounded-sm border border-black w-fit text-sm">
            {car.licensePlate}
          </p>
          <p
            className={`text-sm pt-1 ${
              car.status === "available" ? "text-green-500" : "text-zinc-500"
            }`}
          >
            ◉ {car.status}
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-1 text-left mt-5">
        {menuItems.map(({ to, icon, label, exact, onClick }) => (
          <li key={to} className="rounded-md hover:bg-zinc-100 cursor-pointer">
            <NavLink
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex w-full h-full items-center justify-between p-3 ${
                  isActive ? "bg-zinc-100 rounded-md" : ""
                }`
              }
              onClick={onClick}
            >
              <div className="flex items-center gap-2">
                {icon}
                {label}
              </div>
            </NavLink>
          </li>
        ))}
      </ul>
    </>
  );

  // 6) Effective
  const effective = useMemo(() => {
    if (!car || !globalSettings) return {};
    const coalesce = <T,>(a: T | null | undefined, b: T) =>
      (a ?? undefined) !== undefined ? (a as T) : b;
    return {
      effectiveCurrency: coalesce(car.currency, globalSettings.currency),
      effectiveOpenTime: coalesce(car.openTime, globalSettings.openTime),
      effectiveCloseTime: coalesce(car.closeTime, globalSettings.closeTime),
      effectiveMinRentPeriod: coalesce(
        car.minRentPeriod,
        globalSettings.minRentPeriod
      ),
      effectiveMaxRentPeriod: coalesce(
        car.maxRentPeriod,
        globalSettings.maxRentPeriod
      ),
      effectiveIntervalBetweenBookings: coalesce(
        car.intervalBetweenBookings,
        globalSettings.intervalBetweenBookings
      ),
      effectiveAgeRenters: coalesce(car.ageRenters, globalSettings.ageRenters),
      effectiveMinDriverLicense: coalesce(
        car.minDriverLicense,
        globalSettings.minDriverLicense
      ),
      effectiveIsInstantBooking: coalesce(
        car.isInstantBooking,
        globalSettings.isInstantBooking
      ),
      effectiveIsSmoking: coalesce(car.isSmoking, globalSettings.isSmoking),
      effectiveIsPets: coalesce(car.isPets, globalSettings.isPets),
      effectiveIsAbroad: coalesce(car.isAbroad, globalSettings.isAbroad),
    };
  }, [car, globalSettings]);

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 300, breakpoint: "md", collapsed: { mobile: !opened } }}
      padding={{ base: "md", sm: "lg", md: "xl", lg: "xl" }}
    >
      <AppShell.Header className="flex items-center justify-between">
        <NavLink
          to={"/"}
          className="ml-3 flex items-center shrink-0 uppercase  gap-1"
        >
          <img src="/icons/logo.png" className=" w-11 opacity-90" />
          <p className=" text-black font-medium">MINI2GO</p>
        </NavLink>
        <Burger
          opened={opened}
          onClick={toggle}
          hiddenFrom="md"
          size="sm"
          mx={10}
        />
        <div className="hidden lg:block px-4">
          <UserMenu onClick={toggle} />
        </div>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <SidebarMenu />
        <div className="lg:hidden fixed bottom-0">
          <UserMenu onClick={toggle} />
        </div>
      </AppShell.Navbar>

      <AppShell.Main>
        <CarContext.Provider
          value={{
            car,
            setCar,
            parkingAddress,
            setParkingAddress,
            parkingCoords,
            setCoords,
            pickupInfo,
            setPickupInfo,
            isDelivery,
            setIsDelivery,
            deliveryFee,
            setDeliveryFee,
            includeMileage,
            setIncludeMileage,
            extras,
            setExtras,
            pricingRules,
            setPricingRules,
            seasonalRates,
            setSeasonalRates,
            refreshPricingData,
            globalSettings,
            loadingCar,
            loadingGlobal,
            refreshCar,
            refreshGlobal,
            hasGlobalSettings: Boolean(globalSettings),
            getCachedUser: (id) => userCache.current.get(id),
            setCachedUser: (id, u) => userCache.current.set(id, u),
            ...effective,
          }}
        >
          <Outlet />
        </CarContext.Provider>
      </AppShell.Main>
    </AppShell>
  );
}
