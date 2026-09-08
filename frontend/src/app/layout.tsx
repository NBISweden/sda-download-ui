import type { Metadata } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import BootstrapClient from "@/app/components/BootstrapClient";
import "./globals.scss";
import { Header } from "./components/Header";
import { SessionExpiryWatcher } from "./components/SessionExpiryWatcher";
import { getServerToken } from "./lib/serverToken";

export const metadata: Metadata = {
  title: "SDA Download UI",
  description: "An UI for the SDA download",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const jwt = await getServerToken();
  const expiresAtMs = jwt?.expiresAt ? jwt.expiresAt * 1000 : undefined; // `expiresAt` is seconds since epoch; convert once for the client watcher.

  return (
    <html lang="en">
      <body>
        <Header />
        <BootstrapClient />
        {children}
        {expiresAtMs && <SessionExpiryWatcher expiresAt={expiresAtMs} />}
      </body>
    </html>
  );
}
