# 极简栈创造 v1.0 开发流程与路线图

## 前提说明

- `/DESIGN.md` 已存在，跳过 Prism UI 设计阶段。
- 节点工作流（分镜节点化模块）明确要求使用 [React Flow](https://reactflow.dev/) 库实现。
- Blueprint 需先确定最终技术栈并产出架构文档/ADR。

## 开发阶段

### 阶段 0：架构决策（Sprint 0，先启动）

| Issue | 模块 | 负责人 | 目标产出 |
|-------|------|--------|----------|
| #8 | AI 适配器层 | Blueprint | 确定最终技术栈、Adapter 接口规范、供应商路由策略、fallback 机制、ADR 文档 |
| #9 | 版本快照系统 | Core | 数据库 Schema、版本快照服务接口、diff/回滚实现 |
| #10 | 一致性保障机制 | Core + Blueprint | IP-Adapter/Seed 注入规则、end_state 传递机制、剧本医生检查规则 |

**准入条件**：Blueprint 确认 `/docs/architecture/tech-stack.md` 和 `/docs/adr/001-adapter-layer.md` 就绪。

### 阶段 1：主流程 P0（Sprint 1-2）

按依赖顺序实现，部分模块可并行：

```
项目创建 #1
    ↓
大纲生成 #2
    ↓
角色圣经 #3  +  场景圣经 #4  （可并行）
    ↓
单集脚本生成 #5
    ↓
分镜节点化 #6  （使用 React Flow）
    ↓
分镜图生成 #7
```

| Issue | 模块 | 负责人 | 说明 |
|-------|------|--------|------|
| #1 | 项目创建 | Core + Flux | 首页列表、项目 CRUD、表单校验 |
| #2 | 大纲生成 | Core + Flux | AI 生成 JSON 大纲、剧本医生、版本快照 |
| #3 | 角色圣经 | Core + Flux | 角色卡片、三视图、参考图集、TTS 音色绑定 |
| #4 | 场景圣经 | Core + Flux | 场景卡片、基准图/变体图、Prompt 分层管理 |
| #5 | 单集脚本 | Core + Flux | 单集脚本生成、台词编辑、end_state 传递 |
| #6 | 分镜节点化 | Flux（前端主导）+ Core | **使用 React Flow** 实现泳道时间轴编辑器 |
| #7 | 分镜图生成 | Core + Flux | 6 层 Prompt 组装、IP-Adapter/Seed 注入、审核 |

### 阶段 2：P1 迭代（Sprint 3+）

| Issue | 模块 | 负责人 | 说明 |
|-------|------|--------|------|
| #11 | TTS 配音生成 | Core + Flux | 按角色 voice_id 批量生成配音 |
| #12 | 配乐生成 | Core + Flux | 整集 BGM、情绪序列、Duck 处理 |
| #13 | 视频片段生成 | Core + Flux | 图生视频、质量检测、降级熔断 |
| #14 | 合成输出 | Core | FFmpeg 拼接、混音、字幕、MP4 输出 |

## 优先级规则

- 不允许并列 P0；本阶段 P0 按阶段顺序执行。
- 阶段 0 完成前，阶段 1 可提前准备但不得大规模实现。
- 每个模块完成后由 Shield 进行验收测试，再进入下一个模块。

## 当前 Sprint 任务

**Sprint 0（立即开始）**：
1. Blueprint 完成 #8 AI 适配器层的技术栈决策和 ADR。
2. Core 完成 #9 版本快照系统的基础接口。
3. Core + Blueprint 完成 #10 一致性保障机制的规则定义。

**Sprint 1**：
1. Core + Flux 实现 #1 项目创建模块。
2. Core + Flux 实现 #2 大纲生成模块。

## Issue 分配表

| Issue | 标题 | Assignee | Status |
|-------|------|----------|--------|
| #1 | [PRD] v1.0 项目创建模块 | Flux | todo |
| #2 | [PRD] v1.0 大纲生成模块 | Core | todo |
| #3 | [PRD] v1.0 角色圣经模块 | Core | todo |
| #4 | [PRD] v1.0 场景圣经模块 | Core | todo |
| #5 | [PRD] v1.0 单集脚本生成模块 | Core | todo |
| #6 | [PRD] v1.0 分镜节点化模块 | Flux | todo |
| #7 | [PRD] v1.0 分镜图生成模块 | Core | todo |
| #8 | [PRD] v1.0 AI 适配器层 | Blueprint | in_progress |
| #9 | [PRD] v1.0 版本快照系统 | Core | in_progress |
| #10 | [PRD] v1.0 一致性保障机制 | Core | in_progress |
| #11 | [PRD] v1.0 TTS 配音生成模块 | Core | backlog |
| #12 | [PRD] v1.0 配乐生成模块 | Core | backlog |
| #13 | [PRD] v1.0 视频片段生成模块 | Core | backlog |
| #14 | [PRD] v1.0 合成输出模块 | Core | backlog |

## 关键约束

- 分镜节点化必须使用 React Flow 库。
- 所有后端 API 路径以 `/api/v1` 为前缀。
- 所有表预留 `user_id` 和 `team_id`。
- AI 不自动推进到下一步，必须用户手动触发。
- 每次用户编辑/AI 生成必须创建版本快照。

## 变更记录

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-06-18 | v1.0 | 初始开发流程 | Anchor |
