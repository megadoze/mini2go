// BookingCarCard.tsx
import React from "react";

type BookingCarCardProps = {
  car: any;
  isFinished?: boolean;
};

export const BookingCarCard: React.FC<BookingCarCardProps> = ({
  car,
  isFinished = false,
}) => {
  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-4 sm:p-5">
      {/* фото */}
      <div className="aspect-video w-full overflow-hidden rounded-xl ring-1 ring-gray-200 bg-gray-100">
        {car?.coverPhotos?.[0] ? (
          <img
            src={car.coverPhotos[0]}
            className={`h-full w-full object-cover ${
              isFinished ? "opacity-50" : ""
            }`}
            alt="Car"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
            no photo
          </div>
        )}
      </div>

      {/* текст */}
      <div className="mt-3">
        <p className="text-sm font-semibold text-gray-900">
          {car?.model?.brands?.name} {car?.model?.name} {car?.year}
        </p>

        {car?.licensePlate && (
          <p className="mt-1 inline-flex items-center rounded-md border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-[10px] font-mono text-gray-700 shadow-sm ring-1 ring-white/50">
            {car.licensePlate}
          </p>
        )}
      </div>
    </section>
  );
};
