# 极简栈创造 v1.0 技术栈

> 状态：已冻结（v1.0）  
> 适用范围：极简栈创造 v1.0 全部前后端模块  
> 决策日期：2026-06-18  
> 决策人：Blueprint · 架构师

---

## 1. 设计原则

1. **统一语言**：前后端均使用 TypeScript，降低类型转换成本。
2. **版本优先**：优先选择已确认的最新稳定版本（LTS），不追逐 Current/Beta。
3. **供应商隔离**：AI 供应商通过 Adapter 层统一接入，业务模块不直接依赖具体 SDK。
4. **渐进扩展**：基础设施选型支持从单机部署平滑扩展到多 worker 队列。
5. **最小必要**：在初始建议栈基础上，仅补充验证、ORM、构建等必要支撑库。

---

## 2. 前端技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 框架 | React | 19.2+ | 当前稳定主版本，`useActionState`、`useEffectEvent`（19.2 稳定）对表单和副作用编排更友好。 |
| 语言 | TypeScript | 5.7+ | 严格模式启用。 |
| 构建 | Vite | 6.x | 快速 HMR、原生 ESM、对 React 19 支持良好。 |
| 路由 | React Router | 7.x | 声明式路由，支持 loader/action 与 v1 API 风格兼容。 |
| 样式 | Tailwind CSS | 4.3+ | CSS-first 配置，与设计系统 Token 映射直接。 |
| 组件库 | shadcn/ui | 最新 CLI | 基于 Radix UI + Tailwind，组件源码可复制修改，便于贴合 DESIGN.md。 |
| 状态管理 | Zustand | 5.x | 轻量、TypeScript 友好，适合项目级与编辑器级状态。 |
| 节点编辑器 | @xyflow/react | 12.x | React Flow 官方包，用于分镜节点化泳道时间轴。 |
| 表单/校验 | React Hook Form + Zod | 7.x / 3.24+ | 前端表单与后端 API 共享 Zod Schema。 |
| 数据获取 | TanStack Query (React Query) | 5.x | 服务端状态缓存、后台刷新、乐观更新。 |
| 测试 | Vitest + React Testing Library + Playwright | 最新稳定 | 单元/组件/E2E 分层。 |

### 2.1 前端关键版本确认

- React 19.2 已于 2025-10-01 发布稳定版，是 2026 年新项目的推荐起点。
- Tailwind CSS v4.3 是当前稳定主版本，v4 采用基于 CSS 的配置方式；新项目直接使用 v4，无需承担 v3→v4 迁移成本。

### 2.2 前端依赖约束说明

- **新增依赖**：React Router、TanStack Query、React Hook Form、Zod、@xyflow/react 属于 v1.0 功能必需依赖。
- 其中 Zod、React Hook Form、TanStack Query 为同时服务于前后端的共享校验与数据获取基础设施。
- 这些依赖均超过初始建议栈范围，由 Blueprint 在架构决策中统一纳入；若后续需要继续新增 UI 库导致 gzip 增量 >100KB 或依赖数 >+3，须按人类介入红线重新审批。

---

## 3. 后端技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 运行时 | Node.js | 22.x LTS | 当前生产 LTS，支持到 2027 年以后。 |
| 框架 | Express | 5.0+ | 2024-09 发布稳定版，支持 Promise 错误处理、路由改进。 |
| 语言 | TypeScript | 5.7+ | 编译目标 `ES2022`，模块 `NodeNext`。 |
| ORM | Prisma | 6.x | 类型安全、迁移系统完善、与 PostgreSQL 配合成熟。 |
| 校验 | Zod | 3.24+ | 前后端共享 Schema，用于 API 入参、AI Adapter 接口校验。 |
| 数据库 | PostgreSQL | 17.x | 主数据库，JSONB 支持版本快照与半结构化节点数据。 |
| 缓存/队列 | Redis | 7.x | 会话、缓存、BullMQ 队列状态。 |
| 对象存储 | MinIO | 最新稳定 | 自托管 S3 兼容存储，存放生成图片/视频/音频。 |
| 任务队列 | BullMQ | 5.x+ | Redis 基础，支持延迟、重试、并发、进度、父子任务。 |
| 视频处理 | FFmpeg | 7.x | 合成输出、转码、混音、字幕烧录。 |
| 实时推送 | Server-Sent Events (SSE) | 原生 | 长 AI 任务进度推送，比 WebSocket 更轻量。 |
| 测试 | Vitest / Supertest | 最新稳定 | 后端单元与集成测试。 |

### 3.1 后端关键版本确认

- Node.js 22 已于 2024-10 进入 Active LTS，是当前生产部署推荐版本。
- Express 5.0 于 2024-09-10 发布稳定版，主要破坏性变更已明确（`res.status` 严格校验、`res.redirect('back')` 移除、`res.clearCookie` 行为调整等）。
- PostgreSQL 17 是当前稳定主版本，JSONB 与向量扩展生态成熟。

### 3.2 后端目录约定

```
/src/server
  ├── app.ts                 # Express 应用实例
  ├── routes/                # 路由注册（按业务模块）
  ├── services/              # 业务服务层
  ├── adapters/              # AI Adapter 实现
  ├── workers/               # BullMQ Worker 进程
  ├── prisma/                # Schema、迁移、Seed
  ├── middleware/            # 鉴权、校验、错误处理
  └── config/                # 环境配置与 Provider 配置
```

---

## 4. AI 适配器层技术栈

| 组件 | 技术/方式 | 说明 |
|------|-----------|------|
| 接口抽象 | TypeScript Interface | `AITextAdapter`、`AIImageAdapter`、`AIVideoAdapter`、`AITTSAdapter`、`AIMusicAdapter`。 |
| 路由注册 | Adapter Registry | 启动时按 `provider` ID 注册实例。 |
| 模型绑定 | `ModelBindings` 配置 | 项目级默认 + 节点级覆盖。 |
| 降级 | Fallback Chain | 按配置顺序切换，仅对可用性错误生效。 |
| 健康检查 | 定时探测 + 调用时校验 | 失败标记为不可用，触发降级。 |
| 日志/用量 | `ai_call_logs` 表 | provider、model、耗时、token/用量、状态、脱敏参数。 |

### 4.1 首批支持的供应商类型（接口层面）

v1.0 不强制实现所有供应商，但接口必须覆盖五类任务。建议首批接入：

- 文本：OpenAI GPT-4o / Claude / 国产兼容 OpenAI 接口。
- 图像：Midjourney API（若可接入）、Stable Diffusion / ComfyUI、DALL·E。
- 视频：Runway / Luma / Kling / 可灵 / Stable Video Diffusion。
- TTS：ElevenLabs / Azure TTS / 讯飞。
- 音乐：Suno / Udio / Stable Audio。

具体供应商密钥与 endpoint 通过环境变量或数据库配置注入，不硬编码。

---

## 5. 基础设施与部署

| 组件 | 选型 | 说明 |
|------|------|------|
| 容器化 | Docker + Docker Compose | 本地开发、测试、单机部署统一。 |
| 反向代理 | Nginx / Traefik | 生产环境 TLS、静态资源、SSE 长连接。 |
| 进程管理 | PM2 / systemd | Node.js 多实例与 worker 进程。 |
| 监控 | 基础日志 + 可选 OpenTelemetry | v1.0 以结构化日志为主，不强制引入 APM。 |
| CI/CD | GitHub Actions | 测试、构建、镜像推送。 |

### 5.1 开发环境服务

`docker-compose.yml` 至少包含：

- `postgres:17`
- `redis:7`
- `minio/minio:latest`
- `app`（Node.js + Vite dev server）

---

## 6. 版本与兼容性矩阵

| 技术 | 最低版本 | 锁定方式 | 备注 |
|------|----------|----------|------|
| React | 19.2.0 | `^19.2.0` | 冻结至 v1.0 结束。 |
| Node.js | 22.0.0 | `engines.node` | 开发/生产均 >=22 LTS。 |
| Express | 5.0.0 | `^5.0.0` | 不向下兼容 Express 4。 |
| Tailwind CSS | 4.3.0 | `^4.3.0` | v4 配置方式与 v3 不同，禁止混用。 |
| TypeScript | 5.7.0 | `^5.7.0` | 严格模式。 |
| Prisma | 6.0.0 | `^6.0.0` | 按官方迁移流程升级。 |
| PostgreSQL | 17.0 | 服务器版本 | 开发/测试/生产一致。 |
| Redis | 7.0 | 服务器版本 | BullMQ 要求 Redis >=6。 |

---

## 7. 待后续 Sprint 评估的技术

以下技术不在 v1.0 冻结范围，由后续 Sprint 根据需求重新评估：

- **向量数据库**：角色/场景 embedding 检索（当前用 PostgreSQL + pgvector 扩展即可）。
- **WebSocket**：当前 SSE 足够；若出现强协同编辑需求再评估。
- **消息队列替代**：BullMQ 当前足够；若任务量大幅增长可考虑 RabbitMQ / SQS。
- **Server Components / RSC**：v1.0 以 CSR + TanStack Query 为主，暂不引入 RSC 部署复杂度。

---

## 8. 参考资料

- 初始技术栈建议：React 18 + TS + Tailwind + shadcn/ui, Zustand, Node.js/Express, PostgreSQL, Redis, MinIO, BullMQ, FFmpeg, Adapter 模式。
- 相关 PRD：
  - `/docs/prd/v1.0-AI适配器层.md`
  - `/docs/prd/v1.0-版本快照系统.md`
  - `/docs/prd/v1.0-一致性保障机制.md`
  - `/docs/prd/v1.0-分镜节点化模块.md`
- 版本确认来源：React.dev、Node.js LTS、Tailwind CSS 官方文档、Express.js 官方文档（通过 context7 MCP 获取）。
