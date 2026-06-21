import type { ModelConfig } from '../types.js';

/**
 * 获取当前启用的文本生成 provider 配置
 *
 * 优先级：
 * 1. DEEP_SEEK_API_KEY 存在 → 使用 DeepSeek
 * 2. 否则回退到 mock-text（用于测试和本地开发）
 */
export function getTextProviderConfig(): ModelConfig {
  const deepSeekApiKey = process.env.DEEP_SEEK_API_KEY;
  const deepSeekBaseUrl = process.env.DEEP_SEEK_BASE_URL;

  if (deepSeekApiKey) {
    return {
      provider: 'deepseek',
      model: process.env.DEEP_SEEK_MODEL ?? 'deepseek-chat',
      apiKey: deepSeekApiKey,
      baseUrl: deepSeekBaseUrl,
      extraParams: {
        temperature: 0.7,
        max_tokens: 4096,
      },
    };
  }

  return {
    provider: 'mock-text',
    model: 'mock-model',
  };
}

/**
 * 获取当前启用的图像生成 provider 配置
 *
 * 优先级：
 * 1. AGNES_IMAGE_API_KEY 存在 → 使用 Agnes
 * 2. 否则回退到 mock-image（用于测试和本地开发）
 */
export function getImageProviderConfig(): ModelConfig {
  const agnesApiKey = process.env.AGNES_IMAGE_API_KEY;
  const agnesBaseUrl = process.env.AGNES_IMAGE_URL;
  const agnesModel = process.env.AGNES_IMAGE_MODEL;

  if (agnesApiKey) {
    return {
      provider: 'agnes-image',
      model: agnesModel ?? 'agnes-image-2.0-flash',
      apiKey: agnesApiKey,
      baseUrl: agnesBaseUrl,
      extraParams: {
        response_format: 'url',
      },
    };
  }

  return {
    provider: 'mock-image',
    model: 'mock-model',
  };
}

/**
 * 获取当前启用的视频生成 provider 配置
 *
 * 优先级：
 * 1. AGNES_VIDEO_API_KEY 存在 → 使用 Agnes
 * 2. 否则回退到 mock-video（用于测试和本地开发）
 */
export function getVideoProviderConfig(): ModelConfig {
  const agnesApiKey = process.env.AGNES_VIDEO_API_KEY;
  const agnesBaseUrl = process.env.AGNES_VIDEO_URL;
  const agnesModel = process.env.AGNES_VIDEO_MODEL;

  if (agnesApiKey) {
    return {
      provider: 'agnes-video',
      model: agnesModel ?? 'agnes-video-v2.0',
      apiKey: agnesApiKey,
      baseUrl: agnesBaseUrl,
      extraParams: {
        width: 720,
        height: 1280,
        frame_rate: 24,
      },
    };
  }

  return {
    provider: 'mock-video',
    model: 'mock-model',
  };
}
