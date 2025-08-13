import React, { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  DocumentArrowDownIcon,
  MapIcon,
  MapPinIcon,
  PlusCircleIcon,
  ShareIcon,
  ShieldCheckIcon,
  XMarkIcon, // ✨ для модалки QR
} from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/24/solid";

import type { Booking as DbBooking } from "@/types/booking";
import type { BookingCard as BookingCardType } from "@/types/bookingCard";
import {
  cancelAndUnlock,
  fetchBookingCard,
  subscribeBooking,
  updateBookingCard,
} from "@/services/bookings.service";
import { Badge } from "@mantine/core";

const BookingCard: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: { b?: BookingCardType } };
  const { id: paramId } = useParams<{ id: string }>();

  const [shareToast, setShareToast] = useState<string | null>(null);

  const seed = state?.b;
  const id = seed?.id ?? paramId ?? "";

  const qc = useQueryClient();

  // Лайв-тик раз в 30 сек
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const now = useMemo(() => new Date(), [tick]);

  // ---------- data fetching -----------------------------------------------
  const { data: booking } = useQuery<BookingCardType | null>({
    queryKey: ["booking", id],
    queryFn: () => fetchBookingCard(id),
    initialData: seed ?? null,
    enabled: Boolean(id),
    staleTime: 0,
  });

  // ---------- realtime subscription --------------------------------------
  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeBooking(id, () => {
      qc.invalidateQueries({ queryKey: ["booking", id] });
      qc.invalidateQueries({ queryKey: ["bookingsByUser"] });
    });
    return unsubscribe;
  }, [id, qc]);

  // ---------- dates & helpers --------------------------------------------
  const startDate = useMemo(
    () => (booking ? parseISO(booking.startAt) : null),
    [booking]
  );
  const endDate = useMemo(
    () => (booking ? parseISO(booking.endAt) : null),
    [booking]
  );

  type Countdown = { days: number; hours: number; minutes: number };

  // формат Xd Xh Ym до старта
  const countdownParts = (target?: Date | null): Countdown | null => {
    if (!target) return null;
    const diffMs = Math.max(0, target.getTime() - now.getTime());
    const totalMin = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const minutes = totalMin % 60;
    return { days, hours, minutes };
  };
  const cdStart = useMemo(() => countdownParts(startDate), [startDate, now]);

  // Прогресс поездки
  const tripProgress = useMemo(() => {
    if (!startDate || !endDate) return null as number | null;
    const total = endDate.getTime() - startDate.getTime();
    if (total <= 0) return 0;
    const elapsed = now.getTime() - startDate.getTime();
    if (elapsed <= 0) return 0;
    if (elapsed >= total) return 100;
    return Math.round((elapsed / total) * 100);
  }, [startDate, endDate, now]);

  // ---------- status ui machine ------------------------------------------
  const initialStateStatus = (): {
    status: boolean;
    confirmBut: boolean;
    cancelBut: boolean;
    comment: string;
  } => {
    const value = booking?.status ?? undefined;
    switch (value) {
      case "onApproval":
        return {
          status: true,
          confirmBut: true,
          cancelBut: true,
          comment: "Подтвердите бронирование гостя как можно скорее.",
        };
      case "confirmed":
        return {
          status: true,
          confirmBut: false,
          cancelBut: true,
          comment: "Вы подтвердили бронирование. Поездка начнётся через ",
        };
      case "canceledHost":
        return {
          status: false,
          confirmBut: false,
          cancelBut: false,
          comment: "Вы отменили бронирование гостя.",
        };
      case "canceledGuest":
        return {
          status: false,
          confirmBut: false,
          cancelBut: false,
          comment: "Бронирование отменено гостем.",
        };
      case "canceledTime":
        return {
          status: false,
          confirmBut: false,
          cancelBut: true,
          comment:
            "Бронирование отменено. Вы не подтвердили запрос гостя вовремя.",
        };
      case "rent":
        return {
          status: true,
          confirmBut: false,
          cancelBut: false,
          comment: "Поездка началась.",
        };
      case "finished":
        return {
          status: false,
          confirmBut: false,
          cancelBut: false,
          comment: "Поездка завершена.",
        };
      default:
        return {
          status: true,
          confirmBut: true,
          cancelBut: true,
          comment: "Подтвердите бронирование гостя как можно скорее.",
        };
    }
  };
  const [bookingStatus, setBookingStatus] = useState(initialStateStatus());
  useEffect(() => {
    setBookingStatus(initialStateStatus());
  }, [booking?.status]);

  // ---------- статус-плашка (цвет/текст) ----------------------------------
  const statusView = useMemo(() => {
    const s = booking?.status;
    if (s === "rent")
      return {
        text: s,
        cls: "lime",
      };
    if (s === "confirmed")
      return {
        text: s,
        cls: "orange",
      };
    if (s === "onApproval")
      return {
        text: s,
        cls: "grape",
      };
    if (s === "finished")
      return {
        text: s,
        cls: "dark",
      };
    if (s === "canceledHost" || s === "canceledGuest" || s === "canceledTime")
      return {
        text: s,
        cls: "red",
      };
    return {
      text: "unknown",
      cls: "gray",
    };
  }, [booking?.status]);

  // ---------- mutations (via service) ------------------------------------
  async function mutateBooking(id: string, payload: Partial<DbBooking>) {
    const next = await updateBookingCard(id, payload);
    qc.setQueryData(["booking", id], next);
    qc.setQueryData<BookingCardType[]>(["bookingsByUser"], (prev = []) =>
      prev.map((b) => (b.id === id ? next : b))
    );
    return next;
  }

  // автопрогрессия статусов (rent/finished)
  useEffect(() => {
    if (!booking || !startDate || !endDate) return;
    const started = now >= startDate && now < endDate;
    const finished = now >= endDate;

    const goRent = async () => {
      setBookingStatus({
        status: true,
        confirmBut: false,
        cancelBut: false,
        comment: "Поездка началась.",
      });
      await mutateBooking(booking.id, { status: "rent" });
    };

    const goFinished = async () => {
      setBookingStatus({
        status: false,
        confirmBut: false,
        cancelBut: false,
        comment: "Поездка завершена.",
      });
      await mutateBooking(booking.id, { status: "finished" });
    };

    if (started && booking.status !== "rent") void goRent();
    else if (finished && booking.status !== "finished") void goFinished();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    booking?.id,
    booking?.status,
    startDate?.getTime?.(),
    endDate?.getTime?.(),
    now.getTime(),
  ]);

  const handleConfirmBooking = async () => {
    if (!booking) return;
    setBookingStatus({
      status: true,
      confirmBut: false,
      cancelBut: true,
      comment: "Вы подтвердили бронирование. Поездка начнётся через ",
    });
    await mutateBooking(booking.id, { status: "confirmed" });
  };

  const handleCancelBooking = async () => {
    if (!booking) return;
    setBookingStatus({
      status: false,
      confirmBut: false,
      cancelBut: false,
      comment: "Вы отменили бронирование гостя.",
    });
    const next = await cancelAndUnlock(booking.id);
    // кладём свежую карточку в кэш, а список просто инвалидируем
    qc.setQueryData(["booking", booking.id], next);
    qc.invalidateQueries({ queryKey: ["bookingsByUser"] });
  };

  const handleBack = () => navigate(-1);

  // ----------------------- QR code (UI only) ------------------------------
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const shareUrl = useMemo(() => {
    if (!booking?.id) return "";
    try {
      const { origin, pathname, search, hash } = window.location;
      // Текущий URL карточки — шарим его
      return `${origin}${pathname}${search}${hash}`;
    } catch {
      return String(booking.id);
    }
  }, [booking?.id]);

  const payloadForQR = shareUrl || booking?.id || "";

  // генерируем dataURL локально, если есть пакет "qrcode"; иначе — фолбэк на CDN PNG
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const url = await QRCode.toDataURL(payloadForQR, {
          width: 480,
          margin: 1,
          errorCorrectionLevel: "M",
        });

        if (!cancelled) setQrSrc(url);
      } catch {
        // graceful fallback — внешний PNG
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&data=${encodeURIComponent(
          payloadForQR
        )}`;

        if (!cancelled) setQrSrc(url);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payloadForQR]);

  const displayId = useMemo(
    () =>
      booking
        ? (booking as any)?.code ?? booking.id.slice(0, 8).toUpperCase()
        : "",
    [booking]
  );

  const copyFullId = async () => {
    if (!booking?.id) return;
    try {
      await navigator.clipboard.writeText(booking.id);
      setShareToast("ID скопирован");
    } catch {
      // Фолбэк, если Clipboard API недоступен (не https и т.п.)
      window.prompt("Скопируйте ID ⤵️", booking.id);
      setShareToast("ID скопирован");
    } finally {
      setTimeout(() => setShareToast(null), 1500);
    }
  };

  const downloadQR = () => {
    if (!qrSrc) return;
    const a = document.createElement("a");
    a.href = qrSrc;
    a.download = `booking-${displayId}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  async function shareBooking() {
    if (!shareUrl) return;
    const data = {
      title: `Booking #${displayId}`,
      text: `Бронирование ${booking?.car?.brand ?? ""} ${
        booking?.car?.model ?? ""
      }`.trim(),
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        setShareToast("Поделились");
        setTimeout(() => setShareToast(null), 1500);
        return;
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareToast("Ссылка скопирована");
        setTimeout(() => setShareToast(null), 1800);
      }
    } catch (e: any) {
      // если пользователь отменил — просто выходим
      if (e?.name === "AbortError") return;
      await navigator.clipboard.writeText(shareUrl);
      setShareToast("Ссылка скопирована");
      setTimeout(() => setShareToast(null), 1800);
    }
  }

  // ---------------------------- UI ---------------------------------------

  // плавающая мобильная панель
  const showMobileActionBar =
    bookingStatus.status &&
    (bookingStatus.confirmBut || bookingStatus.cancelBut);

  const containerPad = showMobileActionBar ? "pb-24 lg:pb-0" : "";

  if (!id) {
    return (
      <main className={`text-gray-600 px-4 sm:px-6 max-w-7xl mx-auto`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-semibold text-xl sm:text-2xl text-gray-800">
            Бронирование
          </h1>
          <button
            className="border-gray-300 border rounded-md px-3 py-2 sm:py-2 text-sm sm:text-base active:scale-[.98] transition"
            onClick={handleBack}
          >
            <div className="flex items-center text-gray-600">
              <ChevronLeftIcon className="w-4 mr-1" strokeWidth={1.6} />
              <span>Назад</span>
            </div>
          </button>
        </div>
        <div className="border-b border-gray-100 mt-4 sm:mt-5 shadow-sm" />
        <div className="mt-6">
          Нет id бронирования. Откройте карточку из списка.
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className={`text-gray-600 px-4 sm:px-6 max-w-7xl mx-auto`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-semibold text-xl sm:text-2xl text-gray-800">
            Booking # <span className="font-normal text-green-500">{id}</span>
          </h1>
          <button
            className="border-gray-300 border rounded-md px-3 py-2 text-sm sm:text-base active:scale-[.98] transition"
            onClick={handleBack}
          >
            <div className="flex items-center text-gray-600">
              <ChevronLeftIcon className="w-4 mr-1" strokeWidth={1.6} />
              <span>Back</span>
            </div>
          </button>
        </div>
        <div className="border-b border-gray-100 mt-4 sm:mt-5 shadow-sm" />
        <div className="mt-6">
          Загружаю данные бронирования… (проверь Supabase клиент, если висит
          долго)
        </div>
      </main>
    );
  }

  // Доп. данные
  const priceTotal: number | undefined =
    (booking as any)?.priceTotal ?? undefined;
  const deposit: number | undefined =
    (booking as any)?.car?.deposit ?? undefined;
  const pickup: string | undefined = (booking as any)?.pickup ?? undefined;
  const delivery: number | undefined = (booking as any)?.delivery ?? undefined;
  const services: { id: string; name: string; sum: number }[] | undefined =
    (booking as any)?.services ?? undefined;
  const mileage: { days: number; overprice: number } | undefined =
    (booking as any)?.mileage ?? undefined;
  const plate: string | undefined =
    (booking as any)?.car?.licensePlate ?? undefined;

  // показываем бар только в поездке/после
  const showTripBar =
    booking?.status === "rent" || booking?.status === "finished";

  return (
    <main className={`text-gray-600 max-w-4xl  ${containerPad}`}>
      {/* Header */}
      <div className="flex flex-col gap-0 sm:gap-3 md:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-xl sm:text-2xl text-gray-800">
            Booking&nbsp;
            <span className="font-normal text-lime-500">#{displayId}</span>
          </h1>
          {/* маленькая QR-кнопка (desktop) */}
          <button
            onClick={() => setQrOpen(true)}
            className=" inline-flex rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 active:scale-[.98]"
            title="Показать QR-код"
          >
            QR
          </button>
          <button
            onClick={shareBooking}
            className=" inline-flex rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 active:scale-[.98] items-center gap-1"
            title="Поделиться ссылкой на бронирование"
          >
            <ShareIcon className="w-4 h-4" />
            Share
          </button>
        </div>
        <div className="">
          {/* статус-плашка на десктопе */}
          <Badge variant="dot" color={statusView.cls}>
            {statusView.text}
          </Badge>
          {/* <button
            className="border-gray-300 border rounded-md px-3 py-2 text-sm sm:text-base active:scale-[.98] transition"
            onClick={handleBack}
          >
            <div className="flex items-center text-gray-600">
              <ChevronLeftIcon className="w-4 mr-1" strokeWidth={1.6} />
              <span>Back</span>
            </div>
          </button> */}
        </div>
      </div>

      {/* <div className="border-b border-gray-100 mt-4 sm:mt-5 shadow-sm" /> */}

      {/* Content grid */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT (details) */}
        <div className="lg:col-span-2">
          {/* Photo */}
          <section className="lg:hidden flex gap-3 mb-5">
            <div
              id="photo"
              className={`${!bookingStatus.status ? "opacity-40" : ""} flex-1`}
            >
              {booking.car?.photo ? (
                <div className="aspect-video w-full overflow-hidden rounded-2xl">
                  <img
                    src={booking.car.photo}
                    className="h-full w-full object-cover"
                    alt="Car"
                  />
                </div>
              ) : (
                <div className="w-full rounded-2xl bg-gray-100 aspect-video flex items-center justify-center text-sm text-gray-400">
                  no photo
                </div>
              )}
            </div>

            {/* Name */}
            <div
              id="name"
              className={`${!bookingStatus.status ? "opacity-60" : ""}`}
            >
              <p className="font-semibold text-gray-800">
                {booking.car?.brand} {booking.car?.model} {booking.car?.year}{" "}
              </p>
              <p className="pt-1">
                {plate ? (
                  <span className="border border-gray-500 rounded-sm p-1 text-sm text-gray-800">
                    {plate}
                  </span>
                ) : null}
              </p>
            </div>
          </section>

          {/* Dates */}
          <section id="dates">
            <p className="font-medium text-base sm:text-lg text-gray-800">
              Dates of trip
            </p>
            <div className="mt-2 flex justify-between md:justify-normal items-center gap-5">
              {/* Start */}
              <div className="flex items-start">
                <CalendarDaysIcon className="w-5 shrink-0" />
                <div
                  className={`${
                    !bookingStatus.status ? "line-through" : ""
                  } flex flex-col font-normal pl-2`}
                >
                  <p className="text-sm sm:text-base">
                    {format(parseISO(booking.startAt), "eee, d MMMM")}
                  </p>
                  <p className="text-sm sm:text-base">
                    {format(parseISO(booking.startAt), "HH:mm")}
                  </p>
                </div>
              </div>
              <div>
                <ArrowRightIcon className="w-5" />
              </div>
              {/* End */}
              <div className="flex items-start">
                <CalendarDaysIcon className="w-5 shrink-0" />
                <div
                  className={`${
                    !bookingStatus.status ? "line-through" : ""
                  } flex flex-col font-normal pl-2`}
                >
                  <p className="text-sm sm:text-base">
                    {format(parseISO(booking.endAt), "eee, d MMMM")}
                  </p>
                  <p className="text-sm sm:text-base">
                    {format(parseISO(booking.endAt), "HH:mm")}
                  </p>
                </div>
              </div>
            </div>

            {/* Прогресс поездки */}
            {showTripBar && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-800">
                    {booking?.status === "rent"
                      ? "Прогресс поездки"
                      : "Поездка завершена"}
                  </span>
                  {booking?.status === "rent" &&
                    typeof tripProgress === "number" && (
                      <span className="text-sm font-medium text-gray-800">
                        {tripProgress}%
                      </span>
                    )}
                </div>
                <div
                  className="h-2 w-full rounded-full bg-gray-100 overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={
                    booking?.status === "rent" &&
                    typeof tripProgress === "number"
                      ? tripProgress
                      : 100
                  }
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${
                      booking?.status === "rent" ? "bg-lime-400" : "bg-gray-400"
                    }`}
                    style={{
                      width:
                        booking?.status === "rent" &&
                        typeof tripProgress === "number"
                          ? `${tripProgress}%`
                          : "100%",
                    }}
                  />
                </div>
              </div>
            )}

            {/* До старта — только текст */}
            {booking?.status === "confirmed" && (
              <div className="mt-4 text-sm text-gray-600">
                До старта:&nbsp;
                {cdStart &&
                (cdStart.days || cdStart.hours || cdStart.minutes) ? (
                  <>
                    {cdStart.days ? `${cdStart.days} д ` : ""}
                    {cdStart.hours} ч {cdStart.minutes} мин
                  </>
                ) : (
                  "меньше минуты"
                )}
              </div>
            )}
          </section>

          {/* Location */}
          {pickup && (
            <section id="location" className="mt-6">
              <p className="font-medium text-base sm:text-lg">Pick-up/Return</p>
              <div className="flex items-start sm:items-center mt-2">
                <MapPinIcon className="w-5 shrink-0 mt-0.5 sm:mt-0" />
                <p className="font-normal pl-2 text-sm sm:text-base">
                  {pickup} —{" "}
                  {delivery && delivery > 0 ? (
                    <>{delivery}$</>
                  ) : (
                    <span className="text-green-500">Free</span>
                  )}
                </p>
              </div>
            </section>
          )}

          {/* Services */}
          <section id="services" className="mt-6">
            <p className="font-medium text-base sm:text-lg text-gray-800">
              Services
            </p>
            <div className="mt-2">
              {services?.length ? (
                <ul className="space-y-2">
                  {services.map((s) => (
                    <li key={s.id} className="flex items-start sm:items-center">
                      <PlusCircleIcon className="w-5 shrink-0 mt-0.5 sm:mt-0" />
                      <p className="font-normal pl-2 text-sm sm:text-base">
                        {s.name} — {s.sum}$
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-sm sm:text-base text-gray-500">
                  no services selected
                </span>
              )}
            </div>
          </section>

          {/* Mileage */}
          {mileage && (
            <section id="mileage" className="mt-6">
              <p className="font-medium text-base sm:text-lg text-gray-800">
                Include mileage
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-2">
                <MapIcon className="w-5 shrink-0" />
                <p className="text-sm sm:text-base">{mileage.days}km</p>
                <span className="text-sm sm:text-base">,</span>
                <p className="text-sm sm:text-base">
                  over — {mileage.overprice}$ per km
                </p>
              </div>
            </section>
          )}

          {/* Insurance */}
          <section id="insurance" className="mt-6">
            <p className="font-medium text-base sm:text-lg text-gray-800">
              Insurance
            </p>
            <div className="mt-2 flex items-start sm:items-center mr-0 sm:mr-10">
              <ShieldCheckIcon className="w-5 shrink-0 mt-0.5 sm:mt-0" />
              <p className="pl-2 text-sm sm:text-base">
                The guest's responsibility in case of damage to the car or theft
                is equal to the amount of the deposit.
              </p>
            </div>
          </section>

          {/* TOTAL */}
          {typeof priceTotal === "number" && (
            <section id="total" className="mt-6">
              <p className="font-semibold text-base sm:text-lg text-gray-800">
                TOTAL for RENT
              </p>
              <div className="mt-1">
                <p className="font-bold text-lg sm:text-xl text-red-800">
                  {priceTotal}$
                </p>
              </div>
            </section>
          )}

          {/* Deposit */}
          {typeof deposit === "number" && (
            <section id="deposit" className="mt-6 text-gray-800">
              <p className="font-semibold text-base sm:text-lg ">Deposit</p>
              <div className="mt-1 ">
                <p className="text-lg font-medium">
                  {deposit}${" "}
                  <span className="text-sm sm:text-base font-normal">
                    (refundable)
                  </span>
                </p>
              </div>
            </section>
          )}

          {/* Agreement */}
          <section
            id="agreement"
            className={`${!bookingStatus.status ? "hidden" : ""} mt-6`}
          >
            <div className="flex items-start sm:items-center">
              <DocumentArrowDownIcon className="w-5 shrink-0 text-lime-500 mt-0.5 sm:mt-0" />
              <p className="text-base sm:text-lg text-lime-500 pl-2">
                <a
                  href={
                    (booking as any)?.rentalAgreementUrl ||
                    "https://firebasestorage.googleapis.com/v0/b/tachki-cbd02.appspot.com/o/18533556.pdf?alt=media&token=da50f22e-7a02-4586-9000-4519b31d7c2c"
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Car rental agreement
                </a>
              </p>
            </div>
          </section>
          <div className=" lg:hidden border-b border-gray-100 mt-4 sm:mt-5 shadow-sm" />
        </div>

        {/* RIGHT (summary/actions) */}
        <aside className="lg:col-span-1 lg:sticky lg:top-6">
          {/* Photo */}
          <section className=" hidden lg:block">
            <div
              id="photo"
              className={`${!bookingStatus.status ? "opacity-40" : ""}`}
            >
              {booking.car?.photo ? (
                <div className="aspect-video w-full overflow-hidden rounded-2xl">
                  <img
                    src={booking.car.photo}
                    className="h-full w-full object-cover"
                    alt="Car"
                  />
                </div>
              ) : (
                <div className="w-full rounded-2xl bg-gray-100 aspect-video flex items-center justify-center text-sm text-gray-400">
                  no photo
                </div>
              )}
            </div>

            {/* Name */}
            <div
              id="name"
              className={`${!bookingStatus.status ? "opacity-60" : ""} mt-3`}
            >
              <p className="font-semibold text-lg text-gray-800">
                {booking.car?.brand} {booking.car?.model} {booking.car?.year}{" "}
                {plate ? (
                  <span className="border border-gray-800 rounded-sm p-1 text-sm">
                    {plate}
                  </span>
                ) : null}
              </p>
            </div>
          </section>

          {/* Confirm/Cancel (desktop only) */}
          <div id="confirmBlock" className="hidden lg:block">
            {bookingStatus.status ? (
              <>
                <div id="confirmAlert" className="mt-6">
                  <p className="border rounded-xl p-4 text-base">
                    {booking.status === "confirmed" ? (
                      <>
                        {bookingStatus.comment}
                        {cdStart &&
                        (cdStart.days || cdStart.hours || cdStart.minutes) ? (
                          <>
                            {cdStart.days ? `${cdStart.days} д ` : ""}
                            {cdStart.hours} ч {cdStart.minutes} мин
                          </>
                        ) : (
                          <span>меньше минуты</span>
                        )}
                      </>
                    ) : booking.status === "rent" &&
                      typeof tripProgress === "number" ? (
                      <>Поездка идёт • {tripProgress}%</>
                    ) : (
                      bookingStatus.comment
                    )}
                  </p>
                </div>

                {bookingStatus.confirmBut && (
                  <div id="confirmButton" className="mt-2">
                    <button
                      className="border rounded-md border-green-400 text-green-600 w-full py-2 text-base active:scale-[.99] transition"
                      onClick={handleConfirmBooking}
                    >
                      Confirm booking
                    </button>
                  </div>
                )}

                {bookingStatus.cancelBut && (
                  <div id="cancelButton" className="mt-2">
                    <button
                      className="border rounded-md border-gray-300 text-gray-700 w-full py-2 text-base active:scale-[.99] transition"
                      onClick={handleCancelBooking}
                    >
                      Cancel booking
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div id="cancelAlert" className="mt-6">
                <p className="border rounded-xl p-4 text-base">
                  {bookingStatus.comment}
                </p>
              </div>
            )}
          </div>

          {/* Guest (заглушка) */}
          <div id="guest" className=" lg:mt-10">
            <div className="flex items-center">
              <button className="shrink-0">
                <img
                  src={"/masha.jpg"}
                  alt="Guest"
                  className="border rounded-full object-cover w-14 h-14 sm:w-16 sm:h-16"
                />
              </button>
              <div className="ml-4">
                <div>
                  <p className="text-base sm:text-lg font-semibold text-gray-800">
                    Oleg
                  </p>
                  <p className="text-xs sm:text-sm text-gray-700">
                    Joined Feb 2019
                  </p>
                </div>
                <div className="flex items-center mt-1">
                  <StarIcon className="h-4 text-violet-600" />
                  <p className="ml-1 text-xs sm:text-sm text-gray-700">4.8</p>
                  <p className="ml-2 text-xs sm:text-sm text-gray-700">
                    (8 trips)
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 font-medium text-base sm:text-lg text-gray-800">
              Verified info
            </div>
            <ul className="mt-3 text-sm sm:text-base">
              <li className="flex justify-between items-center mb-1">
                Phone number <CheckCircleIcon className="w-5 text-violet-500" />
              </li>
              <li className="flex justify-between items-center mb-1">
                Email <CheckCircleIcon className="w-5 text-violet-500" />
              </li>
              <li className="flex justify-between items-center mb-1">
                Passport <CheckCircleIcon className="w-5 text-violet-500" />
              </li>
              <li className="flex justify-between items-center">
                Driver's license{" "}
                <CheckCircleIcon className="w-5 text-violet-500" />
              </li>
            </ul>
          </div>
        </aside>
      </div>

      {/* MOBILE ACTION BAR (floating) */}
      {showMobileActionBar && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <div
            className="px-4 py-3 flex gap-3 max-w-7xl mx-auto"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)",
            }}
          >
            {bookingStatus.cancelBut && (
              <button
                onClick={handleCancelBooking}
                className="flex-1 border rounded-md border-gray-300 text-gray-700 py-3 text-sm active:scale-[.99] transition"
              >
                Cancel
              </button>
            )}
            {bookingStatus.confirmBut && (
              <button
                onClick={handleConfirmBooking}
                className="flex-1 rounded-md bg-green-600 text-white py-3 text-sm active:scale-[.99] transition"
              >
                Confirm
              </button>
            )}
          </div>
        </div>
      )}

      {/* QR MODAL */}
      {qrOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Booking QR code"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="w-full max-w-sm sm:max-w-md rounded-2xl bg-white shadow-lg p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800">
                Booking #{displayId}
              </h2>
              <button
                className="p-2 rounded-md hover:bg-gray-100 active:scale-[.98]"
                onClick={() => setQrOpen(false)}
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="mt-4 sm:mt-6">
              {qrSrc ? (
                <img
                  src={qrSrc}
                  alt="QR code"
                  className="mx-auto w-56 h-56 sm:w-72 sm:h-72 object-contain"
                />
              ) : (
                <div className="mx-auto w-56 h-56 sm:w-72 sm:h-72 rounded-xl bg-gray-100 animate-pulse" />
              )}
            </div>
            <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2">
              <button
                onClick={downloadQR}
                className="flex-1 rounded-md bg-gray-900 text-white py-2.5 text-sm active:scale-[.99]"
                disabled={!qrSrc}
              >
                Download PNG
              </button>
              <button
                onClick={copyFullId}
                className="flex-1 rounded-md border border-gray-300 text-gray-800 py-2.5 text-sm active:scale-[.99]"
              >
                Copy full ID
              </button>
              <button
                onClick={shareBooking}
                className="flex-1 rounded-md bg-blue-600 text-white py-2.5 text-sm active:scale-[.99]"
              >
                Share
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 break-all">{booking.id}</p>
          </div>
        </div>
      )}
      {shareToast && (
        <div
          className="fixed top-20 md:right-6 z-[999] bg-gray-900 text-white text-sm px-3 py-2 rounded-md shadow"
          aria-live="polite"
        >
          {shareToast}
        </div>
      )}
    </main>
  );
};

export default BookingCard;
