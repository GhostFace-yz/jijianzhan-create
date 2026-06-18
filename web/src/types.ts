export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: '草稿',
  outlining: '大纲中',
  asset_prep: '素材准备',
  producing: '制作中',
  completed: '已完成',
};

export const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'outlining', label: '大纲中' },
  { value: 'asset_prep', label: '素材准备' },
  { value: 'producing', label: '制作中' },
  { value: 'completed', label: '已完成' },
];

export const PROJECT_GENRE_LABELS: Record<ProjectGenre, string> = {
  urban_romance: '都市情感',
  ancient_costume: '古装',
  suspense: '悬疑',
  comedy: '喜剧',
  sci_fi: '科幻',
  other: '其他',
};

export const PROJECT_GENRE_OPTIONS: { value: ProjectGenre; label: string }[] = [
  { value: 'urban_romance', label: '都市情感' },
  { value: 'ancient_costume', label: '古装' },
  { value: 'suspense', label: '悬疑' },
  { value: 'comedy', label: '喜剧' },
  { value: 'sci_fi', label: '科幻' },
  { value: 'other', label: '其他' },
];

export const PROJECT_DURATION_GOAL_LABELS: Record<ProjectDurationGoal, string> = {
  '3min': '3 分钟',
  '5min': '5 分钟',
  '10min': '10 分钟',
};

export const PROJECT_DURATION_GOAL_OPTIONS: { value: ProjectDurationGoal; label: string }[] = [
  { value: '3min', label: '3 分钟' },
  { value: '5min', label: '5 分钟' },
  { value: '10min', label: '10 分钟' },
];

export const PROJECT_STYLE_TAG_LABELS: Record<ProjectStyleTag, string> = {
  realistic: '写实',
  comic: '漫画风',
  cyberpunk: '赛博朋克',
  chinese_style: '国风',
  fresh: '小清新',
  dark: '暗黑系',
};

export const PROJECT_STYLE_TAG_OPTIONS: { value: ProjectStyleTag; label: string }[] = [
  { value: 'realistic', label: '写实' },
  { value: 'comic', label: '漫画风' },
  { value: 'cyberpunk', label: '赛博朋克' },
  { value: 'chinese_style', label: '国风' },
  { value: 'fresh', label: '小清新' },
  { value: 'dark', label: '暗黑系' },
];

export type ProjectStatus =
  | 'draft'
  | 'outlining'
  | 'asset_prep'
  | 'producing'
  | 'completed';

export type ProjectGenre =
  | 'urban_romance'
  | 'ancient_costume'
  | 'suspense'
  | 'comedy'
  | 'sci_fi'
  | 'other';

export type ProjectDurationGoal = '3min' | '5min' | '10min';

export type ProjectStyleTag =
  | 'realistic'
  | 'comic'
  | 'cyberpunk'
  | 'chinese_style'
  | 'fresh'
  | 'dark';

export interface ProjectMeta {
  title: string;
  description: string;
  genre: ProjectGenre;
  target_episodes?: number | null;
  duration_goal?: ProjectDurationGoal | null;
  style_tags: ProjectStyleTag[];
  notes?: string | null;
}

export interface Project {
  id: string;
  user_id: string;
  team_id: string | null;
  status: ProjectStatus;
  meta: ProjectMeta;
  created_at: string;
  updated_at: string;
}

export interface ProjectListFilters {
  status?: ProjectStatus;
  search?: string;
  sort?: 'updated_at_asc' | 'updated_at_desc';
  limit?: number;
  offset?: number;
}

export interface ProjectListResponse {
  data: {
    total: number;
    projects: Project[];
  };
}

export interface ProjectResponse {
  data: Project;
}

export type CharacterRoleType = 'protagonist' | 'supporting' | 'antagonist';

export type CharacterStatus = 'draft' | 'confirmed';

export const CHARACTER_ROLE_TYPE_LABELS: Record<CharacterRoleType, string> = {
  protagonist: '主角',
  supporting: '配角',
  antagonist: '反派',
};

export const CHARACTER_ROLE_TYPE_OPTIONS: { value: CharacterRoleType; label: string }[] = [
  { value: 'protagonist', label: '主角' },
  { value: 'supporting', label: '配角' },
  { value: 'antagonist', label: '反派' },
];

export const CHARACTER_STATUS_LABELS: Record<CharacterStatus, string> = {
  draft: '草稿',
  confirmed: '已确认',
};

export const CHARACTER_STATUS_OPTIONS: { value: CharacterStatus; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'confirmed', label: '已确认' },
];

export const VIEW_LABELS: Record<string, string> = {
  front: '正面',
  side: '侧面',
  back: '背面',
  expr_happy: '开心',
  expr_sad: '悲伤',
  expr_angry: '愤怒',
  expr_surprised: '惊讶',
  scene_standing_casual: '休闲站立',
  scene_standing_formal: '正式站立',
};

export interface CharacterRefImage {
  view: string;
  url: string;
  seed: number;
}

export interface Character {
  id: string;
  project_id: string;
  name: string;
  role_type: CharacterRoleType;
  episode_range: string | null;
  appearance: string | null;
  costume: string | null;
  expression: string | null;
  signature_action: string | null;
  voice_description: string | null;
  status: CharacterStatus;
  ref_images: CharacterRefImage[];
  ip_adapter_id: string | null;
  lora_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface CharacterListResponse {
  data: {
    total: number;
    characters: Character[];
  };
}

export interface CharacterResponse {
  data: Character;
}

export interface CreateCharacterInput {
  name: string;
  role_type: CharacterRoleType;
  episode_range?: string | null;
  appearance?: string | null;
  costume?: string | null;
  expression?: string | null;
  signature_action?: string | null;
  voice_description?: string | null;
  status?: CharacterStatus;
}

export interface UpdateCharacterInput {
  name?: string;
  role_type?: CharacterRoleType;
  episode_range?: string | null;
  costume?: string | null;
  appearance?: string | null;
  expression?: string | null;
  signature_action?: string | null;
  voice_description?: string | null;
  status?: CharacterStatus;
}

export interface GenerateViewsInput {
  seed?: number;
  width?: number;
  height?: number;
  style_preset?: string;
}

export type LocationStatus = 'draft' | 'confirmed';

export const LOCATION_STATUS_LABELS: Record<LocationStatus, string> = {
  draft: '草稿',
  confirmed: '已确认',
};

export const LOCATION_STATUS_OPTIONS: { value: LocationStatus; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'confirmed', label: '已确认' },
];

export interface LocationVariant {
  image_url: string;
  prompt: string;
  seed: number;
}

export interface Location {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  frequency: string | null;
  space_type: string | null;
  style: string | null;
  color_tone: string | null;
  lighting_type: string | null;
  key_props: string[];
  status: LocationStatus;
  base_seed: number | null;
  base_image_url: string | null;
  variants: Record<string, LocationVariant>;
  created_at: string;
  updated_at: string;
}

export interface LocationListResponse {
  data: {
    total: number;
    locations: Location[];
  };
}

export interface LocationResponse {
  data: Location;
}

export interface UpdateLocationInput {
  name?: string;
  description?: string | null;
  frequency?: string | null;
  space_type?: string | null;
  style?: string | null;
  color_tone?: string | null;
  lighting_type?: string | null;
  key_props?: string[];
  status?: LocationStatus;
}

export interface BaseCandidate {
  url: string;
  seed: number;
  prompt: string;
}

export interface GenerateBaseCandidatesInput {
  seed?: number;
}

export interface ConfirmBaseInput {
  candidate: BaseCandidate;
}

export interface VariantResult {
  url: string;
  seed: number;
  prompt: string;
}

export interface GenerateVariantInput {
  time_of_day: string;
  weather: string;
}

export interface ConfirmVariantInput {
  time_of_day: string;
  weather: string;
  variant: VariantResult;
}

export interface RollbackLocationInput {
  version_id: string;
}

export interface SnapshotMeta {
  id: string;
  versionId: string;
  versionNumber: number;
  source: 'ai_generated' | 'user_edited' | 'ai_regenerated' | 'locked';
  editedBy: string | null;
  aiModel: { provider: string; model: string } | null;
  promptOverride: string | null;
  parentVersionNumber: number | null;
  createdAt: string;
}

export interface Snapshot {
  id: string;
  versionId: string;
  versionNumber: number;
  source: 'ai_generated' | 'user_edited' | 'ai_regenerated' | 'locked';
  editedBy: string | null;
  aiModel: { provider: string; model: string } | null;
  promptOverride: string | null;
  parentVersionNumber: number | null;
  createdAt: string;
  content: Record<string, unknown>;
  diff: Record<string, 'added' | 'changed' | 'removed'>;
}

export interface SnapshotHistoryResponse {
  data: {
    total: number;
    versions: SnapshotMeta[];
  };
}

export interface SnapshotResponse {
  data: Snapshot;
}
