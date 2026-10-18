import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "揪練｜小團教練與學員",
    short_name: "揪練",
    description: "揪越多人，每人越便宜。小團上課、打卡盯梢、自動計價。",
    start_url: "/home",
    display: "standalone",
    background_color: "#eef2f7",
    theme_color: "#2347c8",
    lang: "zh-Hant-TW",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
