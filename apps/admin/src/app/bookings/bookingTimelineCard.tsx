// TripTimelineCard.tsx
import React from "react";
import { format } from "date-fns";
import { Badge } from "@mantine/core";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { mmToHHMM } from "@/utils/forBookingEditor";

type StatusView = { text: string; cls: string };

type Countdown = { days: number; hours: number; minutes: number } | null;

type Props = {
  cardCls: string;

  mode: "create" | "edit";
  mark: "booking" | "block";

  status: string | null;
  statusView: StatusView;

  isFinished: boolean;
  isLocked: boolean;

  startDateInp: string;
  endDateInp: string;

  effectiveOpenTime: number;
  effectiveCloseTime: number;

  durationDays: number;
  durationHours: number;
  durationMinutes: number;

  startDate: Date | null;
  endDate: Date | null;

  tripProgress: number;
  cdStart: Countdown;
  role: "host" | "guest" | "other";

  onOpenPicker: () => void;
};

function fmtLocal(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const BookingTimelineCard: React.FC<Props> = ({
  cardCls,
  mode,
  mark,
  status,
  statusView,
  isFinished,
  isLocked,
  startDateInp,
  endDateInp,
  effectiveOpenTime,
  effectiveCloseTime,
  durationDays,
  durationHours,
  durationMinutes,
  startDate,
  endDate,
  tripProgress,
  cdStart,
  role,
  onOpenPicker,
}) => {
  const hasDates = Boolean(startDateInp && endDateInp);

  return (
    <section className={cardCls}>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Trip timeline
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Start / end time, duration, and status
          </p>
        </div>

        {/* статус для мобильного когда нет header-badge (например create/block) */}
        {mode !== "edit" && mark === "booking" && status && (
          <Badge
            variant="dot"
            color={statusView.cls as any}
            fw={500}
            className="uppercase tracking-wide text-[10px] leading-none"
          >
            {statusView.text}
          </Badge>
        )}
      </div>

      {/* дата-кнопка или статичные даты */}
      <div className="mt-4">
        {!isFinished ? (
          status !== "rent" ? (
            <button
              type="button"
              className={`w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-left shadow-sm hover:bg-gray-50 active:scale-[.995] ${
                isLocked ? "opacity-60 cursor-not-allowed" : ""
              }`}
              onClick={() => !isLocked && onOpenPicker()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 md:py-1">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-700 ring-1 ring-gray-200">
                    <CalendarDaysIcon className="size-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] uppercase tracking-wide text-gray-500">
                      Rental period
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {hasDates
                        ? `${format(
                            new Date(startDateInp).toISOString(),
                            "d MMM, HH:mm"
                          )} — ${format(
                            new Date(endDateInp).toISOString(),
                            "d MMM, HH:mm"
                          )}`
                        : "Select start and end"}
                    </span>
                  </div>
                </div>
                <ChevronRightIcon className="size-4 text-gray-400" />
              </div>
            </button>
          ) : (
            hasDates && (
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-800">
                <CalendarDaysIcon className="size-5 text-gray-700" />
                {format(
                  new Date(startDateInp).toISOString(),
                  "d MMM yy, HH:mm"
                )}
                <ArrowRightIcon className="size-4 text-gray-500" />
                {format(new Date(endDateInp).toISOString(), "d MMM yy, HH:mm")}
              </div>
            )
          )
        ) : (
          <p className="mt-2 line-through text-sm text-gray-500">
            {fmtLocal(startDateInp)} — {fmtLocal(endDateInp)}
          </p>
        )}

        {!isFinished && (
          <div className="mt-3 text-[11px] text-gray-500">
            {effectiveOpenTime === effectiveCloseTime ? (
              <>Working hours: 24/7</>
            ) : (
              <>
                Working hours:{" "}
                <span className="font-medium text-gray-700">
                  {mmToHHMM(effectiveOpenTime)} – {mmToHHMM(effectiveCloseTime)}
                </span>
              </>
            )}
          </div>
        )}

        <div className="mt-4 text-sm text-gray-700">
          <span className="text-gray-500">Duration: </span>
          <span className="font-medium text-gray-900">
            {durationDays}d {durationHours}h {durationMinutes}m
          </span>
        </div>
      </div>

      {/* прогресс или таймер до начала */}
      <div className="mt-6 space-y-3">
        {status === "rent" && startDate && endDate && (
          <div>
            <div className="flex items-center justify-between text-[11px] text-gray-600 mb-1">
              <span>{format(startDate, "d MMM, HH:mm")}</span>
              <span>{format(endDate, "d MMM, HH:mm")}</span>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full border border-gray-200 bg-gray-100">
              <div
                className="h-full bg-green-500/90 transition-[width] duration-500 ease-out"
                style={{ width: `${tripProgress}%` }}
                role="progressbar"
                aria-valuenow={tripProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>

            <div className="mt-1 text-right text-[11px] font-medium text-gray-700">
              {tripProgress}%
            </div>
          </div>
        )}

        {status === "confirmed" && cdStart && (
          <div className="rounded-lg border border-orange-200 bg-orange-50/50 px-4 py-3 text-sm text-orange-800 shadow-sm">
            <div className="font-medium">
              {role === "guest"
                ? "Your booking is confirmed"
                : role === "host"
                ? "Trip is confirmed"
                : "Booking confirmed"}
            </div>
            <div className="text-xs text-orange-700 mt-1">
              Starts in:&nbsp;
              {cdStart.days ? `${cdStart.days}d ` : ""}
              {cdStart.hours}h {cdStart.minutes}m
            </div>
          </div>
        )}

        {status === "onApproval" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm shadow-sm">
            <div className="font-medium text-amber-800">
              {role === "host"
                ? "Waiting for your confirmation"
                : role === "guest"
                ? "Request sent to host"
                : "Pending host approval"}
            </div>
            <div className="text-xs text-amber-700 mt-1">
              {role === "host"
                ? "Please confirm this booking."
                : role === "guest"
                ? "You can cancel before it's confirmed."
                : "Host hasn't confirmed yet."}
            </div>
          </div>
        )}

        {status === "finished" && (
          <div className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700 shadow-sm">
            Trip is finished.
          </div>
        )}
      </div>
    </section>
  );
};
