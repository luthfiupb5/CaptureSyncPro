import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import DeveloperCard from "@/components/DeveloperCard";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: 'swap',
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "CaptureSync Pro - Face-Recognition Photo Sync",
  description: "Secure, AI-powered photo distribution for events.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${outfit.variable} antialiased`}
      >
        {/* Global Cosmic Background */}
        <div className="fixed inset-0 min-h-screen pointer-events-none -z-50 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(17,24,39,1)_0%,_rgba(2,2,10,1)_100%)]"></div>
          <div className="absolute top-0 right-[-10%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[120px] mix-blend-screen animate-blob"></div>
          <div className="absolute bottom-0 left-[-10%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px] mix-blend-screen animate-blob animation-delay-2000"></div>
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '50px 50px' }}></div>
        </div>

        {children}
        <DeveloperCard />
      </body>
    </html>
  );
}
