import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useParams, useLoaderData } from "react-router-dom";
import { AppShell, Burger } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  ChartBarSquareIcon,
  DocumentTextIcon,
  FireIcon,
  RocketLaunchIcon,
  UserGroupIcon,
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
import {
  fetchCarById,
  fetchExtras,
  fetchCarExtras,
} from "@/services/car.service";

type LoaderData = {
  car: CarWithModelRelations;
  globalSettings: AppSettings;
  extras: CarExtraWithMeta[];
  pricingRules: PricingRule[];
  seasonalRates: SeasonalRate[];
};

export default function CarPageLayout() {
  const [opened, { toggle }] = useDisclosure();

  const { id } = useParams();

  // 1) Берём данные из loader
  const {
    car: loaderCar,
    globalSettings: loaderGS,
    extras: loaderExtras,
    pricingRules: loaderPR,
    seasonalRates: loaderSR,
  } = useLoaderData() as LoaderData;

  // 2) Инициализируем локальные стейты уже заполненными значениями
  const [car, setCar] = useState<CarWithModelRelations>(loaderCar);
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
  const [pickupInfo, setPickupInfo] = useState({
    pickupInfo: loaderCar.pickupInfo,
    returnInfo: loaderCar.returnInfo,
  });
  const [isDelivery, setIsDelivery] = useState(loaderCar.isDelivery);
  const [deliveryFee, setDeliveryFee] = useState(loaderCar.deliveryFee);
  const [includeMileage, setIncludeMileage] = useState(
    loaderCar.includeMileage
  );

  // 3) Флаги загрузки — false, т.к. первичная загрузка уже выполнена в loader
  const [loadingCar, setLoadingCar] = useState(false);
  const [loadingGlobal, setLoadingGlobal] = useState(false);

  const getCarId = () => String((car as any)?.id ?? id);

  useEffect(() => {
    // основные сущности
    setCar(loaderCar);
    setGlobalSettings(loaderGS);
    setExtras(loaderExtras);
    setPricingRules(loaderPR);
    setSeasonalRates(loaderSR);

    // производные от car
    setParkingAddress(loaderCar.address);

    setCoords({
      latitude: loaderCar.lat ?? 0,
      longitude: loaderCar.long ?? 0,
    });

    setPickupInfo({
      pickupInfo: loaderCar.pickupInfo,
      returnInfo: loaderCar.returnInfo,
    });
    setIsDelivery(loaderCar.isDelivery);
    setDeliveryFee(loaderCar.deliveryFee);
    setIncludeMileage(loaderCar.includeMileage);
  }, [loaderCar, loaderGS, loaderExtras, loaderPR, loaderSR]);

  // 4) Мягкие рефетчи (опционально)
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
      const data = await fetchCarById(carId);
      setCar(data);
      setParkingAddress(data.address);
      setCoords({ latitude: data.lat, longitude: data.long });
      setPickupInfo({
        pickupInfo: data.pickupInfo,
        returnInfo: data.returnInfo,
      });
      setIsDelivery(data.isDelivery);
      setDeliveryFee(data.deliveryFee);
      setIncludeMileage(data.includeMileage);

      // синхронизируем extras при ручном обновлении
      const allExtras = await fetchExtras();
      const carExtras = await fetchCarExtras(carId);
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

  // 5) Ваши пункты меню — без изменений
  const menuItems = useMemo(
    () => [
      {
        to: "cardetails",
        icon: <ChartBarSquareIcon className="size-5" />,
        label: "Car Details",
        exact: true,
        onClick: toggle,
      },
      {
        to: "calendar",
        icon: <FireIcon className="size-5" />,
        label: "Calendar",
        onClick: toggle,
      },
      {
        to: "pricing",
        icon: <RocketLaunchIcon className="size-5" />,
        label: "Pricing",
        onClick: toggle,
      },
      {
        to: "distance",
        icon: <RocketLaunchIcon className="size-5" />,
        label: "Distance",
        onClick: toggle,
      },
      {
        to: "photos",
        icon: <RocketLaunchIcon className="size-5" />,
        label: "Photos",
        onClick: toggle,
      },
      {
        to: "extra",
        icon: <DocumentTextIcon className="size-5" />,
        label: "Extra",
        onClick: toggle,
      },
      {
        to: "location",
        icon: <UserGroupIcon className="size-5" />,
        label: "Location & delivery",
        onClick: toggle,
      },
      {
        to: "settings",
        icon: <UserGroupIcon className="size-5" />,
        label: "Booking settings",
        onClick: toggle,
      },
    ],
    [toggle]
  );

  const SidebarMenu = () => (
    <>
      {/* Мини-карточка — рендерится сразу, car уже есть */}
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
          <p className="pt-1 text-sm">{car?.status}</p>
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

  // 6) Effective (как у тебя)
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
          className="ml-1 flex px-3 py-2 items-center font-openSans font-black text-2xl"
        >
          MINI2go
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
        {/* car уже гарантированно есть */}
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
            ...effective,
          }}
        >
          <Outlet />
        </CarContext.Provider>
      </AppShell.Main>
    </AppShell>
  );
}
