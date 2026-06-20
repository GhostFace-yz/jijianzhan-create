import type {
  EpisodeMusicResultResponse,
  MusicGenerateOptions,
  MusicUploadInput,
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

/** GET /projects/{projectId}/episodes/{epId}/audio/music — get current episode music */
export async function getEpisodeMusic(
  projectId: string,
  epId: string,
): Promise<EpisodeMusicResultResponse> {
  return request<EpisodeMusicResultResponse>(
    `/projects/${projectId}/episodes/${epId}/audio/music`,
  );
}

/** POST /projects/{projectId}/episodes/{epId}/audio/music/generate — generate full episode BGM */
export async function generateEpisodeMusic(
  projectId: string,
  epId: string,
  options?: MusicGenerateOptions,
): Promise<EpisodeMusicResultResponse> {
  return request<EpisodeMusicResultResponse>(
    `/projects/${projectId}/episodes/${epId}/audio/music/generate`,
    { method: 'POST', body: JSON.stringify(options || {}) },
  );
}

/** PUT /projects/{projectId}/episodes/{epId}/audio/music/upload — upload custom BGM */
export async function uploadEpisodeMusic(
  projectId: string,
  epId: string,
  input: MusicUploadInput,
): Promise<EpisodeMusicResultResponse> {
  return request<EpisodeMusicResultResponse>(
    `/projects/${projectId}/episodes/${epId}/audio/music/upload`,
    { method: 'PUT', body: JSON.stringify(input) },
  );
}
