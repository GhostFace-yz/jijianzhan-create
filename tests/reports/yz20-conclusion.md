# YZ-20 前端功能 E2E 测试结论报告

> **测试执行时间**：2026-06-03  
> **测试负责人**：Shield · 测试工程师  
> **测试范围**：YZ-20 前端功能完善与业务组件开发  
> **版本**：main 分支最新 commit `1e668b0`

---

## 测试结论

**不建议上线**。P0 缺陷未关闭，不满足「所有 P1 功能通过 E2E 测试」的验收标准。

---

## 缺陷汇总

| 优先级 | Issue | 标题 | 状态 |
|---|---|---|---|
| P0 | [#5](https://github.com/GhostFace-yz/jijianzhan-create/issues/5) | API 路径前缀不匹配：前端 /api/* 请求全部 404 | 🔴 未修复 |
| P1 | [#6](https://github.com/GhostFace-yz/jijianzhan-create/issues/6) | SubscriptionPage 白屏崩溃：字段名 snake_case vs camelCase 不匹配 | 🔴 未修复 |
| P1 | [#7](https://github.com/GhostFace-yz/jijianzhan-create/issues/7) | 数据模型字段命名全局不一致：后端 camelCase vs 前端 snake_case | 🔴 未修复 |
| P1 | [#3](https://github.com/GhostFace-yz/jijianzhan-create/issues/3) | 注册页密码校验不一致（之前已报） | ✅ 已修复 |
| P1 | [#4](https://github.com/GhostFace-yz/jijianzhan-create/issues/4) | 前端构建失败（之前已报） | ✅ 已修复 |

---

## 逐项验证结果

### 1. 注册与登录（US-1）

| 检查项 | 状态 | 说明 |
|---|---|---|
| 注册页加载与样式 | ✅ | Tailwind v4 样式正常渲染 |
| 密码校验 ≥ 8 位 | ✅ | 输入 7 位时正确提示「密码长度至少8位」 |
| 注册功能 | ❌ | 被 P0 #5 阻塞：/api/auth/register 返回 404 |
| 登录功能 | ❌ | 被 P0 #5 阻塞 |
| JWT Token 返回 | — | 后端直接调用验证通过（curl） |

### 2. 用户中心（US-1 扩展）

| 检查项 | 状态 | 说明 |
|---|---|---|
| 页面加载 | ✅ | `/profile` 路由正常，显示「用户中心」标题 |
| 昵称编辑输入框 | ✅ | 存在且可交互 |
| 邮箱显示（只读） | ✅ | 正确显示当前用户邮箱 |
| 头像上传区域 | ✅ | 点击区域、相机图标、上传提示文案完整 |
| 保存按钮 | ✅ | 存在 |
| 头像上传功能 | ❌ | 被 P0 #5 阻塞（上传依赖预签名 URL API） |
| 保存后全局状态同步 | ❌ | 被 P0 #5 阻塞 |

### 3. 订阅与额度（排除项 Won't Have 但 YZ-20 已实现）

| 检查项 | 状态 | 说明 |
|---|---|---|
| 页面加载 | ❌ | 白屏崩溃，`TypeError: Cannot read properties of undefined (reading 'text_chats')` |
| 计划展示与对比 | ❌ | 被 P1 #6 阻塞 |
| 额度用量显示 | ❌ | 被 P1 #6 阻塞 |
| 取消订阅 | ❌ | 被 P1 #6 阻塞 |
| 账单历史列表 | ❌ | 被 P1 #6 阻塞 |

### 4. 会话管理（US-4）

| 检查项 | 状态 | 说明 |
|---|---|---|
| 会话列表侧边栏 | ✅ | Layout 渲染正常，显示「新建会话」「搜索会话」 |
| 会话时间显示 | ⚠️ | 显示为「Invalid Date」，受 P1 #7 字段名不一致影响 |
| 新建会话 | ❌ | 被 P0 #5 阻塞 |
| 重命名 | ❌ | 被 P0 #5 阻塞 |
| 删除 | ❌ | 被 P0 #5 阻塞 |
| 搜索过滤 | ❌ | 被 P0 #5 阻塞（前端本地过滤可用，但数据依赖 API） |

### 5. AI 对话流式输出（US-2）

| 检查项 | 状态 | 说明 |
|---|---|---|
| 聊天页加载（有 session） | ✅ | 页面渲染正常，包含输入框和消息类型切换（文本/图片/视频） |
| 消息类型切换 UI | ✅ | 文本、图片、视频三个选项可见 |
| 输入框存在 | ✅ | textarea / input 存在 |
| SSE 流式接收 | ❌ | 被 P0 #5 阻塞（`connectMessageStream` 硬编码 `/api/messages`） |
| Markdown 渲染 | — | 待联调后验证 |
| 代码块复制 | — | 待联调后验证 |

### 6. 图片/视频生成（US-3）

| 检查项 | 状态 | 说明 |
|---|---|---|
| 图片生成 UI | — | 被 P0 #5 阻塞，无法联调 |
| 视频生成 UI | — | 被 P0 #5 阻塞，无法联调 |
| 任务状态轮询 | — | 被 P0 #5 阻塞，无法联调 |

### 7. 文件上传（US-3 扩展）

| 检查项 | 状态 | 说明 |
|---|---|---|
| 附件上传按钮 | ✅ | 聊天页有 Paperclip 图标 |
| 预签名 URL 获取 | ❌ | 被 P0 #5 阻塞 |
| OSS 直传 | ❌ | 被 P0 #5 阻塞 |

---

## 根因分析

### P0 #5：API 路径前缀不匹配

前端 axios `baseURL = '/api'`，Vite proxy 将 `/api` 代理到 `localhost:3000` 但不做路径 rewrite。后端 NestJS 未设置 `setGlobalPrefix('api')`，导致所有请求 404。

**影响**：阻塞 100% 的前后端联调功能。

### P1 #6 / #7：字段命名全局不一致

后端 Prisma + NestJS 默认返回 camelCase（`quotaLimits`, `createdAt`, `updatedAt`），但前端 TypeScript 类型和组件代码使用 snake_case（`quota_limits`, `created_at`, `updated_at`）。

**影响**：SubscriptionPage 白屏崩溃、会话列表时间显示 Invalid Date、多处字段缺失。

---

## 修复建议

1. **优先修复 P0 #5**（API 路径前缀）：
   - 推荐后端在 `main.ts` 中添加 `app.setGlobalPrefix('api')`，改动最小。

2. **统一字段命名规范**（P1 #6 / #7）：
   - 推荐前端将 `src/types/index.ts` 和组件代码统一改为 camelCase，与后端保持一致。
   - 或者后端添加全局 snake_case 序列化拦截器。

3. **回归测试**：
   - P0 #5 和 P1 #6 修复后，Shield 重新执行完整 E2E 回归测试。

---

## 产出物

- 测试计划：`/tests/TEST-PLAN.md`
- 测试结论报告：`/tests/reports/yz20-conclusion.md`
- GitHub Issues：
  - [P0 #5](https://github.com/GhostFace-yz/jijianzhan-create/issues/5) API 路径前缀不匹配
  - [P1 #6](https://github.com/GhostFace-yz/jijianzhan-create/issues/6) SubscriptionPage 字段名不匹配
  - [P1 #7](https://github.com/GhostFace-yz/jijianzhan-create/issues/7) 数据模型字段命名全局不一致
