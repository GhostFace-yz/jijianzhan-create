# 组件规范：ChatMessage 聊天消息

> **关联组件**：shadcn/ui 无直接对应，基于 `Card` + 自定义实现  
> **版本**：v1.0  
> **更新日期**：2026-06-02

---

## 1. 组件概述

ChatMessage 是对话界面中最核心的组件，用于展示用户消息和 AI 回复。支持纯文本、Markdown 富文本、图片、视频、代码块等多种内容类型。

---

## 2. Props 定义

| Prop | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `role` | `"user" \| "assistant"` | 是 | — | 消息发送者角色 |
| `content` | `string` | 是 | — | 消息文本内容（Markdown 格式） |
| `attachments` | `Attachment[]` | 否 | `[]` | 附件列表（图片、视频） |
| `timestamp` | `Date` | 否 | — | 消息发送时间 |
| `isStreaming` | `boolean` | 否 | `false` | 是否正在流式生成中 |
| `onRegenerate` | `() => void` | 否 | — | 重新生成回调 |
| `onCopy` | `() => void` | 否 | — | 复制内容回调 |
| `onStop` | `() => void` | 否 | — | 停止生成回调 |
| `status` | `"sending" \| "sent" \| "error"` | 否 | `"sent"` | 消息状态 |

### Attachment 类型

```typescript
interface Attachment {
  id: string;
  type: "image" | "video";
  url: string;
  thumbnailUrl?: string;
  name: string;
  size: number; // bytes
  mimeType: string;
}
```

---

## 3. 状态说明

### 3.1 用户消息（User）

| 状态 | 视觉说明 |
|------|----------|
| **Default** | 背景色 `--user-message-bg`（Indigo-900），文字 `--foreground`，右侧对齐，圆角 `--radius-lg` |
| **Sending** | 消息气泡右下角显示小型旋转加载器（16px），颜色 `--muted-foreground` |
| **Error** | 边框变为 `--destructive`，下方显示错误提示条 |

### 3.2 AI 消息（Assistant）

| 状态 | 视觉说明 |
|------|----------|
| **Default** | 背景色 `--ai-message-bg`（#1C1C1F），文字 `--foreground`，左侧对齐，圆角 `--radius-lg`，左侧显示 AI Avatar |
| **Streaming** | 消息末尾显示闪烁光标 `--streaming-cursor`，颜色 `--primary`，动画周期 0.8s；输入区显示「停止生成」按钮 |
| **Error** | 边框 `--destructive`，显示错误图标 + 重试按钮 |

---

## 4. Markdown 渲染规范

组件内部集成 Markdown 渲染器（推荐 `react-markdown` + `remark-gfm`），各元素样式映射：

| Markdown 元素 | 渲染样式 |
|---------------|----------|
| 段落 `<p>` | `--text-base`，行高 1.6，段间距 12px |
| 标题 H1-H3 | H1=`--text-lg` 加粗，H2=`--text-base` 加粗，H3=`--text-sm` 加粗，颜色均为 `--foreground` |
| 列表 `ul/ol` | 左侧缩进 1.5em，`ul` 使用 `•`，`ol` 使用数字，行高 1.8 |
| 引用块 `blockquote` | 左侧 3px 竖线 `--primary`，背景 `--muted`，内边距 12px 16px，文字 `--muted-foreground` |
| 行内代码 `code` | 背景 `--code-bg`，文字 `--primary`，字号 0.875em，圆角 4px，内边距 2px 4px |
| 代码块 `pre>code` | 独立 CodeBlock 组件（见下方） |
| 链接 `a` | 颜色 `--primary`，Hover 下划线，新标签页打开 |
| 表格 `table` | 边框 `--border`，表头背景 `--muted`，单元格内边距 8px 12px |
| 分隔线 `hr` | 1px solid `--border`，上下 margin 16px |

---

## 5. 代码块子组件（CodeBlock）

### 5.1 结构

```
┌─────────────────────────────────────────┐
│ python                    [复制]        │  ← CodeHeader
├─────────────────────────────────────────┤
│                                         │
│  import asyncio                         │  ← CodeBody
│  ...                                    │
│                                         │
└─────────────────────────────────────────┘
```

### 5.2 样式

- **容器**：背景 `--code-bg`，边框 1px `--code-border`，圆角 `--radius-lg`，溢出隐藏
- **顶部栏**：背景 `#1C1C1F`，边框底部 1px `--code-border`，高度 40px，内边距 0 12px
  - 左侧：语言标签，文字 `--muted-foreground`，字号 `--text-xs`，字体 mono
  - 右侧：「复制」按钮，Ghost Button，图标 14px
- **代码区**：内边距 `--space-4`，字体 `JetBrains Mono`，字号 13px，行高 1.6
- **语法高亮**：使用 `react-syntax-highlighter` + `oneDark` 主题，自定义配色映射至 Design Token
- **滚动条**：自定义细滚动条（宽 4px，颜色 `#3F3F46`）

### 5.3 交互

- **复制按钮**：点击后图标变为对勾（绿色 `--success`），2 秒后恢复
- **Hover**：顶部栏「复制」按钮显示（默认隐藏或一直显示根据实现）

---

## 6. 媒体附件渲染

### 6.1 图片

- **缩略图**：最大宽度 320px，圆角 `--radius-xl`，object-fit cover
- **点击行为**：打开全屏 Lightbox 模态框查看原图
- **Lightbox**：背景 `rgba(0,0,0,0.9)`，图片居中，支持点击关闭、ESC 关闭、双指缩放

### 6.2 视频

- **缩略图**：首帧截图 + 居中播放按钮（圆形，背景 `rgba(0,0,0,0.6)`，白色播放图标）
- **播放**：点击后展开内联播放器或全屏播放
- **控制条**：自定义或原生 HTML5 controls，底部圆角与容器一致

---

## 7. 消息操作栏（MessageActions）

位于 AI 消息气泡下方，包含以下操作按钮（Ghost Button，16px 图标）：

| 按钮 | 图标 | 行为 | 说明 |
|------|------|------|------|
| 重新生成 | RefreshCw | 触发 `onRegenerate` | 基于相同上下文重新请求 |
| 复制 | Copy | 触发 `onCopy` | 复制消息纯文本到剪贴板 |
| 点赞 | ThumbsUp | 反馈标记 | 切换激活态，颜色变 `--primary` |
| 点踩 | ThumbsDown | 反馈标记 | 切换激活态，颜色变 `--destructive` |

- **布局**：水平排列，gap 4px
- **显隐**：默认半透明（`opacity: 0.6`），Hover 消息区域时 fully opaque
- **移动端**：始终显示，避免 touch 设备无 Hover

---

## 8. GSAP 动画配置

> 所有动画不在组件代码中实现，由 Flux 根据以下规范使用 GSAP 配置。

### 8.1 消息进入动画

```javascript
// 用户消息
gsap.from(messageEl, {
  scale: 0.95,
  opacity: 0,
  duration: 0.2,
  ease: "back.out(1.5)"
});

// AI 消息
gsap.from(messageEl, {
  opacity: 0,
  y: 4,
  duration: 0.3,
  ease: "power2.out"
});
```

### 8.2 流式光标动画

```javascript
gsap.to(cursorEl, {
  opacity: 0,
  duration: 0.4,
  repeat: -1,
  yoyo: true,
  ease: "steps(1)"
});
```

### 8.3 代码块复制反馈

```javascript
gsap.fromTo(checkIconEl,
  { scale: 0.5, opacity: 0 },
  { scale: 1, opacity: 1, duration: 0.15, ease: "back.out(2)" }
);
```

---

## 9. 与 Three.js Canvas 层叠关系

本组件为纯业务 UI 组件，不涉及 Three.js Canvas。若未来在对话界面中嵌入 3D 可视化内容，遵循以下层叠规则：

- **z-index 层级**：Message Bubble (`z-index: 1`) < 3D Canvas (`z-index: 0`) < Message Actions (`z-index: 10`)
- **3D 内容消息**：使用特殊消息类型 `role: "assistant", contentType: "3d"`，渲染为全宽卡片，内部嵌入 Three.js Canvas 容器
- **HUD 说明**：若 3D 场景需要标注，使用独立的 `AnnotationBubble` 组件，z-index 高于 Canvas

---

## 10. 响应式行为

| 断点 | 用户消息最大宽度 | AI 消息最大宽度 | 图片最大宽度 |
|------|------------------|-----------------|--------------|
| < 768px | 90% | 95% | 100%（全宽） |
| 768-1023px | 85% | 90% | 280px |
| ≥ 1024px | 70% | 85% | 320px |

---

## 11. 无障碍（A11y）

- 消息容器 `role="log"`，`aria-live="polite"`，`aria-atomic="false"`
- 流式生成时 `aria-busy="true"`
- 代码块复制按钮 `aria-label="复制代码"`
- 图片附件 `alt` 文本由 AI 自动生成描述或用户上传时填写
- 所有操作按钮有明确的 `aria-label`
