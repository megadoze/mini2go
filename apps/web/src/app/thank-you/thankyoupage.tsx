"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function ThankYouClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const bookingId = searchParams.get("booking");

  // можно сделать короткий номер для отображения
  const shortBooking =
    bookingId && bookingId.length > 8
      ? bookingId.slice(0, 8).toUpperCase()
      : bookingId;

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg border border-neutral-200 p-6 sm:p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <span className="text-2xl">✅</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900">
          Thank you for your booking!
        </h1>

        {bookingId ? (
          <p className="mt-3 text-sm sm:text-base text-neutral-600">
            Your booking ID:
            <span className="ml-1 font-mono text-neutral-900">
              {shortBooking}
            </span>
          </p>
        ) : (
          <p className="mt-3 text-sm sm:text-base text-neutral-600">
            We have received your booking request.
          </p>
        )}

        <p className="mt-2 text-xs sm:text-sm text-neutral-500">
          We’ll review your request and contact you shortly with confirmation
          details.
        </p>

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full rounded-xl bg-black text-white py-2.5 text-sm font-medium hover:bg-black/90 cursor-pointer"
          >
            Back to homepage
          </button>

          <Link
            href="/cars"
            className="block w-full rounded-xl border border-neutral-300 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 cursor-pointer"
          >
            Browse more cars
          </Link>
        </div>

        <div className="mt-4 text-[11px] text-neutral-500">
          If you entered your email, a confirmation will be sent there.
        </div>
      </div>
    </div>
  );
}
