import type { Location, LocationStatus } from '@prisma/client';
import type { AdapterPool } from '../../adapters/pool.js';
import type { SnapshotService } from '../snapshot/types.js';

export type { Location, LocationStatus };

export const LOCATION_STATUSES: LocationStatus[] = ['draft', 'confirmed'];

export interface SceneVariant {
  image_url: string;
  prompt: string;
  seed: number;
}

export interface LocationVariants {
  [key: string]: SceneVariant;
}

export interface CreateLocationInput {
  name: string;
  description?: string | null;
  frequency?: string | null;
  space_type?: string | null;
  style?: string | null;
  color_tone?: string | null;
  lighting_type?: string | null;
  key_props?: string[];
  status?: LocationStatus;
}

export type UpdateLocationInput = Partial<CreateLocationInput>;

export interface OutlineLocationInput {
  name: string;
  description?: string | null;
  frequency?: string | null;
  space_type?: string | null;
  style?: string | null;
  color_tone?: string | null;
  lighting_type?: string | null;
  key_props?: string[];
}

export interface GenerateBaseCandidatesOptions {
  seed?: number;
}

export interface BaseCandidate {
  url: string;
  seed: number;
  prompt: string;
}

export interface GenerateVariantInput {
  time_of_day: string;
  weather: string;
}

export interface VariantResult {
  url: string;
  seed: number;
  prompt: string;
}

export interface ConfirmVariantInput {
  time_of_day: string;
  weather: string;
  variant: VariantResult;
}

export interface LocationListResult {
  total: number;
  locations: Location[];
}

export interface SceneBibleService {
  syncScenesFromOutline(projectId: string): Promise<Location[]>;
  listScenes(projectId: string): Promise<LocationListResult>;
  getScene(projectId: string, locId: string): Promise<Location | null>;
  createScene(projectId: string, input: CreateLocationInput): Promise<Location>;
  updateScene(projectId: string, locId: string, input: UpdateLocationInput): Promise<Location>;
  generateBaseCandidates(
    projectId: string,
    locId: string,
    options?: GenerateBaseCandidatesOptions
  ): Promise<BaseCandidate[]>;
  confirmBase(projectId: string, locId: string, candidate: BaseCandidate): Promise<Location>;
  generateVariant(projectId: string, locId: string, input: GenerateVariantInput): Promise<VariantResult>;
  confirmVariant(projectId: string, locId: string, input: ConfirmVariantInput): Promise<Location>;
  getSceneHistory(projectId: string, locId: string): Promise<import('../snapshot/types.js').HistoryResult>;
  rollbackScene(projectId: string, locId: string, versionId: string): Promise<Location>;
}

export interface SceneBibleServiceOptions {
  prisma?: typeof import('../../lib/db.js').prisma;
  snapshotService?: SnapshotService;
  adapterPool?: AdapterPool;
}
