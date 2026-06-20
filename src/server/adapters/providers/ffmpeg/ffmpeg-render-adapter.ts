import { exec } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import { dir } from 'tmp-promise';
import { BaseAdapter } from '../../base-adapter.js';
import type {
  AIRenderAdapter,
  AdapterResult,
  HealthStatus,
  ModelConfig,
  RenderResult,
  RenderUsage,
} from '../../types.js';
import type { StorageService } from '../../../services/storage/types.js';
import {
  buildAudioFilterComplex,
  buildVideoFilterComplex,
  computeTotalDuration,
  parseResolution,
  type ComposePlan,
} from './command-builder.js';
import { buildAssSubtitles } from './subtitle-builder.js';

export interface FFmpegRenderAdapterOptions {
  storage: StorageService;
  ffmpegPath?: string;
}

/**
 * 基于 FFmpeg 的真实合成输出 Adapter
 *
 * 功能：
 * - 拼接视频片段并应用转场
 * - 混音（配音 + 配乐 duck）
 * - 烧录 ASS 字幕
 * - 输出 1080×1920 竖屏 MP4（默认 h264）
 * - 处理 TTS 音频超过视频时长时的冻结末帧延伸
 */
export class FFmpegRenderAdapter extends BaseAdapter implements AIRenderAdapter {
  readonly provider = 'ffmpeg-render';
  private readonly storage: StorageService;

  constructor(options: FFmpegRenderAdapterOptions) {
    super('ffmpeg-render');
    this.storage = options.storage;

    if (options.ffmpegPath) {
      ffmpeg.setFfmpegPath(options.ffmpegPath);
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      await this.runFfmpegVersion();
      return 'available';
    } catch {
      return 'unavailable';
    }
  }

  async composeEpisode(
    params: {
      videoClips: Array<{ url: string; duration: number; freezeExtend?: number }>;
      audioClips: Array<{ url: string; duration: number; startTime: number }>;
      musicSegments: Array<{
        url: string;
        start_time: number;
        duration: number;
        volume: number;
      }>;
      transitions: Array<{
        from_node_id: string;
        to_node_id: string;
        transition_type: 'cut' | 'dissolve' | 'fade' | 'white_flash' | 'black_fade';
        duration: number;
      }>;
      subtitleCues: Array<{
        start_time: number;
        end_time: number;
        text: string;
        node_id: string;
      }>;
      resolution: string;
      fps: number;
      codec: string;
    },
    config: ModelConfig,
  ): Promise<AdapterResult<RenderResult, RenderUsage>> {
    const { result, latencyMs } = await this.measureLatency(async () => {
      const tmpDir = await dir({ unsafeCleanup: true });
      const workDir = tmpDir.path;

      try {
        const plan: ComposePlan = {
          videoSegments: params.videoClips.map((c) => ({
            url: c.url,
            duration: c.duration,
            freezeExtend: c.freezeExtend,
          })),
          audioClips: params.audioClips.map((c) => ({
            url: c.url,
            duration: c.duration,
            startTime: c.startTime,
          })),
          musicSegments: params.musicSegments,
          transitions: params.transitions,
          subtitleCues: params.subtitleCues,
          resolution: params.resolution,
          fps: params.fps,
          codec: params.codec,
        };

        const inputs = await this.downloadInputs(workDir, plan);
        const videoFilter = buildVideoFilterComplex(
          plan.videoSegments,
          plan.transitions,
          parseResolution(plan.resolution),
          plan.fps,
        );
        const audioFilter = buildAudioFilterComplex(plan.audioClips, plan.musicSegments);
        const subtitlePath =
          plan.subtitleCues.length > 0
            ? await this.writeSubtitles(workDir, plan.subtitleCues, plan.resolution, config)
            : null;

        const outputPath = path.join(workDir, 'output.mp4');
        await this.runFfmpegCompose(inputs, videoFilter, audioFilter, subtitlePath, outputPath, plan);

        const outputKey = `render/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.mp4`;
        const { url } = await this.storage.save(outputPath, outputKey);
        const totalDuration = computeTotalDuration(plan.videoSegments);

        return {
          url,
          duration: Math.round(totalDuration * 100) / 100,
          resolution: plan.resolution,
          fps: plan.fps,
          codec: plan.codec,
        };
      } finally {
        await tmpDir.cleanup();
      }
    });

    const usage = this.computeUsage(result, latencyMs);

    return {
      data: result,
      usage,
      latencyMs,
      provider: this.provider,
      model: config.model,
    };
  }

  private async downloadInputs(workDir: string, plan: ComposePlan): Promise<string[]> {
    const inputsDir = path.join(workDir, 'inputs');
    await mkdir(inputsDir, { recursive: true });

    const urls: string[] = [
      ...plan.videoSegments.map((s) => s.url),
      ...plan.audioClips.map((a) => a.url),
      ...plan.musicSegments.map((m) => m.url),
    ];

    const downloaded: string[] = [];
    for (let i = 0; i < urls.length; i++) {
      const ext = urls[i].endsWith('.mp3') ? 'mp3' : urls[i].endsWith('.mp4') ? 'mp4' : 'bin';
      const localPath = path.join(inputsDir, `input-${i}.${ext}`);
      await this.downloadFile(urls[i], localPath);
      downloaded.push(localPath);
    }

    return downloaded;
  }

  private async downloadFile(url: string, dest: string): Promise<void> {
    if (url.startsWith('file://')) {
      const src = url.replace('file://', '');
      await import('node:fs/promises').then((fs) => fs.copyFile(src, dest),
      );
      return;
    }

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buffer);
  }

  private async writeSubtitles(
    workDir: string,
    cues: Array<{ start_time: number; end_time: number; text: string; node_id: string }>,
    resolution: string,
    _config: ModelConfig,
  ): Promise<string> {
    const subtitlePath = path.join(workDir, 'subtitles.ass');
    const ass = buildAssSubtitles(cues, resolution);
    await writeFile(subtitlePath, ass, 'utf-8');
    return subtitlePath;
  }

  private async runFfmpegCompose(
    inputs: string[],
    videoFilter: string,
    audioFilter: string,
    subtitlePath: string | null,
    outputPath: string,
    plan: {
      resolution: string;
      fps: number;
      codec: string;
    },
  ): Promise<void> {
    const intermediatePath = subtitlePath ? outputPath.replace('.mp4', '-intermediate.mp4') : outputPath;

    // 第一遍：视频拼接 + 转场 + 混音
    await this.runPass1(inputs, videoFilter, audioFilter, intermediatePath, plan);

    // 第二遍：烧录字幕（如有）
    if (subtitlePath) {
      await this.runPass2(intermediatePath, subtitlePath, outputPath, plan);
    }
  }

  private runPass1(
    inputs: string[],
    videoFilter: string,
    audioFilter: string,
    outputPath: string,
    plan: { resolution: string; fps: number; codec: string },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      inputs.forEach((input) => {
        command.input(input);
      });

      const filters: string[] = [];
      if (videoFilter) filters.push(videoFilter);
      if (audioFilter) filters.push(audioFilter);

      if (filters.length > 0) {
        const outputs: string[] = [];
        if (videoFilter) outputs.push('video');
        if (audioFilter) outputs.push('audio');
        command.complexFilter(filters.join(';'), outputs);
      }

      const outputOptions = [
        ...(videoFilter ? ['-map [video]'] : ['-map 0:v']),
        ...(audioFilter ? ['-map [audio]'] : inputs.some((i) => i.endsWith('.mp3')) ? ['-map 0:a'] : []),
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-r',
        String(plan.fps),
        '-s',
        plan.resolution,
        '-c:a aac',
        '-b:a 192k',
        '-ar 48000',
        '-movflags +faststart',
      ];

      command
        .outputOptions(outputOptions)
        .on('error', (err) => reject(new Error(`FFmpeg pass 1 failed: ${err.message}`)))
        .on('end', () => resolve())
        .save(outputPath);
    });
  }

  private runPass2(
    inputPath: string,
    subtitlePath: string,
    outputPath: string,
    plan: { resolution: string; fps: number },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf',
          `subtitles=${subtitlePath}:force_style='FontName=Arial'`,
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-r',
          String(plan.fps),
          '-s',
          plan.resolution,
          '-c:a copy',
          '-movflags +faststart',
        ])
        .on('error', (err) => reject(new Error(`FFmpeg pass 2 (subtitles) failed: ${err.message}`)))
        .on('end', () => resolve())
        .save(outputPath);
    });
  }

  private runFfmpegVersion(): Promise<void> {
    return new Promise((resolve, reject) => {
      exec('ffmpeg -version', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private computeUsage(result: RenderResult, latencyMs: number): RenderUsage {
    // 粗略估算：假设渲染期间 CPU 满载，按延迟换算 CPU 核·秒
    // 实际生产建议通过进程监控或 cgroup 读取
    const cpuCoreSeconds = Math.round((latencyMs / 1000) * 1 * 100) / 100;
    // 文件大小在结果阶段未知，按时长和码率估算
    const bitrateMbps = 8;
    const outputFileSizeBytes = Math.round(
      (result.duration * bitrateMbps * 1024 * 1024) / 8,
    );

    return {
      credits: Math.max(1, Math.round(result.duration * 2)),
      durationSec: result.duration,
      cpuCoreSeconds,
      outputFileSizeBytes,
    };
  }
}
