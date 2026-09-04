// Shared fetch helper for admin UI screens — reads the readable `admin_csrf` cookie
// (set alongside the httpOnly session cookie on login, docs/SECURITY.md §7) and attaches it
// as the double-submit header every admin route's `requireAdmin` checks for state-changing methods.
"use client";

function readCsrfCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith("admin_csrf="))
    ?.split("=")[1];
}

export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (method !== "GET" && method !== "HEAD") {
    const csrf = readCsrfCookie();
    if (csrf) headers.set("x-csrf-token", csrf);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  }
  return fetch(input, { ...init, method, headers, credentials: "same-origin" });
}
