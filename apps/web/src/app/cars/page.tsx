import { Metadata } from "next";
import CatalogClient from "./catalogClient"; // или как ты назвал файл

export const metadata: Metadata = {
  title: "Cars - MINI2GO",
  description: "Fleet MINI2GO. Browse and rent cars.",
  openGraph: {
    title: "Cars - MINI2GO",
    description: "Fleet MINI2GO",
  },
};

export default function CatalogPage() {
  return <CatalogClient />;
}
