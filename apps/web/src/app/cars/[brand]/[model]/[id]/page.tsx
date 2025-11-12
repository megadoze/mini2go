import { notFound } from "next/navigation";
import ClientCarLanding from "./clientCarLanding"; // client component (use client внутри)
import type { CarWithRelations } from "@/types/carWithRelations";
import { fetchCarByIdServer } from "@/services/car.server";

// Сделать params *явно* Promise (или undefined) — это то, что требует проверка типов
type Props = { params?: Promise<{ id?: string }> | undefined };

export default async function Page({ params }: Props) {
  // Нормализуем значение в рантайме — если params plain object или Promise, этот код работает одинаково.
  // (await on a plain object просто вернёт его)
  const resolved = params ? await params : undefined;
  const { id: carId } = resolved ?? {};

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
