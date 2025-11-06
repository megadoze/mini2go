// apps/web/app/cars/page.tsx
import React, { Suspense } from "react";
import { Metadata } from "next";
import CatalogClient from "./catalogClient";
// import CatalogSkeletonGlass from "./catalogSkeletonFallback"; // опционально — или используй любой fallback

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
    <Suspense fallback={<div className="p-6">Loading cars…</div>}>
      <CatalogClient />
    </Suspense>
  );
}
