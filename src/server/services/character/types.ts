import type { Character, CharacterStatus, RoleType } from '@prisma/client';
import type { AdapterPool } from '../../adapters/pool.js';
import type { SnapshotService } from '../snapshot/types.js';

export type { Character, CharacterStatus, RoleType };

export const ROLE_TYPES: RoleType[] = ['protagonist', 'supporting', 'antagonist'];
export const CHARACTER_STATUSES: CharacterStatus[] = ['draft', 'confirmed'];

export interface CreateCharacterInput {
  name: string;
  role_type: RoleType;
  episode_range?: string | null;
  appearance?: string | null;
  costume?: string | null;
  expression?: string | null;
  signature_action?: string | null;
  voice_description?: string | null;
  status?: CharacterStatus;
}

export type UpdateCharacterInput = Partial<CreateCharacterInput>;

export interface OutlineCharacterInput {
  name: string;
  role_type: RoleType;
  episode_range?: string | null;
  appearance?: string | null;
  costume?: string | null;
  expression?: string | null;
  signature_action?: string | null;
  voice_description?: string | null;
}

export interface GenerateViewsOptions {
  seed?: number;
  width?: number;
  height?: number;
  style_preset?: string;
}

export interface CharacterRefImage {
  view: string;
  url: string;
  seed: number;
}

export interface CharacterService {
  listCharacters(projectId: string): Promise<{ total: number; characters: Character[] }>;
  createCharacter(projectId: string, input: CreateCharacterInput): Promise<Character>;
  getCharacter(projectId: string, charId: string): Promise<Character | null>;
  updateCharacter(projectId: string, charId: string, input: UpdateCharacterInput): Promise<Character>;
  deleteCharacter(projectId: string, charId: string): Promise<void>;
  autoCreateCharacters(
    projectId: string,
    outlineCharacters: OutlineCharacterInput[]
  ): Promise<Character[]>;
  generateViews(projectId: string, charId: string, options?: GenerateViewsOptions): Promise<Character>;
  retryView(projectId: string, charId: string, viewId: string): Promise<Character>;
  confirmViews(projectId: string, charId: string): Promise<Character>;
  generateRefs(projectId: string, charId: string): Promise<Character>;
  rollbackCharacter(projectId: string, charId: string, versionId: string): Promise<Character>;
}

export interface CharacterServiceOptions {
  prisma?: typeof import('../../lib/db.js').prisma;
  snapshotService?: SnapshotService;
  adapterPool?: AdapterPool;
}
