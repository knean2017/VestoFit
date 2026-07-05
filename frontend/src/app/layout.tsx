import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import PageTransition from "@/components/PageTransition";

export const metadata: Metadata = {
  title: "VestoFit — your personal stylist",
  description:
    "Your AI-powered wardrobe assistant. Get outfit suggestions, try on clothes virtually, and shop within your budget.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
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
        <ToastProvider>
          <PageTransition>{children}</PageTransition>
        </ToastProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ("serviceWorker" in navigator) {
                window.addEventListener("load", () => {
                  navigator.serviceWorker.register("/sw.js").catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
