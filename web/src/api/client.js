/**
 * Clipzilla API Client
 * Provides resilient fetch execution with structured error diagnostics
 * and Clipzilla creature-feature error messaging.
 */

export class ApiError extends Error {
  constructor(message, status = 0, isConnection = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isConnection = isConnection;
  }
}

export async function request(endpoint, options = {}) {
  try {
    const res = await fetch(endpoint, {
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
      } catch (e) {
        detail = res.statusText;
      }
      throw new ApiError(
        detail || `Celluloid feed rejected with status ${res.status}`,
        res.status,
        false
      );
    }

    // Handle 204 No Content
    if (res.status === 204) return null;

    const data = await res.json().catch(() => null);
    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    // Network failure / Failed to fetch
    const isConn = err.name === 'TypeError' || err.message?.toLowerCase().includes('failed to fetch');
    const friendlyMsg = isConn
      ? 'Clipzilla engine offline: Cannot contact the processing backend on http://127.0.0.1:8000. Ensure the server is active via python dev.py.'
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

export const apiDelete = (endpoint) => request(endpoint, { method: 'DELETE' });
