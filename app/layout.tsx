import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { NavBar } from "@/components/NavBar";
import { ThemeManager } from "@/components/ThemeManager";
import { themeInitScript } from "@/lib/theme";

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
  title: "Lyrics Translator",
  description:
    "Translate song lyrics line by line and build a personal vocabulary list. Everything stays in your browser.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Runs before the first paint so the page never flashes the wrong
          theme. It has to be inline and blocking for that to work, which is
          why it is injected as a string rather than imported as a module.
        */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeManager />
        <NavBar />
        {children}
      </body>
    </html>
  );
}
