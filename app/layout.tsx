import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Clara's Money Diary 🎀 | Finance Tracker",
  description: "A cute and modern personal finance tracker made especially for Clara Heng Jia Ee",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col bg-[#FFF5F7] text-slate-800 selection:bg-pink-200 selection:text-pink-900">
        {children}
      </body>
    </html>
  );
}
