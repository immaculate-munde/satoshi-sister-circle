import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Key-ching",
    short_name: "Key-ching",
    description: "Your chama on Lightning. Save together, paid out on time.",
    start_url: "/home",
    display: "standalone",
    background_color: "#FFF7FB",
    theme_color: "#21212E",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
