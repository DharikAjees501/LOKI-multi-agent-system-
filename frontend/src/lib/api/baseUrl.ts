/**
 * Centralized API base URL resolver for LOKI SwarmLens.
 * Normalizes URLs across local dev and Render production deployments.
 */
export function getApiBaseUrl(): string {
  // 1. IN THE BROWSER (Client-side):
  if (typeof window !== "undefined") {
    const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
    // Only use envUrl directly if it is an actual public domain with a dot (e.g. my-backend.onrender.com)
    if (envUrl && (envUrl.includes(".") || envUrl.includes("localhost"))) {
      let clean = envUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
      if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
        clean = `https://${clean}`;
      }
      return `${clean}/api`;
    }
    // ALWAYS use relative "/api" in the browser so requests proxy through Next.js rewrite
    // This prevents ERR_NAME_NOT_RESOLVED on internal hostnames like "swarmlens-backend"
    return "/api";
  }

  // 2. ON THE SERVER (SSR):
  const internal = process.env.BACKEND_INTERNAL_URL?.trim();
  if (internal) {
    let clean = internal.replace(/\/api\/?$/, "").replace(/\/+$/, "");
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = `http://${clean}`;
    }
    return `${clean}/api`;
  }

  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envUrl) {
    let clean = envUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = clean.includes(".") ? `https://${clean}` : `http://${clean}:10000`;
    }
    return `${clean}/api`;
  }

  return "http://127.0.0.1:8000/api";
}

export const API_BASE_URL = getApiBaseUrl();
