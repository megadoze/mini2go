// apps/web/app/cars/page.tsx
import { Suspense } from "react";
import { Metadata } from "next";
import ThankYouClient from "./thankyoupage";

export const metadata: Metadata = {
  title: "Cars - MINI2GO",
  description: "Fleet MINI2GO. Browse and rent cars.",
  openGraph: {
    title: "Cars - MINI2GO",
    description: "Fleet MINI2GO",
  },
};

export default function ThankYouPage() {
  return (
    <Suspense fallback={null}>
      <ThankYouClient />
    </Suspense>
  );
}
