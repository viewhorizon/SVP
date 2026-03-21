export interface HttpError extends Error {
  status?: number;
  payload?: unknown;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim();

const readAuthToken = (): string | null => {
  try {
    return localStorage.getItem('auth.token');
  } catch {
    return null;
  }
};

export async function requestJSON<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = readAuthToken();
  const headers = new Headers(options.headers ?? {});

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const error = new Error(
      typeof body === 'object' && body && 'error' in body
        ? String((body as { error: string }).error)
        : `Request failed with status ${response.status}`
    ) as HttpError;
    error.status = response.status;
    error.payload = body;
    throw error;
  }

  return body as T;
}
