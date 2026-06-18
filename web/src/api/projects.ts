import type {
  Project,
  ProjectListFilters,
  ProjectListResponse,
  ProjectResponse,
  ProjectMeta,
} from '../types';

const API_BASE = '/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(body.error?.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function buildQueryString(filters: ProjectListFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset !== undefined) params.set('offset', String(filters.offset));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function listProjects(filters: ProjectListFilters = {}): Promise<ProjectListResponse> {
  return request<ProjectListResponse>(`/projects${buildQueryString(filters)}`);
}

export async function getProject(id: string): Promise<ProjectResponse> {
  return request<ProjectResponse>(`/projects/${id}`);
}

export async function createProject(meta: ProjectMeta): Promise<ProjectResponse> {
  return request<ProjectResponse>('/projects', {
    method: 'POST',
    body: JSON.stringify({ meta }),
  });
}

export async function updateProject(
  id: string,
  input: { meta?: Partial<ProjectMeta>; status?: Project['status'] }
): Promise<ProjectResponse> {
  return request<ProjectResponse>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await request(`/projects/${id}`, { method: 'DELETE' });
}
