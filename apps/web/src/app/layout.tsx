// app/layout.tsx

import "./globals.css";
import type { Metadata } from "next";
import { mantineHtmlProps } from "@mantine/core";
import { AppProviders } from "./providers";
import {
  Boogaloo,
  Montserrat,
  Pacifico,
  Roboto_Condensed,
} from "next/font/google";

const robotoCondensed = Roboto_Condensed({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-roboto-condensed",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});

const pacifico = Pacifico({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-pacifico",
  display: "swap",
});

const boogaloo = Boogaloo({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-boogaloo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MINI2GO",
  description: "Rent MINI - drive dream!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      {...mantineHtmlProps}
      className={`${robotoCondensed.variable} ${montserrat.variable} ${pacifico.variable} ${boogaloo.variable}`}
    >
      <body
        className={`${robotoCondensed.className} ${montserrat.className} ${pacifico.variable} ${boogaloo.variable}`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
