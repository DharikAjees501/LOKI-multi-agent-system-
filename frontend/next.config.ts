import type { NextConfig } from "next";

let rawUrl =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://swarmlens-backend.onrender.com";

rawUrl = rawUrl.trim().replace(/\/api\/?$/, "");

// Replace unresolvable internal Docker service names with public Render URL
if (
  rawUrl === "http://swarmlens-backend:10000" ||
  rawUrl === "swarmlens-backend" ||
  rawUrl.includes("swarmlens-backend:10000") ||
  rawUrl.endsWith("swarmlens-backend")
) {
  rawUrl = "https://swarmlens-backend.onrender.com";
}

if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
  if (rawUrl.includes(".")) {
    rawUrl = `https://${rawUrl}`;
  } else {
    rawUrl = `https://${rawUrl}.onrender.com`;
  }
}
const backendUrl = rawUrl;

const nextConfig: NextConfig = {
  async rewrites() {
    // If deployed on Vercel as a unified monorepo without an external backend override,
    // vercel.json handles edge routing directly to the backend service.
    if (process.env.VERCEL && !process.env.BACKEND_INTERNAL_URL && !process.env.NEXT_PUBLIC_API_URL) {
      return [];
    }
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
