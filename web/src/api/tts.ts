import type {
  TtsBatchResultResponse,
  TtsNodeResultResponse,
  AudioClipResponse,
  TtsGenerateOptions,
  TtsReviewInput,
  TtsUploadInput,
  UpdateNodesInput,
  StoryboardNodesResponse,
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

/** POST /projects/{projectId}/episodes/{epId}/audio/tts/generate — batch generate TTS */
export async function batchGenerateTts(
  projectId: string,
  epId: string,
  options?: TtsGenerateOptions,
): Promise<TtsBatchResultResponse> {
  return request<TtsBatchResultResponse>(
    `/projects/${projectId}/episodes/${epId}/audio/tts/generate`,
    { method: 'POST', body: JSON.stringify(options || {}) },
  );
}

/** POST /projects/{projectId}/episodes/{epId}/audio/tts/nodes/{nodeId}/generate — generate single node TTS */
export async function generateNodeTts(
  projectId: string,
  epId: string,
  nodeId: string,
  options?: TtsGenerateOptions,
): Promise<TtsNodeResultResponse> {
  return request<TtsNodeResultResponse>(
    `/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/generate`,
    { method: 'POST', body: JSON.stringify(options || {}) },
  );
}

/** PUT /projects/{projectId}/episodes/{epId}/audio/tts/nodes/{nodeId}/review — review a node TTS */
export async function reviewNodeTts(
  projectId: string,
  epId: string,
  nodeId: string,
  input: TtsReviewInput,
): Promise<AudioClipResponse> {
  return request<AudioClipResponse>(
    `/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/review`,
    { method: 'PUT', body: JSON.stringify(input) },
  );
}

/** PUT /projects/{projectId}/episodes/{epId}/audio/tts/nodes/{nodeId}/upload — replace with manual recording */
export async function uploadNodeTts(
  projectId: string,
  epId: string,
  nodeId: string,
  input: TtsUploadInput,
): Promise<AudioClipResponse> {
  return request<AudioClipResponse>(
    `/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/upload`,
    { method: 'PUT', body: JSON.stringify(input) },
  );
}

/** PUT /projects/{projectId}/episodes/{epId}/storyboard/nodes — batch update nodes (dialogue / emotion edits) */
export async function updateStoryboardNodes(
  projectId: string,
  epId: string,
  input: UpdateNodesInput,
): Promise<StoryboardNodesResponse> {
  return request<StoryboardNodesResponse>(
    `/projects/${projectId}/episodes/${epId}/storyboard/nodes`,
    { method: 'PUT', body: JSON.stringify(input) },
  );
}

/** GET /projects/{projectId}/episodes/{epId}/storyboard/nodes — list storyboard nodes with audio clips */
export async function listStoryboardNodesWithAudio(
  projectId: string,
  epId: string,
): Promise<StoryboardNodesResponse> {
  return request<StoryboardNodesResponse>(
    `/projects/${projectId}/episodes/${epId}/storyboard/nodes`,
  );
}
