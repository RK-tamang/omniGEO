import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle in `.next/standalone`, which is what
  // the Docker image ships. It keeps the runtime image to production
  // dependencies only.
  output: "standalone",
};

export default nextConfig;
