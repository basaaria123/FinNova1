// In development, Vite proxies /api → localhost:3000
// In production, VITE_API_URL must point to the deployed backend (e.g. Render)
const BASE_URL = import.meta.env.VITE_API_URL ?? "";

export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}
