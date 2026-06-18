# ADR-002: AI 适配器层架构决策

| 项目 | 内容 |
|------|------|
| ADR 编号 | ADR-002 |
| 主题 | AI 适配器层架构 |
| 状态 | 已冻结 |
| 决策日期 | 2026-06-18 |
| 决策人 | Blueprint · 架构师 |
| 影响范围 | AI 适配器层、所有生成模块、后端服务层 |

---

## 1. 背景

极简栈创造需要接入多个 AI 供应商，覆盖文本、图像、视频、TTS、音乐五类生成任务。如果各业务模块直接调用供应商 SDK，会导致：

1. 代码耦合严重，新增供应商需要修改多处业务代码。
2. 错误处理、重试、日志、用量统计不统一。
3. 难以支持 PRD 要求的节点级模型切换和 fallback 降级。
4. API Key 等敏感信息容易散落。

因此，需要设计统一的 AI 适配器层，将供应商差异收敛到 Adapter 内部。

---

## 2. 决策

采用 **Adapter Pool + 统一接口 + Fallback Router** 三层架构：

1. **Adapter 接口层**：为五类任务定义 TypeScript 接口（`AITextAdapter`、`AIImageAdapter`、`AIVideoAdapter`、`AITTSAdapter`、`AIMusicAdapter`）。
2. **Adapter Pool**：启动时注册所有 Adapter 实例，按 `provider` ID 路由。
3. **Fallback Router**：根据错误类型判断是否切换到备用 provider，仅对可用性错误生效。

### 2.1 五类 Adapter 统一接口

```typescript
// 通用结果与用量类型
interface TokenUsage { inputTokens: number; outputTokens: number; }
interface ImageUsage { credits: number; }
interface VideoUsage { credits: number; durationSec: number; }
interface TTSUsage { credits: number; durationSec: number; }
interface MusicUsage { credits: number; durationSec: number; }

interface AdapterResult<T, U> {
  data: T;
  usage: U;
  latencyMs: number;
  provider: string;
  model: string;
}

interface AdapterError {
  code: string;
  message: string;
  retryable: boolean; // true = 可用性错误，可 fallback
}

// 文本
interface AITextAdapter {
  readonly provider: string;
  healthCheck(): Promise<HealthStatus>;
  generateText(
    prompt: string,
    systemPrompt: string | undefined,
    schema: ZodSchema | undefined,
    config: ModelConfig
  ): Promise<AdapterResult<{ content: string }, TokenUsage>>;
}

// 图像
interface AIImageAdapter {
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
  ): Promise<AdapterResult<{ url: string; seed: number }, ImageUsage>>;
}

// 视频
interface AIVideoAdapter {
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
  ): Promise<AdapterResult<{ url: string; duration: number }, VideoUsage>>;
}

// TTS
interface AITTSAdapter {
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
  ): Promise<AdapterResult<{ url: string; duration: number }, TTSUsage>>;
}

// 音乐
interface AIMusicAdapter {
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
  ): Promise<AdapterResult<{ url: string; duration: number }, MusicUsage>>;
}
```

### 2.2 ModelConfig 与 ModelBinding

```typescript
interface ModelConfig {
  provider: string;
  model: string;
  apiKey?: string;        // 运行时装配，不持久化到业务数据
  baseUrl?: string;
  extraParams?: Record<string, unknown>;
  timeoutMs?: number;
  maxRetries?: number;
}

interface ModelBinding {
  taskType: 'text' | 'image' | 'video' | 'tts' | 'music';
  primary: ModelConfig;
  fallbacks: ModelConfig[];
}

interface ProjectModelBindings {
  outline: ModelBinding;
  script: ModelBinding;
  storyboard: ModelBinding;
  character_img: ModelBinding;
  scene_img: ModelBinding;
  video: ModelBinding;
  video_fallback: ModelBinding;
  tts: ModelBinding;
  music: ModelBinding;
}
```

### 2.3 Adapter Pool

```typescript
class AdapterPool {
  private textAdapters = new Map<string, AITextAdapter>();
  private imageAdapters = new Map<string, AIImageAdapter>();
  // ... 其他类型

  registerText(adapter: AITextAdapter): void;
  getText(provider: string): AITextAdapter;
  routeText(binding: ModelBinding): AITextAdapter;
  healthCheckAll(): Promise<HealthReport>;
}
```

启动时通过工厂函数注册：

```typescript
const pool = new AdapterPool();
pool.registerText(new OpenAITextAdapter());
pool.registerImage(new ComfyUIImageAdapter());
// ...
```

### 2.4 Fallback Router

```typescript
class FallbackRouter {
  async execute<T>(
    binding: ModelBinding,
    executor: (adapter: Adapter<T>, config: ModelConfig) => Promise<T>
  ): Promise<T> {
    const configs = [binding.primary, ...binding.fallbacks];
    let lastError: AdapterError;

    for (const config of configs) {
      try {
        const adapter = this.pool.get(config.provider, binding.taskType);
        return await executor(adapter, config);
      } catch (err) {
        lastError = normalizeError(err);
        if (!lastError.retryable) break; // 非可用性错误，不 fallback
        logFallback(binding.taskType, config.provider, lastError);
      }
    }

    throw lastError;
  }
}
```

### 2.5 健康检查

- 每个 Adapter 实现 `healthCheck()`，返回 `available` / `degraded` / `unavailable`。
- API 服务启动时执行一次全量健康检查。
- 运行期间每 60 秒执行一次后台探测（通过 BullMQ 重复任务或 setInterval）。
- 调用时若 Adapter 被标记为 `unavailable`，直接跳过并触发 fallback。

---

## 3. 替代方案对比

### 3.1 Adapter Pool vs 每个模块直接调用 SDK

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| 直接调用 SDK | 无抽象层，快速原型 | 耦合、重复代码、切换成本高 | 不采用 |
| **Adapter Pool** | 统一接口、易于新增供应商、集中监控 | 需要维护 Adapter 实现 | **采用** |

### 3.2 运行时 Provider 路由 vs 编译时绑定

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| 编译时绑定 | 类型安全极致，Tree-shaking 好 | 新增供应商必须重新构建 | 不采用 |
| **运行时 Provider 路由** | 支持热切换、配置化启用/禁用 | 需要运行时校验 | **采用** |

### 3.3 统一接口 vs 每个任务独立接口

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| 每个任务独立接口 | 更贴合各供应商参数 | 无法统一 fallback 和监控 | 不采用 |
| **五类统一接口** | 统一错误、用量、降级、注册 | 参数需要 Adapter 内部转换 | **采用** |

### 3.4 Fallback 链 vs 单一 Provider

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| 单一 Provider | 简单 | 供应商故障时完全中断 | 不采用 |
| **Fallback 链** | 可用性错误时自动切换，提高稳定性 | 配置复杂，成本可能增加 | **采用** |

---

## 4. 后果与风险

### 4.1 正面后果

- 新增 AI 供应商时，业务代码零改动，只需实现对应 Adapter 并注册。
- 节点级模型切换通过更新 `ModelBinding` 实现，路由逻辑统一。
- 调用日志、用量统计、错误码统一，便于监控和成本分析。
- API Key 集中在 Adapter 层装配，不向业务模块暴露。

### 4.2 负面后果 / 风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 不同供应商参数差异大，统一接口可能损失部分高级特性 | 中 | Adapter 内部通过 `extraParams` 透传供应商特有参数；文档中明确各 Adapter 支持的能力矩阵。 |
| Fallback 触发条件判断错误可能导致不必要的切换 | 中 | 严格区分可用性错误（timeout/5xx/rate limit）与业务错误（prompt 违规/内容审核）；单元测试覆盖。 |
| 健康检查频繁调用消耗配额 | 低 | 健康检查优先使用轻量接口或缓存状态；探测间隔 60 秒。 |
| Adapter 实现增多后 Pool 管理复杂 | 低 | 按任务类型分 Map 管理；启动注册代码集中在一个 `registerAdapters()` 函数。 |

---

## 5. 与一致性保障的集成

AI 适配器层不负责业务规则，但需要接收由 ConsistencyService 准备好的约束参数：

- **图像生成**：`referenceImages` 由角色/场景圣经提供（IP-Adapter 参考图）。
- **视频生成**：`referenceImages`、`faceEnhancement` 由一致性服务注入。
- **文本生成**：`systemPrompt` 中可嵌入 `end_state`、`key_props` 等叙事约束。
- **Seed**：图像 Adapter 在内部强制使用场景 `base_seed` 或其小偏移，不依赖业务模块传入随机值。

Adapter 层只校验参数格式，不解释业务语义。

---

## 6. 调用日志与监控

每次 Adapter 调用写入 `ai_call_logs` 表：

```typescript
interface AICallLog {
  id: string;
  projectId: string;
  episodeId?: string;
  nodeId?: string;
  taskType: string;
  provider: string;
  model: string;
  status: 'success' | 'error' | 'fallback';
  latencyMs: number;
  usage: unknown; // TokenUsage | ImageUsage | ...
  errorCode?: string;
  createdAt: Date;
  // apiKey 等敏感字段已脱敏，不存储原始值
}
```

---

## 7. 人类介入红线

本 ADR 涉及以下需要人类负责人书面确认（GitHub Issue 记录）的变更：

1. 修改五类 Adapter 统一接口签名（影响所有业务模块）。
2. 引入新的任务类型（如新增配音情绪克隆），需要扩展 Adapter 接口。
3. 变更 API Key 的存储方式（如从环境变量改为 KMS）。
4. 修改 fallback 策略的根本逻辑（如对所有错误都 fallback）。

---

## 8. 关联文档

- `/docs/prd/v1.0-AI适配器层.md`
- `/docs/architecture/tech-stack.md`
- `/docs/architecture/system-overview.md`
- `/docs/adr/ADR-001-tech-stack.md`
- `/docs/architecture/performance-baseline.md`

---

## 9. 变更记录

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-06-18 | v1.0 | 初始 AI 适配器层架构决策 | Blueprint |
