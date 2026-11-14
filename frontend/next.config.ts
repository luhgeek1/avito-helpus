import type { NextConfig } from "next";

/** In Docker nginx routes /api/v1 to the API; `npm run dev` proxies it here instead. */
const orbiBackend = process.env.ORBI_BACKEND_URL ?? "http://localhost:8080";

const config: NextConfig = {
  devIndicators: false,
  output: "standalone",
  // gzip buffers proxied SSE (chat and /events) until the stream ends; nginx compresses in Docker.
  compress: false,
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${orbiBackend}/api/v1/:path*` }];
  },
};

export default config;
