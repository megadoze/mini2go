// apps/web/app/cars/page.tsx
import { Suspense } from "react";
import { Metadata } from "next";
import CatalogClient from "./catalogClient";

export const metadata: Metadata = {
  title: "Cars - MINI2GO",
  description: "Fleet MINI2GO. Browse and rent cars.",
  openGraph: {
    title: "Cars - MINI2GO",
    description: "Fleet MINI2GO",
  },
};

export default function CatalogPage() {
  return (
    <Suspense fallback={null}>
      <CatalogClient />
    </Suspense>
  );
}
