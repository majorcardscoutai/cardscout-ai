import type { MetadataRoute } from "next";

/** Lets the site install to the Home Screen as an app — required for iPhone notifications. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CardHawk AI",
    short_name: "CardHawk",
    description: "Private trading-card deal desk",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#080b10",
    theme_color: "#080b10",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
