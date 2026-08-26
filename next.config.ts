import type { NextConfig } from "next";

// "standalone" output is for the self-hosted Docker build (see Dockerfile) — Vercel
// packages the app itself and doesn't need it, so skip it when building on Vercel.
const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
};

export default nextConfig;
