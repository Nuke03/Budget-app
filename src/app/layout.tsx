import type { Metadata, Viewport } from "next";
import { Source_Serif_4, Work_Sans } from "next/font/google";
import "./globals.css";
import { NavBar } from "./NavBar";

const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-source-serif",
  display: "swap",
});

const sans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-work-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Budget",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Budget",
  },
};

export const viewport: Viewport = {
  themeColor: "#14306b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${serif.variable} ${sans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="flex-1 pb-28">{children}</div>
        <NavBar />
      </body>
    </html>
  );
}
