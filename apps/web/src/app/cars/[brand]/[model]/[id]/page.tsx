// app/cars/[brand]/[model]/[id]/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ClientCarLanding from "./clientCarLanding";
import { fetchCarByIdServer } from "@/services/car.server";
import { fetchCarSeoServer } from "@/services/carSeo.server";
import type { CarWithRelations } from "@/types/carWithRelations";

type RouteParams = { brand: string; model: string; id: string };

// ВАЖНО: params — Promise
type Props = { params: Promise<RouteParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: carId, brand, model } = await params;

  if (!carId) return {};

  const [car, seo] = await Promise.all([
    fetchCarByIdServer(carId),
    fetchCarSeoServer(carId, "en"),
  ]);

  if (!car) return {};

  const fallbackTitle = `${car.model?.brands?.name ?? ""} ${
    car.model?.name ?? ""
  } ${car.year ?? ""}`.trim();

  const stripTags = (s?: string | null) =>
    (s ?? "").replace(/<[^>]*>/g, "").trim();

  const title = stripTags(seo?.seo_title) || fallbackTitle;

  const descRaw = stripTags(seo?.seo_description);
  const description = descRaw.length ? descRaw : undefined;

  const ogImage = (car.coverPhotos?.[0] as string | undefined) ?? undefined;
  const urlPath = `/cars/${brand}/${model}/${carId}`;

  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical: urlPath },
    openGraph: {
      title,
      ...(description ? { description } : {}),
      type: "website",
      url: urlPath,
      ...(ogImage ? { images: [{ url: ogImage, alt: title }] } : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      ...(description ? { description } : {}),
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function Page({ params }: Props) {
  const { id: carId } = await params;

  if (!carId) return notFound();

  let car: CarWithRelations | null = null;
  try {
    car = await fetchCarByIdServer(carId);
  } catch (err) {
    console.error("fetchCarByIdServer error:", err);
    return notFound();
  }

  if (!car) return notFound();
  return <ClientCarLanding serverCar={car} />;
}
