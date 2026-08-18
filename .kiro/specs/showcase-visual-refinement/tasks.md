# Tasks — 橱窗视觉精修与全端统一（mockup 驱动）

> Spec ID: `showcase-visual-refinement` · 上游: [requirements.md](./requirements.md) · [design.md](./design.md)
> 状态: **执行中** — mockup 已冻结（2026-08-18），Phase M/N 与 P2/P3 已完成并通过门禁；剩余 0.2 持续评审、P1 截图归档、P4 人工走查
> 流程纪律：**Phase M 之前只允许修改 mockup 与 spec 文档，禁止改产品代码。**
> 任务标注 `[Rx.y]` 追溯验收标准；🧪 = TDD。

---

## Phase 0 — Mockup 评审循环（当前阶段）

- [x] **0.1** 交付 `assets/mockup/index.html`：九页全分区 + 令牌色板页 + 设计标注开关（AC-2.1 / AC-3.1 / AC-3.2）。
- [ ] **0.2** 用户评审：逐页（design.md §5 锚点）给出修改意见 → 更新 mockup → 循环直至拍板。
- [x] **0.3** 冻结基线：在 design.md 标注「Mockup 冻结于 YYYY-MM-DD」，此后 mockup 变更须走显式任务。

## Phase M — 令牌统一与守卫（先行，其余阶段的地基）

- [x] **M1** `[AC-1.1]` 对照 design.md §2 校对 dashboard `:root` 令牌（当前预估 95% 一致，修订偏差项）。🧪
- [x] **M2** `[AC-5.2]` 新增 dashboard `tokens.guard.spec.ts`：解析两端 `:root`，断言关键令牌（bg/panel/border/text/muted/accent/五组语义色/radius/spacing 基线/sidebar-w/header-h）值一致。🧪 先写测试（此刻应捕捉 console 与目标表的偏差）。
- [x] **M3** `[AC-4.1 / AC-4.2]` console 令牌迁移到统一表（改值不改命名形态）；跑通 console 全部守卫（零外部资源 / textContent-only / COPY 奇偶 / 稳定状态键）。

## Phase N — 内页精修（对照冻结 mockup 逐页实现）

- [x] **N1** `[AC-2.2 / 2.3]` 员工详情页（§5.4）：画像头/统计/prompt 卡/策略表/最近执行/成长入口重排。🧪 渲染结构测试更新。
- [x] **N2** `[AC-2.2 / 2.3]` 训练成长页（§5.5）：时间轴节点规格（节点圆/语义描边/辅导笔记卡）、重放对比双列、商业卡位置。🧪
- [x] **N3** `[AC-2.2 / 2.3]` 治理策略页（§5.8）：说明条 + 分组表 + 只读边界卡。🧪
- [x] **N4** `[AC-2.2 / 2.3]` 审批页（§5.6）：ApprovalCard 规格与空态。🧪
- [x] **N5** `[AC-2.2 / 2.3]` 审计链页（§5.7）：列表 + 详情时间轴（折叠节点内 JSON/芯片布局）+ 事件流。🧪
- [x] **N6** `[AC-2.2]` 运行页与登录页对照微调（§5.1、运行页沿用 RunView 结构精修边距）。
- [x] **N7** `[AC-2.2]` 产品控制台对照（§5.9：弹窗 eyebrow/图标色调分布复核）。
- [x] **N8** `[AC-2.4]` 响应式复核：860px 断点全页走查（侧栏横滑、双列降单列、pad 收敛）。

## Phase P — 收尾与门禁

- [x] **P1** `[AC-2.2]` 冻结 mockup 与实现同页并排截图归档 `assets/baseline/`（已归档 assets/baseline/{mockup,app} ×1440 共 19 张；含 860 断点与登录页，共 23 张）。
- [x] **P2** `[AC-5.3]` 新增文案 i18n 双表补齐；dashboard i18n 奇偶测试保持。🧪
- [x] **P3** `[AC-5.1 / 5.4]` 全门禁：root build、`check:i18n`、`check:boundary`、backend 48+、dashboard 全测；两 package.json 零 diff。
- [ ] **P4** 人工验收清单：浏览器走查九页与冻结 mockup 逐页对照，偏差记录（容忍度内注记、超差返工）。

## 完成定义（DoD）

- 需求追溯全绿：AC-1.1 … AC-5.4 每条至少一个任务 + 测试/人工步骤覆盖。
- 令牌守卫进 CI 且通过；两端关键令牌零偏差。
- 冻结 mockup 与实现并排截图归档，超差项清零。
- 零新依赖；`packages/shared` 零改动。
