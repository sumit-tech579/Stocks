/**
 * Safe API client for TradeNest authentication endpoints.
 * Prevents HTML/SPA fallback response parsing errors (e.g. Unexpected token '<').
 */

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  isHtmlFallback?: boolean;
}

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const targetUrl = url.startsWith('/') && API_BASE ? `${API_BASE}${url}` : url;

  try {
    const res = await fetch(targetUrl, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options?.headers || {}),
      },
    });

    const contentType = res.headers.get('content-type') || '';

    // If the server returned HTML (e.g. 404/502 error page or SPA index.html rewrite)
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      const isHtml = text.trim().toLowerCase().startsWith('<!doctype') || text.includes('<html');

      return {
        ok: false,
        status: res.status,
        isHtmlFallback: isHtml,
        error: isHtml
          ? 'Backend authentication service is not active on this domain. Please use http://localhost:3000 or deploy Cloud Functions.'
          : text.slice(0, 200) || `Server returned non-JSON response (${res.status})`,
      };
    }

    try {
      const data = await res.json();
      return {
        ok: res.ok,
        status: res.status,
        data,
        error: !res.ok ? data?.error || `Request failed with status ${res.status}` : undefined,
      };
    } catch (parseErr: any) {
      return {
        ok: false,
        status: res.status,
        error: 'Failed to parse JSON response from server.',
      };
    }
  } catch (networkErr: any) {
    return {
      ok: false,
      status: 0,
      error: networkErr.message || 'Network request failed. Please check your internet connection.',
    };
  }
}
