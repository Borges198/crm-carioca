import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AuthProviderClient from "../components/AuthProviderClient";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Painel de Viagens",
  description: "Sistema para criacao e gestao de cotacoes de viagens.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProviderClient>{children}</AuthProviderClient>
      </body>
    </html>
  );
}
