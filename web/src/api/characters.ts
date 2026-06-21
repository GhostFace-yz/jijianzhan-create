import type {
  Character,
  CharacterListResponse,
  CharacterResponse,
  CreateCharacterInput,
  UpdateCharacterInput,
  GenerateViewsInput,
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

export async function listCharacters(projectId: string): Promise<CharacterListResponse> {
  return request<CharacterListResponse>(`/projects/${projectId}/characters`);
}

export async function getCharacter(projectId: string, characterId: string): Promise<CharacterResponse> {
  return request<CharacterResponse>(`/projects/${projectId}/characters/${characterId}`);
}

export async function createCharacter(
  projectId: string,
  input: CreateCharacterInput
): Promise<CharacterResponse> {
  return request<CharacterResponse>(`/projects/${projectId}/characters`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateCharacter(
  projectId: string,
  characterId: string,
  input: UpdateCharacterInput
): Promise<CharacterResponse> {
  return request<CharacterResponse>(`/projects/${projectId}/characters/${characterId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteCharacter(projectId: string, characterId: string): Promise<void> {
  await request<void>(`/projects/${projectId}/characters/${characterId}`, { method: 'DELETE' });
}

export async function generateViews(
  projectId: string,
  characterId: string,
  input?: GenerateViewsInput
): Promise<CharacterResponse> {
  return request<CharacterResponse>(`/projects/${projectId}/characters/${characterId}/generate-views`, {
    method: 'POST',
    body: JSON.stringify(input ?? {}),
  });
}

export async function retryView(
  projectId: string,
  characterId: string,
  viewId: 'front' | 'side' | 'back'
): Promise<CharacterResponse> {
  return request<CharacterResponse>(
    `/projects/${projectId}/characters/${characterId}/generate-views/${viewId}/retry`,
    { method: 'POST' }
  );
}

export async function confirmViews(projectId: string, characterId: string): Promise<CharacterResponse> {
  return request<CharacterResponse>(
    `/projects/${projectId}/characters/${characterId}/confirm-views`,
    { method: 'POST' }
  );
}

export async function generateRefs(projectId: string, characterId: string): Promise<CharacterResponse> {
  return request<CharacterResponse>(
    `/projects/${projectId}/characters/${characterId}/generate-refs`,
    { method: 'POST' }
  );
}

export async function rollbackCharacter(
  projectId: string,
  characterId: string,
  versionId: string
): Promise<CharacterResponse> {
  return request<CharacterResponse>(
    `/projects/${projectId}/characters/${characterId}/rollback`,
    {
      method: 'POST',
      body: JSON.stringify({ version_id: versionId }),
    }
  );
}

export async function syncCharactersFromOutline(projectId: string): Promise<CharacterListResponse> {
  return request<CharacterListResponse>(`/projects/${projectId}/characters/sync-from-outline`, {
    method: 'POST',
  });
}
export async function listCharacterVersions(
  projectId: string,
  characterId: string
): Promise<SnapshotHistoryResponse> {
  return request<SnapshotHistoryResponse>(
    `/projects/${projectId}/entities/character/${characterId}/versions`
  );
}

export async function getCharacterVersion(
  projectId: string,
  characterId: string,
  versionId: string
): Promise<SnapshotResponse> {
  return request<SnapshotResponse>(
    `/projects/${projectId}/entities/character/${characterId}/versions/${versionId}`
  );
}

export function viewImages(character: Character) {
  const views = character.ref_images.filter((img) => ['front', 'side', 'back'].includes(img.view));
  const expressions = character.ref_images.filter((img) => img.view.startsWith('expr_'));
  const sceneStandings = character.ref_images.filter((img) => img.view.startsWith('scene_'));
  return { views, expressions, sceneStandings };
}

export function viewUrl(character: Character, view: string): string | undefined {
  return character.ref_images.find((img) => img.view === view)?.url;
}
