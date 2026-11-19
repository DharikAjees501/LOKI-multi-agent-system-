/**
 * Centralized API base URL resolver for LOKI SwarmLens.
 * Normalizes URLs across local dev and Render production deployments.
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (envUrl) {
    let clean = envUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = `https://${clean}`;
    }
    return `${clean}/api`;
  }

  // When running in the browser, using relative "/api" delegates to Next.js rewrites
  if (typeof window !== "undefined") {
    return "/api";
  }

  return "http://127.0.0.1:8000/api";
}

export const API_BASE_URL = getApiBaseUrl();
