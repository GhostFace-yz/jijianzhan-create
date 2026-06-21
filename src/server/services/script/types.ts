import type { SnapshotService, Snapshot, HistoryResult, AIModelInfo } from '../snapshot/types.js';
export type { HistoryResult } from '../snapshot/types.js';
import type { AdapterPool } from '../../adapters/pool.js';

// ── Script Data Shapes ─────────────────────────────────────────────

export interface Dialogue {
  char_id: string;
  text: string;
  emotion: string;
  note?: string | null;
}

export interface Scene {
  scene_id: string;
  location_id: string;
  time_of_day: string;
  weather: string;
  characters_present: string[];
  scene_summary: string;
  beats: string[];
  dialogues: Dialogue[];
}

export interface EndStateCharacter {
  char_id: string;
  emotion: string;
  position: string;
}

export interface EndState {
  characters: EndStateCharacter[];
  unresolved_conflicts: string[];
  key_prop_states: Record<string, string>;
}

export interface EpisodeScript {
  episode_title: string;
  scenes: Scene[];
  end_state: EndState;
}

// ── Service Input / Output ─────────────────────────────────────────

export interface UpdateScriptInput {
  episode_title?: string;
  scenes?: Scene[];
  end_state?: EndState;
}

// ── Service Interface ──────────────────────────────────────────────

export interface ScriptService {
  generateScript(projectId: string, episodeNumber: number): Promise<EpisodeScript>;
  getScript(projectId: string, episodeNumber: number): Promise<EpisodeScript | null>;
  updateScript(
    projectId: string,
    episodeNumber: number,
    input: UpdateScriptInput
  ): Promise<EpisodeScript>;
  regenerateScene(
    projectId: string,
    episodeNumber: number,
    sceneId: string
  ): Promise<Scene>;
  listVersions(projectId: string, episodeNumber: number): Promise<HistoryResult>;
  getVersion(
    projectId: string,
    episodeNumber: number,
    versionId: string
  ): Promise<Snapshot | null>;
  rollbackVersion(
    projectId: string,
    episodeNumber: number,
    versionId: string
  ): Promise<Snapshot>;
}

// ── Service Options ────────────────────────────────────────────────

export interface ScriptServiceOptions {
  prisma?: typeof import('../../lib/db.js').prisma;
  snapshotService?: SnapshotService;
  adapterPool?: AdapterPool;
  maxRetries?: number;
}

export { AIModelInfo };
