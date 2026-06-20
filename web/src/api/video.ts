import type {
  VideoBatchResultResponse,
  VideoNodeResultResponse,
  VideoClipResponse,
  VideoGenerateOptions,
  VideoReviewInput,
  VideoUploadInput,
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

/** POST /projects/{projectId}/episodes/{epId}/video/generate — batch generate video clips */
export async function batchGenerateVideo(
  projectId: string,
  epId: string,
  options?: VideoGenerateOptions,
): Promise<VideoBatchResultResponse> {
  return request<VideoBatchResultResponse>(
    `/projects/${projectId}/episodes/${epId}/video/generate`,
    { method: 'POST', body: JSON.stringify(options || {}) },
  );
}

/** POST /projects/{projectId}/episodes/{epId}/video/nodes/{nodeId}/generate — generate single node video */
export async function generateNodeVideo(
  projectId: string,
  epId: string,
  nodeId: string,
  options?: VideoGenerateOptions,
): Promise<VideoNodeResultResponse> {
  return request<VideoNodeResultResponse>(
    `/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/generate`,
    { method: 'POST', body: JSON.stringify(options || {}) },
  );
}

/** PUT /projects/{projectId}/episodes/{epId}/video/nodes/{nodeId}/review — review a node video clip */
export async function reviewNodeVideo(
  projectId: string,
  epId: string,
  nodeId: string,
  input: VideoReviewInput,
): Promise<VideoClipResponse> {
  return request<VideoClipResponse>(
    `/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/review`,
    { method: 'PUT', body: JSON.stringify(input) },
  );
}

/** PUT /projects/{projectId}/episodes/{epId}/video/nodes/{nodeId}/upload — replace with manually uploaded video URL */
export async function uploadNodeVideo(
  projectId: string,
  epId: string,
  nodeId: string,
  input: VideoUploadInput,
): Promise<VideoClipResponse> {
  return request<VideoClipResponse>(
    `/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/upload`,
    { method: 'PUT', body: JSON.stringify(input) },
  );
}

/** POST /projects/{projectId}/episodes/{epId}/video/nodes/{nodeId}/upload — upload a video file directly */
export async function uploadNodeVideoFile(
  projectId: string,
  epId: string,
  nodeId: string,
  file: File,
  options?: Pick<VideoUploadInput, 'duration' | 'camera_move' | 'motion_description'>,
): Promise<VideoClipResponse> {
  const formData = new FormData();
  formData.append('video', file);
  if (options?.duration !== undefined) formData.append('duration', String(options.duration));
  if (options?.camera_move !== undefined) formData.append('camera_move', options.camera_move);
  if (options?.motion_description !== undefined) {
    formData.append('motion_description', options.motion_description);
  }

  const response = await fetch(`${API_BASE}/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/upload`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(body.error?.message || `HTTP ${response.status}`);
  }

  return response.json() as Promise<VideoClipResponse>;
}
