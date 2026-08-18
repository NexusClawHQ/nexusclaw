# Tasks — 产品橱窗 Dashboard（完整能力展示 + 数字员工训练成长 UI）

> Spec ID: `product-showcase-dashboard` · 上游: [requirements.md](./requirements.md) · [design.md](./design.md)
> 状态: Draft（待评审）
> **执行状态 2026-08-18**: G–K/L1–L3/L5 已实现并通过门禁；L1 的 compose e2e、L4 截图、L6 人工走查待执行。
> 任务标注 `[Rx.y]` 追溯验收标准；🧪 = TDD（先测试后实现）。Phase G–L 与 spec1 Phase A–F 可并行；仅 I2 依赖 H3，徽标类任务消费 spec1 E1。

---

## Phase G — 橱窗外壳与信息架构

- [x] **G1** `[AC-4.1 / 4.2]` App.tsx 重构为侧边导航外壳：`Tab` 扩展为 `Section` 联合类型（overview / employees / run / approvals / audit / growth / policy / product / console-link）；手写 hash 路由（`#/section[/id]`，~20 行监听 + 刷新保持）；720px 折叠为顶部横滑。🧪 hash 切换与刷新保持用例。
- [x] **G2** `[AC-4.1]` 设计令牌迁入 `styles.css`（与 spec1 共享命名）；顶部状态栏：模型来源徽标（消费 spec1 `communityModelSource`，未合入前占位）+ 待审批角标 + 语言切换 + 退出。
- [x] **G3** `[AC-4.4]` 概览页：前端聚合 feed 四统计卡 + 快速入口 + 最近执行迷你列表。🧪 聚合正确性（空 / 有数）。
- [x] **G4** `[AC-4.5]` 全分区空状态组件（说明 + 下一步动作入口）。🧪

## Phase H — 数字员工（卡片墙 + 详情）

- [x] **H1** `[AC-5.4]` `communityAgents` 增强：暴露 `description` + 统计字段（executionCount / approvalRate / l3EscalationCount），approvalRate 无样本返回 null。🧪 先写 resolver 测试（含无样本分支）。
- [x] **H2** `[AC-5.1]` 员工卡片墙视图：头像（`agent-avatars` 按 id 稳定映射）/ 名称 / 状态 / 职责 / 三统计。🧪 渲染与 null 统计显示。
- [x] **H3** `[AC-5.2 / 5.4]` 新 resolver `communityAgentDetail`（画像 + guardrailRules 投影 + recentExecutions + stats）+ 详情视图（hash `#/employees/<id>`；prompt 只读折叠；策略表复用 J1 组件；成长入口跳 I）。🧪 聚合形状 + JSON 投影。

## Phase I — 训练成长 UI（旗舰）

- [x] **I1** `[AC-6.1]` 新 resolver `communityAgentGrowthTimeline`：coaching（approval 决定+意见）/ escalation（guardrail_pending）/ milestone（完成/失败）三路合并倒序。🧪 合并排序、拒绝+意见高亮判定、空数据空数组。
- [x] **I2** `[AC-6.1 / 6.2]` 训练成长分区视图：员工选择器 + 成长时间轴（辅导记录 / 升级暂停 / 里程碑节点，回链执行）；"辅导笔记"高亮样式。🧪 时间轴渲染 + 回链 hash。
- [x] **I3** `[AC-6.3]` 重放对比：成长记录卡"重放训练"→ 取 `rawInput` 调既有 `communityExecuteAgent` → 完成后两列步骤对比视图，差异行高亮。🧪 mutation 调用参数 + 差异高亮。
- [x] **I4** `[AC-6.4]` 能力统计卡：successRate / approvalRate / avgDurationMs / totalExecutions，标注"数据来源：审计链"。🧪 计算正确性（含除零→null）。
- [x] **I5** `[AC-6.5]` 成长种子：幂等补种 1 拒绝（附意见）+ 1 批准完成的执行与审批记录，固定 UUID，时间戳回填启动前 1–3 天。🧪 二次启动不重复。

## Phase J — 治理策略可视化

- [x] **J1** `[AC-7.1]` `sensitiveOps` 策略表组件（工具 / 操作 / 风险级芯片 / 动作芯片 / 说明），员工详情与策略分区复用。🧪
- [x] **J2** `[AC-7.2]` 治理策略分区：按员工分组表 + deny-by-default 说明卡 + 只读边界预览卡。

## Phase K — 商业版预览卡与能力全景

- [x] **K1** `[AC-4.3]` `CommercialPreviewCard` 组件 + `COMMERCIAL_PREVIEW` 静态目录（visual-builder / growth-loop / model-routing / enterprise-modules），统一"商业版"徽标 + 官网链接 + 无交互。🧪 无可交互元素断言。
- [x] **K2** `[AC-4.2 / 4.3]` "完整产品能力"导航分区：预览卡全集 + 社区版能力对照说明；growth 区嵌 growth-loop 卡、policy 区嵌 visual-builder 卡（复用 K1）。🧪

## Phase L — 壳、入口、文档与门禁收尾

- [x] **L1** `[AC-8.1]` 生产托管：dashboard 构建产物由 backend `ServeStaticModule` 挂载 `/app`；compose 构建链调整（dashboard build → backend 镜像静态目录）。🧪 e2e：compose 起栈后 `/app` 200 且登录可用。
- [x] **L2** `[AC-8.2]` 互链：console 头部"产品橱窗"按钮（协调 spec1 Phase A）；Dashboard 导航底部"零依赖演示控制台"链接。
- [x] **L3** `[AC-9.5]` i18n：新增 ~70 键补齐 dashboard 本地 zh/en map；键奇偶进 `i18n.spec.ts`。🧪
- [x] **L4** `[AC-8.3]` README（EN + 中文）快速开始：`/app` 主入口 + `/console` 零依赖演示双介绍；橱窗截图（概览 / 训练成长 / 审批对比新旧）。（README EN 已含 /app + /console 双介绍与概览/配置/成长/审批/占位五张橱窗截图——审批队列截图于 2026-08-18 验收走查补齐；中文节引同一批资产与 GIF）
- [x] **L5** `[AC-9.1 / 9.2 / 9.3]` 门禁收尾：根 `npm run build`、`check:i18n`、`check:boundary`、backend + dashboard 全测；确认两 package.json dependencies 零 diff、`packages/shared` 零 diff。
- [x] **L6** 人工验收清单：起栈 → `/app` 全分区走查（空态 / 种子态）→ 拒绝一次 L3 并写意见 → 成长时间轴出现辅导笔记 → 重放对比 → 商业预览卡无假交互 → `/console` 互链往返。（2026-08-18 真实浏览器 CDP 全流程走查通过：L3 带意见驳回 → 辅导笔记落链 → 重放对比"完全一致" → 商业占位克制 → /console 往返；八张证据截图归档 assets/acceptance/）

## 完成定义（DoD）

- 需求追溯全绿：AC-4.1 … AC-9.5 每条至少一个任务 + 一个测试/人工步骤覆盖。
- L5 门禁零失败；零新依赖；`packages/shared` 零 diff。
- 视觉基线截图归档 `assets/`：概览、数字员工墙、员工详情、训练成长时间轴、重放对比、治理策略、完整产品分区（1440px 与 720px 各一套）。
- 与 spec1 的合流检查：模型来源徽标在 `/app` 顶部与 `/console` 头部一致；两前端芯片 / 令牌视觉一致。
