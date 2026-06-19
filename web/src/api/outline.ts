import type {
  OutlineData,
  OutlineResponse,
  OutlineSummaryResponse,
  ValidationReportResponse,
  UpdateOutlineInput,
  RegenerateEpisodeResponse,
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

/** 触发大纲 AI 生成 */
export async function generateOutline(projectId: string): Promise<OutlineResponse> {
  return request<OutlineResponse>(`/projects/${projectId}/outline/generate`, {
    method: 'POST',
  });
}

/** 获取当前大纲及锁定状态 */
export async function getOutline(projectId: string): Promise<OutlineSummaryResponse> {
  return request<OutlineSummaryResponse>(`/projects/${projectId}/outline`);
}

/** 保存编辑后的大纲 */
export async function updateOutline(
  projectId: string,
  input: UpdateOutlineInput
): Promise<OutlineResponse> {
  return request<OutlineResponse>(`/projects/${projectId}/outline`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

/** 单集重新生成 */
export async function regenerateEpisode(
  projectId: string,
  episodeNumber: number
): Promise<RegenerateEpisodeResponse> {
  return request<RegenerateEpisodeResponse>(
    `/projects/${projectId}/outline/episodes/${episodeNumber}/regenerate`,
    { method: 'POST' }
  );
}

/** 执行剧本医生自洽性检查 */
export async function validateOutline(
  projectId: string
): Promise<ValidationReportResponse> {
  return request<ValidationReportResponse>(`/projects/${projectId}/outline/validate`, {
    method: 'POST',
  });
}

/** 确认并锁定大纲 */
export async function confirmOutline(projectId: string): Promise<OutlineResponse> {
  return request<OutlineResponse>(`/projects/${projectId}/outline/confirm`, {
    method: 'POST',
  });
}
