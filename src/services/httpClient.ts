export interface HttpError extends Error {
  status?: number;
  payload?: unknown;
  requestId?: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").trim();

const readAuthToken = (): string | null => {
  try {
    return localStorage.getItem("auth.token");
  } catch {
    return null;
  }
};

type RequestTelemetryDetail = {
  requestId: string;
  path: string;
  status: number;
  ok: boolean;
};

let lastRequestTelemetry: RequestTelemetryDetail | null = null;

export const getLastRequestTelemetry = () => lastRequestTelemetry;

const publishRequestTelemetry = (detail: RequestTelemetryDetail) => {
  lastRequestTelemetry = detail;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<RequestTelemetryDetail>("spv:request", { detail }));
};

export async function requestJSON<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = readAuthToken();
  const headers = new Headers(options.headers ?? {});

  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const requestId = response.headers.get("x-request-id")?.trim() ?? "";
  if (requestId) {
    publishRequestTelemetry({
      requestId,
      path,
      status: response.status,
      ok: response.ok,
    });
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const error = new Error(
      typeof body === "object" && body && "error" in body
        ? String((body as { error: string }).error)
        : `Request failed with status ${response.status}`,
    ) as HttpError;
    error.status = response.status;
    error.payload = body;
    error.requestId = requestId || undefined;
    throw error;
  }

  return body as T;
}
