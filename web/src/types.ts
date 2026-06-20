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

// ── Outline (YZ-40) ──

export interface OutlineCharacter {
  name: string;
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

export type ValidationSeverity = 'error' | 'warning' | 'pass';

export interface ValidationItem {
  type: string;
  severity: ValidationSeverity;
  message: string;
  details?: string;
}

export interface ValidationReport {
  errors: ValidationItem[];
  warnings: ValidationItem[];
  passes: ValidationItem[];
  passed: boolean;
}

export interface OutlineResponse {
  data: OutlineData;
}

export interface OutlineSummaryResponse {
  data: {
    outline: OutlineData | null;
    outline_locked: boolean;
    project_status: ProjectStatus;
  };
}

export interface ValidationReportResponse {
  data: ValidationReport;
}

export interface UpdateOutlineInput {
  world_setting?: string;
  main_conflict?: string;
  characters?: OutlineCharacter[];
  locations?: OutlineLocation[];
  episodes?: OutlineEpisode[];
}

export interface RegenerateEpisodeResponse {
  data: {
    episode: OutlineEpisode;
    episode_number: number;
  };
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

// ── Script (YZ-53) ──

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

export type EditImpact = 'light' | 'medium' | 'deep';

export const EDIT_IMPACT_LABELS: Record<EditImpact, string> = {
  light: '轻量编辑',
  medium: '中度编辑',
  deep: '深度编辑',
};

export const EDIT_IMPACT_DESCRIPTIONS: Record<EditImpact, string> = {
  light: '仅影响当前台词文本',
  medium: '影响当前场景结构，建议检查分镜节点',
  deep: '影响整集脚本结构，分镜节点需重新生成',
};

export interface ScriptResponse {
  data: EpisodeScript;
}

export interface ScriptGenerateResponse {
  data: EpisodeScript;
}

export interface RegenerateSceneResponse {
  data: Scene;
}

export interface UpdateScriptInput {
  episode_title?: string;
  scenes?: Scene[];
  end_state?: EndState;
}

export interface RegenerateSceneInput {
  scene_id: string;
}

/** Common emotion labels for Chinese drama */
export const EMOTION_LABELS: Record<string, string> = {
  neutral: '平静',
  happy: '开心',
  sad: '悲伤',
  angry: '愤怒',
  surprised: '惊讶',
  fearful: '恐惧',
  disgusted: '厌恶',
  contemplative: '沉思',
  anxious: '焦虑',
  excited: '兴奋',
  cold: '冷漠',
  gentle: '温柔',
  sarcastic: '讽刺',
  nervous: '紧张',
  proud: '骄傲',
  shy: '害羞',
};

export const TIME_OF_DAY_OPTIONS = [
  '清晨', '上午', '中午', '下午', '傍晚', '夜晚', '深夜', '黎明',
] as const;

export const WEATHER_OPTIONS = [
  '晴天', '多云', '阴天', '小雨', '大雨', '雪', '雾', '风', '暴风雨',
] as const;

// ── Storyboard (YZ-55) ──

export type ShotType =
  | 'close-up'
  | 'medium-shot'
  | 'wide-shot'
  | 'over-shoulder'
  | 'pov'
  | 'aerial';

export const SHOT_TYPE_LABELS: Record<ShotType, string> = {
  'close-up': '特写',
  'medium-shot': '中景',
  'wide-shot': '全景',
  'over-shoulder': '过肩',
  'pov': '主观视角',
  'aerial': '航拍',
};

export const SHOT_TYPE_OPTIONS: { value: ShotType; label: string }[] = [
  { value: 'close-up', label: '特写' },
  { value: 'medium-shot', label: '中景' },
  { value: 'wide-shot', label: '全景' },
  { value: 'over-shoulder', label: '过肩' },
  { value: 'pov', label: '主观视角' },
  { value: 'aerial', label: '航拍' },
];

export type CameraMove =
  | 'static'
  | 'pan-left'
  | 'pan-right'
  | 'tilt-up'
  | 'tilt-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'dolly'
  | 'tracking'
  | 'handheld';

export const CAMERA_MOVE_LABELS: Record<CameraMove, string> = {
  'static': '静止',
  'pan-left': '左摇',
  'pan-right': '右摇',
  'tilt-up': '上摇',
  'tilt-down': '下摇',
  'zoom-in': '推近',
  'zoom-out': '拉远',
  'dolly': '推轨',
  'tracking': '跟拍',
  'handheld': '手持',
};

export const CAMERA_MOVE_OPTIONS: { value: CameraMove; label: string }[] = [
  { value: 'static', label: '静止' },
  { value: 'pan-left', label: '左摇' },
  { value: 'pan-right', label: '右摇' },
  { value: 'tilt-up', label: '上摇' },
  { value: 'tilt-down', label: '下摇' },
  { value: 'zoom-in', label: '推近' },
  { value: 'zoom-out', label: '拉远' },
  { value: 'dolly', label: '推轨' },
  { value: 'tracking', label: '跟拍' },
  { value: 'handheld', label: '手持' },
];

export type TransitionType = 'cut' | 'fade' | 'dissolve' | 'wipe';

export const TRANSITION_LABELS: Record<TransitionType, string> = {
  'cut': '硬切',
  'fade': '淡入淡出',
  'dissolve': '叠化',
  'wipe': '划像',
};

export const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: 'cut', label: '硬切' },
  { value: 'fade', label: '淡入淡出' },
  { value: 'dissolve', label: '叠化' },
  { value: 'wipe', label: '划像' },
];

export type NodeStatus = 'pending' | 'generating' | 'completed' | 'needs_redo';

export const NODE_STATUS_LABELS: Record<NodeStatus, string> = {
  'pending': '待处理',
  'generating': '生成中',
  'completed': '已完成',
  'needs_redo': '需重做',
};

export const NODE_STATUS_ICONS: Record<NodeStatus, string> = {
  'pending': '⏳',
  'generating': '🔄',
  'completed': '✅',
  'needs_redo': '⚠️',
};

export type NodeEditImpact = 'light' | 'medium' | 'deep';

export const NODE_EDIT_IMPACT_LABELS: Record<NodeEditImpact, string> = {
  light: '轻量编辑',
  medium: '中度编辑',
  deep: '深度编辑',
};

/** Impact descriptions for storyboard node field edits */
export const NODE_EDIT_IMPACT_DESCRIPTIONS: Record<NodeEditImpact, string> = {
  light: '台词/情绪/时长/转场变更 — 仅影响配音配乐，分镜图不变',
  medium: '镜头/运镜/场景变体变更 — 影响分镜图+视频，需重生成',
  deep: '角色/服装/visual_desc变更 — 影响全链路，需重生成',
};

/** Get impact level for a specific field change */
export function getFieldImpact(field: string): NodeEditImpact {
  const lightFields = ['dialogue', 'emotion_tag', 'music_mood', 'duration_target', 'transition_in', 'transition_out'];
  const mediumFields = ['shot_type', 'camera_move', 'scene_variant'];
  const deepFields = ['characters', 'visual_desc', 'scene_id'];

  if (lightFields.includes(field)) return 'light';
  if (mediumFields.includes(field)) return 'medium';
  if (deepFields.includes(field)) return 'deep';
  return 'light';
}

export interface StoryboardCharacter {
  char_id: string;
  costume_variant: string;
}

export interface StoryboardDialogue {
  char_id: string;
  text: string;
  emotion: string;
}

export interface VersionHistoryEntry {
  version_id: string;
  version_number: number;
  created_at: string;
  source: 'ai_generated' | 'user_edited' | 'ai_regenerated';
}

export interface ImpactHint {
  field: string;
  impact: NodeEditImpact;
  affected_assets: string[];
  message: string;
}

export interface StoryboardNode {
  node_id: string;
  scene_id: string;
  scene_variant: string;
  characters: StoryboardCharacter[];
  shot_type: ShotType;
  camera_move: CameraMove;
  visual_desc: string;
  dialogue: StoryboardDialogue | null;
  emotion_tag: string;
  music_mood: string;
  duration_target: number;
  transition_in: TransitionType;
  transition_out: TransitionType;
  status: NodeStatus;
  version_history: VersionHistoryEntry[];
}

export interface SplitResult {
  nodes: StoryboardNode[];
  total_duration: number;
  node_count: number;
}

export interface NodeSplitResult {
  original: StoryboardNode;
  new_nodes: StoryboardNode[];
}

export interface StoryboardNodesResponse {
  data: StoryboardNode[];
}

export interface SplitResultResponse {
  data: SplitResult;
}

export interface NodeSplitResultResponse {
  data: NodeSplitResult;
}

export interface UpdateNodesInput {
  nodes: StoryboardNode[];
}

export interface SplitNodeInput {
  split_point_seconds?: number;
}

/** Music mood options for batch editing */
export const MUSIC_MOOD_OPTIONS = [
  '紧张', '舒缓', '激昂', '悲伤', '温馨', '悬疑', '轻松', '壮阔', '神秘', '欢快',
] as const;

/** Common emotion tags for batch editing */
export const EMOTION_TAG_OPTIONS = [
  '平静', '开心', '悲伤', '愤怒', '惊讶', '恐惧', '厌恶',
  '沉思', '焦虑', '兴奋', '冷漠', '温柔', '讽刺', '紧张',
  '骄傲', '害羞', '感动', '绝望', '希望', '怀念',
] as const;

// ── Storyboard Image Generation & Review (YZ-57) ──

export type ImageGenerationStatus = 'pending' | 'generating' | 'completed' | 'needs_redo';

export const IMAGE_STATUS_LABELS: Record<ImageGenerationStatus, string> = {
  pending: '待生成',
  generating: '生成中',
  completed: '已完成',
  needs_redo: '需重做',
};

export const IMAGE_STATUS_COLORS: Record<ImageGenerationStatus, string> = {
  pending: 'bg-surface text-steel',
  generating: 'bg-card-tint-sky text-link-blue',
  completed: 'bg-card-tint-mint text-brand-green',
  needs_redo: 'bg-card-tint-peach text-semantic-warning',
};

export interface ImageReview {
  approved: boolean;
  comment?: string;
  reviewed_at: string;
}

export interface StoryboardNodeWithImage extends StoryboardNode {
  image_url?: string;
  image_seed?: number;
  image_prompt?: string;
  image_negative_prompt?: string;
  image_status: ImageGenerationStatus;
  image_review?: ImageReview;
  refinement_iterations?: number;
}

export interface GenerateNodeImageOptions {
  width?: number;
  height?: number;
  style_preset?: string;
  force?: boolean;
}

export interface NodeImageResult {
  node_id: string;
  image_url: string;
  image_seed: number;
  image_prompt: string;
  image_negative_prompt: string;
  refinement_iterations: number;
  status: 'completed' | 'needs_redo';
  latency_ms: number;
}

export interface BatchGenerateSummary {
  total: number;
  completed: number;
  needs_redo: number;
  failed: number;
  ip_adapter_injection_rate: number;
  scene_seed_lock_rate: number;
}

export interface BatchGenerateResult {
  results: NodeImageResult[];
  summary: BatchGenerateSummary;
}

export interface ReviewNodeImageInput {
  approved: boolean;
  comment?: string;
}

// API response types
export interface StoryboardNodesWithImagesResponse {
  data: StoryboardNodeWithImage[];
}

export interface NodeImageResultResponse {
  data: NodeImageResult;
}

export interface BatchGenerateResultResponse {
  data: BatchGenerateResult;
}

export interface StoryboardNodeWithImageResponse {
  data: StoryboardNodeWithImage;
}

// ── TTS (YZ-60) ──

export type TtsStatus = 'pending' | 'generated' | 'reviewed';

export const TTS_STATUS_LABELS: Record<TtsStatus, string> = {
  pending: '待生成',
  generated: '已生成',
  reviewed: '已审核',
};

export const TTS_STATUS_COLORS: Record<TtsStatus, string> = {
  pending: 'bg-surface text-steel',
  generated: 'bg-card-tint-sky text-link-blue',
  reviewed: 'bg-card-tint-mint text-brand-green',
};

export interface AudioClip {
  url: string;
  duration: number;
  voice_id: string;
  emotion: string;
  speed: number;
  generated_at: string;
  status: TtsStatus;
  reviewed_at?: string;
  review_comment?: string;
  reviewed?: boolean;
}

export interface TtsGenerateOptions {
  speed?: number;
  emotion?: string;
  voice_id?: string;
  force?: boolean;
  provider?: string;
}

export interface TtsReviewInput {
  approved: boolean;
  comment?: string;
}

export interface TtsUploadInput {
  url: string;
  duration: number;
}

export interface TtsNodeResult {
  node_id: string;
  audio_clip: AudioClip | null;
  skipped: boolean;
  skip_reason?: string;
  error?: string;
}

export interface TtsBatchResult {
  episode_id: string;
  total_nodes: number;
  nodes_with_dialogue: number;
  nodes_generated: number;
  nodes_skipped: number;
  nodes_failed: number;
  success_rate: number;
  results: TtsNodeResult[];
}

export interface StoryboardNodeWithAudio extends StoryboardNode {
  audio_clip?: AudioClip | null;
  tts_status: TtsStatus;
}

export interface TtsNodeResultResponse {
  data: TtsNodeResult;
}

export interface TtsBatchResultResponse {
  data: TtsBatchResult;
}

export interface AudioClipResponse {
  data: AudioClip;
}

export interface StoryboardNodesWithAudioResponse {
  data: StoryboardNodeWithAudio[];
}

// ── Music (YZ-62) ──

export interface MusicSegment {
  node_id: string;
  start_time: number;
  duration: number;
  url: string;
  volume: number;
  ducked: boolean;
  crossfade_in: number;
  crossfade_out: number;
}

export interface EmotionTransitionWarning {
  type: 'emotion_transition';
  from_node: string;
  to_node: string;
  from_mood: string;
  to_mood: string;
  message: string;
}

export interface EpisodeMusicResult {
  episode_id: string;
  original_url: string;
  duration: number;
  segments: MusicSegment[];
  generated_at: string;
  provider: string;
  model: string;
  warnings?: EmotionTransitionWarning[];
}

export interface MusicGenerateOptions {
  provider?: string;
  style_tags?: string[];
  crossfade_duration?: number;
}

export interface MusicUploadInput {
  url: string;
  duration: number;
}

export interface EpisodeMusicResultResponse {
  data: EpisodeMusicResult;
}

export const MUSIC_MOOD_LABELS: Record<string, string> = {
  舒缓: '舒缓',
  激昂: '激昂',
  悲伤: '悲伤',
  紧张: '紧张',
  浪漫: '浪漫',
  悬疑: '悬疑',
  轻快: '轻快',
  沉重: '沉重',
  温馨: '温馨',
  空灵: '空灵',
  轻松: '轻松',
  壮阔: '壮阔',
  神秘: '神秘',
  欢快: '欢快',
};

// ── Video (YZ-64) ──

export type VideoStatus = 'pending' | 'generated' | 'reviewed';

export const VIDEO_STATUS_LABELS: Record<VideoStatus, string> = {
  pending: '待生成',
  generated: '已生成',
  reviewed: '已审核',
};

export const VIDEO_STATUS_COLORS: Record<VideoStatus, string> = {
  pending: 'bg-surface text-steel',
  generated: 'bg-card-tint-sky text-link-blue',
  reviewed: 'bg-card-tint-mint text-brand-green',
};

export interface QualityReport {
  actual_duration: number;
  target_duration: number;
  duration_ok: boolean;
  face_corruption_detected: boolean;
  motion_jump_detected: boolean;
  passed: boolean;
  details: string[];
}

export interface VideoClip {
  url: string;
  duration: number;
  camera_move: string;
  motion_description: string;
  generated_at: string;
  status: VideoStatus;
  reviewed_at?: string;
  review_comment?: string;
  reviewed?: boolean;
  quality_report: QualityReport;
  provider: string;
  model: string;
  fallback_used: boolean;
}

export interface VideoGenerateOptions {
  provider?: string;
  fallback_provider?: string;
  force?: boolean;
  concurrency?: number;
  duration?: number;
  face_enhancement?: boolean;
}

export interface VideoReviewInput {
  approved: boolean;
  comment?: string;
}

export interface VideoUploadInput {
  url: string;
  duration: number;
  camera_move?: string;
  motion_description?: string;
}

export interface VideoNodeResult {
  node_id: string;
  video_clip: VideoClip | null;
  skipped: boolean;
  skip_reason?: string;
  error?: string;
}

export interface VideoBatchResult {
  episode_id: string;
  total_nodes: number;
  nodes_generated: number;
  nodes_skipped: number;
  nodes_failed: number;
  success_rate: number;
  fallback_used_count: number;
  quality_passed_count: number;
  results: VideoNodeResult[];
}

export interface StoryboardNodeWithVideo extends StoryboardNode {
  video_clip?: VideoClip | null;
  video_status?: VideoStatus;
}

export interface VideoNodeResultResponse {
  data: VideoNodeResult;
}

export interface VideoBatchResultResponse {
  data: VideoBatchResult;
}

export interface VideoClipResponse {
  data: VideoClip;
}

// ── Composite / Final Output (YZ-66) ──

export type CompositeResolution = 'portrait_9_16' | 'landscape_16_9';
export type CompositeFrameRate = 24 | 30;
export type CompositeCodec = 'h264' | 'h265';
export type CompositeSubtitlePosition = 'bottom' | 'top';
export type CompositeSubtitleStyle = 'default' | 'outline' | 'background';
export type CompositeSubtitleSize = 'small' | 'medium' | 'large';

export interface CompositeConfig {
  resolution: CompositeResolution;
  frame_rate: CompositeFrameRate;
  codec: CompositeCodec;
  subtitle_enabled: boolean;
  subtitle_position: CompositeSubtitlePosition;
  subtitle_style: CompositeSubtitleStyle;
  subtitle_size: CompositeSubtitleSize;
}

export type CompositeStepKey = 'concat' | 'mix_audio' | 'render_subtitles' | 'encode';

export interface CompositeStep {
  key: CompositeStepKey;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface CompositeProgress {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  current_step: CompositeStepKey;
  steps: CompositeStep[];
  message?: string;
}

export interface CompositeResult {
  job_id: string;
  url: string;
  duration: number;
  width: number;
  height: number;
  file_size?: number;
  created_at: string;
}

export interface CompositeStartResponse {
  data: {
    job_id: string;
    status: 'queued' | 'running';
  };
}

export interface CompositeProgressResponse {
  data: CompositeProgress;
}

export interface CompositeResultResponse {
  data: CompositeResult;
}

// ── Render / Final Output (YZ-69) ──

export type RenderStatus =
  | 'pending'
  | 'queued'
  | 'concatenating'
  | 'mixing'
  | 'burning_subtitles'
  | 'encoding'
  | 'completed'
  | 'failed';

export const RENDER_STATUS_LABELS: Record<RenderStatus, string> = {
  pending: '待启动',
  queued: '排队中',
  concatenating: '拼接中',
  mixing: '混音中',
  burning_subtitles: '字幕渲染中',
  encoding: '编码中',
  completed: '已完成',
  failed: '失败',
};

export const RENDER_STATUS_COLORS: Record<RenderStatus, string> = {
  pending: 'bg-surface text-steel',
  queued: 'bg-card-tint-sky text-link-blue',
  concatenating: 'bg-card-tint-sky text-link-blue',
  mixing: 'bg-card-tint-sky text-link-blue',
  burning_subtitles: 'bg-card-tint-sky text-link-blue',
  encoding: 'bg-card-tint-sky text-link-blue',
  completed: 'bg-card-tint-mint text-brand-green',
  failed: 'bg-card-tint-peach text-semantic-error',
};

export interface RenderOptions {
  provider?: string;
  resolution?: '1080x1920' | '1920x1080';
  fps?: 24 | 30;
  codec?: 'h264' | 'h265';
  subtitles_enabled?: boolean;
  subtitle_style?: 'white_with_black_border' | 'white' | 'black';
  subtitle_position?: 'bottom' | 'top';
  subtitle_size?: 'small' | 'medium' | 'large';
  music_duck_dialogue?: number;
  music_duck_nondialogue?: number;
  strong_emotion_transition?: 'white_flash' | 'black_fade';
}

export interface SubtitleCue {
  start_time: number;
  end_time: number;
  text: string;
  node_id: string;
}

export interface TransitionRecord {
  from_node_id: string;
  to_node_id: string;
  transition_type: 'cut' | 'dissolve' | 'fade' | 'white_flash' | 'black_fade';
  duration: number;
}

export interface EpisodeRenderOutput {
  episode_id: string;
  status: RenderStatus;
  progress_percent: number;
  output_url: string | null;
  output_duration: number | null;
  resolution?: string;
  fps?: number;
  codec?: string;
  subtitle_cues: SubtitleCue[];
  transitions: TransitionRecord[];
  started_at: string;
  queued_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  job_id: string | null;
}

export interface EpisodeRenderOutputResponse {
  data: EpisodeRenderOutput;
}

export interface RenderDownloadResponse {
  data: {
    url: string;
  };
}
