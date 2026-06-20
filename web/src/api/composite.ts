import type {
  CompositeConfig,
  CompositeStartResponse,
  CompositeProgressResponse,
  CompositeResultResponse,
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

/** POST /projects/{projectId}/episodes/{epId}/composite — start final composition */
export async function startComposite(
  projectId: string,
  epId: string,
  config: CompositeConfig,
): Promise<CompositeStartResponse> {
  return request<CompositeStartResponse>(
    `/projects/${projectId}/episodes/${epId}/composite`,
    { method: 'POST', body: JSON.stringify(config) },
  );
}

/** GET /projects/{projectId}/episodes/{epId}/composite/progress — poll composition progress */
export async function getCompositeProgress(
  projectId: string,
  epId: string,
  jobId: string,
): Promise<CompositeProgressResponse> {
  return request<CompositeProgressResponse>(
    `/projects/${projectId}/episodes/${epId}/composite/progress?job_id=${encodeURIComponent(jobId)}`,
  );
}

/** GET /projects/{projectId}/episodes/{epId}/composite/result — get completed output */
export async function getCompositeResult(
  projectId: string,
  epId: string,
  jobId: string,
): Promise<CompositeResultResponse> {
  return request<CompositeResultResponse>(
    `/projects/${projectId}/episodes/${epId}/composite/result?job_id=${encodeURIComponent(jobId)}`,
  );
}
