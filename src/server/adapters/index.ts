import { AdapterPool } from './pool.js';
import { DeepSeekTextAdapter } from './providers/deepseek/deepseek-text-adapter.js';
import { MockImageAdapter } from './providers/mock/mock-image-adapter.js';
import { MockMusicAdapter } from './providers/mock/mock-music-adapter.js';
import { MockRenderAdapter } from './providers/mock/mock-render-adapter.js';
import { MockTTSAdapter } from './providers/mock/mock-tts-adapter.js';
import { MockTextAdapter } from './providers/mock/mock-text-adapter.js';
import { MockVideoAdapter } from './providers/mock/mock-video-adapter.js';

/**
 * 注册所有内置 Adapter
 * 新增供应商时，只需在此函数中添加对应 Adapter 实例，业务代码无需改动
 */
export function registerAdapters(pool: AdapterPool): AdapterPool {
  pool.registerText(new MockTextAdapter());
  pool.registerText(new DeepSeekTextAdapter());
  pool.registerImage(new MockImageAdapter());
  pool.registerVideo(new MockVideoAdapter());
  pool.registerTTS(new MockTTSAdapter());
  pool.registerMusic(new MockMusicAdapter());
  pool.registerRender(new MockRenderAdapter());
  return pool;
}

/**
 * 创建并注册默认 AdapterPool
 */
export function createDefaultAdapterPool(): AdapterPool {
  return registerAdapters(new AdapterPool());
}

export * from './types.js';
export * from './pool.js';
export * from './router.js';
export * from './error.js';
export * from './logger.js';
export * from './base-adapter.js';
export * from './lib/provider-config.js';
