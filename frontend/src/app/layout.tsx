import type { Metadata } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import BootstrapClient from "@/app/components/BootstrapClient";
import "./globals.scss";
import { Header } from "./components/Header";
import { SessionExpiryWatcher } from "./components/SessionExpiryWatcher";
import { getSession } from "./lib/session";

export const metadata: Metadata = {
  title: "SDA Download UI",
  description: "An UI for the SDA download",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  const exp = session?.expires ? new Date(session?.expires).getTime() : undefined;

  return (
    <html lang="en">
      <body>
        <Header />
        <BootstrapClient />
        {children}
        {exp && <SessionExpiryWatcher expiresAt={exp * 1000} />}
      </body>
    </html>
  );
}
