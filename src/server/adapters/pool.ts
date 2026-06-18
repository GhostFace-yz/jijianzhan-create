import type {
  AITextAdapter,
  AIImageAdapter,
  AIVideoAdapter,
  AITTSAdapter,
  AIMusicAdapter,
  AdapterForTask,
  HealthStatus,
  TaskType,
} from './types.js';

/**
 * Adapter 注册表
 * 按任务类型和 provider ID 管理 Adapter 实例
 */
export class AdapterPool {
  private textAdapters = new Map<string, AITextAdapter>();
  private imageAdapters = new Map<string, AIImageAdapter>();
  private videoAdapters = new Map<string, AIVideoAdapter>();
  private ttsAdapters = new Map<string, AITTSAdapter>();
  private musicAdapters = new Map<string, AIMusicAdapter>();
  private healthStatus: HealthReport = {
    text: {},
    image: {},
    video: {},
    tts: {},
    music: {},
  };

  private adapterMapForTask<T extends TaskType>(taskType: T): Map<string, AdapterForTask[T]> {
    switch (taskType) {
      case 'text':
        return this.textAdapters as Map<string, AdapterForTask[T]>;
      case 'image':
        return this.imageAdapters as Map<string, AdapterForTask[T]>;
      case 'video':
        return this.videoAdapters as Map<string, AdapterForTask[T]>;
      case 'tts':
        return this.ttsAdapters as Map<string, AdapterForTask[T]>;
      case 'music':
        return this.musicAdapters as Map<string, AdapterForTask[T]>;
      default: {
        const _exhaustive: never = taskType;
        throw new Error(`Unknown task type: ${_exhaustive}`);
      }
    }
  }

  registerText(adapter: AITextAdapter): void {
    this.textAdapters.set(adapter.provider, adapter);
  }

  registerImage(adapter: AIImageAdapter): void {
    this.imageAdapters.set(adapter.provider, adapter);
  }

  registerVideo(adapter: AIVideoAdapter): void {
    this.videoAdapters.set(adapter.provider, adapter);
  }

  registerTTS(adapter: AITTSAdapter): void {
    this.ttsAdapters.set(adapter.provider, adapter);
  }

  registerMusic(adapter: AIMusicAdapter): void {
    this.musicAdapters.set(adapter.provider, adapter);
  }

  getText(provider: string): AITextAdapter {
    const adapter = this.textAdapters.get(provider);
    if (!adapter) {
      throw new Error(`Text adapter not found for provider: ${provider}`);
    }
    return adapter;
  }

  getImage(provider: string): AIImageAdapter {
    const adapter = this.imageAdapters.get(provider);
    if (!adapter) {
      throw new Error(`Image adapter not found for provider: ${provider}`);
    }
    return adapter;
  }

  getVideo(provider: string): AIVideoAdapter {
    const adapter = this.videoAdapters.get(provider);
    if (!adapter) {
      throw new Error(`Video adapter not found for provider: ${provider}`);
    }
    return adapter;
  }

  getTTS(provider: string): AITTSAdapter {
    const adapter = this.ttsAdapters.get(provider);
    if (!adapter) {
      throw new Error(`TTS adapter not found for provider: ${provider}`);
    }
    return adapter;
  }

  getMusic(provider: string): AIMusicAdapter {
    const adapter = this.musicAdapters.get(provider);
    if (!adapter) {
      throw new Error(`Music adapter not found for provider: ${provider}`);
    }
    return adapter;
  }

  /**
   * 按任务类型和 provider ID 路由获取 Adapter
   */
  route<T extends TaskType>(taskType: T, provider: string): AdapterForTask[T] {
    const map = this.adapterMapForTask(taskType);
    const adapter = map.get(provider);
    if (!adapter) {
      throw new Error(`${taskType} adapter not found for provider: ${provider}`);
    }
    return adapter;
  }

  /**
   * 获取最近一次健康检查状态
   */
  getHealthStatus(taskType: TaskType, provider: string): HealthStatus | undefined {
    return this.healthStatus[taskType][provider];
  }

  /**
   * 执行全量健康检查
   */
  async healthCheckAll(): Promise<HealthReport> {
    const report: HealthReport = {
      text: {},
      image: {},
      video: {},
      tts: {},
      music: {},
    };

    const tasks: Array<Promise<void>> = [];

    for (const [provider, adapter] of this.textAdapters.entries()) {
      tasks.push(
        adapter.healthCheck().then((status) => {
          report.text[provider] = status;
        })
      );
    }
    for (const [provider, adapter] of this.imageAdapters.entries()) {
      tasks.push(
        adapter.healthCheck().then((status) => {
          report.image[provider] = status;
        })
      );
    }
    for (const [provider, adapter] of this.videoAdapters.entries()) {
      tasks.push(
        adapter.healthCheck().then((status) => {
          report.video[provider] = status;
        })
      );
    }
    for (const [provider, adapter] of this.ttsAdapters.entries()) {
      tasks.push(
        adapter.healthCheck().then((status) => {
          report.tts[provider] = status;
        })
      );
    }
    for (const [provider, adapter] of this.musicAdapters.entries()) {
      tasks.push(
        adapter.healthCheck().then((status) => {
          report.music[provider] = status;
        })
      );
    }

    await Promise.all(tasks);
    this.healthStatus = report;
    return report;
  }

  /**
   * 获取所有已注册的 provider 列表
   */
  listProviders(): { taskType: TaskType; provider: string }[] {
    const providers: { taskType: TaskType; provider: string }[] = [];
    for (const provider of this.textAdapters.keys()) {
      providers.push({ taskType: 'text', provider });
    }
    for (const provider of this.imageAdapters.keys()) {
      providers.push({ taskType: 'image', provider });
    }
    for (const provider of this.videoAdapters.keys()) {
      providers.push({ taskType: 'video', provider });
    }
    for (const provider of this.ttsAdapters.keys()) {
      providers.push({ taskType: 'tts', provider });
    }
    for (const provider of this.musicAdapters.keys()) {
      providers.push({ taskType: 'music', provider });
    }
    return providers;
  }
}

/**
 * 健康检查报告
 */
export interface HealthReport {
  text: Record<string, HealthStatus>;
  image: Record<string, HealthStatus>;
  video: Record<string, HealthStatus>;
  tts: Record<string, HealthStatus>;
  music: Record<string, HealthStatus>;
}
