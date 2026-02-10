import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: {
    default: "ADHDer.io",
    template: "%s / ADHDer.io",
  },
  description: "Tools for ADHD minds - check-ins, getting unstuck, and impulse control.",
  applicationName: "ADHDer.io",
};

export const viewport: Viewport = {
  themeColor: "#1da1f2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <AppShell />
        </Providers>
      </body>
    </html>
  );
}
