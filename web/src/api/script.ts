import type {
  ScriptResponse,
  ScriptGenerateResponse,
  RegenerateSceneResponse,
  UpdateScriptInput,
  SnapshotHistoryResponse,
  SnapshotResponse,
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

/** POST /projects/{projectId}/episodes/{episodeNumber}/script/generate — trigger AI script generation */
export async function generateScript(
  projectId: string,
  episodeNumber: number,
): Promise<ScriptGenerateResponse> {
  return request<ScriptGenerateResponse>(
    `/projects/${projectId}/episodes/${episodeNumber}/script/generate`,
    { method: 'POST' },
  );
}

/** GET /projects/{projectId}/episodes/{episodeNumber}/script — fetch script data */
export async function getScript(
  projectId: string,
  episodeNumber: number,
): Promise<ScriptResponse> {
  return request<ScriptResponse>(
    `/projects/${projectId}/episodes/${episodeNumber}/script`,
  );
}

/** PUT /projects/{projectId}/episodes/{episodeNumber}/script — save edited script */
export async function updateScript(
  projectId: string,
  episodeNumber: number,
  input: UpdateScriptInput,
): Promise<ScriptResponse> {
  return request<ScriptResponse>(
    `/projects/${projectId}/episodes/${episodeNumber}/script`,
    { method: 'PUT', body: JSON.stringify(input) },
  );
}

/** POST /projects/{projectId}/episodes/{episodeNumber}/script/regenerate-scene — regenerate single scene */
export async function regenerateScene(
  projectId: string,
  episodeNumber: number,
  sceneId: string,
): Promise<RegenerateSceneResponse> {
  return request<RegenerateSceneResponse>(
    `/projects/${projectId}/episodes/${episodeNumber}/script/regenerate-scene`,
    { method: 'POST', body: JSON.stringify({ scene_id: sceneId }) },
  );
}

/** GET /projects/{projectId}/entities/script/{episodeNumber}/versions — list script version history */
export async function listScriptVersions(
  projectId: string,
  episodeNumber: number,
): Promise<SnapshotHistoryResponse> {
  return request<SnapshotHistoryResponse>(
    `/projects/${projectId}/entities/script/ep-${episodeNumber}/versions`,
  );
}

/** GET /projects/{projectId}/entities/script/{episodeNumber}/versions/{versionId} — get version snapshot */
export async function getScriptVersion(
  projectId: string,
  episodeNumber: number,
  versionId: string,
): Promise<SnapshotResponse> {
  return request<SnapshotResponse>(
    `/projects/${projectId}/entities/script/ep-${episodeNumber}/versions/${versionId}`,
  );
}

/** POST /projects/{projectId}/entities/script/{episodeNumber}/versions/{versionId}/rollback — rollback script */
export async function rollbackScript(
  projectId: string,
  episodeNumber: number,
  versionId: string,
): Promise<SnapshotResponse> {
  return request<SnapshotResponse>(
    `/projects/${projectId}/entities/script/ep-${episodeNumber}/versions/${versionId}/rollback`,
    { method: 'POST' },
  );
}
