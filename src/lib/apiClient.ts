export class ApiClientError extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number,
    public raw?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: PaginatedMeta;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('fam_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiClientError('Failed to parse server response', 'PARSE_ERROR', res.status);
  }

  if (!res.ok) {
    const err = json as { error?: string; code?: string };

    // Auto-clear auth on 401
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('fam_token');
      localStorage.removeItem('fam_user');
      window.location.href = '/login';
    }

    throw new ApiClientError(
      err.error || 'Request failed',
      err.code  || 'UNKNOWN_ERROR',
      res.status,
      json
    );
  }

  return json as ApiResponse<T>;
}

export const apiClient = {
  get: <T>(path: string) =>
    request<T>(path),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'POST',
      body:   JSON.stringify(body),
    }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body:   JSON.stringify(body),
    }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};