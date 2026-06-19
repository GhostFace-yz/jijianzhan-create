import type {
  ScriptGenerateResponse,
  ScriptUpdateResponse,
  RegenerateSceneResponse,
  ScriptUpdateInput,
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

/** AI 生成完整单集脚本 */
export async function generateScript(
  projectId: string,
  episodeId: string
): Promise<ScriptGenerateResponse> {
  return request<ScriptGenerateResponse>(
    `/projects/${projectId}/episodes/${episodeId}/script/generate`,
    { method: 'POST' }
  );
}

/** 保存编辑后的单集脚本 */
export async function updateScript(
  projectId: string,
  episodeId: string,
  input: ScriptUpdateInput
): Promise<ScriptUpdateResponse> {
  return request<ScriptUpdateResponse>(
    `/projects/${projectId}/episodes/${episodeId}/script`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    }
  );
}

/** 重新生成单个场景 */
export async function regenerateScene(
  projectId: string,
  episodeId: string,
  sceneId: string
): Promise<RegenerateSceneResponse> {
  return request<RegenerateSceneResponse>(
    `/projects/${projectId}/episodes/${episodeId}/script/regenerate-scene`,
    {
      method: 'POST',
      body: JSON.stringify({ scene_id: sceneId }),
    }
  );
}
