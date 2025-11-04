// src/app/cars/page.tsx
import { Metadata } from "next";
import ClientOnly from "@/app/cars/clientOnly";
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
    <ClientOnly>
      <CatalogClient />
    </ClientOnly>
  );
}

// import { Metadata } from "next";
// import CatalogClient from "./catalogClient";

// export const metadata: Metadata = {
//   title: "Cars - MINI2GO",
//   description: "Fleet MINI2GO. Browse and rent cars.",
//   openGraph: {
//     title: "Cars - MINI2GO",
//     description: "Fleet MINI2GO",
//   },
// };

// export default function CatalogPage() {
//   return <CatalogClient />;
// }
