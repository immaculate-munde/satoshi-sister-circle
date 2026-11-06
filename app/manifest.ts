import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chama on Lightning",
    short_name: "Chama",
    description: "Save together. Paid out on time.",
    start_url: "/home",
    display: "standalone",
    background_color: "#F7FAF8",
    theme_color: "#0F6B4C",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
