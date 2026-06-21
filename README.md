# 极简栈创造

AI 辅助短剧生产平台 v1.0。

## 开发环境

- Node.js >= 22
- SQLite（本地开发，默认）
- Redis 7（渲染队列必需，真实渲染模式下）
- FFmpeg 7（真实渲染模式下）

渲染 Worker 依赖 Redis 与 FFmpeg。macOS 一键安装：

```bash
brew install redis ffmpeg
brew services start redis
```

Linux（Ubuntu/Debian）：

```bash
sudo apt-get update
sudo apt-get install -y redis-server ffmpeg
sudo systemctl start redis-server
```

## 目录结构

- `/src/server` — Express + Prisma 后端
- `/web` — React + Vite + Tailwind CSS 前端
- `/docs` — PRD、架构文档、OpenAPI 规范

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 数据库迁移（首次运行或 schema 变更后）
npm run db:migrate

# 3. 编译 TypeScript
npm run build
```

### 启动后端 API

```bash
# 开发模式（自动重载）
npm run dev

# 生产模式
npm start
```

API 默认监听 `http://localhost:3000`。

### 启动渲染 Worker（可选）

真实渲染需要 Redis 与 FFmpeg。确保 Redis 已启动后：

```bash
npm run worker
```

Worker 会从 Redis 队列消费渲染任务并调用 FFmpeg 执行真实渲染。

### 启动前端

```bash
cd web
npm install
npm run dev
```

前端开发服务器默认监听 `http://localhost:5173`，并通过 Vite 代理将 `/api` 请求转发到 `http://localhost:3000`。

## 常用命令

### 后端

```bash
# 开发模式
npm run dev

# 生产模式
npm start

# 启动渲染 Worker
npm run worker

# 数据库迁移
npm run db:migrate

# 类型检查
npm run typecheck

# 测试
DATABASE_URL=file:./src/server/prisma/test.db npm test
```

### 前端

```bash
cd web
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

前端开发服务器默认监听 `http://localhost:5173`，并通过 Vite 代理将 `/api` 请求转发到 `http://localhost:3000`。

## 部署

### Docker Compose（推荐）

```bash
docker compose up -d
```

包含服务：PostgreSQL 17、Redis 7、MinIO、API 服务、渲染 Worker。API 默认监听 `http://localhost:3000`。

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | 数据库连接串 | SQLite 本地文件 |
| `REDIS_URL` | Redis 连接串 | `redis://localhost:6379` |
| `RENDER_PROVIDER` | 默认渲染 provider | `mock-render` |
| `RENDER_CONCURRENCY` | Worker 并发数 | `1` |
| `RENDER_OUTPUT_BUCKET` | MinIO/S3 输出 bucket | `renders` |
| `FFMPEG_PATH` | FFmpeg 可执行文件路径 | `ffmpeg` |
| `MINIO_ENDPOINT` | MinIO 主机名 | `localhost` |
| `MINIO_PORT` | MinIO 端口 | `9000` |
| `MINIO_USE_SSL` | 是否使用 HTTPS | `false` |
| `MINIO_ACCESS_KEY` | MinIO access key | - |
| `MINIO_SECRET_KEY` | MinIO secret key | - |

- 后端 API：`/api/v1/projects`
- 前端页面：`/`（项目列表）、`/projects/new`（新建项目）
