import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads live JSON state from disk, so render on each request.
  // cacheComponents/partial prefetching add nothing for a single-user localhost app.
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
