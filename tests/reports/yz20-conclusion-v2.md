# YZ-20 前端功能 E2E 测试结论报告（修复后回归）

> **测试执行时间**：2026-06-03  
> **测试负责人**：Shield · 测试工程师  
> **测试范围**：YZ-20 前端功能完善与业务组件开发（Core 修复后回归）  
> **版本**：main 分支最新 commit `a06e0df`

---

## 测试结论

**不建议上线**。P0 缺陷已修复，但新发现 P1 缺陷（Date 对象转换错误），不满足「所有 P1 功能通过 E2E 测试」的验收标准。

---

## 缺陷状态汇总

| 优先级 | Issue | 标题 | 状态 |
|---|---|---|---|
| P0 | [#5](https://github.com/GhostFace-yz/jijianzhan-create/issues/5) | API 路径前缀不匹配 | ✅ **已修复** |
| P1 | [#6](https://github.com/GhostFace-yz/jijianzhan-create/issues/6) | SubscriptionPage 字段名不匹配 | ✅ **已修复** |
| P1 | [#7](https://github.com/GhostFace-yz/jijianzhan-create/issues/7) | 数据模型字段命名全局不一致 | ✅ **已修复**（转换层统一处理） |
| P1 | [#8](https://github.com/GhostFace-yz/jijianzhan-create/issues/8) | TransformInterceptor 将 Date 对象错误转换为 `{}` | 🔴 **新发现，未修复** |
| P1 | [#3](https://github.com/GhostFace-yz/jijianzhan-create/issues/3) | 注册页密码校验不一致 | ✅ 已修复 |
| P1 | [#4](https://github.com/GhostFace-yz/jijianzhan-create/issues/4) | 前端构建失败 | ✅ 已修复 |

---

## 修复验证结果

### P0 #5：API 路径前缀不匹配

| 检查项 | 状态 | 说明 |
|---|---|---|
| `/api/auth/register` | ✅ | 返回 200，正常注册 |
| `/api/auth/login` | ✅ | 返回 200，正常登录 |
| `/api/sessions` | ✅ | 返回 200 |
| `/api/users/me` | ✅ | 返回 200 |
| `/api/subscription-plans` | ✅ | 返回 200，字段已转 snake_case |
| `/api/quota` | ✅ | 返回 200 |

**结论**：`app.setGlobalPrefix('api')` 生效，前后端 API 通信恢复正常。

### P1 #6 / #7：字段命名不一致

| 检查项 | 状态 | 说明 |
|---|---|---|
| `quota_limits` 字段 | ✅ | 后端返回 `quota_limits`（原为 `quotaLimits`） |
| `price_monthly` / `price_yearly` | ✅ | 已正确转换 |
| `user_id` / `created_at` / `updated_at` | ⚠️ | 字段名已转换，但值为 `{}`（见 P1 #8） |
| `reset_at` | ✅ | 字符串格式正确 |

**结论**：TransformInterceptor 字段名转换生效，但引入了 Date 对象处理问题。

---

## 逐项功能验证

### 1. 注册与登录（US-1）

| 检查项 | 状态 | 说明 |
|---|---|---|
| 注册页加载与样式 | ✅ | Tailwind v4 正常 |
| 密码校验 ≥ 8 位 | ✅ | 输入 7 位时正确提示 |
| 注册功能 | ✅ | 注册成功，自动跳转首页 |
| 登录功能 | ✅ | 登录成功，跳转首页 |

### 2. 用户中心（US-1 扩展）

| 检查项 | 状态 | 说明 |
|---|---|---|
| 页面加载 | ✅ | `/profile` 正常显示「用户中心」 |
| 昵称编辑输入框 | ✅ | 存在且可交互 |
| 邮箱显示（只读） | ✅ | 正确显示 |
| 头像上传区域 | ✅ | 点击区域、提示文案完整 |
| 保存按钮 | ✅ | 存在 |
| 头像上传功能 | — | 待进一步验证（需 OSS 配置） |
| 保存后全局状态同步 | — | 待进一步验证 |

### 3. 订阅与额度

| 检查项 | 状态 | 说明 |
|---|---|---|
| 页面加载 | ✅ | 不再白屏崩溃 |
| 计划展示与对比 | ✅ | 免费试用、基础版、专业版三个计划完整展示 |
| 额度用量显示 | ✅ | 文本对话：无限、图片生成：10/100/500 次/月、视频生成：3/20/100 次/月 |
| 账单历史 Tab | ✅ | 「账单历史」Tab 存在 |
| 当前订阅卡片 | — | 测试账号无活跃订阅，未展示 |
| 取消订阅 | — | 待有订阅账号后验证 |

### 4. 会话管理（US-4）

| 检查项 | 状态 | 说明 |
|---|---|---|
| 会话列表侧边栏 | ✅ | Layout 渲染正常 |
| 新建会话按钮 | ✅ | 存在 |
| 搜索会话输入框 | ✅ | 存在 |
| 会话时间显示 | ⚠️ | 显示为「Invalid Date」（P1 #8） |
| 新建会话功能 | — | API 正常，前端待进一步验证 |
| 重命名 / 删除 | — | 待进一步验证 |

### 5. AI 对话流式输出（US-2）

| 检查项 | 状态 | 说明 |
|---|---|---|
| 聊天页加载（有 session） | ✅ | 页面渲染正常 |
| 消息类型切换 UI | ✅ | 文本、图片、视频三个选项 |
| 输入框存在 | ✅ | textarea 存在 |
| SSE 流式发送 | ⚠️ | 返回「No active subscription found」（业务逻辑正常，测试账号无订阅） |
| Markdown 渲染 | — | 待有订阅账号后验证 |

### 6. 图片/视频生成（US-3）

| 检查项 | 状态 | 说明 |
|---|---|---|
| 图片/视频生成 UI | ✅ | 聊天页消息类型切换可见「图片」「视频」 |
| 实际生成功能 | — | 待有订阅账号后验证 |

### 7. 文件上传（US-3 扩展）

| 检查项 | 状态 | 说明 |
|---|---|---|
| 附件上传按钮 | ✅ | Paperclip 图标存在 |
| 上传流程 | — | 待进一步验证 |

---

## 新发现缺陷详情

### P1 #8：TransformInterceptor 将 Date 对象错误转换为 `{}`

**根因**：`TransformInterceptor` 递归转换 camelCase → snake_case 时，未处理 `Date` 类型。`Date` 对象没有可枚举属性，遍历后返回空对象 `{}`。

**影响接口**：
- `GET /api/sessions`：`created_at`, `updated_at` → `{}`
- `GET /api/users/me`：`created_at` → `{}`
- `POST /api/sessions`：`created_at`, `updated_at` → `{}`

**前端表现**：会话列表显示「Invalid Date」。

**修复建议**：在递归函数中添加 `Date` 类型判断：
```ts
if (obj instanceof Date) return obj.toISOString();
```

---

## 阻塞原因

P1 #8 未关闭，会话管理功能的日期显示异常，不满足「所有 P1 功能通过 E2E 测试」的验收标准。需 Core 修复 TransformInterceptor 的 Date 处理逻辑后，重新触发 Shield 回归测试。

---

## 产出物

- 测试计划：`/tests/TEST-PLAN.md`
- 测试结论报告（初版）：`/tests/reports/yz20-conclusion.md`
- 测试结论报告（回归版）：`/tests/reports/yz20-conclusion-v2.md`
- GitHub Issues：
  - [P0 #5](https://github.com/GhostFace-yz/jijianzhan-create/issues/5) API 路径前缀不匹配（已修复）
  - [P1 #6](https://github.com/GhostFace-yz/jijianzhan-create/issues/6) SubscriptionPage 字段名不匹配（已修复）
  - [P1 #7](https://github.com/GhostFace-yz/jijianzhan-create/issues/7) 数据模型字段命名全局不一致（已修复）
  - [P1 #8](https://github.com/GhostFace-yz/jijianzhan-create/issues/8) TransformInterceptor Date 对象转换错误（新发现）
