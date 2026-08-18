# Design — 橱窗视觉精修与全端统一（mockup 驱动）

> Spec ID: `showcase-visual-refinement` · 上游: [requirements.md](./requirements.md)
> 状态: **Mockup 冻结于 2026-08-18**（评审结论：浅色 + 紧凑产品节奏 v2 + 员工详情配置页两列版式；此后 mockup 变更须走显式任务） · **可视化基线: [assets/mockup/index.html](./assets/mockup/index.html)**

---

## 1. 设计原则（从参考图提炼的语言，不是像素复刻）

1. **白底纸面感**：页面浅灰底（画布），内容在白色卡片（纸面）上，一层海拔即可，不堆阴影。
2. **左侧信息架构 + 右侧工作区**：分组侧栏承载导航心智（组标题小号大写弱化），工作区留足 32px 呼吸边距。
3. **间距即层级**：组间 20px、卡内 24px、行内 8–12px；靠间距分组，不靠分割线堆叠。
4. **数字大、标签小**：统计值 26px/700，标签 12px 弱化；正文 13.5px。
5. **色彩只用于语义**：品牌蓝引导动作，语义色（绿/琥珀/红/蓝）只出现在状态芯片与反馈，不做装饰。
6. **代码块是唯一的深色元素**：JSON 深蓝黑底，作为页面视觉锚点。

## 2. 统一设计令牌表（单一来源，AC-1.1）

### 2.1 色彩

| 令牌 | 值 | 用途 |
|---|---|---|
| `bg` | `#f5f7fa` | 页面画布 |
| `panel` | `#ffffff` | 卡片/侧栏/顶栏 |
| `panel-2` | `#f2f5f9` | 悬停底/次级填充 |
| `border` | `#e5e9f0` | 常规描边 |
| `border-strong` | `#d4dae4` | 输入框/强调描边 |
| `text` | `#17233d` | 主文字 |
| `muted` | `#68738a` | 次级文字 |
| `faint` | `#98a1b3` | 弱化标签/表头 |
| `accent` | `#3056d3` | 品牌蓝（动作/选中/链接） |
| `accent-soft` | `#edf1fe` | 选中底/图标底 |
| `ok` / `ok-soft` | `#0f7a4a` / `#e6f5ee` | 成功 |
| `info` / `info-soft` | `#1d4fd8` / `#e8effd` | 信息/L1 |
| `warn` / `warn-soft` | `#9a6408` / `#fdf3e0` | 警告/L3/商业徽标 |
| `bad` / `bad-soft` | `#b33131` / `#fbeaea` | 危险/失败 |
| `json-bg` / `json-ink` | `#0f1626` / `#d7e0f5` | 代码块 |

### 2.2 间距与形状（4px 基线 · 紧凑产品节奏 v2）

| 令牌 | 值 | 用途 |
|---|---|---|
| `sp-1..7` | 4/8/12/16/20/24/32 | 组件内→区块间 |
| `radius-sm/md/lg` | 6/10/14 | 输入框与统计卡/卡片/弹窗 |
| `shadow-1` | `0 1px 2px rgba(23,35,61,.05)` | 卡片静置 |
| `shadow-2` | `0 6px 24px rgba(23,35,61,.08)` | 悬停/弹窗 |
| `sidebar-w` | `236px` | 侧栏 |
| `header-h` | `64px` | 顶栏 |
| `content-max` | `1280px` | 工作区最大宽 |
| `content-pad` | `20px 24px` | 工作区内边距 |
| `panel-pad` | `20px`（slim 16px） | 卡片内边距 |
| `section-gap` | `16px` | 分区间距 |
| `kv-row-pad` | `7px` | 配置 kv 行 |
| `config-row-pad` | `9px` | 工具配置行 |

### 2.3 字号层级（紧凑版）

| 层级 | 规格 |
|---|---|
| 页标题 h2 | 18px / 650 |
| 卡标题 h3 | 13.5px / 600（panel 内 12px 级说明） |
| 统计值 | 22px / 700，行高 1.3 |
| 正文 | 13px / 400，行高 1.5–1.6 |
| 辅助 | 12–12.5px `muted` |
| 弱标签/表头 | 11.5–12px `faint`（组标题 11px 大写 +0.08em） |
| 表格 | 12.5px，单元格 pad 7/8 |

## 3. 布局网格

```
┌──────────────────────────────────────────────────────────────┐
│ topbar  h64 · sticky · panel底 · 下边框      [徽标|语言|退出]  │ ①
├──────────┬───────────────────────────────────────────────────┤
│ sidebar  │  content  max1280 · pad 24/32                       │
│ w236     │  ┌───────────────────────────────────────────┐     │
│ pad 20/12│  │ view: 纵向 flex · gap 20                    │     │
│ sticky   │  │  h2 标题 + muted 副题(-12 上移)              │     │
│ 组标题→  │  │  [stat-grid | card-wall | module-grid ...]  │     │
│ nav-item │  │  panel: pad24 · r14 · border+shadow1        │     │
│ 选中=蓝底│  └───────────────────────────────────────────┘     │
│ +左3px条 │                                                   │
└──────────┴───────────────────────────────────────────────────┘
断点 860px：sidebar→顶部横滑条(h自动)，content pad 16。
```

## 4. 组件规格清单（mockup 中逐一示例）

| 组件 | 规格要点 |
|---|---|
| NavGroup | 组标题 + nav-item（图标16 + 文案13.5，h36，r6）；选中 `accent-soft` 底 + 左 3px `accent` 条 + 650 字重 |
| TopBar | 标题17/650 + 副题12；右侧 chip 徽标 + live-dot + ghost 按钮 |
| StatCard | pad 20/24，值26/700，标签12.5 muted |
| ModuleCard | r10 dashed(商业)/solid(社区)，icon 38 r6 soft底，名称14.5/650，chip 版本标签；hover 抬升1px+shadow2 |
| Chip | 高22 r999 pad 1/10 12/600；语义 soft 底 + 深字 |
| Button | primary=accent实心白字；default=白底strong描边；approve/reject=语义soft底深字；ghost=无边 |
| TimelineNode | 左轨2px border，节点圆10px 白底2.5px 语义描边；coaching=warn，escalation=info，milestone=accent |
| CoachingNote | 左3px 语义条 + panel 底 + shadow1，r 0/10/10/0；footer 12 faint |
| ApprovalCard | r10 panel，风险chip+工具名mono+提交时间；JSON输入折叠；意见输入全宽；动作行 approve/reject |
| PolicyTable | 表头12 faint/600，行 pad10，风险/动作用 chip |
| JsonBlock | `json-bg` 底 `json-ink` 字 r6 pad12 max-h240 |
| EmptyState | 居中 48px 上下留白，10px 圆点 + muted 文案 |
| Modal | 遮罩 `rgba(15,22,38,.45)`；卡片 440 r14 pad32；eyebrow 12 大写 + h3 17 |
| Avatar | 42 r10 渐变蓝底白字（大号54/20px） |

## 5. 逐页布局详述（对 mockup 锚点 `#/页名`）

1. **登录 `#/login`**：渐晕背景（accent-soft/ok-soft 双 radial）+ 400px 白卡（标题/双输入/主按钮/mono 提示）。
2. **概览 `#/overview`**：h2+副题 → 4×StatCard → CTA 行（主按钮“跑一次闭环”）→ 最近执行表（3 行 mock）→ 员工概要卡。
3. **员工墙 `#/employees`**：卡片墙 300px 列距 16；卡=头像+名+状态chip+职责+4统计（分隔线上方）。
4. **员工详情 `#/employee-detail`**（重点页，紧凑版式）：页头卡（46 头像 + 名称/chip/版本 + 描述 + 右侧动作）→ **页内 tabs（概览 / 配置 / 执行记录 / 成长记录）**，默认落在"配置"：
   - **配置子页（两列 1 : 1.3，列距 12）**：
     - 左列——**基本信息卡**（kv 双列网格，行 pad7，6 项折 3 行；分隔线下内嵌模型来源条 + 商业版模型路由行卡）；系统提示词卡（JSON 块 max-h120 只读 + 治理边界说明）。两卡右上「编辑属商业版」提示 chip。
     - 右列——能力配置·工具卡（配置行 pad9：28px 图标 + 名称/描述 + L 级 chip + 动作 chip + 30×18 开关；deny-by-default 脚注）；自主权限·风险分级卡（L0–L4 轨道条 pad6 + 触发条件表 + 五段式管线脚注）。
   - 概览子页：4 StatCard（pad 12/16，值 22）+ 最近执行表。
   - 执行记录子页：执行表（状态/输入/耗时/令牌/时间）。
   - 成长记录子页：辅导时间轴精简版 +「打开完整训练成长」入口。
5. **训练成长 `#/growth`**（旗舰）：h2+副题 → 员工选择 → 时间轴（示例 5 节点：coaching-拒绝含辅导笔记高亮 / escalation-L3 / milestone-done / coaching-批准 / milestone-cancelled）→ 重放对比面板（双列 step 列表 + 一致性结论条）→ 商业版成长回路卡。
6. **审批 `#/approvals`**：2×ApprovalCard（一 L3 发信待审：JSON 输入、意见框、批准/拒绝；一空态示例）。
7. **审计链 `#/audit`**：执行列表表 → 详情卡：meta 网格 → 步骤时间轴（节点含 actionType chip/L 级 chip/守卫 chip，折叠体含思考/工具输入 JSON/观察）→ 工具调用表 → 事件流（折叠 JSON）。
8. **治理策略 `#/policy`**：deny-by-default 说明条 → 按员工分组 sensitiveOps 表（工具/操作/L 级 chip/动作 chip/说明）→ 只读边界商业卡。
9. **产品控制台 `#/product`**：14 模块网格（6 社区 solid + 8 商业 dashed）→ **弹窗打开态直接呈现**（mockup 默认展示 Visual builder 弹窗）。
10. **令牌色板 `#/tokens`**：AC-3.2 色板 + 间距/圆角标尺可视化。

## 6. 实现映射（实现阶段改哪里）

| 目标 | 文件 | 动作 |
|---|---|---|
| dashboard 令牌对齐 | `packages/dashboard/src/styles.css` `:root` | 对照 §2 修订（当前已 95% 一致，校验偏差） |
| 内页精修 | `EmployeeDetailView/GrowthView/PolicyView/ApprovalsView/ExecutionsView/RunView.tsx` + styles.css 对应段 | 按 §5.4–5.8 重排结构与类名 |
| 产品控制台微调 | `ProductView.tsx` | 对照 §5.9（弹窗 eyebrow 等） |
| console 对齐 | `packages/backend/.../community-demo-console.styles.ts` | 令牌改值映射 §2（命名可保留连字符形式）；守卫测试同步 |
| 令牌守卫 | dashboard `tokens.guard.spec.ts`（新）+ console guard 扩展 | 断言两端关键令牌值一致（§2.1/2.2 关键行） |

## 7. 测试策略

- 令牌守卫（AC-5.2）：解析两端 CSS 的 `:root` 块，断言关键令牌键值一致；
- 既有 25+48 测试与门禁全部保持（AC-5.4）；
- 人工对照：冻结 mockup 与实现同页并排截图归档 `assets/`（实现阶段完成）。
