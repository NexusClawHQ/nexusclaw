# Design — 产品橱窗 Dashboard（完整能力展示 + 数字员工训练成长 UI）

> Spec ID: `product-showcase-dashboard` · 上游: [requirements.md](./requirements.md)
> 状态: Draft（待评审）

---

## 1. 总体思路

**Dashboard 是橱窗主体，console 降级为零依赖快速演示。** React 壳（`packages/dashboard`）已有轮询 feed、i18n、登录流，在其上做信息架构升级与新增分区，比重写 console 单文件合理（单文件撑不起产品级 IA，且会破坏 spec1 的零依赖叙事）。

数据面原则：**一切统计与成长记录皆从既有持久化数据派生，零新表、零新 mutation**。员工统计聚合自 `agent_executions`；成长时间轴派生自 approval instances + 执行状态迁移；重放复用 `communityExecuteAgent`。新增的只有只读 resolver。

## 2. 信息架构与外壳

### 2.1 布局

```
┌────────────────────────────────────────────────────────────┐
│ NexusClaw ▸ <workspace>   [模型来源徽标] [🔔 待审批n] [EN] [退出] │
├──────────┬─────────────────────────────────────────────────┤
│ 概览      │                                                 │
│ 数字员工  │              <分区内容区>                          │
│ 运行      │                                                 │
│ 审批 (n)  │                                                 │
│ 审计链    │                                                 │
│ 训练成长  │                                                 │
│ 治理策略  │                                                 │
│ ──────── │                                                 │
│ 完整产品  │  （商业版能力预览卡分区，见 §6）                    │
│ 零依赖演示│  （链接 /console）                                │
└──────────┴─────────────────────────────────────────────────┘
```

- 导航状态用现有 `Tab` 联合类型扩展为 `Section`（不引入路由库；URL hash 同步 `#/section[/id]` 以支持回链与刷新保持，手写 ~20 行 hash 监听）。
- 720px 以下导航折叠为顶部横滑条。
- 设计令牌与 spec1 共享命名（色彩 / 间距 / 圆角 / 芯片体系原样搬入 `styles.css` 的 `:root`），两个前端一套视觉语言。

### 2.2 概览页（AC-4.4）

纯前端聚合现有 feed（agents / executions / approvals 三查询 + spec1 的 `communityModelSource`）：四张统计卡（执行总数、待审批、最近完成、治理事件）+ 快速入口（跑一次闭环 → 运行分区；处理审批 → 审批分区）+ 最近执行迷你列表。零后端改动。

## 3. 后端读模型（AC-5.4）

### 3.1 `communityAgents` 增强

```graphql
communityAgents {
  id name status description      # description 新增（列已存在，resolver 未暴露）
  executionCount                    # count(agent_executions where agentId)
  approvalRate                      # approved / (approved+rejected)，无样本时返回 null
  l3EscalationCount                 # guardrail_pending 态出现过次数（按执行计）
}
```

### 3.2 员工详情聚合（新 resolver `communityAgentDetail`）

```graphql
communityAgentDetail(id: ID!) {
  id name description prompt status
  guardrailRules { sensitiveOps { toolPattern operation riskLevel action description } }  # JSON 列原样投影
  recentExecutions(limit: 10) { ...ExecutionSummary }
  growthTimeline { ... §4 GrowthEntry }
  stats { successRate approvalRate avgDurationMs totalExecutions }
}
```

实现为 community resolver 上的聚合查询（TypeORM `findOne` + 计数查询），只读。

### 3.3 命名与位置纪律（AC-9.2）

新文件：`community/runtime/community-agent-growth.resolver.ts`、`community/runtime/community-agent-detail.resolver.ts`。词汇表：**growth / coaching / replay / milestone**；禁用 workforce、learning-loop、employee-package 等边界禁则词。`check:boundary` 收尾必跑。

## 4. 训练成长 UI——派生规则（旗舰，AC-6.1–6.4）

### 4.1 成长时间轴数据模型

```ts
type GrowthEntry =
  | { kind: 'coaching';  decision: 'approved'|'rejected'; comment: string|null;
      toolName: string; decidedAt: string; executionId: string; actor: string }
  | { kind: 'escalation'; toolName: string; riskLevel: 'L3'; executionId: string; at: string }
  | { kind: 'milestone'; executionId: string; status: 'done'|'failed'; at: string; durationMs: number }
```

派生来源（全部既有持久化，无新写入）：

| GrowthEntry | 来源 | 规则 |
|---|---|---|
| coaching | approval instance（decision + comment + toolName + decidedAt + actor） | 每条决定一条；**拒绝 + 有意见 → 高亮为"辅导笔记"**（AC-6.2 的呈现层） |
| escalation | 执行进入 `guardrail_pending` 的状态迁移 | 每次暂停一条 |
| milestone | `agent_executions.completedAt` | done/failed 各一条 |

按 `at/decidedAt` 倒序合并；resolver 内实现为对该 agent 执行集的三路查询合并（数据量 demo 级，无需分页 v1）。

### 4.2 训练复盘——重放对比（AC-6.3）

纯前端编排，零新 mutation：

1. 成长记录卡片上的"重放训练" → 取该记录关联执行的 `rawInput` → 调既有 `communityExecuteAgent`。
2. 新执行完成后进入对比视图：两列并排渲染两次执行的步骤时间轴（复用 ExecutionsView 的行渲染），差异行（步骤数 / 工具调用序列 / 结论）高亮。
3. 确定性模式下两次执行 byte 级一致（确定性剧本的价值恰好在此演示"训练前后对照"的界面能力）；BYO 模式下自然产生真实差异——两种模式都是卖点。

### 4.3 成长种子（AC-6.5）

`community-demo-seed.service.ts` 幂等补种：预置 1 条已完成的"被拒绝并附意见"执行 + 审批记录 + 1 条"批准后完成"执行（固定 UUID，延续 `COMMUNITY_DEMO_*` 常量模式），使训练成长分区首次打开即有内容。种子数据走真实表插入（与现有 seed 同机制），时间戳回填为启动前 1–3 天。

### 4.4 商业边界（AC-6.6）

训练成长分区底部固定一张预览卡："深度成长回路（商业版）"——模型微调、范例库、自动策略调优的能力说明 + 官网链接。**社区版成长视图的数据来源（审计链派生）在卡内明示**，构成诚实对比。

## 5. 员工与策略页

- **卡片墙**（AC-5.1）：头像用 `packages/shared/src/agent-avatars`（社区允许清单内资产）按 agentId 稳定映射；卡片统计来自 §3.1。
- **详情页**（AC-5.2）：hash 路由 `#/employees/<id>`；prompt 只读折叠块；guardrailRules 进入 §5 策略表组件复用。
- **治理策略页**（AC-7.1 / 7.2）：按员工分组的 `sensitiveOps` 表格（工具 / 操作 / 风险级芯片 / 动作芯片 / 说明）+ deny-by-default 说明卡 + "策略编辑属商业版"预览卡。

## 6. 商业版预览卡（AC-4.3，橱窗的 upsell 面）

静态内容模型（i18n 双语），驱动数据一次定义：

```ts
const COMMERCIAL_PREVIEW: CommercialCapability[] = [
  { key: 'visual-builder',    domain: '平台', i18nTitle: 'cap.visualBuilder' },
  { key: 'growth-loop',       domain: '成长', i18nTitle: 'cap.growthLoop' },
  { key: 'model-routing',     domain: '模型', i18nTitle: 'cap.modelRouting' },
  { key: 'enterprise-modules',domain: '企业', i18nTitle: 'cap.enterprise' },
  // 官网 capabilities 页链接 + 一句能力描述
];
```

渲染为统一 `CommercialPreviewCard`（"商业版"徽标 + 描述 + 链接 + 无交互）。分散复用：训练成长区放 growth-loop 卡、策略区放 visual-builder 卡、导航"完整产品"分区放全集。

## 7. 壳与入口（AC-8）

- 生产可达：backend 以 `ServeStaticModule` 托管 dashboard 构建产物于 `/app`（compose 中 dashboard build 产物拷入 backend 镜像静态目录；零外部文件系统读约束仅属 console 页，静态资源托管不违背）。`/app` 与 `/console` 并存。
- 互链：console 头部加 "产品橱窗 →/app" 按钮（spec1 Phase A 顺带）；Dashboard 导航底部 "零依赖演示 →/console"。
- README：快速开始改为 `/app` 主入口 + `/console` 零依赖演示双介绍。

## 8. i18n 与文案（AC-9.5）

全部进 `packages/dashboard/src/i18n.ts` 本地 map（预计 +70 键：导航、概览、员工、成长、策略、预览卡）；不触碰 shared locales 200 行上限。dashboard 增加键奇偶测试（现有 `i18n.spec.ts` 扩展）。

## 9. 测试策略（AC-9.4）

| 测试 | 断言要点 |
|---|---|
| `community-agent-growth.resolver.spec.ts` | 三路数据合并排序；拒绝+意见→coaching 高亮判定；空数据空数组（非报错） |
| `community-agent-detail.resolver.spec.ts` | 聚合形状；无样本统计返回 null 而非 0 假值；guardrailRules JSON 投影 |
| `growth-seed.spec.ts` | 幂等（二次启动不重复）；固定 UUID；时间戳回填 |
| `replay-compare.spec.tsx` | 重放调用既有 mutation；对比视图差异行高亮 |
| `showcase-shell.spec.tsx` | hash 路由分区切换；空状态渲染；预览卡无交互；导航角标 |
| `i18n-parity`（dashboard） | zh/en 键集合相等 |
| 门禁回归 | 根 build / check:i18n / check:boundary / 全测；`packages/shared` 零 diff |

## 10. 实施顺序

Phase G（壳）→ H（员工）→ I（训练成长，旗舰）→ J（策略）→ K（预览卡与完整产品分区）→ L（托管 / 互链 / 文档 / 门禁）。与 spec1 的前后端线可并行；I 依赖 H 的详情壳，徽标类消费 spec1 E1。
