import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "FitMe — your personal stylist",
  description:
    "Your AI-powered wardrobe assistant. Get outfit suggestions, try on clothes virtually, and shop within your budget.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#FF6B5E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
