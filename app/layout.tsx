import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: {
    default: "ADHDer.io",
    template: "%s / ADHDer.io",
  },
  description: "Tools for ADHD minds - check-ins, getting unstuck, and impulse control.",
  applicationName: "ADHDer.io",
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}