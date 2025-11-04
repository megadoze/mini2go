"use client";

import Link from "next/link";

export default function CatalogCardGlass({
  car,
  pricingMeta,
  ownerSettings,
}: any) {
  const brand = car.models?.brands?.name ?? "—";
  const model = car.models?.name ?? "—";
  const title = `${brand} ${model}`;
  const price = pricingMeta?.baseDailyPrice ?? car.price ?? 0;

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-2xl bg-white/60 shadow-sm">
      <Link href={`/cars/${car.id}`}>
        <img src={car.photos?.[0] ?? ""} alt={title} />
        <div className="p-4">
          <h2>{title}</h2>
          <p>
            {price} {ownerSettings?.currency ?? "EUR"} /day
          </p>
        </div>
      </Link>
    </li>
  );
}
