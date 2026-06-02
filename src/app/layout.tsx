import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PowerShell AD Command Generator",
  description: "Service for generating PowerShell commands for Active Directory management",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Cdefs%3E%3ClinearGradient id='a' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%230078D4'/%3E%3Cstop offset='100%25' stop-color='%23005A9E'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='128' height='128' rx='18' fill='url(%23a)'/%3E%3Cpath d='M30 28l56-12v48L30 64zm0 72l56 12V72l-56 4zm64-82l12-4v44l-12 4zm0 56l12 4v44l-12-4z' fill='white' opacity='.95'/%3E%3C/svg%3E",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
