import { ApiResponse, ApiErrorResponse } from '@octopus/shared';

export class ApiService {
  private static baseUrl = '/api/v1';

  private static getToken(): string | null {
    return localStorage.getItem('octopus_token');
  }

  static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers = new Headers(options.headers || {});

    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = (await res.json().catch(() => ({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Invalid response from server' },
    }))) as ApiResponse<T>;

    if (!res.ok || !data.success) {
      const err = (data as ApiErrorResponse).error || {
        code: 'INTERNAL_ERROR',
        message: `HTTP ${res.status}: ${res.statusText}`,
      };
      throw err;
    }

    return (data as { success: true; data: T }).data;
  }

  static get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  static post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  static put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  static delete<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }
}
