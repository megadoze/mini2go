/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Select } from "@mantine/core";
import { CarExtraWithMeta } from "@/types/carExtra";
import { CarWithRelations } from "@/types/carWithRelations";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarDateRangeIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { uploadDriverLicenseFile } from "@/services/uploadDriverLicense";

import dynamic from "next/dynamic";
import "mapbox-gl/dist/mapbox-gl.css";

const Map = dynamic(() => import("react-map-gl/mapbox").then((m) => m.Map), {
  ssr: false,
}) as any;

const Marker = dynamic(
  () => import("react-map-gl/mapbox").then((m) => m.Marker),
  { ssr: false }
) as any;

const FullscreenControl = dynamic(
  () => import("react-map-gl/mapbox").then((m) => m.FullscreenControl),
  { ssr: false }
) as any;

const ScaleControl = dynamic(
  () => import("react-map-gl/mapbox").then((m) => m.ScaleControl),
  { ssr: false }
) as any;

const NavigationControl = dynamic(
  () => import("react-map-gl/mapbox").then((m) => m.NavigationControl),
  { ssr: false }
) as any;

const GeolocateControl = dynamic(
  () => import("react-map-gl/mapbox").then((m) => m.GeolocateControl),
  { ssr: false }
) as any;

// динамический импорт AddressAutofill — тоже только на клиенте
const AddressAutofill = dynamic(
  () => import("@mapbox/search-js-react").then((mod) => mod.AddressAutofill),
  { ssr: false }
);

import Pin from "@/components/pin"; // если у тебя есть аналог
import { fetchAddressFromCoords } from "@/services/geo.service"; // или свой сервис
import { toast } from "sonner";

type BookingDrawerProps = {
  open: boolean;
  onClose: () => void;
  car: CarWithRelations;
  start: string;
  end: string;
  days: number;
  onConfirm: (
    opts: Record<string, string | number | boolean>
  ) => Promise<void> | void;
  isMobile: boolean;
  extras: CarExtraWithMeta[];
  loadingRemote?: boolean;
  pricingResult?: {
    total: number;
    days: number;
    hours: number;
    minutes: number;
    pricePerDay: number;
    avgPerDay?: number;
    discountApplied?: number;
  } | null;
  currency: string;
  driverAge: string;
  drivingExperience: string;
};

export function BookingDrawer({
  open,
  onClose,
  car,
  start,
  end,
  days,
  onConfirm,
  isMobile,
  extras,
  loadingRemote,
  pricingResult,
  currency,
  driverAge,
  drivingExperience,
}: BookingDrawerProps) {
  const shouldReduceMotion = useReducedMotion();
  const ACCEPTED_VERSION = "v1.0";
  const isLocked = false;

  const cardCls =
    "rounded-2xl bg-white shadow-sm border border-gray-200 px-4 py-4 sm:px-5 sm:py-5";

  const modelObj = (car as any).model ?? (car as any).models ?? undefined;

  const brand = modelObj?.brands?.name;
  const model = modelObj?.name;
  const title = `${brand ?? ""} ${model ?? ""}`.trim();

  const depositValue = Number(car.deposit || 0);

  // локальные поля — как у тебя
  const [pickedExtras, setPickedExtras] = useState<string[]>([]);
  const [delivery, setDelivery] = useState<"car_address" | "by_address">(
    "car_address"
  );
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLong, setDeliveryLong] = useState<number | null>(null);
  const [deliveryCountry, setDeliveryCountry] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryFeeValue, setDeliveryFeeValue] = useState<number>(0);
  const [driverName, setDriverName] = useState("");
  const [driverDob, setDriverDob] = useState<string | null>(null);
  const [driverLicense, setDriverLicense] = useState("");
  const [driverLicenseIssue, setDriverLicenseIssue] = useState<string | null>(
    null
  );
  const [driverLicenseExpiry, setDriverLicenseExpiry] = useState<string | null>(
    null
  );
  const [driverPhone, setDriverPhone] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // helper: очистить ошибку по конкретному полю
  const clearError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const hasErrors = Object.keys(errors).length > 0;

  const [submitting, setSubmitting] = useState(false);

  // upload/license
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [acceptedTs, setAcceptedTs] = useState<string | null>(null);

  const canSubmit =
    driverName.trim().length > 0 &&
    driverDob &&
    driverLicense.trim().length > 0 &&
    driverLicenseIssue &&
    driverLicenseExpiry &&
    driverPhone.trim().length > 0 &&
    driverEmail.trim().length > 0 &&
    acceptedTerms &&
    !!licenseFile;

  // refs + UI
  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstFocusRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<any>(null);

  // Delivery
  const deliveryEnabled = Boolean((car as any)?.isDelivery);

  const deliveryOptions = useMemo(() => {
    const opts = [
      {
        value: "car_address",
        label: `Pickup at car address${
          (car as any)?.address ? ` (${(car as any).address})` : ""
        }`,
      },
    ];
    if (deliveryEnabled || delivery === "by_address") {
      opts.push({
        value: "by_address",
        label: "Delivery to customer's address",
      });
    }
    return opts;
  }, [deliveryEnabled, delivery, car]);

  const mapboxToken =
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
    (typeof import.meta !== "undefined"
      ? (import.meta as any).env?.VITE_MAPBOX_TOKEN
      : undefined);

  // map view state (initial from car)
  const toNum = (v: unknown, fallback: number | null = 50.45): number | null =>
    Number.isFinite(Number(v)) ? Number(v) : fallback;

  const initialLat = toNum(car?.lat, 50.45);
  const initialLng = toNum(car?.long, 30.52);
  const [mapView, setMapView] = useState<any>({
    latitude: initialLat,
    longitude: initialLng,
    zoom: 12,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  // client-only flag (to prevent using window on server)
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(typeof window !== "undefined"), []);

  // block scroll while open
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // touchmove guard — разрешаем прокрутку, если событие происходит внутри panelRef
    const onTouchMove = (e: TouchEvent) => {
      const panel = panelRef.current;
      if (!panel) {
        e.preventDefault();
        return;
      }
      // если тач внутри панели — не блокируем
      if (panel.contains(e.target as Node)) return;
      // иначе — блокируем (чтобы фон не скроллился)
      e.preventDefault();
    };

    document.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, [open]);

  // reset UI when drawer opens
  useEffect(() => {
    if (!open) return;
    setPickedExtras([]);
    // оставляем delivery выбор, но очищаем адрес
    setDeliveryAddress("");
    setDeliveryLat(null);
    setDeliveryLong(null);
    setLicenseFile(null);
    setLicensePreview(null);
    setAcceptedTerms(false);
    setAcceptedTs(null);
    setSubmitting(false);
    setErrors({});
    requestAnimationFrame(() => {
      try {
        firstFocusRef.current?.focus?.({ preventScroll: true });
      } catch {
        firstFocusRef.current?.focus?.();
      }
    });
  }, [open]);

  // helper — compute billable days (same as bookingEditor)
  const billableDaysForExtras = useMemo(() => {
    if (!start || !end) return 1;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const minutes = Math.max(0, Math.ceil((e - s) / (1000 * 60)));
    return Math.max(1, Math.ceil(minutes / (24 * 60)));
  }, [start, end]);

  const extrasTotal = useMemo(() => {
    return pickedExtras.reduce((sum, id) => {
      const ex = extras.find((x) => x.extra_id === id);
      if (!ex) return sum;
      const mult =
        ex.meta?.price_type === "per_day" ? billableDaysForExtras : 1;
      return sum + Number(ex.price || 0) * mult;
    }, 0);
  }, [pickedExtras, extras, billableDaysForExtras]);

  const isDiscount = pricingResult?.discountApplied || "";

  const baseTotal =
    pricingResult?.total ??
    Math.round(Math.max(1, days) * (car.price || 0) * 100) / 100;

  const deliveryFee =
    delivery === "by_address" ? Number(deliveryFeeValue || 0) : 0;
  const optionsTotal = Math.round((extrasTotal + deliveryFee) * 100) / 100;
  const grandTotal = Math.round((baseTotal + optionsTotal) * 100) / 100;

  // validation (simplified, взято из BookingDrawer/Editor)
  function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  const MIN_DRIVER_AGE = Number(driverAge);
  const MIN_DRIVING_EXPERIENCE = Number(drivingExperience);
  const MIN_LICENSE_VALIDITY_MONTHS = 6;

  const validate = useCallback(() => {
    const e: Record<string, string> = {};

    // ✅ FULL NAME: Имя и Фамилия, минимум по 2 символа
    const nameTrimmed = driverName.trim();
    if (!nameTrimmed) {
      e.driverName = "Please enter your first and last name";
    } else {
      const parts = nameTrimmed.split(/\s+/);
      if (parts.length < 2) {
        e.driverName = "Please enter first and last name";
      } else {
        const first = parts[0];
        const last = parts[parts.length - 1];
        if (first.length < 2 || last.length < 2) {
          e.driverName =
            "First and last name must be at least 2 characters each";
        }
      }
    }

    // ✅ DOB
    if (!driverDob) {
      e.driverDob = "Please enter your date of birth";
    } else {
      const dobDate = new Date(driverDob);
      if (Number.isNaN(dobDate.getTime())) {
        e.driverDob = "Invalid date of birth";
      } else {
        const today = new Date();
        // обнуляем время, чтобы сравнивать только даты
        today.setHours(0, 0, 0, 0);

        if (dobDate > today) {
          e.driverDob = "Date of birth cannot be in the future";
        } else {
          const ageDiffMs = today.getTime() - dobDate.getTime();
          const age = Math.floor(ageDiffMs / (1000 * 60 * 60 * 24 * 365.25));
          if (age < MIN_DRIVER_AGE) {
            e.driverDob = `Driver must be at least ${MIN_DRIVER_AGE} years old`;
          }
        }
      }
    }

    // ✅ LICENSE NUMBER
    const licenseTrimmed = driverLicense.trim();
    const licenseCore = licenseTrimmed.replace(/[\s-]/g, ""); // убираем пробелы и дефисы

    if (!licenseCore) {
      e.driverLicense = "Enter license number";
    } else if (licenseCore.length < 6) {
      e.driverLicense = "License number seems too short";
    }

    // ✅ LICENSE ISSUE DATE → СТАЖ
    if (!driverLicenseIssue) {
      e.driverLicenseIssue = "Please enter license issue date";
    } else {
      const issue = new Date(driverLicenseIssue);
      if (Number.isNaN(issue.getTime())) {
        e.driverLicenseIssue = "Invalid license issue date";
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // не в будущем
        if (issue > today) {
          e.driverLicenseIssue = "License issue date cannot be in the future";
        }

        // не раньше даты рождения
        if (driverDob) {
          const dobDate = new Date(driverDob);
          if (!Number.isNaN(dobDate.getTime()) && issue < dobDate) {
            e.driverLicenseIssue =
              "License issue date cannot be earlier than date of birth";
          }
        }

        // стаж
        const experienceYears =
          (today.getTime() - issue.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (experienceYears < MIN_DRIVING_EXPERIENCE) {
          e.driverLicenseIssue = `Driving experience must be at least ${MIN_DRIVING_EXPERIENCE} years`;
        }

        // опционально: лицензия должна быть выдана до начала аренды
        if (start) {
          const rentalStart = new Date(start);
          if (!Number.isNaN(rentalStart.getTime()) && issue > rentalStart) {
            e.driverLicenseIssue =
              "License must be issued before the rental starts";
          }
        }
      }
    }

    // ✅ LICENSE EXPIRY — минимум 6 месяцев от сегодня и покрывать аренду
    if (!driverLicenseExpiry) {
      e.driverLicenseExpiry = "Please enter license expiry date";
    } else {
      const expDate = new Date(driverLicenseExpiry);
      if (Number.isNaN(expDate.getTime())) {
        e.driverLicenseExpiry = "Invalid expiry date";
      } else {
        // "нормализуем" сегодняшнюю дату
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // дата, когда права должны быть действительны минимум
        const minValid = new Date(today);
        minValid.setMonth(minValid.getMonth() + MIN_LICENSE_VALIDITY_MONTHS);

        // базовое требование: не просрочены уже сейчас
        if (expDate < today) {
          e.driverLicenseExpiry = "Driver license is already expired";
        } else {
          // требование: не меньше 6 месяцев от сегодня
          if (expDate < minValid) {
            e.driverLicenseExpiry = `Driver license must be valid at least ${MIN_LICENSE_VALIDITY_MONTHS} months from today`;
          }

          // плюс: должны покрывать период аренды (если есть end)
          if (end) {
            const rentalEnd = new Date(end);
            if (!Number.isNaN(rentalEnd.getTime())) {
              rentalEnd.setHours(0, 0, 0, 0);
              if (expDate < rentalEnd) {
                e.driverLicenseExpiry =
                  "License must be valid for the entire rental period";
              }
            }
          }
        }
      }
    }

    // ✅ PHONE
    const phoneTrimmed = driverPhone.trim();
    const phoneCore = phoneTrimmed.replace(/[\s-]/g, ""); // убираем пробелы и дефисы

    if (!phoneCore) {
      e.driverPhone = "Enter phone number";
    } else if (phoneCore.length < 7) {
      e.driverPhone = "Phone number seems too short";
    }

    // ✅ EMAIL
    if (!driverEmail.trim() || !isValidEmail(driverEmail)) {
      e.driverEmail = "Enter a valid email address";
    }

    // ✅ TERMS
    if (!acceptedTerms) {
      e.acceptedTerms = "You must accept Terms & Conditions";
    }

    // ✅ LICENSE FILE (1 MB лимит)
    if (!licenseFile) {
      e.driverLicenseFile = "Please upload a photo/scan of your driver license";
    } else if (licenseFile) {
      const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
      if (!allowedTypes.includes(licenseFile.type)) {
        e.driverLicenseFile =
          "Unsupported file type. Please upload JPG, PNG or PDF.";
      }
      const maxSizeMb = 1;
      if (licenseFile.size > maxSizeMb * 1024 * 1024) {
        e.driverLicenseFile = `File is too large. Max ${maxSizeMb}MB.`;
      }
    }

    // ✅ DELIVERY ADDRESS (если доставка)
    if (delivery === "by_address" && !deliveryAddress.trim()) {
      e.deliveryAddress = "Enter delivery address";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }, [
    driverName,
    driverDob,
    driverLicense,
    driverLicenseIssue,
    driverLicenseExpiry,
    driverPhone,
    driverEmail,
    acceptedTerms,
    licenseFile,
    delivery,
    deliveryAddress,
    MIN_DRIVER_AGE,
    MIN_DRIVING_EXPERIENCE,
    start,
    end,
  ]);

  useEffect(() => {
    if (!licenseFile) {
      setLicensePreview(null);
      return;
    }

    const url = URL.createObjectURL(licenseFile);
    setLicensePreview(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [licenseFile]);

  const clearSubmitError = () =>
    setErrors((prev) => {
      const rest = { ...prev };
      delete rest.submit; // аккуратно убираем только submit
      return rest;
    });

  const handleConfirm = async () => {
    if (submitting) return;

    clearSubmitError();

    const ok = validate();
    if (!ok) return;

    setSubmitting(true);
    try {
      // 1. Показываем превью прав

      // 1) Загружаем права, если есть файл
      let storagePath: string | null = null;

      if (licenseFile) {
        const res = await uploadDriverLicenseFile(licenseFile);
        storagePath = res.storagePath;
      }

      // 2. Собираем payload для onConfirm с уже готовым URL
      const opts: Record<string, string | number | boolean> = {
        extras: pickedExtras.join(","),
        delivery: delivery === "by_address" ? 1 : 0,
        delivery_address: delivery === "by_address" ? deliveryAddress : "",
        delivery_lat: delivery === "by_address" ? deliveryLat ?? "" : "",
        delivery_long: delivery === "by_address" ? deliveryLong ?? "" : "",
        driver_name: driverName.trim(),
        driver_dob: driverDob ? new Date(driverDob).toISOString() : "",
        driver_license: driverLicense.trim(),
        driver_license_issue: driverLicenseIssue
          ? new Date(driverLicenseIssue).toISOString()
          : "",
        driver_license_expiry: driverLicenseExpiry
          ? new Date(driverLicenseExpiry).toISOString()
          : "",
        driver_phone: driverPhone.trim(),
        driver_email: driverEmail.trim(),
        driver_license_file_name: licenseFile ? licenseFile.name : "",
        driver_license_file_url: storagePath ?? "",
        accepted_terms: acceptedTerms ? 1 : 0,
        accepted_ts: acceptedTs ?? new Date().toISOString(),
        accepted_version: ACCEPTED_VERSION,
        price_total: grandTotal,
        delivery_fee: deliveryFee,
      };

      await Promise.resolve(onConfirm(opts));
      onClose();
    } catch (err: any) {
      console.error("Booking failed", err);

      const message =
        err?.message && typeof err.message === "string"
          ? err.message
          : "Booking failed. Please try again.";

      toast.error(message);
      setErrors((p) => ({
        ...p,
        // driverLicenseFile трогать не будем, если ошибка не про файл
        submit: message,
      }));
    } finally {
      setSubmitting(false);
    }
  };

  // dropzone handlers
  const handleFiles = (f: File | null) => {
    if (!f) return;
    setLicenseFile(f);
    clearError("driverLicenseFile");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    handleFiles(f);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  // map + AddressAutofill handlers (reuse logic из bookingEditor)
  const onAddressRetrieve = async (res: any) => {
    const f = res?.features?.[0];
    const coords = f?.geometry?.coordinates as [number, number] | undefined;
    if (!coords) return;
    const [lng, lat] = coords;
    setDeliveryLat(lat);
    setDeliveryLong(lng);
    const fallback = f?.properties?.full_address || f?.place_name || "";
    try {
      const addr = await fetchAddressFromCoords(lat, lng);
      setDeliveryAddress(addr?.address || fallback);
      setDeliveryCountry(addr?.country || "");
      setDeliveryCity(addr?.city || "");
    } catch {
      setDeliveryAddress(fallback);
      setDeliveryCountry("");
      setDeliveryCity("");
    }
    setMapView((prev: any) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      zoom: Math.max(prev.zoom, 13),
    }));
    try {
      mapRef.current?.flyTo?.({
        center: [lng, lat],
        zoom: Math.max(mapView.zoom ?? 13, 14),
        essential: true,
      });
    } catch {}
  };

  // autofill user location into delivery address when delivery === 'by_address' and address empty
  useEffect(() => {
    if (!isClient) return;
    if (delivery !== "by_address") return;
    if (deliveryAddress && deliveryAddress.trim()) return;

    let cancelled = false;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (cancelled) return;
          try {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setDeliveryLat(lat);
            setDeliveryLong(lng);
            setMapView((prev: any) => ({
              ...prev,
              latitude: lat,
              longitude: lng,
              zoom: Math.max(prev.zoom ?? 12, 13),
            }));
            try {
              const addr = await fetchAddressFromCoords(lat, lng);
              if (!cancelled && addr) {
                setDeliveryAddress(addr.address || "");
                setDeliveryCountry(addr.country || "");
                setDeliveryCity(addr.city || "");
              }
            } catch {}
          } catch {}
        },
        () => {},
        { maximumAge: 1000 * 60 * 10, timeout: 5000 }
      );
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery, isClient]);

  // helpers for UI timeline & progress
  const computeDurationPretty = (s?: string | null, e?: string | null) => {
    if (!s || !e) return "—";
    const ss = new Date(s);
    const ee = new Date(e);
    const totalMin = Math.max(
      0,
      Math.round((ee.getTime() - ss.getTime()) / 60000)
    );
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    const parts: string[] = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    return parts.length ? parts.join(" ") : "0m";
  };

  function formatDateTimeForLabel(dt: string) {
    if (!dt) return "—";
    try {
      const d = new Date(dt);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      return `${dd}.${mm}, ${hh}:${min}`;
    } catch {
      return dt;
    }
  }

  const startDate = formatDateTimeForLabel(start);
  const endDate = formatDateTimeForLabel(end);

  return (
    <div
      className={`fixed inset-0 z-50 pointer-events-none transition-all ${
        open ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0"
        }`}
      />
      <motion.aside
        initial={{ x: "100%", opacity: 0 }}
        animate={open ? { x: "0%", opacity: 1 } : { x: "100%", opacity: 0 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : {
                x: { type: "tween", duration: 0.45, ease: [0.22, 0.8, 0.2, 1] },
                opacity: { duration: 0.15 },
              }
        }
        className="pointer-events-auto fixed right-0 top-0 h-full w-full sm:w-[920px] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={panelRef}
          className="px-0 h-full flex flex-col overflow-auto md:overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 md:px-6 py-2 mb-4 md:mb-5 bg-black text-white/95">
            <div className="text-lg md:text-xl font-roboto-condensed font-medium">
              Confirm booking
            </div>
            <div className="flex items-center">
              <button
                onClick={onClose}
                className=" bg-white/10 hover:bg-white/15 rounded-xs p-1 cursor-pointer"
                disabled={submitting}
              >
                <XMarkIcon className="size-5 " />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 h-full px-4 md:px-0">
            {/* LEFT: summary */}
            <div className="relative md:flex-none md:w-[360px] md:pl-6">
              <div className="md:sticky md:top-6 md:space-y-4 md:max-h-[calc(100vh-6rem)]">
                {/* Car card */}
                <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-4 sm:p-5">
                  <div className="aspect-video w-full overflow-hidden rounded-xl h-40 object-cover bg-gray-50">
                    {car?.photos?.[0] ? (
                      <img
                        src={car.photos[0]}
                        className="h-full w-full object-cover"
                        alt="Car"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                        no photo
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="font-semibold text-gray-900 pt-1">
                      {title} {car?.year}
                    </p>
                  </div>
                </section>

                {/* Trip timeline */}
                <section className="mt-4 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 px-4 py-4 sm:px-5 sm:py-5">
                  <div>
                    <div className="flex flex-col">
                      <span className="text-xs uppercase font-semibold tracking-wide text-gray-900">
                        Rental period
                      </span>
                      <div className="flex items-center gap-1 pt-1">
                        <CalendarDateRangeIcon className="size-4" />
                        <span className="text-sm font-medium text-gray-900">
                          {`${startDate} — ${endDate}`}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1 text-sm text-gray-700">
                      <span className="text-gray-600">Duration: </span>
                      <span className="font-medium">
                        {computeDurationPretty(start, end)}
                      </span>
                    </div>
                  </div>
                </section>

                {/* Trip summary */}
                <section className="mt-4 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-4 sm:p-5 text-sm">
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-wide text-gray-900 font-semibold">
                      Trip summary
                    </p>
                  </div>

                  <div className="space-y-2 text-gray-700">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col">
                        <span className="text-gray-600 text-sm">
                          Price per day
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block font-medium text-gray-900">
                          {Number(car?.price || 0).toFixed(2)} {currency}
                        </span>
                      </div>
                    </div>
                    {isDiscount && (
                      <div className="flex items-start justify-between -mt-2 text-emerald-500">
                        <div className="flex flex-col">
                          <span className="text-sm">
                            {pricingResult?.discountApplied}% with discount
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block font-medium">
                            {Number(pricingResult?.avgPerDay || 0).toFixed(2)}{" "}
                            {currency}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start justify-between">
                      <span className="text-gray-600 text-sm">
                        Rental subtotal
                      </span>
                      <span className="font-medium text-gray-900">
                        {baseTotal.toFixed(2)} {currency}
                      </span>
                    </div>

                    {deliveryFee > 0 && (
                      <div className="flex items-start justify-between">
                        <span className="text-gray-600 text-sm">Delivery</span>
                        <span className="font-medium text-gray-900">
                          {deliveryFee.toFixed(2)} {currency}
                        </span>
                      </div>
                    )}

                    {extrasTotal > 0 && (
                      <div className="flex items-start justify-between">
                        <span className="text-gray-600 text-sm">Extras</span>
                        <span className="font-medium text-gray-900">
                          {extrasTotal.toFixed(2)} {currency}
                        </span>
                      </div>
                    )}

                    <div className="border-t border-dashed border-gray-300 pt-1" />

                    <div className="flex items-start justify-between">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="text-base font-semibold text-gray-900">
                        {grandTotal.toFixed(2)} {currency}
                      </span>
                    </div>

                    <div className="flex items-start justify-between text-gray-900">
                      <span>Deposit</span>
                      <span>
                        {depositValue.toFixed(2)} {currency}
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* RIGHT: form */}
            <div className="flex-1">
              <div className="h-full pb-18 md:pb-20 md:overflow-y-scroll">
                <div className="space-y-4 md:pr-6">
                  {/* Options (Extras) */}
                  <section className={cardCls}>
                    <div className="font-semibold text-xs text-gray-900 uppercase">
                      Extras
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      Additional services & fees
                    </p>

                    <div className="mt-4 space-y-2">
                      {loadingRemote ? (
                        <div className="text-sm text-gray-500">Loading…</div>
                      ) : (
                        extras.map((ex) => (
                          <div
                            key={ex.extra_id}
                            className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 shadow-sm"
                          >
                            <label className="flex-1 flex items-start gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={pickedExtras.includes(ex.extra_id)}
                                onChange={(e) => {
                                  const checked = e.currentTarget.checked;
                                  if (checked)
                                    setPickedExtras((p) => [...p, ex.extra_id]);
                                  else
                                    setPickedExtras((p) =>
                                      p.filter((x) => x !== ex.extra_id)
                                    );
                                }}
                                className="mt-1 h-4 w-4 accent-black "
                                disabled={isLocked}
                              />
                              <div>
                                <div className="font-medium text-sm text-gray-800">
                                  {ex.meta?.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {ex.meta?.price_type === "per_day"
                                    ? "(per day)"
                                    : "(per rental)"}
                                </div>
                              </div>
                            </label>

                            <div className="flex items-center gap-3">
                              <div className="text-sm font-medium">
                                {ex.price} {currency}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  {/* DELIVERY selector */}
                  <section className="mt-4 rounded-2xl bg-white shadow-sm border border-gray-200 px-4 py-4 sm:px-5 sm:py-5">
                    {/* header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-xs font-semibold text-gray-900 uppercase">
                          Delivery
                        </h2>
                        <p className="mt-1 text-xs text-gray-500">
                          Pickup or drop-off location
                        </p>
                      </div>
                    </div>

                    {/* select + fee */}
                    <div className="mt-4 space-y-2">
                      <Select
                        value={delivery}
                        onChange={async (e) => {
                          const next =
                            (e as "car_address" | "by_address") ??
                            "car_address";
                          setDelivery(next);

                          if (next === "car_address") {
                            // reset fee when picking up at car address
                            setDeliveryFeeValue(0);
                            return;
                          }

                          // next === "by_address"
                          if (
                            !deliveryFeeValue &&
                            (car as any)?.deliveryFee != null
                          ) {
                            setDeliveryFeeValue(
                              Number((car as any).deliveryFee)
                            );
                          }

                          // автоподстановка адреса/координат если пусто
                          if (
                            !deliveryAddress &&
                            car?.lat != null &&
                            car?.long != null
                          ) {
                            const lat = Number(car.lat);
                            const lng = Number(car.long);
                            setDeliveryLat(lat);
                            setDeliveryLong(lng);

                            try {
                              const addr = await fetchAddressFromCoords(
                                lat,
                                lng
                              );
                              setDeliveryAddress(
                                addr?.address || (car as any)?.address || ""
                              );
                              setDeliveryCountry(addr?.country || "");
                              setDeliveryCity(addr?.city || "");
                            } catch {
                              setDeliveryAddress((car as any)?.address || "");
                              setDeliveryCountry("");
                              setDeliveryCity("");
                            }

                            // сдвинуть карту и плавно перелететь
                            setMapView((prev: any) => ({
                              ...prev,
                              latitude: lat,
                              longitude: lng,
                              zoom: 13,
                            }));
                            try {
                              mapRef.current?.flyTo?.({
                                center: [lng, lat],
                                zoom: 13,
                                essential: true,
                              });
                            } catch {}
                          }
                        }}
                        data={deliveryOptions}
                        radius="md"
                        disabled={isLocked}
                      />

                      <div className="text-[11px] text-gray-600">
                        Delivery fee:&nbsp;
                        <b className="text-gray-800">
                          {(delivery === "by_address"
                            ? deliveryFeeValue
                            : 0
                          ).toFixed(2)}
                          €
                        </b>
                      </div>
                    </div>

                    {/* map + address only if delivery by_address */}
                    {delivery === "by_address" && (
                      <div
                        className={`mt-4 space-y-4 ${
                          isLocked ? "opacity-60" : ""
                        }`}
                      >
                        {/* MAP CARD */}
                        <div className="h-60 overflow-hidden rounded-xl border border-gray-100 shadow-sm ring-1 ring-gray-100">
                          <Map
                            ref={mapRef}
                            {...mapView}
                            onMove={(e: any) => setMapView(e.viewState)}
                            style={{ width: "100%", height: "100%" }}
                            mapStyle="mapbox://styles/megadoze/cldamjew5003701p5mbqrrwkc"
                            mapboxAccessToken={mapboxToken}
                            interactive={!isLocked}
                          >
                            <Marker
                              longitude={
                                deliveryLong ?? car?.long ?? initialLng
                              }
                              latitude={deliveryLat ?? car?.lat ?? initialLat}
                              draggable={!isLocked}
                              onDragEnd={async (e: any) => {
                                const { lat, lng } = e.lngLat;
                                setDeliveryLat(lat);
                                setDeliveryLong(lng);
                                setMapView((prev: any) => ({
                                  ...prev,
                                  latitude: lat,
                                  longitude: lng,
                                  zoom: Math.max(prev.zoom ?? 12, 13),
                                }));

                                try {
                                  const addr = await fetchAddressFromCoords(
                                    lat,
                                    lng
                                  );
                                  if (addr) {
                                    setDeliveryAddress(addr.address || "");
                                    setDeliveryCountry(addr.country || "");
                                    setDeliveryCity(addr.city || "");
                                  }
                                } catch {}
                              }}
                            >
                              <Pin />
                            </Marker>

                            <GeolocateControl
                              trackUserLocation
                              showUserHeading
                              onGeolocate={async (pos: any) => {
                                if (isLocked) return;
                                const lat = pos.coords.latitude;
                                const lng = pos.coords.longitude;
                                setDeliveryLat(lat);
                                setDeliveryLong(lng);
                                setMapView((prev: any) => ({
                                  ...prev,
                                  latitude: lat,
                                  longitude: lng,
                                  zoom: Math.max(prev.zoom ?? 12, 13),
                                }));
                                try {
                                  const addr = await fetchAddressFromCoords(
                                    lat,
                                    lng
                                  );
                                  if (addr) {
                                    setDeliveryAddress(addr.address || "");
                                    setDeliveryCountry(addr.country || "");
                                    setDeliveryCity(addr.city || "");
                                  }
                                } catch {}
                                try {
                                  mapRef.current?.flyTo?.({
                                    center: [lng, lat],
                                    zoom: Math.max(mapView.zoom ?? 13, 13),
                                    essential: true,
                                  });
                                } catch {}
                              }}
                            />

                            <NavigationControl />
                            <ScaleControl />
                            <FullscreenControl />
                          </Map>
                        </div>

                        {/* ADDRESS INPUT + meta */}
                        <div className="space-y-2">
                          {mapboxToken ? (
                            <AddressAutofill
                              accessToken={mapboxToken}
                              onRetrieve={onAddressRetrieve}
                            >
                              <input
                                name="delivery-address"
                                id="delivery-address"
                                type="text"
                                value={deliveryAddress}
                                onChange={(e) =>
                                  setDeliveryAddress(e.target.value)
                                }
                                placeholder="Enter delivery address"
                                autoComplete="address-line1"
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm! text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-600 focus:outline-none"
                                disabled={isLocked}
                              />
                            </AddressAutofill>
                          ) : (
                            <input
                              name="delivery-address"
                              id="delivery-address"
                              type="text"
                              value={deliveryAddress}
                              onChange={(e) => {
                                setDeliveryAddress(e.target.value);
                                clearError("deliveryAddress");
                              }}
                              placeholder="Enter delivery address"
                              autoComplete="address-line1"
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-600 focus:outline-none"
                              disabled={isLocked}
                            />
                          )}

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 pt-2">
                            <p>
                              <span className="text-gray-500">Country: </span>
                              <span className="font-semibold text-gray-800">
                                {deliveryCountry || "—"}
                              </span>
                            </p>
                            <p>
                              <span className="text-gray-500">City: </span>
                              <span className="font-semibold text-gray-800">
                                {deliveryCity || "—"}
                              </span>
                            </p>
                          </div>

                          {errors.deliveryAddress && (
                            <div className="mt-2 text-xs text-red-500">
                              {errors.deliveryAddress}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Driver card */}
                  <section className={cardCls}>
                    <div className="font-semibold text-xs text-gray-900 uppercase">
                      Driver
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 w-full">
                      <input
                        ref={firstFocusRef}
                        value={driverName}
                        onChange={(e) => {
                          setDriverName(e.target.value);
                          clearError("driverName");
                        }}
                        placeholder="Full name *"
                        className={`w-full rounded-md border border-gray-300 px-3 py-2 outline-emerald-200 ${
                          errors.driverName ? "border-red-400" : ""
                        }`}
                      />
                      {errors.driverName && (
                        <p className=" text-xs text-red-500 -mt-2">
                          {errors.driverName}
                        </p>
                      )}

                      <div className="grid md:grid-cols-3 md:gap-x-2 gap-y-2">
                        {/* DOB */}
                        <div className="order-1">
                          <label className="text-xs text-gray-500">
                            Date of birth
                          </label>
                          <input
                            type="date"
                            value={driverDob ?? ""}
                            onChange={(e) => {
                              setDriverDob(e.target.value || null);
                              clearError("driverDob");
                            }}
                            className={`w-full md:max-w-fit rounded-md border px-2 py-2 outline-emerald-200 text-xs ${
                              errors.driverDob
                                ? "border-red-400"
                                : "border-gray-300"
                            }`}
                          />
                          {errors.driverDob && (
                            <div className="mt-1 text-xs text-red-500">
                              {errors.driverDob}
                            </div>
                          )}
                        </div>

                        {/* License number — сразу после DOB на мобиле, но ниже дат на десктопе */}
                        <div className="order-2 md:order-4 md:col-span-3 mt-2">
                          <input
                            value={driverLicense}
                            onChange={(e) => {
                              setDriverLicense(e.target.value);
                              clearError("driverLicense");
                            }}
                            placeholder="Driver license number *"
                            className={`w-full rounded-md border border-gray-300 px-2 py-2 outline-emerald-200 placeholder:normal-case uppercase ${
                              errors.driverLicense ? "border-red-400" : ""
                            }`}
                          />
                          {errors.driverLicense && (
                            <p className="-mt-2 text-xs text-red-500">
                              {errors.driverLicense}
                            </p>
                          )}
                        </div>

                        {/* License issue date */}
                        <div className="order-3">
                          <label className="text-xs text-gray-500">
                            License issue date
                          </label>
                          <input
                            type="date"
                            value={driverLicenseIssue ?? ""}
                            onChange={(e) => {
                              setDriverLicenseIssue(e.target.value || null);
                              clearError("driverLicenseIssue");
                            }}
                            className={`w-full rounded-md border px-2 py-2 outline-emerald-200 ${
                              errors.driverLicenseIssue
                                ? "border-red-400"
                                : "border-gray-300"
                            }`}
                          />
                          {errors.driverLicenseIssue && (
                            <div className="mt-1 text-xs text-red-500">
                              {errors.driverLicenseIssue}
                            </div>
                          )}
                        </div>

                        {/* License expire date */}
                        <div className="order-4 md:order-3">
                          <label className="text-xs text-gray-500">
                            License expire date
                          </label>
                          <input
                            type="date"
                            lang="en"
                            value={driverLicenseExpiry ?? ""}
                            onChange={(e) => {
                              setDriverLicenseExpiry(e.target.value || null);
                              clearError("driverLicenseExpiry");
                            }}
                            className={`w-full rounded-md border px-3 py-2 outline-emerald-200 ${
                              errors.driverLicenseExpiry
                                ? "border-red-400"
                                : "border-gray-300"
                            }`}
                          />
                          {errors.driverLicenseExpiry && (
                            <div className="mt-1 text-xs text-red-500">
                              {errors.driverLicenseExpiry}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-3 md:gap-2 mt-2">
                        <div>
                          <input
                            value={driverPhone}
                            onChange={(e) => {
                              setDriverPhone(e.target.value);
                              clearError("driverPhone");
                            }}
                            placeholder="Phone *"
                            className={`w-full rounded-md border border-gray-300 px-3 py-2 outline-emerald-200 ${
                              errors.driverPhone ? "border-red-400" : ""
                            }`}
                          />
                          {errors.driverPhone && (
                            <p className="mt-1 text-xs text-red-500">
                              {errors.driverPhone}
                            </p>
                          )}
                        </div>

                        <div>
                          <input
                            value={driverEmail}
                            onChange={(e) => {
                              setDriverEmail(e.target.value);
                              clearError("driverEmail");
                            }}
                            placeholder="Email *"
                            type="email"
                            className={`w-full rounded-md border border-gray-300 px-3 py-2 outline-emerald-200 ${
                              errors.driverEmail ? "border-red-400" : ""
                            }`}
                          />
                          {errors.driverEmail && (
                            <p className="mt-1 text-xs text-red-500">
                              {errors.driverEmail}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Upload */}
                      <div>
                        <label className="text-xs text-gray-500">
                          Upload driver license (jpeg, png, pdf - 1Mb max)
                        </label>
                        <div
                          onDrop={onDrop}
                          onDragOver={onDragOver}
                          onDragLeave={onDragLeave}
                          className={`mt-2 flex flex-col items-center gap-3 rounded-md border-dashed ${
                            dragActive ? "border-black" : "border-gray-200"
                          } border p-3 bg-white`}
                        >
                          <div className="flex-1">
                            {licensePreview ? (
                              <div className="flex items-center gap-3">
                                <img
                                  src={licensePreview}
                                  alt="preview"
                                  className="h-12 w-16 object-cover rounded-md"
                                />
                                <div>
                                  <div className="font-medium">
                                    {licenseFile?.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {licenseFile?.size
                                      ? Math.round(licenseFile.size / 1024)
                                      : ""}{" "}
                                    KB
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">
                                Drag & drop file here, or{" "}
                                <label className="underline cursor-pointer">
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) =>
                                      handleFiles(e.target.files?.[0] ?? null)
                                    }
                                  />
                                  select file
                                </label>
                              </div>
                            )}

                            {errors.driverLicenseFile && (
                              <div className="text-xs text-red-500 mt-2">
                                {errors.driverLicenseFile}
                              </div>
                            )}
                          </div>

                          {licensePreview && (
                            <button
                              type="button"
                              onClick={() => {
                                setLicenseFile(null);
                                setLicensePreview(null);
                              }}
                              className="text-xs text-red-500 px-2 py-1 rounded-md hover:bg-red-50 cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                  {/* Terms */}
                  <section className={cardCls}>
                    <label className="flex items-center gap-3">
                      <input
                        id="terms"
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => {
                          setAcceptedTerms(e.target.checked);
                          if (e.target.checked) {
                            setAcceptedTs(new Date().toISOString());
                            clearError("acceptedTerms");
                          } else {
                            setAcceptedTs(null);
                          }
                        }}
                      />
                      <div className="text-sm">
                        I agree to the{" "}
                        <Link
                          href="/rental-terms.pdf"
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-emerald-500"
                        >
                          Terms & Conditions
                        </Link>{" "}
                        and{" "}
                        <Link
                          href="/privacy"
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-emerald-500"
                        >
                          Privacy Policy
                        </Link>
                        .
                        {errors.acceptedTerms && (
                          <div className="text-xs text-red-500">
                            {errors.acceptedTerms}
                          </div>
                        )}
                      </div>
                    </label>
                  </section>
                  {/* desktop action row (как в BookingEditor) */}
                  <div className="hidden sm:flex items-center justify-center gap-3">
                    <button
                      onClick={handleConfirm}
                      disabled={submitting || !canSubmit}
                      className={`rounded-xl py-3 px-5 font-medium transition-all flex items-center justify-center gap-3 w-full cursor-pointer ${
                        submitting || !canSubmit
                          ? "bg-gray-100 text-gray-800 cursor-not-allowed"
                          : "bg-black text-white"
                      }`}
                    >
                      {submitting
                        ? "Booking…"
                        : `Book — ${grandTotal.toFixed(0)}€`}
                    </button>
                  </div>
                  {/* errors / hints */}
                  {hasErrors && !submitting && (
                    <div className="mt-2 text-center text-xs text-red-500">
                      Please check highlighted fields — some information is
                      missing or incorrect.
                    </div>
                  )}

                  {errors.submit && (
                    <div className="mt-2 text-center text-xs text-red-500">
                      {errors.submit}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* MOBILE sticky bar */}
          <div className="sm:hidden fixed left-0 right-0 bottom-0 z-50 border-gray-100 bg-white border-t p-3">
            <div className="mx-auto max-w-3xl flex items-center justify-between gap-3 font-roboto-condensed">
              <button
                onClick={handleConfirm}
                disabled={submitting || !canSubmit}
                className={`rounded-xl py-3 px-5 font-medium transition-all flex items-center justify-center gap-3 w-full cursor-pointer ${
                  submitting || !canSubmit
                    ? "bg-gray-100 text-gray-800 cursor-not-allowed"
                    : "bg-black text-white"
                }`}
              >
                {submitting ? "Booking…" : `Book — ${grandTotal.toFixed(0)}€`}
              </button>
            </div>
          </div>
        </div>
        {submitting && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/10">
            <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg text-sm text-gray-800">
              <div className="h-4 w-4 animate-spin rounded-full border border-gray-300 border-t-black" />
              <span>Booking your car…</span>
            </div>
          </div>
        )}
      </motion.aside>
    </div>
  );
}
