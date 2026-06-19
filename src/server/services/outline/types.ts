import type { SnapshotService } from '../snapshot/types.js';
import type { AdapterPool } from '../../adapters/pool.js';

// ── Outline Data Shapes ────────────────────────────────────────────

export interface OutlineCharacter {
  name: string;
  role_type: 'protagonist' | 'supporting' | 'antagonist';
  description: string;
}

export interface OutlineLocation {
  name: string;
  description: string;
}

export interface OutlineEpisode {
  episode_number: number;
  title: string;
  summary: string;
  key_events: string[];
  featured_characters: string[];
  featured_locations: string[];
}

export interface OutlineData {
  world_setting: string;
  main_conflict: string;
  characters: OutlineCharacter[];
  locations: OutlineLocation[];
  episode_count: number;
  episodes: OutlineEpisode[];
}

// ── Validation Report ──────────────────────────────────────────────

export type CheckSeverity = 'error' | 'warning' | 'pass';

export interface CheckItem {
  severity: CheckSeverity;
  type: string;
  message: string;
  details?: string;
}

export interface OutlineValidationReport {
  errors: CheckItem[];
  warnings: CheckItem[];
  passes: CheckItem[];
  passed: boolean;
}

// ── Service Input / Output ─────────────────────────────────────────

export interface UpdateOutlineInput {
  world_setting?: string;
  main_conflict?: string;
  characters?: OutlineCharacter[];
  locations?: OutlineLocation[];
  episode_count?: number;
  episodes?: OutlineEpisode[];
}

// ── Service Interface ──────────────────────────────────────────────

export interface OutlineService {
  generateOutline(projectId: string): Promise<OutlineData>;
  getOutline(projectId: string): Promise<OutlineData | null>;
  updateOutline(projectId: string, data: UpdateOutlineInput): Promise<OutlineData>;
  regenerateEpisode(projectId: string, episodeNumber: number): Promise<OutlineData>;
  validateOutline(projectId: string): Promise<OutlineValidationReport>;
  confirmOutline(projectId: string): Promise<OutlineData>;
}

// ── Service Options ────────────────────────────────────────────────

export interface OutlineServiceOptions {
  prisma?: typeof import('../../lib/db.js').prisma;
  snapshotService?: SnapshotService;
  adapterPool?: AdapterPool;
  /** Max retries when AI returns non-compliant JSON */
  maxRetries?: number;
}
