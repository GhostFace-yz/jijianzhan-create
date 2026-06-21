import { BaseAdapter } from '../../base-adapter.js';
import type {
  AIVideoAdapter,
  AdapterResult,
  HealthStatus,
  ModelConfig,
  VideoResult,
  VideoUsage,
} from '../../types.js';

interface AgnesVideoCreateResponse {
  id?: string;
  task_id?: string;
  videoId?: string;
  status?: string;
  video_url?: string;
  remixed_from_video_id?: string;
  seconds?: string | number;
  error?: { message?: string };
}

interface AgnesVideoStatusResponse {
  id?: string;
  task_id?: string;
  videoId?: string;
  status?: string;
  progress?: number;
  video_url?: string;
  remixed_from_video_id?: string;
  seconds?: string | number;
  error?: { message?: string };
}

const VALID_FRAME_COUNTS = [81, 121, 161, 241, 441] as const;
const DEFAULT_FRAME_RATE = 24;
const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 1280;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nearestValidFrameCount(frames: number): number {
  if (frames <= VALID_FRAME_COUNTS[0]) return VALID_FRAME_COUNTS[0];
  if (frames >= VALID_FRAME_COUNTS[VALID_FRAME_COUNTS.length - 1]) {
    return VALID_FRAME_COUNTS[VALID_FRAME_COUNTS.length - 1];
  }
  return VALID_FRAME_COUNTS.reduce((best, candidate) =>
    Math.abs(candidate - frames) < Math.abs(best - frames) ? candidate : best,
  );
}

function isPubliclyReachableUrl(url: string | undefined): url is string {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  // Agnes cannot fetch localhost / loopback URLs
  if (/^https?:\/\/(localhost|127\.\d+\.\d+\.\d+)(:\d+)?\//i.test(url)) return false;
  return true;
}

function extractVideoUrl(
  res: AgnesVideoCreateResponse | AgnesVideoStatusResponse,
): string | undefined {
  return res.video_url ?? res.remixed_from_video_id;
}

function parseSeconds(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Agnes 视频生成 Adapter
 *
 * Agnes 提供 OpenAI 兼容的视频生成 API：
 * - POST /v1/videos 创建异步任务
 * - GET  /v1/videos/{task_id} 轮询结果
 */
export class AgnesVideoAdapter extends BaseAdapter implements AIVideoAdapter {
  constructor() {
    super('agnes-video');
  }

  protected resolveApiKey(config: ModelConfig): string {
    const apiKey = config.apiKey ?? process.env.AGNES_VIDEO_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Agnes video API key not configured. Set AGNES_VIDEO_API_KEY or pass config.apiKey.',
      );
    }
    return apiKey;
  }

  protected resolveBaseUrl(config: ModelConfig): string {
    return (
      config.baseUrl ||
      process.env.AGNES_VIDEO_URL ||
      'https://apihub.agnes-ai.com'
    );
  }

  protected resolveModel(config: ModelConfig): string {
    return config.model ?? process.env.AGNES_VIDEO_MODEL ?? 'agnes-video-v2.0';
  }

  protected resolveEndpoint(config: ModelConfig): string {
    const baseUrl = this.resolveBaseUrl(config).replace(/\/$/, '');
    if (baseUrl.endsWith('/v1/videos')) {
      return baseUrl;
    }
    return `${baseUrl}/v1/videos`;
  }

  async healthCheck(): Promise<HealthStatus> {
    const apiKey = process.env.AGNES_VIDEO_API_KEY;
    const baseUrl = process.env.AGNES_VIDEO_URL;

    if (!apiKey) {
      return 'unavailable';
    }

    try {
      const res = await fetch(baseUrl || 'https://apihub.agnes-ai.com', {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.status < 500 ? 'available' : 'unavailable';
    } catch {
      return 'unavailable';
    }
  }

  async generateVideo(
    params: {
      imageUrl?: string;
      referenceImages?: string[];
      duration: number;
      cameraMove?: string;
      motionDescription?: string;
      audioUrl?: string;
      faceEnhancement?: boolean;
    },
    config: ModelConfig,
  ): Promise<AdapterResult<VideoResult, VideoUsage>> {
    const apiKey = this.resolveApiKey(config);
    const endpoint = this.resolveEndpoint(config);
    const model = this.resolveModel(config);

    const frameRate =
      typeof config.extraParams?.frame_rate === 'number'
        ? (config.extraParams.frame_rate as number)
        : DEFAULT_FRAME_RATE;
    const width =
      typeof config.extraParams?.width === 'number'
        ? (config.extraParams.width as number)
        : DEFAULT_WIDTH;
    const height =
      typeof config.extraParams?.height === 'number'
        ? (config.extraParams.height as number)
        : DEFAULT_HEIGHT;

    const targetFrames = Math.max(1, Math.round(params.duration * frameRate));
    const numFrames = nearestValidFrameCount(targetFrames);
    const actualDuration = numFrames / frameRate;

    const promptParts = [
      params.motionDescription,
      params.cameraMove && params.cameraMove !== 'none'
        ? `Camera movement: ${params.cameraMove}`
        : '',
    ].filter(Boolean);
    const prompt = promptParts.join('. ');

    const firstFrameUrl = params.imageUrl ?? params.referenceImages?.[0];
    if (firstFrameUrl && !isPubliclyReachableUrl(firstFrameUrl)) {
      console.log(
        `[AgnesVideoAdapter] skipping non-public first-frame URL: ${firstFrameUrl}`,
      );
    }

    const body: Record<string, unknown> = {
      model,
      prompt,
      width,
      height,
      num_frames: numFrames,
      frame_rate: frameRate,
    };

    if (isPubliclyReachableUrl(firstFrameUrl)) {
      body.image = firstFrameUrl;
    }

    const { result, latencyMs } = await this.measureLatency(async () => {
      try {
        const createRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!createRes.ok) {
          const text = await createRes.text().catch(() => 'Unknown error');
          console.error(
            `[AgnesVideoAdapter] task creation failed. prompt="${prompt}" response="${text}"`,
          );
          throw new Error(`Agnes video task creation failed (${createRes.status}): ${text}`);
        }

        const createJson = (await createRes.json()) as AgnesVideoCreateResponse;
        const taskId = createJson.id ?? createJson.task_id ?? createJson.videoId;

        if (!taskId) {
          throw new Error(
            createJson.error?.message ??
              'Agnes video task creation returned no task ID',
          );
        }

        if (createJson.status === 'completed' && extractVideoUrl(createJson)) {
          const url = extractVideoUrl(createJson)!;
          const duration = parseSeconds(createJson.seconds) ?? actualDuration;
          return { url, duration };
        }

        // Poll until completion
        const pollUrl = `${endpoint}/${taskId}`;
        const timeoutMs = config.timeoutMs ?? 600_000;
        const deadline = Date.now() + timeoutMs;
        const pollIntervalMs = 5_000;

        while (Date.now() < deadline) {
          await sleep(pollIntervalMs);

          const statusRes = await fetch(pollUrl, {
            method: 'GET',
            headers: { Authorization: `Bearer ${apiKey}` },
          });

          if (!statusRes.ok) {
            const text = await statusRes.text().catch(() => 'Unknown error');
            throw new Error(`Agnes video status poll failed (${statusRes.status}): ${text}`);
          }

          const statusJson = (await statusRes.json()) as AgnesVideoStatusResponse;

          if (statusJson.status === 'completed' && extractVideoUrl(statusJson)) {
            const url = extractVideoUrl(statusJson)!;
            const duration = parseSeconds(statusJson.seconds) ?? actualDuration;
            return { url, duration };
          }

          if (
            statusJson.status === 'failed' ||
            statusJson.status === 'error' ||
            statusJson.error
          ) {
            throw new Error(
              statusJson.error?.message ??
                `Agnes video generation failed with status: ${statusJson.status}`,
            );
          }
        }

        throw new Error('Agnes video generation timed out');
      } catch (err) {
        console.error(
          '[AgnesVideoAdapter] generateVideo failed:',
          err instanceof Error ? err.message : err,
        );
        throw err;
      }
    });

    return {
      data: result,
      usage: { credits: 5, durationSec: result.duration },
      latencyMs,
      provider: this.provider,
      model,
    };
  }
}
