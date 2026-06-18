# 极简栈创造 v1.0 系统架构总览

> 状态：已冻结（v1.0）  
> 配套文档：
> - `/docs/architecture/tech-stack.md`
> - `/docs/adr/ADR-001-tech-stack.md`
> - `/docs/adr/ADR-002-adapter-layer.md`
> - `/docs/architecture/performance-baseline.md`

---

## 1. 系统定位

极简栈创造是一个面向内容创作者的 AI 辅助短剧生产平台。用户从创意描述出发，经大纲、角色/场景圣经、单集脚本、分镜节点、分镜图、配音/配乐/视频片段，最终合成完整短剧。

v1.0 采用**单体式分层架构**：

- **Web 前端**（React + Vite）负责创作界面、节点编辑器、版本历史、结果预览。
- **API 服务**（Node.js + Express）承载业务逻辑、版本快照、一致性保障。
- **AI 适配器层**统一封装五类生成任务（文本/图像/视频/TTS/音乐）。
- **异步 Worker**（BullMQ）执行长时 AI 生成任务，通过 SSE 向前端推送进度。
- **数据层**（PostgreSQL + Redis + MinIO）分别持久化结构化数据、缓存/队列状态、生成的媒体资产。

---

## 2. 高层架构图

```mermaid
flowchart TB
    subgraph Client["前端 (React 19 + Vite)"]
        UI["业务页面"]
        Flow["分镜节点编辑器 (@xyflow/react)"]
        VersionUI["版本历史 / Diff / 回滚"]
        SSE["SSE 客户端"]
    end

    subgraph API["API 服务 (Node.js 22 + Express 5)"]
        Routes["REST API /api/v1"]
        Services["业务服务层"]
        Consistency["一致性保障服务"]
        Snapshot["版本快照服务"]
        AdapterPool["AI Adapter Pool"]
    end

    subgraph Workers["异步 Worker (BullMQ)"]
        TextWorker["文本生成 Worker"]
        ImageWorker["图像生成 Worker"]
        VideoWorker["视频生成 Worker"]
        TTSWorker["TTS Worker"]
        MusicWorker["配乐 Worker"]
        ComposeWorker["合成 Worker (FFmpeg)"]
    end

    subgraph Providers["AI 供应商"]
        TextProvider["文本 LLM"]
        ImageProvider["图像模型"]
        VideoProvider["视频模型"]
        TTSProvider["TTS 模型"]
        MusicProvider["音乐模型"]
    end

    subgraph Data["数据层"]
        PG[("PostgreSQL 17")]
        Redis[("Redis 7")]
        MinIO[("MinIO S3")]
    end

    UI <--> Routes
    Flow <--> Routes
    VersionUI <--> Routes
    SSE <--> Routes

    Routes <--> Services
    Services <--> Consistency
    Services <--> Snapshot
    Services <--> AdapterPool

    AdapterPool <--> TextProvider
    AdapterPool <--> ImageProvider
    AdapterPool <--> VideoProvider
    AdapterPool <--> TTSProvider
    AdapterPool <--> MusicProvider

    Services <--> TextWorker
    Services <--> ImageWorker
    Services <--> VideoWorker
    Services <--> TTSWorker
    Services <--> MusicWorker
    Services <--> ComposeWorker

    Workers <--> Redis
    AdapterPool <--> Redis
    Services <--> PG
    Services <--> MinIO
    Snapshot <--> PG
    Consistency <--> PG
```

---

## 3. 模块边界与依赖关系

```mermaid
flowchart LR
    subgraph Frontend["前端层"]
        F1["项目/大纲/圣经页面"]
        F2["分镜节点编辑器"]
        F3["版本历史弹窗"]
    end

    subgraph APILayer["API 层"]
        A1["项目 API"]
        A2["大纲 API"]
        A3["角色/场景 API"]
        A4["脚本 API"]
        A5["分镜节点 API"]
        A6["生成任务 API"]
        A7["版本快照 API"]
        A8["一致性检查 API"]
    end

    subgraph ServiceLayer["服务层"]
        S1["ProjectService"]
        S2["OutlineService"]
        S3["CharacterService"]
        S4["SceneService"]
        S5["ScriptService"]
        S6["StoryboardService"]
        S7["GenerationService"]
        S8["SnapshotService"]
        S9["ConsistencyService"]
    end

    subgraph AdapterLayer["AI 适配器层"]
        T1["TextAdapterPool"]
        T2["ImageAdapterPool"]
        T3["VideoAdapterPool"]
        T4["TTSAdapterPool"]
        T5["MusicAdapterPool"]
    end

    F1 --> A1
    F1 --> A2
    F1 --> A3
    F1 --> A4
    F2 --> A5
    F2 --> A6
    F3 --> A7
    F1 --> A8

    A1 --> S1
    A2 --> S2
    A3 --> S3
    A3 --> S4
    A4 --> S5
    A5 --> S6
    A6 --> S7
    A7 --> S8
    A8 --> S9

    S2 --> S9
    S5 --> S9
    S6 --> S8
    S7 --> S8
    S7 --> T1
    S7 --> T2
    S7 --> T3
    S7 --> T4
    S7 --> T5

    S3 --> S9
    S4 --> S9
```

### 3.1 依赖方向规则

- **前端**只能调用 **API 层**，禁止直接访问数据库、Redis、MinIO。
- **API 层**只能调用 **服务层**，禁止直接调用 Adapter。
- **服务层**可调用 **AI 适配器层**、版本快照服务、一致性服务、数据层。
- **AI 适配器层**只向上暴露统一接口，内部隔离供应商 SDK。
- **Worker**与 API 服务共享服务层代码，但独立进程运行，通过 Redis/BullMQ 接收任务。

---

## 4. 核心数据流

### 4.1 AI 生成请求流

```mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant API as API 服务
    participant S as GenerationService
    participant Q as BullMQ
    participant W as Worker
    participant A as AI Adapter Pool
    participant P as AI 供应商
    participant PG as PostgreSQL
    participant R as Redis
    participant M as MinIO

    U->>F: 点击生成
    F->>API: POST /api/v1/projects/{id}/generate
    API->>S: 创建生成任务
    S->>PG: 写入任务记录
    S->>Q: 投递 BullMQ Job
    S->>API: 返回 job_id
    API->>F: 202 Accepted + job_id
    F->>API: 建立 SSE 通道 /events/{job_id}

    Q->>W: 消费 Job
    W->>A: 按 provider/model 路由
    A->>P: 调用供应商 API
    P->>A: 返回结果 URL
    A->>W: 返回统一响应
    W->>M: 上传/引用媒体文件
    W->>PG: 更新任务状态与结果
    W->>R: 发布进度事件
    API->>F: SSE 推送进度/完成
```

### 4.2 版本快照流

```mermaid
sequenceDiagram
    participant U as 用户/AI
    participant API as API 服务
    participant S as 业务服务
    participant SS as SnapshotService
    participant PG as PostgreSQL

    U->>API: 编辑/生成操作
    API->>S: 执行业务逻辑
    S->>SS: 请求保存快照
    SS->>PG: 读取父版本内容
    SS->>SS: 计算 diff
    SS->>PG: 插入 version_snapshot
    SS->>S: 返回 version_id
    S->>API: 返回结果
```

### 4.3 一致性保障流

```mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant API as API 服务
    participant CS as ConsistencyService
    participant S as 业务服务
    participant A as AI Adapter Pool

    U->>F: 修改角色服装
    F->>API: PUT 字段
    API->>CS: 变更影响分析
    CS->>F: 返回受影响节点
    F->>U: 顶部横幅提示

    U->>F: 确认大纲
    F->>API: POST /consistency/check-outline
    API->>CS: 剧本医生检查
    CS->>API: 红/黄/绿报告
    API->>F: 展示报告
    alt 存在红色错误
        F->>U: 拦截，要求修复
    else 通过
        F->>API: 继续下一步
    end

    API->>S: 脚本生成
    S->>CS: 获取 end_state / key_props
    CS->>S: 返回约束
    S->>A: 生成请求（注入约束）
```

---

## 5. AI 适配器层详细设计

```mermaid
classDiagram
    class AITextAdapter {
        +provider: string
        +healthCheck(): Promise~HealthStatus~
        +generateText(prompt, systemPrompt, schema, config): Promise~TextResult~
    }

    class AIImageAdapter {
        +provider: string
        +healthCheck(): Promise~HealthStatus~
        +generateImage(params, config): Promise~ImageResult~
    }

    class AIVideoAdapter {
        +provider: string
        +healthCheck(): Promise~HealthStatus~
        +generateVideo(params, config): Promise~VideoResult~
    }

    class AITTSAdapter {
        +provider: string
        +healthCheck(): Promise~HealthStatus~
        +generateSpeech(params, config): Promise~TTSResult~
    }

    class AIMusicAdapter {
        +provider: string
        +healthCheck(): Promise~HealthStatus~
        +generateMusic(params, config): Promise~MusicResult~
    }

    class AdapterPool {
        -adapters: Map~string, AITextAdapter~
        +register(adapter)
        +get(provider): Adapter
        +healthCheckAll()
        +route(taskType, modelBinding): Adapter
    }

    class ModelBinding {
        +taskType: string
        +primaryProvider: string
        +fallbackProviders: string[]
    }

    class FallbackRouter {
        +executeWithFallback(binding, callFn): Promise~Result~
    }

    AdapterPool "1" *-- "0..*" AITextAdapter
    AdapterPool "1" *-- "0..*" AIImageAdapter
    AdapterPool "1" *-- "0..*" AIVideoAdapter
    AdapterPool "1" *-- "0..*" AITTSAdapter
    AdapterPool "1" *-- "0..*" AIMusicAdapter
    FallbackRouter ..> AdapterPool
    FallbackRouter ..> ModelBinding
```

### 5.1 路由与降级策略

1. **节点级模型选择**：前端在每个生成节点右上角展示当前模型；切换后更新 `ModelBinding`，下次生成生效。
2. **Provider 路由**：`AdapterPool.route(taskType, provider)` 返回对应 Adapter 实例。
3. **降级触发条件**：
   - 触发：网络超时、5xx、rate limit、健康检查失败。
   - 不触发：prompt 违规、内容审核、参数错误。
4. **Fallback 链**：按 `fallbackProviders` 顺序尝试，每次重试间隔指数退避。

---

## 6. 版本快照与一致性模块集成

```mermaid
flowchart TB
    subgraph Edit["编辑/生成操作"]
        E1["用户编辑"]
        E2["AI 生成"]
        E3["重新生成"]
        E4["回滚"]
    end

    subgraph Snapshot["版本快照服务"]
        S1["计算 diff"]
        S2["写入 version_snapshots"]
        S3["历史查询"]
        S4["回滚创建新版本"]
    end

    subgraph Consistency["一致性服务"]
        C1["IP-Adapter 注入"]
        C2["Seed 锁定"]
        C3["end_state 传递"]
        C4["剧本医生检查"]
        C5["变更影响分析"]
    end

    E1 --> S1
    E2 --> S1
    E3 --> S1
    E4 --> S4

    S1 --> S2
    S2 --> S3
    S4 --> C5

    E2 --> C1
    E2 --> C2
    E2 --> C3
    E1 --> C5
    E4 --> C5

    C4 -->|红色错误| Block["拦截进入下一阶段"]
    C5 --> Banner["前端顶部横幅提示"]
```

---

## 7. 部署拓扑（单机/最小集群）

```mermaid
flowchart LR
    subgraph Runtime["运行环境"]
        direction TB
        Nginx["Nginx / Traefik"]
        App["API 服务 x N"]
        Worker["Worker 进程 x M"]
    end

    subgraph Data["数据层"]
        PG["PostgreSQL 17"]
        Redis["Redis 7"]
        MinIO["MinIO"]
    end

    Client["浏览器"] --> Nginx
    Nginx --> App
    App --> PG
    App --> Redis
    App --> MinIO
    Worker --> PG
    Worker --> Redis
    Worker --> MinIO
```

- API 服务与 Worker 可部署在同一容器镜像的不同启动命令中。
- 初始阶段 N=1、M=1 即可满足需求；视频生成任务多时水平扩展 Worker。

---

## 8. 关键接口契约

### 8.1 前端 ↔ API

- 所有 API 以 `/api/v1` 为前缀。
- 认证 Header `Authorization` 当前透传，不做校验（v1.0 单用户）。
- 长任务返回 `202 Accepted`，通过 SSE `/api/v1/events/{job_id}` 推送进度。

### 8.2 API ↔ AI 适配器层

- 统一调用入口：`generate(taskType, params, modelBinding)`。
- 统一响应：`{ data: Result, usage: Usage, latencyMs: number }`。
- 统一错误：`{ code: string, message: string, retryable: boolean }`。

### 8.3 服务层 ↔ 版本快照

- `createSnapshot(entityType, entityId, content, source, aiModel?, promptOverride?)`。
- `compareSnapshots(entityType, entityId, fromVersion, toVersion)` 返回字段级 diff。
- `rollback(entityType, entityId, versionId)` 创建新版本并返回新 content。

---

## 9. 演进路线

- **v1.0（当前）**：单体式分层，SSE 推送，BullMQ 队列，MinIO 存储。
- **v1.1**：引入 OpenTelemetry 监控、Adapter 自动负载均衡、版本快照清理策略。
- **v2.0**：评估微服务拆分（视频合成独立服务）、全局项目快照、跨项目一致性复用。

---

## 10. 变更记录

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-06-18 | v1.0 | 初始架构总览 | Blueprint |
