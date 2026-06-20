import type {
  StoryboardNodesResponse,
  StoryboardNodesWithImagesResponse,
  SplitResultResponse,
  NodeSplitResultResponse,
  UpdateNodesInput,
  SplitNodeInput,
  GenerateNodeImageOptions,
  NodeImageResultResponse,
  BatchGenerateResultResponse,
  StoryboardNodeWithImageResponse,
  ReviewNodeImageInput,
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

/** POST /projects/{projectId}/episodes/{epId}/storyboard/split — AI auto-split storyboard nodes */
export async function splitStoryboardNodes(
  projectId: string,
  epId: string,
): Promise<SplitResultResponse> {
  return request<SplitResultResponse>(
    `/projects/${projectId}/episodes/${epId}/storyboard/split`,
    { method: 'POST' },
  );
}

/** GET /projects/{projectId}/episodes/{epId}/storyboard/nodes — list storyboard nodes */
export async function listStoryboardNodes(
  projectId: string,
  epId: string,
): Promise<StoryboardNodesResponse> {
  return request<StoryboardNodesResponse>(
    `/projects/${projectId}/episodes/${epId}/storyboard/nodes`,
  );
}

/** PUT /projects/{projectId}/episodes/{epId}/storyboard/nodes — batch update nodes */
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

/** POST /projects/{projectId}/episodes/{epId}/storyboard/nodes/{nodeId}/split — split a node */
export async function splitStoryboardNode(
  projectId: string,
  epId: string,
  nodeId: string,
  input?: SplitNodeInput,
): Promise<NodeSplitResultResponse> {
  return request<NodeSplitResultResponse>(
    `/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/split`,
    { method: 'POST', body: input ? JSON.stringify(input) : undefined },
  );
}

// ── Image Generation & Review APIs ──────────────────────────────────

/** GET /projects/{projectId}/episodes/{epId}/storyboard/nodes — list nodes with image data */
export async function listStoryboardNodesWithImages(
  projectId: string,
  epId: string,
): Promise<StoryboardNodesWithImagesResponse> {
  return request<StoryboardNodesWithImagesResponse>(
    `/projects/${projectId}/episodes/${epId}/storyboard/nodes`,
  );
}

/** POST /projects/{projectId}/episodes/{epId}/storyboard/nodes/generate — batch generate images */
export async function batchGenerateImages(
  projectId: string,
  epId: string,
  options?: GenerateNodeImageOptions,
): Promise<BatchGenerateResultResponse> {
  return request<BatchGenerateResultResponse>(
    `/projects/${projectId}/episodes/${epId}/storyboard/nodes/generate`,
    { method: 'POST', body: JSON.stringify(options || {}) },
  );
}

/** POST /projects/{projectId}/episodes/{epId}/storyboard/nodes/{nodeId}/generate — generate single node image */
export async function generateSingleImage(
  projectId: string,
  epId: string,
  nodeId: string,
  options?: GenerateNodeImageOptions,
): Promise<NodeImageResultResponse> {
  return request<NodeImageResultResponse>(
    `/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/generate`,
    { method: 'POST', body: JSON.stringify(options || {}) },
  );
}

/** PUT /projects/{projectId}/episodes/{epId}/storyboard/nodes/{nodeId}/review — review a node image */
export async function reviewNodeImage(
  projectId: string,
  epId: string,
  nodeId: string,
  input: ReviewNodeImageInput,
): Promise<StoryboardNodeWithImageResponse> {
  return request<StoryboardNodeWithImageResponse>(
    `/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/review`,
    { method: 'PUT', body: JSON.stringify(input) },
  );
}
