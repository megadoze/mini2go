// src/app/car/CarPageLayout.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useParams, useLoaderData } from "react-router-dom";
import { AppShell, Burger, Drawer } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
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
} from "@/services/pricing.service";
import { getGlobalSettings } from "@/services/settings.service";
import type { AppSettings } from "@/types/setting";
import {
  fetchCarById,
  fetchCarExtras,
  fetchExtras,
} from "@/services/car.service";
import { fetchBookingsByCarId } from "@/services/calendar.service";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCarsRealtime } from "@/hooks/useCarsRealtime";
import { useCarFeaturesRealtimeRQ } from "@/hooks/useCarFeaturesRealtime";
import { useCarExtrasRealtime } from "@/hooks/useCarExtrasRealtime";
import { QK } from "@/queryKeys";
import { supabase } from "@/lib/supabase";

type LoaderData = {
  car: CarWithModelRelations;
  globalSettings: AppSettings | null; // может быть null для гостя
  extras: CarExtraWithMeta[];
  pricingRules: PricingRule[];
  seasonalRates: SeasonalRate[];
};

export default function CarPageLayout() {
  const [opened, { toggle }] = useDisclosure();
  const { carId: routeCarId } = useParams();
  const isMobile = useMediaQuery("(max-width: 48em)");
  const qc = useQueryClient();
  const userCache = useRef(new Map<string, any>());

  // ----- loader -----
  const {
    car: loaderCar,
    globalSettings: loaderGS,
    extras: loaderExtras,
    pricingRules: loaderPR,
    seasonalRates: loaderSR,
  } = useLoaderData() as LoaderData;

  // Один стабильный id для экрана
  const currentCarId = String(routeCarId ?? loaderCar?.id ?? "");

  // ----- локальные стейты -----
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
  const [pickupInfo, setPickupInfo] = useState({
    pickupInfo: loaderCar.pickupInfo,
    returnInfo: loaderCar.returnInfo,
  });
  const [isDelivery, setIsDelivery] = useState(loaderCar.isDelivery);
  const [deliveryFee, setDeliveryFee] = useState(loaderCar.deliveryFee);
  const [includeMileage, setIncludeMileage] = useState(
    loaderCar.includeMileage
  );

  const [loadingCar, setLoadingCar] = useState(false);
  const [loadingGlobal, setLoadingGlobal] = useState(false);

  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setOwnerId(data.user?.id ?? null));
  }, []);

  // справочник экстр
  const extrasQ = useQuery({
    queryKey: QK.extras,
    queryFn: fetchExtras,
    staleTime: 5 * 60_000,
  });

  const gsQ = useQuery({
    queryKey: QK.appSettingsByOwner(ownerId!),
    queryFn: () => getGlobalSettings(ownerId!), // твоя версия с обязательным ownerId
    enabled: !!ownerId,
    // хотим свежие данные при возврате на вкладку / заходе на страницу
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  useEffect(() => {
    if (gsQ.data !== undefined) {
      setGlobalSettings(gsQ.data ?? null);
    }
  }, [gsQ.data]);

  // экстры конкретной машины + бэкап-пуллинг
  const carExtrasQ = useQuery({
    queryKey: QK.carExtras(currentCarId),
    queryFn: () => fetchCarExtras(currentCarId),
    enabled: !!currentCarId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  // вместо onSuccess:
  useEffect(() => {
    const rows = carExtrasQ.data;
    const allExtras = extrasQ.data;

    if (!rows || !allExtras) return;

    const merged = allExtras
      .filter((x: any) => x.is_active)
      .map((meta: any) => {
        const hit = rows.find((r: any) => r.extra_id === meta.id);
        return {
          extra_id: meta.id,
          price: hit?.price ?? 0,
          is_available: !!hit,
          meta,
        };
      });

    setExtras((prev) => {
      const compact = (a: any[]) =>
        a.map((e) => ({ id: e.extra_id, p: e.price, on: e.is_available }));
      return JSON.stringify(compact(prev ?? [])) ===
        JSON.stringify(compact(merged))
        ? prev
        : merged;
    });
  }, [carExtrasQ.data, extrasQ.data, setExtras]);

  // ===== Realtime фичи/экстры/машина =====
  useCarFeaturesRealtimeRQ(currentCarId || null);

  useCarsRealtime((id, patch) => {
    if (!currentCarId || String(id) !== currentCarId) return;

    setCar((prev: any) => (prev ? { ...prev, ...patch } : prev));

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

  useCarExtrasRealtime(currentCarId || null, ({ type, row }) => {
    if (!row || !row.extra_id) return;
    setExtras((prev) => {
      if (!Array.isArray(prev)) return prev;
      if (type === "DELETE") {
        return prev.map((e) =>
          e.extra_id === row.extra_id
            ? { ...e, is_available: false, price: 0 }
            : e
        );
      }
      const nextPrice = Number(row.price ?? 0);
      return prev.map((e) =>
        e.extra_id === row.extra_id
          ? { ...e, is_available: true, price: nextPrice }
          : e
      );
    });
  });

  // ===== Синк из loader (без перетирания bookings) =====
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

  // ===== Рефетчи =====
  const refreshPricingData = async () => {
    if (!currentCarId) return;
    const [rules, seasons] = await Promise.all([
      fetchPricingRules(currentCarId),
      fetchSeasonalRates(currentCarId),
    ]);
    setPricingRules(rules);
    setSeasonalRates(seasons);
  };

  const refreshGlobal = async () => {
    setLoadingGlobal(true);
    try {
      const { data } = await supabase.auth.getUser();
      const ownerId = data.user?.id;
      if (!ownerId) {
        setGlobalSettings(null);
        return;
      }
      const gs = await getGlobalSettings(ownerId); // обязательно с ownerId
      setGlobalSettings(gs);
    } finally {
      setLoadingGlobal(false);
    }
  };

  const refreshCar = async () => {
    if (!currentCarId) return;
    setLoadingCar(true);
    try {
      const [data, bookings, carExtras] = await Promise.all([
        fetchCarById(currentCarId),
        fetchBookingsByCarId(currentCarId),
        fetchCarExtras(currentCarId),
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

      const allExtras = qc.getQueryData<any[]>(QK.extras) ?? [];
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

  // ===== Меню =====
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
        to: "media",
        icon: <CameraIcon className="size-5" />,
        label: "Media",
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
          src={car?.coverPhotos?.[0]}
          alt=""
          className="rounded-full border w-16 h-16 object-cover object-left"
        />
        <div>
          <p className="font-medium leading-4">
            {car?.model?.brands?.name} {car?.model?.name}
          </p>
          <p className="mt-1 px-1 rounded-sm border border-zinc/80 shadow-sm w-fit text-sm">
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

  // ===== Effective =====
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
          to={"/dashboard"}
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

      {!isMobile && (
        <AppShell.Navbar p="md">
          <SidebarMenu />
          <div className="lg:hidden fixed bottom-0">
            <UserMenu onClick={toggle} />
          </div>
        </AppShell.Navbar>
      )}

      {isMobile && (
        <Drawer
          opened={opened}
          onClose={toggle}
          size="100%"
          withCloseButton={true}
          padding="md"
          lockScroll
          trapFocus
          withinPortal
          overlayProps={{ opacity: 0.2 }}
        >
          <SidebarMenu />
          <div className="fixed left-7 right-7 bottom-4">
            <UserMenu onClick={toggle} />
          </div>
        </Drawer>
      )}

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
            refreshGlobal, // ← теперь функция существует
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
