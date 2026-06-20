# 真实渲染引擎集成技术方案（YZ-70）

> 状态：已实施，YZ-70 开发完成  
> 作者：Core · 后端工程师  
> 日期：2026-06-19  
> 关联：YZ-65 合成输出 API、ADR-001 技术栈、ADR-002 适配器层、/docs/prd/v1.0-合成输出模块.md

---

## 1. 背景与当前状态

YZ-65 合成输出 API 已验收通过，当前实现：

- `src/server/adapters/providers/mock/mock-render-adapter.ts` 模拟返回 MP4 URL。
- `src/server/services/render/render-service.ts` 同步调用 Adapter，按阶段更新 `projects.render_output`。
- 转场决策、字幕时间轴、混音计划已单元测试覆盖（`tests/services/render-service.test.ts`）。
- 集成测试覆盖 `POST/GET /render/*` 路径（`tests/api/render-routes.test.ts`）。

本方案目标是将模拟实现替换为基于 **FFmpeg + BullMQ + Redis** 的真实渲染流水线，同时保留 `MockRenderAdapter` 作为降级与测试替身。

---

## 2. 需引入的新依赖

### 2.1 npm 依赖

| 包名 | 用途 | 版本建议 |
|------|------|----------|
| `bullmq` | Redis 任务队列、Worker、延迟/重试/事件 | ^5.0.0（ADR-001 已选定） |
| `ioredis` | BullMQ 底层 Redis 客户端 | 随 bullmq 依赖 |
| `fluent-ffmpeg` | Node.js FFmpeg 命令封装 | ^2.1.2 |
| `@types/fluent-ffmpeg` | TypeScript 类型 | dev |
| `tmp-promise` | 临时工作目录管理 | ^3.0.3 |

### 2.2 系统依赖

| 组件 | 用途 | 版本建议 |
|------|------|----------|
| FFmpeg | 视频拼接、混音、字幕烧录、编码 | 7.x（ADR-001 已选定） |
| Redis | BullMQ 队列状态、任务事件 | 7.x（ADR-001 已选定） |

### 2.3 基础设施

- 新增 `docker-compose.yml`：包含 `app`、`worker`、`postgres`、`redis`、`minio` 服务。
- 部署文档补充 FFmpeg 安装、Redis 连接串、Worker 启动命令。
- CI 安装 FFmpeg（` FedericoCarboni/setup-ffmpeg` 或容器镜像内置）。

> ⚠️ 按团队「人类介入红线」，引入 Redis/BullMQ 等新的数据库外部依赖须经人类负责人书面确认。本方案待确认后实施。

---

## 3. Adapter 层设计

### 3.1 新增 `FFmpegRenderAdapter`

文件：`src/server/adapters/providers/ffmpeg/ffmpeg-render-adapter.ts`

实现 `AIRenderAdapter` 接口：

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

### 3.2 计费口径更新

`src/server/adapters/types.ts` 中 `RenderUsage` 按实际 CPU/时长计费：

```typescript
export interface RenderUsage {
  credits: number;
  durationSec: number;
  cpuCoreSeconds: number; // 新增：CPU 核·秒
  outputFileSizeBytes: number; // 新增：输出文件大小
}
```

建议 `credits = base + cpuCoreSeconds * rate + outputFileSizeBytes * rate`。

### 3.3 健康检查

- 调用 `ffmpeg -version` 检测 FFmpeg 可用性。
- 通过环境变量检测 `REDIS_URL` 并尝试 ping。
- 两者均可用 → `available`；FFmpeg 可用但 Redis 降级 → `degraded`；否则 `unavailable`。

---

## 4. FFmpeg 渲染流程

### 4.1 工作目录

每个渲染任务创建独立临时目录：

```
/tmp/render-{projectId}-{episodeId}-{jobId}/
├── inputs/           # 下载的源片段
├── segments/         # 冻结延伸后的单段
├── transitions/      # 转场处理后的片段
├── audio/            # 混音中间文件
├── subtitles.ass     # 字幕文件
└── output.mp4        # 最终输出
```

### 4.2 关键步骤

1. **下载源文件**
   - 使用 `fetch` 下载视频、音频、音乐到 `inputs/`。
   - 失败时抛出可重试错误。

2. **冻结延伸（freeze-extend）**
   - 当 TTS 音频时长大于视频时长时，对视频末帧生成静态帧序列并拼接：
     ```bash
     ffmpeg -i input.mp4 -vf "fps=30,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p,loop=loop={n}:1:0" -t {audioDuration} segment.mp4
     ```

3. **转场拼接**
   - 为每种转场生成 `ffmpeg` filter_complex 片段：
     - `cut`：直接 concat。
     - `dissolve`：`xfade` filter，时长 0.3s。
     - `fade`：`fade` filter，0.5s。
     - `white_flash`：白场帧 + cut，0.1s。
     - `black_fade`：fade to black + fade from black，0.3s。

4. **混音**
   - 将 dialogue 与 music 按时间轴合并为单条音频轨：
     ```bash
     ffmpeg -i dialogue.wav -i music.wav -filter_complex "
       [0:a]volume=1.0[dialogue];
       [1:a]volume={duckVolume}[music];
       [dialogue][music]amix=inputs=2:duration=longest[aout]
     " -map "[aout]" mixed.wav
     ```

5. **字幕烧录**
   - 生成 ASS 字幕文件（支持样式、位置、大小）。
   - 使用 `subtitles=subtitle.ass` filter 烧录到视频。

6. **最终编码**
   - 默认 `h264`，分辨率 `1080x1920`，fps `30`。
   - 输出 MP4 上传至 MinIO/S3，返回预签名 URL。

---

## 5. 队列与 Worker 设计

### 5.1 队列注册

新增 `src/server/queues/render-queue.ts`：

```typescript
import { Queue } from 'bullmq';

export const RENDER_QUEUE_NAME = 'render-compose';

export function createRenderQueue(connection: Redis) {
  return new Queue(RENDER_QUEUE_NAME, { connection });
}
```

### 5.2 Worker 注册

新增 `src/server/workers/render-worker.ts`：

```typescript
import { Worker } from 'bullmq';

export function createRenderWorker(connection: Redis, renderService: RenderService) {
  return new Worker(
    RENDER_QUEUE_NAME,
    async (job) => {
      const { projectId, episodeId, options, plan } = job.data;
      await renderService.processRenderJob(projectId, episodeId, options, plan, {
        onProgress: (progress) => job.updateProgress(progress),
      });
    },
    { connection, concurrency: 1 },
  );
}
```

### 5.3 服务层改造

`RenderService` 拆分为：

- `startRender(projectId, episodeId, options)`：验证前置条件、生成 RenderPlan、入队、立即返回 `queued` 状态。
- `processRenderJob(...)`：Worker 调用，执行真实 FFmpeg 渲染，按阶段更新 `render_output`。
- `getProgress` / `getDownloadUrl` 保持现状。

### 5.4 状态机扩展

`RenderStatus` 增加 `queued`：

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

### 5.5 重试与恢复

- BullMQ 默认重试策略：`attempts: 3, backoff: { type: 'exponential', delay: 5000 }`。
- Worker 崩溃：BullMQ 自动将进行中的任务标记为 `stalled` 并重新派发。
- 失败记录：`render_output.error_message` 写入最后错误；`failed_at` 可选补充。

---

## 6. 路由与 API 变化

当前 `POST /render` 同步返回 `completed`。改造后：

- `POST /render` 返回 `202 Accepted`，data 中包含 `job_id` 与 `status: 'queued'`。
- `GET /render/progress` 增加 `job_id` 字段，状态可能为 `queued`。
- 可选新增 `GET /render/jobs/:jobId` 查询 BullMQ 原生状态。

> ⚠️ 按团队红线，修改已冻结接口契约须经人类负责人书面确认。本方案建议保持响应结构兼容：额外字段可增量添加，不删除现有字段。

---

## 7. 健康检查与降级

- `FFmpegRenderAdapter.healthCheck()` 检测 FFmpeg + Redis。
- `AdapterPool.healthCheckAll()` 已支持 render provider。
- 当 `ffmpeg-render` 不可用时，业务层自动回退到 `mock-render`（已在 `render-service.ts` 中通过 `adapterPool.getRender(options.provider ?? 'mock-render')` 支持）。
- 建议新增环境变量 `RENDER_PROVIDER=ffmpeg-render|mock-render` 控制默认 provider。

---

## 8. 测试策略

### 8.1 单元测试

- `tests/services/ffmpeg-render-adapter.test.ts`：
  - 转场 filter_complex 生成。
  - 混音命令生成。
  - ASS 字幕文件生成。
  - 冻结延伸时长计算。
- `tests/services/render-queue.test.ts`：
  - 任务入队数据结构。
  - Worker 进度回调。

### 8.2 集成测试

- `tests/api/render-routes.test.ts`：
  - 使用 `MockRenderAdapter` 保持现有测试通过（默认 provider）。
  - 新增真实 FFmpeg 测试（CI 安装 FFmpeg 后启用，可选标记 `@slow`）。

### 8.3 E2E

- Shield 负责验证：
  - 最终 MP4 可播放。
  - 字幕与配音对齐误差 ≤ 0.3 秒。
  - Worker 重启后任务可恢复。

---

## 9. 部署与运维

### 9.1 docker-compose.yml 草案

```yaml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  app:
    build: .
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379
      - RENDER_PROVIDER=ffmpeg-render
    depends_on: [redis, postgres, minio]

  worker:
    build: .
    command: ["node", "dist/server/workers/render-worker.js"]
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379
      - RENDER_PROVIDER=ffmpeg-render
    depends_on: [redis, postgres, minio]
```

### 9.2 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `REDIS_URL` | Redis 连接串 | `redis://localhost:6379` |
| `RENDER_PROVIDER` | 默认渲染 provider | `mock-render` |
| `RENDER_CONCURRENCY` | Worker 并发数 | `1` |
| `RENDER_OUTPUT_BUCKET` | MinIO/S3 bucket | `renders` |
| `FFMPEG_PATH` | FFmpeg 可执行路径 | `ffmpeg` |

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| FFmpeg 命令参数因版本差异失效 | 高 | 容器化固定 FFmpeg 7.x；单元测试覆盖命令生成。 |
| Redis 不可用导致队列无法投递 | 高 | 保留 `mock-render` 降级；API 层返回明确错误。 |
| Worker 单并发导致队列堆积 | 中 | 水平扩展 Worker；单任务限制 CPU ≤4 核。 |
| 字幕时间轴因冻结延伸错位 | 中 | 冻结延伸在字幕计算之前完成，统一使用延伸后时长。 |
| 输出文件过大 | 中 | 限制码率（默认 8Mbps），单集 ≤500MB。 |

---

## 11. 待确认事项

在实施前，请人类负责人与 Blueprint 确认以下事项：

1. **是否批准引入 FFmpeg、BullMQ、Redis 作为运行时依赖？**
2. **是否允许修改 `POST /render` 响应契约（从同步 `completed` 改为异步 `queued` + `job_id`）？**
3. **`RenderUsage` 计费字段扩展方案是否可接受？**
4. **是否批准新增 `docker-compose.yml` 与部署文档变更？**
5. **Worker 部署模式：独立进程 vs 同进程后台线程？**

确认后，Core 将按本方案进入 TDD 实现阶段。

---

## 12. 关联文档

- `/docs/adr/ADR-001-tech-stack.md`
- `/docs/adr/ADR-002-adapter-layer.md`
- `/docs/architecture/system-overview.md`
- `/docs/architecture/performance-baseline.md`
- `/docs/prd/v1.0-合成输出模块.md`
- `/src/server/adapters/types.ts`
- `/src/server/services/render/render-service.ts`
- `/src/server/routes/render.ts`
