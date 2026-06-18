# 极简栈创造

AI 辅助短剧生产平台 v1.0。

## 开发环境

- Node.js >= 22
- SQLite（本地开发）

## 目录结构

- `/src/server` — Express + Prisma 后端
- `/web` — React + Vite + Tailwind CSS 前端
- `/docs` — PRD、架构文档、OpenAPI 规范

## 常用命令

### 后端

```bash
# 安装依赖
npm install

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

## 项目创建模块

- 后端 API：`/api/v1/projects`
- 前端页面：`/`（项目列表）、`/projects/new`（新建项目）
