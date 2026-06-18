# ADR-001: 极简栈创造 v1.0 技术栈决策

| 项目 | 内容 |
|------|------|
| ADR 编号 | ADR-001 |
| 主题 | v1.0 技术栈 |
| 状态 | 已冻结 |
| 决策日期 | 2026-06-18 |
| 决策人 | Blueprint · 架构师 |
| 影响范围 | 前端、后端、数据层、基础设施、开发规范 |

---

## 1. 背景

极简栈创造 v1.0 的产品文档已拆分为 14 个模块 PRD。工程开发启动前，需要确定一套统一、稳定、可扩展的技术栈，作为 Core、Flux、Vertex、Shield 等角色的开发基准。

初始建议栈为：

- 前端：React 18 + TypeScript + Tailwind CSS + shadcn/ui + Zustand
- 后端：Node.js + Express
- 数据：PostgreSQL + Redis
- 存储：MinIO
- 队列：BullMQ
- 媒体：FFmpeg
- 架构模式：Adapter 模式

本 ADR 在此基础上，结合 2026 年最新稳定版本和模块需求，确定最终技术栈。

---

## 2. 决策

### 2.1 前端

| 技术 | 决策 | 版本 |
|------|------|------|
| React | **React 19.2+** | ^19.2.0 |
| 构建工具 | **Vite 6** | ^6.0.0 |
| 路由 | **React Router 7** | ^7.0.0 |
| 样式 | **Tailwind CSS 4.3+** | ^4.3.0 |
| 组件库 | **shadcn/ui** | 最新 CLI |
| 状态管理 | **Zustand 5** | ^5.0.0 |
| 节点编辑器 | **@xyflow/react 12** | ^12.0.0 |
| 表单 | **React Hook Form 7 + Zod 3.24+** | - |
| 数据获取 | **TanStack Query 5** | ^5.0.0 |

### 2.2 后端

| 技术 | 决策 | 版本 |
|------|------|------|
| 运行时 | **Node.js 22 LTS** | engines.node >=22 |
| Web 框架 | **Express 5** | ^5.0.0 |
| 语言 | **TypeScript 5.7+** | ^5.7.0 |
| ORM | **Prisma 6** | ^6.0.0 |
| 校验 | **Zod 3.24+** | ^3.24.0 |
| 数据库 | **PostgreSQL 17** | 服务器 17.x |
| 缓存/队列 | **Redis 7** | 服务器 7.x |
| 对象存储 | **MinIO** | 最新稳定 |
| 任务队列 | **BullMQ 5** | ^5.0.0 |
| 视频处理 | **FFmpeg 7** | 服务器 7.x |
| 实时推送 | **Server-Sent Events (SSE)** | 原生 |

### 2.3 测试与部署

| 技术 | 决策 |
|------|------|
| 单元/集成测试 | Vitest + React Testing Library / Supertest |
| E2E 测试 | Playwright |
| 容器化 | Docker + Docker Compose |
| 反向代理 | Nginx 或 Traefik |
| CI/CD | GitHub Actions |

---

## 3. 替代方案对比

### 3.1 React 18 vs React 19

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| React 18 | 生态最成熟，第三方库兼容性最好 | 2026 年已非最新主版本，部分新特性缺失 | 不采用 |
| **React 19** | 官方当前稳定主版本，`useActionState`、`useEffectEvent` 对表单和副作用更友好；新文档默认推荐 | 部分旧库可能需要小调整 | **采用** |

### 3.2 Tailwind CSS v3 vs v4

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| Tailwind v3 | 社区资料多，配置方式熟悉 | 2026 年已进入维护阶段，未来需要迁移 | 不采用 |
| **Tailwind v4** | 当前稳定主版本，CSS-first 配置，性能更好；新项目无需承担迁移成本 | 配置方式变化，团队需要适应 | **采用** |

### 3.3 Express 4 vs Express 5

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| Express 4 | 资料最多，生态最成熟 | 已进入维护阶段，不再接收新特性 | 不采用 |
| **Express 5** | 2024-09 已发布稳定版，Promise 错误处理更现代，路由改进 | 有少量破坏性变更（`res.redirect('back')` 移除等） | **采用** |

### 3.4 Prisma vs Drizzle vs 原生 pg

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| 原生 pg | 无 ORM 开销，SQL 完全可控 | 手写迁移、类型安全弱，开发效率低 | 不采用 |
| Drizzle | 轻量、SQL-like、类型安全 | 生态和迁移工具较 Prisma 弱 | 备选 |
| **Prisma** | TypeScript DX 优秀，迁移系统成熟，团队熟悉度高，JSONB 支持好 | 生成器依赖、打包体积略增 | **采用** |

### 3.5 SSE vs WebSocket

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| WebSocket | 双向通信，适合协同编辑 | 部署复杂，需要维护长连接 | 不采用 |
| **SSE** | 单向推送足够满足进度通知，基于 HTTP，Nginx 支持好，实现简单 | 仅支持服务器到客户端 | **采用** |

### 3.6 Zustand vs Redux / Jotai

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| Redux | 大型项目可维护性好，DevTools 强 | 样板代码多，学习成本高 | 不采用 |
| Jotai | 原子化状态，组合灵活 | 对复杂项目结构需要额外约定 | 备选 |
| **Zustand** | 轻量、TypeScript 友好、初始建议栈已包含 | 超大规模状态需额外拆分 | **采用** |

---

## 4. 后果与风险

### 4.1 正面后果

- 前后端统一 TypeScript，减少类型转换和沟通成本。
- React 19 + Tailwind v4 + Express 5 均为当前稳定主版本，可获得最长支持周期。
- Adapter 模式隔离 AI 供应商，未来新增供应商无需改动业务代码。
- Prisma + PostgreSQL + Redis 组合成熟稳定，本地与生产环境一致。
- SSE 方案降低实时推送的部署复杂度。

### 4.2 负面后果 / 风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Tailwind v4 配置方式变化，团队需要学习 | 中 | 由 Flux 在组件开发前完成一次内部分享；使用 shadcn/ui 减少手写配置。 |
| Express 5 破坏性变更导致旧中间件不兼容 | 中 | 依赖安装时锁定 Express 5；集成测试覆盖中间件链路。 |
| React 19 部分第三方库声明兼容但未经充分验证 | 低 | 优先使用已声明支持 React 19 的库；Shield E2E 覆盖关键路径。 |
| Prisma 引入额外构建步骤和依赖 | 低 | 将 Prisma generate 加入 CI/CD 和 postinstall 脚本。 |
| 新增依赖（React Router、TanStack Query、Zod、React Hook Form、@xyflow/react）超出初始建议栈 | 中 | 均为功能必需基础设施，由 Blueprint 统一纳入；后续新增 UI 库仍须按红线审批。 |

### 4.3 性能影响

- 前端 gzip 增量主要来自 React 19、@xyflow/react、TanStack Query。预估总核心依赖 gzip 在 200-300KB 范围，属于现代 React 应用正常水平。
- 后端 Prisma Client 运行时体积可控，不影响前端打包。

---

## 5. 人类介入红线

本 ADR 涉及以下需要人类负责人书面确认（GitHub Issue 记录）的变更：

1. 若后续因功能需要新增前端库导致打包 gzip 增量 >100KB 或依赖数 >+3，须重新审批。
2. 若因性能或兼容性原因需要回退到 React 18 或 Express 4，须重新审批。
3. 修改本 ADR 冻结的版本矩阵（如升级到 React 20/Node 24 在 v1.0 范围内）须产出新版 ADR 并废弃旧版。

---

## 6. 关联文档

- `/docs/architecture/tech-stack.md`
- `/docs/architecture/system-overview.md`
- `/docs/adr/ADR-002-adapter-layer.md`
- `/docs/architecture/performance-baseline.md`

---

## 7. 变更记录

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-06-18 | v1.0 | 初始技术栈决策 | Blueprint |
