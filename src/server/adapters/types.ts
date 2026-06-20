import type { ZodSchema } from 'zod';

/**
 * 通用健康状态
 */
export type HealthStatus = 'available' | 'degraded' | 'unavailable';

/**
 * 任务类型：六类 AI 生成任务（增加 render 合成输出）
 */
export type TaskType = 'text' | 'image' | 'video' | 'tts' | 'music' | 'render';

/**
 * Token 用量（文本生成）
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * 图像生成用量
 */
export interface ImageUsage {
  credits: number;
}

/**
 * 视频生成用量
 */
export interface VideoUsage {
  credits: number;
  durationSec: number;
}

/**
 * TTS 生成用量
 */
export interface TTSUsage {
  credits: number;
  durationSec: number;
}

/**
 * 音乐生成用量
 */
export interface MusicUsage {
  credits: number;
  durationSec: number;
}

/**
 * 合成输出用量
 */
export interface RenderUsage {
  credits: number;
  durationSec: number;
  cpuCoreSeconds: number; // CPU 核·秒
  outputFileSizeBytes: number; // 输出文件大小
}

/**
 * 任务类型到用量类型的映射
 */
export type UsageForTask<T extends TaskType> = T extends 'text'
  ? TokenUsage
  : T extends 'image'
    ? ImageUsage
    : T extends 'video'
      ? VideoUsage
      : T extends 'tts'
        ? TTSUsage
        : T extends 'music'
          ? MusicUsage
          : RenderUsage;

/**
 * 统一结果包装
 */
export interface AdapterResult<T, U> {
  data: T;
  usage: U;
  latencyMs: number;
  provider: string;
  model: string;
}

/**
 * 模型运行时配置
 * apiKey 由运行时装配，不持久化到业务数据
 */
export interface ModelConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  extraParams?: Record<string, unknown>;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * 模型绑定：主模型 + fallback 链
 */
export interface ModelBinding<T extends TaskType = TaskType> {
  taskType: T;
  primary: ModelConfig;
  fallbacks: ModelConfig[];
}

/**
 * 项目级模型绑定配置
 */
export interface ProjectModelBindings {
  outline: ModelBinding<'text'>;
  script: ModelBinding<'text'>;
  storyboard: ModelBinding<'image'>;
  character_img: ModelBinding<'image'>;
  scene_img: ModelBinding<'image'>;
  video: ModelBinding<'video'>;
  video_fallback: ModelBinding<'video'>;
  tts: ModelBinding<'tts'>;
  music: ModelBinding<'music'>;
  render: ModelBinding<'render'>;
}

/**
 * 文本生成结果
 */
export interface TextResult {
  content: string;
}

/**
 * 图像生成结果
 */
export interface ImageResult {
  url: string;
  seed: number;
}

/**
 * 视频生成结果
 */
export interface VideoResult {
  url: string;
  duration: number;
}

/**
 * TTS 生成结果
 */
export interface TTSResult {
  url: string;
  duration: number;
}

/**
 * 音乐生成结果
 */
export interface MusicResult {
  url: string;
  duration: number;
}

/**
 * 合成输出结果
 */
export interface RenderResult {
  url: string;
  duration: number;
  resolution: string;
  fps: number;
  codec: string;
}

/**
 * 合成任务转场描述
 */
export interface RenderTransition {
  from_node_id: string;
  to_node_id: string;
  transition_type: 'cut' | 'dissolve' | 'fade' | 'white_flash' | 'black_fade';
  duration: number;
}

/**
 * 字幕 cue
 */
export interface RenderSubtitleCue {
  start_time: number;
  end_time: number;
  text: string;
  node_id: string;
}

/**
 * 音乐混音片段
 */
export interface RenderMixTrack {
  url: string;
  start_time: number;
  duration: number;
  volume: number;
}

/**
 * 合成 Adapter 接口
 */
export interface AIRenderAdapter {
  readonly provider: string;
  healthCheck(): Promise<HealthStatus>;
  composeEpisode(
    params: {
      videoClips: Array<{
        url: string;
        duration: number;
        freezeExtend?: number;
      }>;
      audioClips: Array<{
        url: string;
        duration: number;
        startTime: number;
      }>;
      musicSegments: RenderMixTrack[];
      transitions: RenderTransition[];
      subtitleCues: RenderSubtitleCue[];
      resolution: string;
      fps: number;
      codec: string;
    },
    config: ModelConfig,
  ): Promise<AdapterResult<RenderResult, RenderUsage>>;
}

/**
 * 文本 Adapter 接口
 */
export interface AITextAdapter {
  readonly provider: string;
  healthCheck(): Promise<HealthStatus>;
  generateText(
    prompt: string,
    systemPrompt: string | undefined,
    schema: ZodSchema | undefined,
    config: ModelConfig
  ): Promise<AdapterResult<TextResult, TokenUsage>>;
}

/**
 * 图像 Adapter 接口
 */
export interface AIImageAdapter {
  readonly provider: string;
  healthCheck(): Promise<HealthStatus>;
  generateImage(
    params: {
      prompt: string;
      negativePrompt?: string;
      referenceImages?: string[];
      seed?: number;
      width?: number;
      height?: number;
      stylePreset?: string;
    },
    config: ModelConfig
  ): Promise<AdapterResult<ImageResult, ImageUsage>>;
}

/**
 * 视频 Adapter 接口
 */
export interface AIVideoAdapter {
  readonly provider: string;
  healthCheck(): Promise<HealthStatus>;
  generateVideo(
    params: {
      imageUrl?: string;
      referenceImages?: string[];
      duration: number;
      cameraMove?: string;
      motionDescription?: string;
      audioUrl?: string;
      faceEnhancement?: boolean;
    },
    config: ModelConfig
  ): Promise<AdapterResult<VideoResult, VideoUsage>>;
}

/**
 * TTS Adapter 接口
 */
export interface AITTSAdapter {
  readonly provider: string;
  healthCheck(): Promise<HealthStatus>;
  generateSpeech(
    params: {
      text: string;
      voiceId: string;
      emotion?: string;
      speed?: number;
    },
    config: ModelConfig
  ): Promise<AdapterResult<TTSResult, TTSUsage>>;
}

/**
 * 音乐 Adapter 接口
 */
export interface AIMusicAdapter {
  readonly provider: string;
  healthCheck(): Promise<HealthStatus>;
  generateMusic(
    params: {
      styleTags: string[];
      emotionSequence?: string[];
      duration: number;
      instrumentPref?: string;
    },
    config: ModelConfig
  ): Promise<AdapterResult<MusicResult, MusicUsage>>;
}

/**
 * 类型级任务类型到 Adapter 接口的映射
 */
export interface AdapterForTask {
  text: AITextAdapter;
  image: AIImageAdapter;
  video: AIVideoAdapter;
  tts: AITTSAdapter;
  music: AIMusicAdapter;
  render: AIRenderAdapter;
}

/**
 * Adapter 统一接口联合类型
 */
export type AIAdapter = AITextAdapter | AIImageAdapter | AIVideoAdapter | AITTSAdapter | AIMusicAdapter | AIRenderAdapter;

/**
 * Adapter 执行函数签名（用于 FallbackRouter）
 */
export type AdapterExecutor<T extends TaskType, R> = (
  adapter: AdapterForTask[T],
  config: ModelConfig
) => Promise<R>;
