/**
 * Centralized API base URL resolver for LOKI SwarmLens.
 * Normalizes URLs across local dev, Render, and Vercel deployments.
 */
const isDev = process.env.NODE_ENV !== "production";

export function getApiBaseUrl(): string {
  // 1. IN THE BROWSER (Client-side):
  if (typeof window !== "undefined") {
    // ALWAYS use relative "/api" in the browser so requests proxy through Next.js / Vercel rewrite
    return "/api";
  }

  // 2. ON THE SERVER (SSR / Next.js Server):
  if (process.env.BACKEND_INTERNAL_URL) {
    let clean = process.env.BACKEND_INTERNAL_URL.trim().replace(/\/api\/?$/, "").replace(/\/+$/, "");
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = `https://${clean}`;
    }
    return `${clean}/api`;
  }

  if (process.env.NEXT_PUBLIC_API_URL) {
    let clean = process.env.NEXT_PUBLIC_API_URL.trim().replace(/\/api\/?$/, "").replace(/\/+$/, "");
    if (clean.startsWith("/")) {
      return clean;
    }
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = `https://${clean}`;
    }
    return `${clean}/api`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api`;
  }

  return isDev ? "http://127.0.0.1:8000/api" : "https://swarmlens-backend.onrender.com/api";
}

export const API_BASE_URL = getApiBaseUrl();
