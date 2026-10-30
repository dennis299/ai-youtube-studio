import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/sidebar";
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
  title: "AI YouTube Studio",
  description:
    "Run a faceless YouTube channel end to end: research, plan, storyboard, check in, produce with OpenMontage, publish.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh md:flex">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 pt-6 pb-16 sm:px-6 md:pt-10 lg:px-10">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
