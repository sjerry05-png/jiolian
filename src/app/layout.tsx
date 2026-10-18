import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "揪練｜揪越多人，每人越便宜", template: "%s｜揪練" },
  description: "教練帶一家人、一群朋友組小團，在家、公園或健身房上課。人數隨時變，價格自動算，下課後還會盯著你練。",
  applicationName: "揪練",
  appleWebApp: { capable: true, title: "揪練", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1524" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant-TW" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..800&family=Huninn&family=Noto+Sans+TC:wght@400;500;700&display=swap"
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
