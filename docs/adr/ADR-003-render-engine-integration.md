# ADR-003: 真实渲染引擎集成架构决策

| 项目 | 内容 |
|------|------|
| ADR 编号 | ADR-003 |
| 主题 | 真实渲染引擎集成（FFmpeg/BullMQ/Redis） |
| 状态 | 已冻结 |
| 决策日期 | 2026-06-19 |
| 决策人 | Blueprint · 架构师 |
| 影响范围 | 后端服务层、AI 适配器层、API 契约、部署拓扑、计费口径 |

---

## 1. 背景

YZ-65 合成输出 API 已基于 `MockRenderAdapter` 验收通过，当前 `POST /render` 同步返回已完成结果。为达到 v1.0 真实短剧合成能力，需将模拟实现替换为基于 FFmpeg 的真实媒体处理流水线，并通过 BullMQ + Redis 异步调度长时渲染任务。

本 ADR 在 ADR-001（技术栈）与 ADR-002（适配器层）已冻结决策的基础上，明确渲染域的具体集成模式、API 契约变更、计费扩展与部署约定。

---

## 2. 决策

### 2.1 技术选型确认

延续 ADR-001 决策：

| 组件 | 版本 | 用途 |
|------|------|------|
| FFmpeg | 7.x | 视频拼接、混音、字幕烧录、编码 |
| BullMQ | 5.x | Redis 任务队列、Worker、重试与进度事件 |
| Redis | 7.x | 队列状态、任务事件、进度缓存 |
| fluent-ffmpeg | ^2.1.2 | Node.js FFmpeg 命令封装 |
| tmp-promise | ^3.0.3 | 临时工作目录管理 |

### 2.2 适配器层扩展

新增 `FFmpegRenderAdapter`（`src/server/adapters/providers/ffmpeg/ffmpeg-render-adapter.ts`），实现已冻结的 `AIRenderAdapter` 接口：

```typescript
export class FFmpegRenderAdapter extends BaseAdapter implements AIRenderAdapter {
  readonly provider = 'ffmpeg-render';

  async healthCheck(): Promise<HealthStatus> {
    // 检测 ffmpeg 可执行文件与 redis 连接
  }

  async composeEpisode(
    params: {
      videoClips: Array<{ url: string; duration: number; freezeExtend?: number }>;
      audioClips: Array<{ url: string; duration: number; startTime: number }>;
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
```

保留 `MockRenderAdapter` 作为：
- 单元/集成测试中的测试替身；
- FFmpeg 或 Redis 不可用时的运行时降级方案。

### 2.3 计费口径扩展

`RenderUsage` 在 `src/server/adapters/types.ts` 中扩展为：

```typescript
export interface RenderUsage {
  credits: number;
  durationSec: number;
  cpuCoreSeconds: number;        // 新增：CPU 核·秒
  outputFileSizeBytes: number;   // 新增：输出文件大小
}
```

计费公式由 Core 在实现层确定，架构约束：
- `credits` 必须综合时长、CPU 消耗与输出体积；
- 新增字段须有默认值以保证旧数据兼容。

### 2.4 同步 API 改造为异步队列

`RenderService` 拆分为两阶段：

1. **`startRender(projectId, episodeId, options)`**
   - 校验前置条件；
   - 生成 `RenderPlan`；
   - 将任务投递到 BullMQ；
   - 立即返回 `queued` 状态与 `job_id`。

2. **`processRenderJob(...)`**
   - 由独立 Worker 调用；
   - 执行 FFmpeg 真实渲染；
   - 按阶段更新 `projects.render_output`；
   - 通过 BullMQ `job.updateProgress` 回传进度。

`RenderStatus` 扩展 `queued` 状态：

```typescript
export type RenderStatus =
  | 'pending'
  | 'queued'
  | 'concatenating'
  | 'mixing'
  | 'burning_subtitles'
  | 'encoding'
  | 'completed'
  | 'failed';
```

### 2.5 API 契约变更

- `POST /render` 从 `201 Created + completed 结果` 改为 `202 Accepted + { status: 'queued', job_id }`。
- `GET /render/progress` 响应中保留 episode 级聚合状态，新增 `job_id` 字段。
- 不删除现有字段，仅增量扩展，保持向后兼容。

### 2.6 队列与 Worker 架构

新增：
- `src/server/queues/render-queue.ts`：创建 BullMQ `Queue` 实例。
- `src/server/workers/render-worker.ts`：创建 BullMQ `Worker` 实例，调用 `RenderService.processRenderJob`。

Worker 配置：
- 默认并发 `concurrency = 1`；
- 重试策略 `attempts: 3, backoff: { type: 'exponential', delay: 5000 }`；
- Worker 崩溃时由 BullMQ 自动检测 `stalled` 任务并重新派发。

### 2.7 健康检查与降级

- `FFmpegRenderAdapter.healthCheck()` 检测 FFmpeg 可执行文件与 Redis 连接；
- `AdapterPool` 已支持 render provider 路由；
- 当 `ffmpeg-render` 不可用时，业务层回退到 `mock-render`；
- 新增环境变量 `RENDER_PROVIDER=ffmpeg-render|mock-render` 控制默认 provider。

### 2.8 部署拓扑

新增 `docker-compose.yml` 服务：
- `redis`：队列状态；
- `app`：API 服务；
- `worker`：独立渲染 Worker 进程；
- 保留已有的 `postgres`、`minio`。

CI 需安装 FFmpeg（GitHub Action `FedericoCarboni/setup-ffmpeg` 或容器镜像内置）。

---

## 3. 替代方案对比

### 3.1 同步渲染 vs 异步队列

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| 同步渲染 | 实现简单，前端无需轮询/SSE | 长时请求易超时；Worker 崩溃无法恢复；API 资源被长时间占用 | 不采用 |
| **异步队列（BullMQ）** | 符合系统总览中异步 Worker 设计；支持重试、恢复、水平扩展 | 需要维护队列、Worker 进程与进度推送 | **采用** |

### 3.2 独立 Worker 进程 vs 同进程后台线程

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| 同进程后台线程 | 部署简单，无需额外进程 | 单进程崩溃影响 API 服务；Node.js 不适合 CPU 密集型后台线程 | 不采用 |
| **独立 Worker 进程** | 与 API 服务解耦；可单独水平扩展；符合系统总览部署拓扑 | 需要独立启动命令和监控 | **采用** |

### 3.3 直接执行 ffmpeg CLI vs 使用 fluent-ffmpeg

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| 直接执行 CLI（child_process） | 无额外依赖，命令完全可控 | 需要自行处理转义、进度解析、错误码 | 不采用 |
| **fluent-ffmpeg** | 社区成熟，封装进度、事件、filter_complex；TypeScript 类型完善 | 抽象层可能限制极少数高级参数 | **采用** |

### 3.4 扩展 RenderUsage vs 保持原字段

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| 保持原字段 | 不改变类型定义 | 无法按 CPU/文件大小精确计费，不符合真实渲染成本模型 | 不采用 |
| **扩展 cpuCoreSeconds + outputFileSizeBytes** | 支持按实际资源消耗计费；保留 credits 作为对外计费口径 | 需要在 Adapter 实现中采集并设置默认值 | **采用** |

---

## 4. 后果与风险

### 4.1 正面后果

- 合成输出从模拟升级为真实媒体处理，满足 v1.0 核心交付要求。
- 异步架构与系统总览中 BullMQ Worker 设计一致，便于统一运维。
- 保留 `MockRenderAdapter` 降级，提升系统可用性。
- 计费字段扩展为后续成本优化提供数据基础。

### 4.2 负面后果 / 风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| FFmpeg 命令参数因版本差异失效 | 高 | 容器化固定 FFmpeg 7.x；单元测试覆盖命令生成；CI 与生产使用相同镜像。 |
| Redis 不可用导致队列无法投递 | 高 | 保留 `mock-render` 降级；API 层返回明确错误；部署文档强调 Redis 为必需依赖。 |
| Worker 单并发导致队列堆积 | 中 | 水平扩展 Worker 进程；单任务限制 CPU ≤4 核；监控队列深度。 |
| 字幕时间轴因冻结延伸错位 | 中 | 冻结延伸在字幕计算之前完成；统一使用延伸后时长；E2E 验证字幕对齐。 |
| 输出文件过大 | 中 | 限制码率（默认 8Mbps），单集 ≤500MB；按 outputFileSizeBytes 计费。 |
| API 契约从同步改为异步影响前端 | 中 | 保持响应结构兼容，仅增量添加字段；Flux 子任务同步更新前端轮询逻辑。 |

---

## 5. 人类介入红线

本 ADR 涉及以下需要人类负责人书面确认（GitHub Issue 记录）的变更：

1. 修改 `POST /render` 响应契约（从同步 `completed` 改为异步 `queued` + `job_id`）。
2. 修改 `RenderUsage` 计费字段或计费公式。
3. 变更 Worker 部署模式（独立进程 vs 其他方案）。
4. 回退或废弃本 ADR 中定义的渲染技术栈。

---

## 6. 关联文档

- `/docs/adr/ADR-001-tech-stack.md`
- `/docs/adr/ADR-002-adapter-layer.md`
- `/docs/architecture/system-overview.md`
- `/docs/architecture/performance-baseline.md`
- `/docs/architecture/render-engine-integration-plan.md`
- `/docs/prd/v1.0-合成输出模块.md`
- `/src/server/adapters/types.ts`
- `/src/server/services/render/render-service.ts`
- `/src/server/routes/render.ts`

---

## 7. 变更记录

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-06-19 | v1.0 | 初始真实渲染引擎集成架构决策 | Blueprint |
