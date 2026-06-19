import type {
  BaseCandidate,
  ConfirmBaseInput,
  ConfirmVariantInput,
  GenerateBaseCandidatesInput,
  GenerateVariantInput,
  Location,
  LocationListResponse,
  LocationResponse,
  RollbackLocationInput,
  SnapshotHistoryResponse,
  SnapshotResponse,
  UpdateLocationInput,
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

export async function listLocations(projectId: string): Promise<LocationListResponse> {
  return request<LocationListResponse>(`/projects/${projectId}/locations`);
}

export async function syncFromOutline(projectId: string): Promise<LocationListResponse> {
  return request<LocationListResponse>(
    `/projects/${projectId}/locations/sync-from-outline`,
    { method: 'POST' }
  );
}

export async function getLocation(
  projectId: string,
  locationId: string
): Promise<LocationResponse> {
  const list = await listLocations(projectId);
  const loc = list.data.locations.find((l) => l.id === locationId);
  if (!loc) {
    throw new Error(`Location ${locationId} not found`);
  }
  return { data: loc };
}

export async function updateLocation(
  projectId: string,
  locationId: string,
  input: UpdateLocationInput
): Promise<LocationResponse> {
  return request<LocationResponse>(`/projects/${projectId}/locations/${locationId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function generateBaseCandidates(
  projectId: string,
  locationId: string,
  input?: GenerateBaseCandidatesInput
): Promise<{ data: BaseCandidate[] }> {
  return request<{ data: BaseCandidate[] }>(
    `/projects/${projectId}/locations/${locationId}/generate-base`,
    {
      method: 'POST',
      body: JSON.stringify(input ?? {}),
    }
  );
}

export async function confirmBaseImage(
  projectId: string,
  locationId: string,
  input: ConfirmBaseInput
): Promise<LocationResponse> {
  return request<LocationResponse>(
    `/projects/${projectId}/locations/${locationId}/confirm-base`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
}

export async function generateLocationVariant(
  projectId: string,
  locationId: string,
  input: GenerateVariantInput
): Promise<{ data: { url: string; seed: number; prompt: string } }> {
  return request<{ data: { url: string; seed: number; prompt: string } }>(
    `/projects/${projectId}/locations/${locationId}/generate-variant`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
}

export async function confirmLocationVariant(
  projectId: string,
  locationId: string,
  input: ConfirmVariantInput
): Promise<LocationResponse> {
  return request<LocationResponse>(
    `/projects/${projectId}/locations/${locationId}/confirm-variant`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
}

export async function listLocationVersions(
  projectId: string,
  locationId: string
): Promise<SnapshotHistoryResponse> {
  return request<SnapshotHistoryResponse>(
    `/projects/${projectId}/locations/${locationId}/versions`
  );
}

export async function rollbackLocation(
  projectId: string,
  locationId: string,
  input: RollbackLocationInput
): Promise<LocationResponse> {
  return request<LocationResponse>(
    `/projects/${projectId}/locations/${locationId}/rollback`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
}

export function variantKey(timeOfDay: string, weather: string): string {
  return `${timeOfDay}-${weather}`;
}

export function getVariant(
  location: Location,
  timeOfDay: string,
  weather: string
): { url: string; seed: number; prompt: string } | undefined {
  const variant = location.variants[variantKey(timeOfDay, weather)];
  if (!variant) return undefined;
  return { url: variant.image_url, seed: variant.seed, prompt: variant.prompt };
}
