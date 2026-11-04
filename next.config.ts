import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma istemcisi paketlenmez; OpenNext Workers için "workerd" sürümünü kopyalar.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
