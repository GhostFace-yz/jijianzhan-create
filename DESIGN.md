# Design System: 极简栈 AI 聊天网页端

> **版本**：v1.0  
> **日期**：2026-06-02  
> **负责人**：Prism · UI 设计师  
> **关联 PRD**：[YZ-2](/docs/prd/v1.0-ai-chat-web.md)  
> **关联 ADR**：[YZ-3](/docs/architecture/adr-001-ai-chat-web.md)

---

## 1. 设计哲学与氛围

### 1.1 整体氛围

极简栈 AI 聊天网页端采用 **「深邃专注的暗色画布」** 作为核心视觉语言。设计哲学强调：

- **内容优先**：对话内容是绝对主角，UI 控件极致克制，仅在需要时出现
- **沉浸感**：深色系背景降低视觉疲劳，适合长时间对话场景
- **科技感与温度并存**：冷色调的 Slate 基底搭配温润的 Indigo  accent，传递 AI 智能感的同时保留人文温度
- **呼吸感**：充足的间距和留白，避免信息过载

### 1.2 关键词

`深邃` `克制` `专注` `现代` `流畅` `智能`

### 1.3 密度策略

- **聊天界面**：低密度 —— 消息间距宽松，单屏消息数控制在 4-6 条，确保每条消息都有独立的视觉领地
- **侧边栏**：中密度 —— 会话列表紧凑但可扫描，信息层级通过字体大小和颜色区分
- **设置/表单**：中高密度 —— 信息分组清晰，标签与输入框对齐，减少眼球移动距离

---

## 2. 色彩系统（Color Palette）

所有颜色采用 **shadcn/ui CSS 变量规范** 命名，支持暗色模式（默认）与亮色模式（可选）。

### 2.1 暗色模式（默认）

| Token | 值 | 角色说明 |
|-------|-----|----------|
| `--background` | `#0F0F10` | 页面主背景，极深灰黑，接近纯黑但带有微弱暖调 |
| `--foreground` | `#F2F2F5` | 主文本色，高对比度灰白色 |
| `--card` | `#18181B` | 卡片/面板背景色，如侧边栏、设置面板、弹窗 |
| `--card-foreground` | `#F2F2F5` | 卡片内文本色 |
| `--popover` | `#1C1C1F` | 下拉菜单、Tooltip、上下文菜单背景 |
| `--popover-foreground` | `#F2F2F5` | Popover 内文本色 |
| `--primary` | `#6366F1` | 主色调，Indigo-500，用于主按钮、激活状态、品牌标识 |
| `--primary-foreground` | `#FFFFFF` | 主色背景上的文本色 |
| `--secondary` | `#27272A` | 次色调，Slate-800，用于次级按钮、标签、Hover 背景 |
| `--secondary-foreground` | `#E4E4E7` | 次色背景上的文本色 |
| `--muted` | `#27272A` | 弱化背景，如禁用态、非激活态 |
| `--muted-foreground` | `#A1A1AA` | 弱化文本，如时间戳、占位符、元信息 |
| `--accent` | `#3F3F46` | 强调背景，如选中项、Hover 高亮 |
| `--accent-foreground` | `#F2F2F5` | 强调背景上的文本色 |
| `--destructive` | `#EF4444` | 危险操作，如删除、退出登录 |
| `--destructive-foreground` | `#FFFFFF` | 危险背景上的文本色 |
| `--border` | `#27272A` | 边框色，细线分隔 |
| `--input` | `#27272A` | 输入框边框/背景 |
| `--ring` | `#6366F1` | 焦点环（Focus Ring），与主色一致 |

### 2.2 语义化扩展色

| Token | 值 | 角色说明 |
|-------|-----|----------|
| `--success` | `#22C55E` | 成功状态，如复制成功、上传完成 |
| `--warning` | `#F59E0B` | 警告状态，如容量接近上限 |
| `--info` | `#3B82F6` | 信息提示，如提示 Banner |
| `--ai-message-bg` | `#1C1C1F` | AI 回复消息气泡背景 |
| `--user-message-bg` | `#312E81` | 用户消息气泡背景（Indigo-900，与主色同系） |
| `--sidebar-bg` | `#0F0F10` | 侧边栏背景，与页面背景一致实现无边际融合 |
| `--sidebar-active` | `#27272A` | 侧边栏选中项背景 |
| `--code-bg` | `#18181B` | 代码块背景 |
| `--code-border` | `#27272A` | 代码块边框 |
| `--streaming-cursor` | `#6366F1` | 流式输出光标色 |

### 2.3 渐变与装饰

| 名称 | 值 | 用途 |
|------|-----|------|
| `--gradient-hero` | `linear-gradient(135deg, #312E81 0%, #1E1B4B 50%, #0F0F10 100%)` | 登录页背景 Hero 区域 |
| `--gradient-glow` | `radial-gradient(circle at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 60%)` | 页面顶部微弱光晕，增加层次 |
| `--glass` | `rgba(24,24,27,0.85)` | 毛玻璃效果（配合 backdrop-blur） |

### 2.4 亮色模式（预留）

亮色模式所有 Token 在暗色值基础上反转，背景使用 `#FAFAFA`，前景使用 `#18181B`，卡片使用 `#FFFFFF`，主色保持 Indigo-500 不变。

---

## 3. 字体排版（Typography）

### 3.1 字体家族

| 层级 | 字体 | 备选 | 说明 |
|------|------|------|------|
| 西文/数字 | `Inter` | `system-ui, -apple-system, sans-serif` | 现代几何无衬线，屏幕显示优化，字重丰富 |
| 中文 | `"Noto Sans SC"` | `"PingFang SC", "Microsoft YaHei", sans-serif` | 思源黑体，覆盖全字重，跨平台一致 |
| 代码 | `"JetBrains Mono"` | `"Fira Code", "SF Mono", monospace` | 等宽字体，代码高亮清晰 |

### 3.2 字体规模（Type Scale）

| Token | 桌面端 | 移动端 | 字重 | 行高 | 字间距 | 用途 |
|-------|--------|--------|------|------|--------|------|
| `--text-xs` | 12px | 11px | 400 | 1.5 | 0 | 标签、时间戳、徽标 |
| `--text-sm` | 14px | 13px | 400 | 1.5 | 0 | 辅助文本、元信息 |
| `--text-base` | 16px | 15px | 400 | 1.6 | 0 | 正文、消息内容 |
| `--text-lg` | 18px | 16px | 500 | 1.5 | -0.01em | 小标题、按钮文字 |
| `--text-xl` | 20px | 18px | 600 | 1.4 | -0.02em | 区块标题 |
| `--text-2xl` | 24px | 20px | 600 | 1.3 | -0.02em | 页面标题、品牌名 |
| `--text-3xl` | 30px | 24px | 700 | 1.2 | -0.03em | Hero 标题、登录页大标题 |
| `--text-4xl` | 36px | 28px | 700 | 1.1 | -0.03em | 仅用于营销页/大标题 |

> **规则**：大于 20px 的标题统一使用 `tracking-tight`（负字间距），增加紧凑感和现代感。

### 3.3 消息排版特殊规则

- **用户消息**：`--text-base` 常规字重，颜色 `--foreground`
- **AI 消息**：`--text-base` 常规字重，颜色 `--foreground`，Markdown 渲染
  - H1/H2/H3：使用 `--text-lg`/`--text-base`/`--text-sm` 加粗，颜色 `--foreground`
  - 列表项：左侧缩进 1.5em，使用 `•` 或 `1.` 标记
  - 引用块：左侧 3px 竖线 `--primary`，背景 `--muted`，内边距 12px 16px
  - 行内代码：背景 `--code-bg`，文字 `--primary`，字号 0.875em，圆角 4px
  - 代码块：背景 `--code-bg`，边框 `--code-border`，圆角 8px，内边距 16px，顶部显示语言标签和「复制」按钮
  - 链接：颜色 `--primary`，下划线仅在 Hover 时显示

---

## 4. 间距系统（Spacing）

采用 **8px 基准网格**，所有间距值为 4 的倍数。

| Token | 值 | 用途 |
|-------|-----|------|
| `--space-1` | 4px | 极小间距，图标与文本间 |
| `--space-2` | 8px | 紧凑间距，按钮内图标边距 |
| `--space-3` | 12px | 默认组件内间距 |
| `--space-4` | 16px | 标准内边距，卡片内部 |
| `--space-5` | 20px | 表单标签与输入框间距 |
| `--space-6` | 24px | 模块间间距 |
| `--space-8` | 32px | 区块间间距 |
| `--space-10` | 40px | 大区块分隔 |
| `--space-12` | 48px | 页面边缘内边距（桌面） |
| `--space-16` | 64px | Hero 区域上下间距 |

### 4.1 页面级间距

- **桌面端（≥1024px）**：页面边缘 `--space-12`，内容最大宽度 1200px（登录/设置页），聊天页无最大宽度限制
- **平板端（768-1023px）**：页面边缘 `--space-6`
- **移动端（<768px）**：页面边缘 `--space-4`

### 4.2 消息间距

- 同一会话中相邻消息间距：`--space-6`
- 用户与 AI 消息对之间的间距：`--space-8`
- 消息气泡内部内边距：`--space-4` 水平，`--space-3` 垂直

---

## 5. 圆角与形状（Shape）

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | 4px | 小标签、行内代码、输入框 |
| `--radius-md` | 6px | 按钮、小卡片 |
| `--radius-lg` | 8px | 消息气泡、代码块、面板 |
| `--radius-xl` | 12px | 大卡片、弹窗、图片预览 |
| `--radius-2xl` | 16px | 登录卡片、设置面板 |
| `--radius-full` | 9999px | 圆形按钮、Avatar、Badge |

### 5.1 消息气泡圆角规则

- **用户消息**：`--radius-lg` 四边，或根据位置调整（如右侧消息右边更圆）
- **AI 消息**：`--radius-lg` 四边
- **图片/视频消息**：`--radius-xl`

---

## 6. 阴影与深度（Elevation）

暗色模式下阴影使用 **带色彩的柔和弥散阴影**，而非纯黑阴影。

| Token | 值 | 用途 |
|-------|-----|------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | 按钮按下、微小抬升 |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.4)` | 卡片、下拉菜单、消息 Hover |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.5)` | 弹窗、模态框 |
| `--shadow-glow` | `0 0 20px rgba(99,102,241,0.15)` | 主按钮 Hover 光晕、焦点状态 |
| `--shadow-inset` | `inset 0 1px 2px rgba(0,0,0,0.2)` | 输入框内阴影 |

---

## 7. 组件规范（Components）

### 7.1 按钮（Button）

#### Primary Button
- **背景**：`--primary`
- **文字**：`--primary-foreground`，字重 500
- **圆角**：`--radius-md`
- **内边距**：垂直 `--space-2.5`（10px），水平 `--space-4`（16px）
- **Hover**：背景亮度提升 10%，添加 `--shadow-glow`
- **Active**：背景亮度降低 5%，移除阴影
- **Disabled**：背景 `--muted`，文字 `--muted-foreground`，无交互
- **过渡**：`all 150ms cubic-bezier(0.4, 0, 0.2, 1)`

#### Secondary Button
- **背景**：`--secondary`
- **文字**：`--secondary-foreground`
- **Hover**：背景 `--accent`

#### Ghost Button
- **背景**：透明
- **文字**：`--foreground`
- **Hover**：背景 `--accent`
- **用途**：图标按钮、工具栏操作（复制、重新生成）

#### Danger Button
- **背景**：`--destructive`
- **文字**：`--destructive-foreground`
- **用途**：删除会话、注销账号

### 7.2 输入框（Input / Textarea）

- **背景**：`transparent` 或 `--card`
- **边框**：1px solid `--input`
- **圆角**：`--radius-md`
- **内边距**：垂直 `--space-2.5`，水平 `--space-3`
- **文字**：`--foreground`，`--text-base`
- **占位符**：`--muted-foreground`
- **Focus**：边框色变为 `--primary`，外环 `--ring`（2px，透明度 50%）
- **错误态**：边框 `--destructive`，下方显示错误文本 `--destructive`
- **过渡**：`border-color 150ms ease, box-shadow 150ms ease`

### 7.3 消息气泡（Message Bubble）

#### 用户消息
- **背景**：`--user-message-bg`
- **文字**：`--foreground`
- **圆角**：`--radius-lg`
- **最大宽度**：桌面端 70%，移动端 85%
- **对齐**：右侧

#### AI 消息
- **背景**：`--ai-message-bg`
- **文字**：`--foreground`
- **圆角**：`--radius-lg`
- **最大宽度**：桌面端 85%，移动端 95%
- **对齐**：左侧
- **Avatar**：左侧显示 AI Avatar（32px 圆形，品牌色背景）

#### 代码块（Code Block）
- **背景**：`--code-bg`
- **边框**：1px solid `--code-border`
- **圆角**：`--radius-lg`
- **内边距**：`--space-4`
- **顶部栏**：显示语言标签 + 「复制」按钮（Ghost Button），背景略深于代码区
- **字体**：`--font-mono`
- **滚动**：水平溢出时显示自定义滚动条（细线，暗色）

### 7.4 侧边栏（Sidebar）

- **宽度**：桌面端 280px（固定），移动端全屏抽屉
- **背景**：`--sidebar-bg`
- **边框**：右侧 1px solid `--border`
- **会话项**：
  - 高度 44px，内边距 `--space-3` 水平
  - 默认：背景透明，文字 `--foreground`
  - Hover：背景 `--accent`
  - 激活：背景 `--sidebar-active`，左侧 3px 竖线 `--primary`
- **会话标题**：单行截断，`--text-sm`，字重 500
- **时间戳**：`--text-xs`，`--muted-foreground`
- **新建对话按钮**：固定在底部，Primary Button 样式，全宽

### 7.5 导航与头部（Header）

- **高度**：56px
- **背景**：`--background`，底部 1px `--border`
- **左侧**：汉堡菜单（移动端）/ 收起按钮（桌面端）+ 品牌 Logo
- **右侧**：用户 Avatar（Dropdown 触发）
- **滚动行为**：聊天区滚动时头部保持固定，添加微弱背景模糊 `backdrop-blur-md`

### 7.6 加载与状态（Loading & Status）

#### 流式生成指示器
- **形式**：消息末尾闪烁光标（`|` 字符），颜色 `--streaming-cursor`
- **动画**：GSAP `opacity` 0→1→0，周期 0.8s，无限循环
- **停止按钮**：输入区右侧显示红色「停止」图标按钮，点击中断生成

#### 上传进度
- **形式**：线性进度条，高度 3px，颜色 `--primary`
- **背景轨道**：`--muted`
- **位置**：附着于输入框上方或消息气泡内

#### Skeleton 加载
- **背景**：`--muted` 到 `--accent` 的渐变 shimmer
- **圆角**：与目标内容一致
- **动画**：GSAP 水平位移 shimmer，周期 1.5s，无限循环

### 7.7 弹窗与模态（Modal / Dialog）

- **遮罩**：`rgba(0,0,0,0.6)`，背景模糊 `backdrop-blur-sm`
- **容器**：背景 `--card`，圆角 `--radius-xl`，阴影 `--shadow-lg`
- **最大宽度**：根据内容，小 400px / 中 560px / 大 720px
- **进入动画**：GSAP `scale: 0.95, opacity: 0` → `scale: 1, opacity: 1`，duration 0.2s，ease `power2.out`
- **退出动画**：反向，duration 0.15s

### 7.8 媒体预览（Media Preview）

#### 图片消息
- **缩略图**：最大宽度 320px，圆角 `--radius-xl`，点击放大
- **放大查看**：全屏模态，背景黑色 90% 透明度，图片居中，支持点击关闭和 ESC 关闭

#### 视频消息
- **播放器**：自定义控制条（播放/暂停、进度、音量、全屏）
- **缩略图**：首帧截图 + 播放按钮覆盖
- **圆角**：`--radius-xl`

---

## 8. 布局原则（Layout Principles）

### 8.1 聊天主界面布局

#### 桌面端（≥1024px）

```
┌─────────────────────────────────────────────────────────────┐
│  Header (56px)                                               │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  Sidebar     │  Chat Area                                   │
│  (280px)     │  - Messages scrollable                       │
│  - History   │  - Input fixed at bottom                     │
│  - New Chat  │                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

- 侧边栏固定左侧，不可滚动（内部会话列表可滚动）
- 主对话区占满剩余宽度，消息列表垂直滚动
- 输入框固定在对话区底部，带有微弱顶部分隔线

#### 平板端（768-1023px）

- 侧边栏默认收起，点击汉堡菜单展开为覆盖层（overlay）
- 展开时宽度 280px，背景遮罩 `rgba(0,0,0,0.5)`
- 主对话区全宽

#### 移动端（<768px）

- 侧边栏为全屏抽屉式，从左侧滑入
- 输入框固定在视口底部，安全区域适配（env(safe-area-inset-bottom)）
- 消息气泡最大宽度 90%

### 8.2 输入区域（Input Area）

```
┌─────────────────────────────────────────────────────────────┐
│  [Attachment Button]  [Textarea (auto-grow)]  [Send Button] │
└─────────────────────────────────────────────────────────────┘
```

- **背景**：`--card`，顶部 1px `--border`
- **内边距**：`--space-3` 水平，`--space-3` 垂直
- **文本域**：
  - 最小高度 44px（单行），最大高度 200px（约 8 行）
  - 自动增高（auto-grow）
  - 无滚动条（超出最大高度才出现）
  - 占位符文案：「输入消息，Shift+Enter 换行…」
- **发送按钮**：圆形 Primary Button，图标为向上箭头，仅在有内容时激活
- **附件按钮**：圆形 Ghost Button，图标为回形针，点击唤起文件选择

### 8.3 登录/注册页布局

- **全屏背景**：`--gradient-hero`
- **中央卡片**：宽度 420px（桌面）/ 全宽减 32px（移动端），圆角 `--radius-2xl`，背景 `--glass`，背景模糊
- **顶部**：品牌 Logo + Slogan
- **中部**：表单（手机号/邮箱切换 Tab）
- **底部**：协议文案 + 第三方登录（预留）

### 8.4 设置页布局

- **桌面端**：左侧设置导航（200px 固定）+ 右侧内容区
- **移动端**：全宽列表，点击进入子页面
- **分组**：账号设置、订阅管理、生成参数、关于/帮助

---

## 9. 响应式断点

| 断点 | 标识 | 布局变化 |
|------|------|----------|
| < 768px | `sm` | 侧边栏全屏抽屉，输入框固定底部，消息 90% 宽 |
| 768-1023px | `md` | 侧边栏可收起覆盖层，消息 85% 宽 |
| 1024-1439px | `lg` | 侧边栏常驻 280px，消息 70%/85% 宽 |
| ≥ 1440px | `xl` | 侧边栏 280px，内容区最大不限制，但消息保持可读宽度 |

---

## 10. 动画规范（Animation Spec）

> **重要**：所有动画在 HTML 原型中**不实现代码**，仅在 Figma Comment 和本规范文档中描述。前端开发使用 GSAP 实现。

### 10.1 页面过渡

- **进入**：内容区 `opacity: 0 → 1`，`translateY(8px) → 0`，duration 0.3s，ease `power2.out`
- **切换会话**：消息列表 `opacity: 0 → 1`，duration 0.2s

### 10.2 消息动画

- **用户消息发送**：`scale: 0.95 → 1`，`opacity: 0 → 1`，duration 0.2s，ease `back.out(1.5)`
- **AI 消息出现**：`opacity: 0 → 1`，`translateY(4px) → 0`，duration 0.3s，ease `power2.out`
- **流式打字效果**：逐字追加，每字间隔由 SSE 数据速率决定，前端不额外添加延迟
- **流式光标**：`opacity` 0→1→0，周期 0.8s，infinite，ease `steps(1)`

### 10.3 侧边栏动画

- **展开（移动端/平板）**：`translateX(-100%) → 0`，duration 0.3s，ease `power2.out`
- **收起**：反向，duration 0.25s
- **遮罩**：`opacity: 0 → 1`，duration 0.2s

### 10.4 按钮交互

- **Hover**：`background-color` 过渡 150ms，图标 `scale: 1 → 1.05`，duration 0.15s
- **Active/Press**：`scale: 1 → 0.97`，duration 0.1s
- **涟漪效果（可选）**：点击时从触点扩散的圆形波纹，颜色 `--primary` 20% 透明度

### 10.5 滚动行为

- **消息列表自动滚动**：新消息出现时平滑滚动到底部，duration 0.3s，ease `power2.out`
- **用户手动滚动后**：若滚动位置不在底部，显示「新消息」提示按钮，点击后平滑滚动到底部

---

## 11. 图标规范（Iconography）

- **图标库**：Lucide React（与 shadcn/ui 一致）
- **描边宽度**：1.5px（默认）
- **尺寸**：
  - 按钮内图标：16px
  - 独立图标按钮：20px
  - 导航图标：18px
  - 空状态/装饰图标：48px
- **颜色**：默认 `--foreground`，Hover 时 `--primary`（如可操作），禁用态 `--muted-foreground`

---

## 12. 可访问性（Accessibility）

- **对比度**：所有文本与背景对比度 ≥ 4.5:1（AA 级）
- **焦点状态**：所有可交互元素有可见焦点环 `--ring`
- **触摸目标**：最小 44×44px
- **减少动效（prefers-reduced-motion）**：所有动画 duration 降为 0 或最小化
- **屏幕阅读器**：
  - 消息列表使用 `role="log"` 和 `aria-live="polite"`
  - 发送按钮 aria-label="发送消息"
  - 流式生成时 aria-busy="true"

---

## 13. 设计令牌文件

设计 Token 已提取为 JSON 文件，存放于 `/design/tokens/` 目录：

- `colors.json` — 完整色彩系统（暗色/亮色模式）
- `typography.json` — 字体家族、规模、字重、行高
- `spacing.json` — 间距 Token

Flux 开发时直接引用上述 JSON 文件映射至 Tailwind CSS 配置或 shadcn/ui CSS 变量。

---

## 14. 文件索引

| 文件 | 路径 | 说明 |
|------|------|------|
| DESIGN.md | `/DESIGN.md` | 本文件，设计系统总览 |
| 颜色令牌 | `/design/tokens/colors.json` | 色彩 Token |
| 字体令牌 | `/design/tokens/typography.json` | 排版 Token |
| 间距令牌 | `/design/tokens/spacing.json` | 间距 Token |
| 登录原型 | `/design/prototypes/login.html` | 登录/注册页 HTML 原型 |
| 聊天原型 | `/design/prototypes/chat.html` | 对话主界面 HTML 原型 |
| 设置原型 | `/design/prototypes/settings.html` | 设置页 HTML 原型 |

---

## 15. 变更记录

| 版本 | 日期 | 变更内容 | 变更人 |
|------|------|----------|--------|
| v1.0 | 2026-06-02 | 初始版本，基于 PRD v1.0 + ADR-001 产出 | Prism |
