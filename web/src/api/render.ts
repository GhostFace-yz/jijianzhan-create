import type {
  RenderOptions,
  EpisodeRenderOutputResponse,
  RenderDownloadResponse,
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

/** POST /projects/{projectId}/episodes/{epId}/render — start final render */
export async function startRender(
  projectId: string,
  epId: string,
  options?: RenderOptions,
): Promise<EpisodeRenderOutputResponse> {
  return request<EpisodeRenderOutputResponse>(
    `/projects/${projectId}/episodes/${epId}/render`,
    { method: 'POST', body: JSON.stringify(options || {}) },
  );
}

/** GET /projects/{projectId}/episodes/{epId}/render/progress — poll render progress */
export async function getRenderProgress(
  projectId: string,
  epId: string,
): Promise<EpisodeRenderOutputResponse> {
  return request<EpisodeRenderOutputResponse>(
    `/projects/${projectId}/episodes/${epId}/render/progress`,
  );
}

/** GET /projects/{projectId}/episodes/{epId}/render/download — get final MP4 download URL */
export async function getRenderDownload(
  projectId: string,
  epId: string,
): Promise<RenderDownloadResponse> {
  return request<RenderDownloadResponse>(
    `/projects/${projectId}/episodes/${epId}/render/download`,
  );
}
