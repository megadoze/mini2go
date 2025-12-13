// app/cars/[brand]/[model]/[id]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import ClientCarLanding from "./clientCarLanding";
import type { CarWithRelations } from "@/types/carWithRelations";
import { fetchCarByIdServer } from "@/services/car.server";
import { fetchCarSeoServer } from "@/services/carSeo.server";

type Params = { brand?: string; model?: string; id?: string };
type Props = { params: Promise<Params> };

// ✅ cache() чтобы в рамках одного запроса не было 2 одинаковых запросов
const getCar = cache(async (id: string) => {
  return (await fetchCarByIdServer(id)) as CarWithRelations | null;
});

const getSeo = cache(async (id: string, locale: string) => {
  return await fetchCarSeoServer(id, locale);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: carId } = await params;

  if (!carId) return {};

  const [car, seo] = await Promise.all([getCar(carId), getSeo(carId, "en")]);

  if (!car) return {};

  const modelObj = (car as any).model ?? (car as any).models ?? undefined;
  const fallbackTitle = `${modelObj?.brands?.name ?? ""} ${
    modelObj.name ?? ""
  } ${car.year ?? ""}`.trim();

  const title = seo?.seo_title?.trim() || fallbackTitle;
  const description = seo?.seo_description?.trim() || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function Page({ params }: Props) {
  const { id: carId } = await params;

  if (!carId) return notFound();

  let car: CarWithRelations | null = null;

  try {
    car = await getCar(carId);
  } catch (err) {
    console.error("fetchCarByIdServer error:", err);
    return notFound();
  }

  if (!car) return notFound();

  return <ClientCarLanding serverCar={car} />;
}
