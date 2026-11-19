import type { NextConfig } from "next";

let rawUrl =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

rawUrl = rawUrl.trim().replace(/\/api\/?$/, "");

if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
  if (rawUrl.includes(".")) {
    rawUrl = `https://${rawUrl}`;
  } else {
    // Internal Render service name: swarmlens-backend -> http://swarmlens-backend:10000
    rawUrl = `http://${rawUrl}:10000`;
  }
}
const backendUrl = rawUrl;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/keys/:path*",
        destination: `${backendUrl}/keys/:path*`,
      },
    ];
  },
};

export default nextConfig;
