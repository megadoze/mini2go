// app/layout.tsx

import "./globals.css";
import type { Metadata } from "next";
import { mantineHtmlProps } from "@mantine/core";
import { AppProviders } from "./providers";
import {
  Boogaloo,
  Montserrat,
  Oleo_Script,
  Roboto_Condensed,
} from "next/font/google";

const oleo = Oleo_Script({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-oleo-script",
  display: "swap",
});

const robotoCondensed = Roboto_Condensed({
  subsets: ["latin"],
  weight: ["300", "400", "700", "800", "900"],
  variable: "--font-roboto-condensed",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

const boogaloo = Boogaloo({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-boogaloo",
  display: "swap",
});

// export const metadata: Metadata = {
//   title: "MINI2GO",
//   description: "Rent MINI - drive dream!",
// };

export const metadata: Metadata = {
  metadataBase: new URL("https://mini2go-app.vercel.app/"),
  title: "MINI2GO",
  description: "Rent MINI - drive dream!",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <body
        className={`${montserrat.className} ${robotoCondensed.variable} ${boogaloo.variable} ${oleo.variable}`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
