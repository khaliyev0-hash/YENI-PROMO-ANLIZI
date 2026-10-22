/**
 * Centralized API URL helper to prevent double-prefix issues (/api/api/...)
 * Always returns a base URL guaranteed to end with '/api'.
 */
export function getApiBase(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    const trimmed = envUrl.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  const hostname =
    typeof window !== 'undefined' && window.location && window.location.hostname
      ? window.location.hostname
      : 'localhost';
  return `http://${hostname}:8000/api`;
}
