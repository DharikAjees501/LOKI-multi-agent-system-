/**
 * Centralized API base URL resolver for LOKI SwarmLens.
 * Normalizes URLs across local dev and Render production deployments.
 */
export function getApiBaseUrl(): string {
  // 1. IN THE BROWSER (Client-side):
  if (typeof window !== "undefined") {
    // ALWAYS use relative "/api" in the browser so requests proxy through Next.js rewrite
    // This routes directly through the current origin without any hostname or CORS issues
    return "/api";
  }

  // 2. ON THE SERVER (SSR / Next.js Server):
  const internal = process.env.BACKEND_INTERNAL_URL?.trim();
  if (internal) {
    let clean = internal.replace(/\/api\/?$/, "").replace(/\/+$/, "");
    if (clean.includes("swarmlens-backend:10000") || clean.endsWith("swarmlens-backend")) {
      return "https://swarmlens-backend.onrender.com/api";
    }
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = `https://${clean}`;
    }
    return `${clean}/api`;
  }

  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envUrl) {
    let clean = envUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
    if (clean.includes("swarmlens-backend:10000") || clean.endsWith("swarmlens-backend")) {
      return "https://swarmlens-backend.onrender.com/api";
    }
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = clean.includes(".") ? `https://${clean}` : `https://${clean}.onrender.com`;
    }
    return `${clean}/api`;
  }

  return "https://swarmlens-backend.onrender.com/api";
}

export const API_BASE_URL = getApiBaseUrl();
