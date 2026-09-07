/**
 * Clipzilla API Client
 * Provides resilient fetch execution with structured error diagnostics,
 * automatic local fallback to FastAPI on http://127.0.0.1:8000, and creature-feature messaging.
 */

export class ApiError extends Error {
  constructor(message, status = 0, isConnection = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isConnection = isConnection;
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const DIRECT_BACKEND_ORIGIN = 'http://127.0.0.1:8000';

function resolveUrl(endpoint) {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (API_BASE) {
    return `${API_BASE}${cleanPath}`;
  }
  return cleanPath;
}

export async function request(endpoint, options = {}) {
  const primaryUrl = resolveUrl(endpoint);

  const executeFetch = async (targetUrl) => {
    const res = await fetch(targetUrl, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      let detail = '';
      try {
        const json = await res.json();
        detail = json.detail || json.message || '';
      } catch {
        detail = res.statusText;
      }
      throw new ApiError(
        detail || `Celluloid feed rejected with status ${res.status}`,
        res.status,
        false
      );
    }

    if (res.status === 204) return null;
    return await res.json().catch(() => null);
  };

  try {
    return await executeFetch(primaryUrl);
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }

    const isConn = err.name === 'TypeError' || err.message?.toLowerCase().includes('failed to fetch');

    // If relative fetch failed due to network / proxy offline, retry directly against local FastAPI port 8000
    if (isConn && !primaryUrl.startsWith(DIRECT_BACKEND_ORIGIN)) {
      const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const directFallbackUrl = `${DIRECT_BACKEND_ORIGIN}${cleanPath}`;
      try {
        return await executeFetch(directFallbackUrl);
      } catch (fallbackErr) {
        if (fallbackErr instanceof ApiError) {
          throw fallbackErr;
        }
      }
    }

    const friendlyMsg = isConn
      ? 'Clipzilla processing engine offline: Cannot contact the backend on http://127.0.0.1:8000. Ensure the server is active via python dev.py.'
      : (err.message || 'Film processing request failed.');
    throw new ApiError(friendlyMsg, 0, isConn);
  }
}

export const apiGet = (endpoint) => request(endpoint, { method: 'GET' });

export const apiPost = (endpoint, body) =>
  request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const apiPatch = (endpoint, body) =>
  request(endpoint, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const apiDelete = (endpoint) => request(endpoint, { method: 'DELETE' });
