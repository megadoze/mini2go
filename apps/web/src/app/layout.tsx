// app/layout.tsx
import type { Metadata } from "next";
import { mantineHtmlProps } from "@mantine/core";
import "./globals.css";
import { AppProviders } from "./providers";

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
    <html lang="en" {...mantineHtmlProps}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
