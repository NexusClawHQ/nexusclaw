# Design — MCP 治理网关与热点对标优化包

> Spec ID: `mcp-governance-gateway` · 上游: [requirements.md](./requirements.md)
> 状态: Draft · 复用红线: 旗舰工作流（§1–§8 MCP 网关）中 gate / approvals / audit-chain / guardrail 四包**零改动**；并行工作流（§9–§12）的改动面只允许落在 `sidecar` 包、`docs/` 与仓库政策文件，核心八包零依赖红线全程保持

---

## 1. 总体思路

**复用而非新建**：网关不是第四套治理，而是把现有 sidecar 的治理管线暴露成 MCP server 形态。新增面只有一个：`McpGatewayModule`——MCP server endpoint（Streamable HTTP）+ 下游 MCP client 连接管理 + 治理语义映射。gate 裁决、审批存储、审计落链、控制台全部原样复用。

```
┌──────────── MCP 宿主（任意标准客户端）────────────┐
│            Streamable HTTP（单 endpoint）          │
└──────────────────────┬─────────────────────────────┘
                       ▼
┌──────────── agent-governance sidecar ─────────────┐
│  McpGatewayModule                                  │
│   ├ tools/list → 聚合 × 可见性过滤（权限即可见性）│
│   ├ tools/call → POST /gate（现有管线）            │
│   │    allow → 转发下游 → /complete → 忠实返回     │
│   │    blocked → isError 结构化拒绝 → 落链         │
│   │    paused → elicitation ｜ pending 结果（§3）  │
│   └ meta-tool: governance_pending__lookup          │
│  （gate/approvals/audit-chain/console 零改动）     │
└───────┬──────────────────┬────────────────────────┘
        ▼                  ▼
  下游 MCP server A    下游 MCP server B
```

## 2. 工具聚合与可见性

聚合命名：`<server>__<tool>`（双下划线分隔，稳定、可预测、无斜杠以避免与路径语义混淆）。下游 server 列表来自 `SIDECAR_MCP_UPSTREAMS`（`name|url[|token]` 逗号列表或声明文件）。

**可见性 = 权限（默认隐藏）**：

| 方案 | 优点 | 缺点 | 决策 |
|---|---|---|---|
| 未授权工具隐藏于 tools/list | 模型根本看不到不可用工具的描述——最小提示注入面 | agent 无法"知道自己不能什么" | **默认** |
| 全部暴露、调用时拒绝 | agent 可学习边界 | 工具描述即注入面；拒绝噪音落链 | 可配置 `exposeDeniedTools=true` |

理由：deny-by-default 的最强形态是**不可见**；教育 agent 边界是治理文档的职责，不是把越权菜单递给模型。

## 3. 暂停语义：同步 RPC 上的人审（核心设计决策）

MCP `tools/call` 是请求—响应式；L2/L3 暂停有三种实现：

| 方案 | 机制 | 问题 |
|---|---|---|
| A 挂起请求 | 网关 hold 住 RPC 直到人审决定 | 超时地狱；宿主普遍 30–120s 超时；连接成本高 |
| B 结构化 pending 结果 | 立即返回 `{status:"approval_pending", approval_id}` 文本结果 | agent 需主动取果 |
| C MCP elicitation | 协议内 server→client 用户输入请求（2025-06 引入，2026-07 延续） | 宿主必须声明该 capability |

**决策：C 优先 + B 兜底，A 不做。**

- 宿主声明 elicitation capability → 网关发起批准/拒绝二选一的 elicitation；人答后**同一次调用内**继续执行或返回拒绝——协议正统、无取果问题。
- 未声明 → 返回结构化 pending 结果（AC-2.3）；人工经**现有**控制台 / `POST /approvals/:id/decide` 审批；批准后网关**代执行**（原始参数已封存于 pending 记录）并 `complete` 落链；agent 经内置 meta-tool `governance_pending__lookup(approval_id)` 取回执行结果或拒绝说明。
- 拒绝路径两分支统一：原调用永不执行，拒绝本身落链（与 AGT 的"拦截"差异：我们记录完整审批人+意见+语境）。

## 4. 治理语义映射

| gate 裁决 | MCP 返回 | 审计 |
|---|---|---|
| allow（L0/L1） | 转发结果忠实返回（isError 透传） | toolCallRecord：permission/guardrail passed |
| blocked（未授权/L4） | isError=true + 结构化文本 `{"governance":"blocked","reason":...}` | 拒绝记录落链 |
| paused（L2/L3） | §3：elicitation 继续 / pending 结果 | 暂停→审批→代执行全链 |

meta-tool 自身也走 gate（授权给所有已连接宿主），保证"查询审批结果"同样可审计。

## 5. 依赖与可选启用

- `@modelcontextprotocol/sdk`（MIT）**只**进入 `@agent-governance/sidecar` 依赖树；其余八包零依赖红线不动；license 审计入 `THIRD_PARTY_NOTICES.md` + `file-licenses.json` 重生成。
- 未配置 `SIDECAR_MCP_UPSTREAMS` 时 `McpGatewayModule` 不注册——sidecar 端点、console、gate API 与现状逐字节一致（AC-5.1 的回归测试即守卫此点）。

## 6. 部署形态

- **演示模式**：`SIDECAR_MCP_DEMO=memory` 内置内存下游 server（echo / counter / `demo.send_notice` 三工具，后者标 L3），零外部依赖跑通 AC-4.1 闭环；衔接 `zero-config-sidecar`（后续 spec）的一命令目标。
- **真实模式**：运营者声明下游列表 + 凭证（env）；网关面向宿主只暴露单 endpoint。

## 7. 测试策略

| 测试 | 断言 |
|---|---|
| `mcp-aggregation.spec` | 多下游聚合、命名空间、可见性过滤（默认隐藏/暴露开关） |
| `mcp-gate-mapping.spec` | allow/blocked/paused 三态映射与结构化返回 |
| `mcp-elicitation.spec` | 声明 capability 的宿主：暂停→人审→同调用继续；两分支 |
| `mcp-pending-fallback.spec` | 未声明 capability：pending 结果→控制台审批→代执行→meta-tool 取果；拒绝分支 |
| `mcp-audit-parity.spec` | MCP 路径产生的审计记录与 gate API 路径同构（AC-2.5） |
| `sidecar-noop.spec`（回归） | 未配置 MCP 时 sidecar 与现状逐字节一致 |
| e2e（内存 MCP fixture） | 四路径全链：聚合→放行→暂停批准→暂停拒绝 |

## 9. 零配置启动（P0-2）

**存储模式矩阵**（新增 `@agent-governance/sidecar` 的存储抽象，核心包端口不变）：

| 模式 | 触发 | 用途 | 红线 |
|---|---|---|---|
| memory | 默认（未配置 DSN 时） | 评估/演示 | 重启即焚，文档明示 |
| sqlite | `SIDECAR_STORAGE=sqlite` | 单机持久 | 零 provision |
| postgres | 现状 env | 生产 | 行为与今日完全一致 |

审计链写入走现有 outbox/audit-chain 端口，存储实现按模式选择——**审计记录结构跨模式一致**（等价性测试守卫）。`npx @agent-governance/sidecar` 是 npm bin 包装器：下载→默认 memory 模式→内置 demo 场景；`docker run` 单容器同语义。30 秒就绪口径以实测记录（同 playground T2 纪律）。

## 10. OTel 审计导出（P1-4）

**span 映射表**（对齐实现时点最新 GenAI semconv，写入测试断言防漂移）：

| 审计链对象 | OTel 映射 |
|---|---|
| execution | `invoke_agent` span（trace 根） |
| react step | span event |
| tool call | `execute_tool` span（子），属性含 toolName/riskLevel/permissionCheck/guardrailCheck |
| 审批（决定+审批人+意见） | `execute_tool` 上的 span event |

**依赖决策**：不引 OTel SDK 进核心包——exporter 作为 sidecar 可选模块，以最小 OTLP/HTTP JSON 编码自实现（零依赖红线延续）；SDK 路线留作规模后再议。消费方为 outbox 事件流（§AC-8.2），未启用零成本。验证示例交付 Langfuse 与 Jaeger 二选一起步。

## 11. deepseek-harness 权限插件（P1-5）

dsh "一切皆插件"（权限亦是插件位）。**两段式**：Phase I1 spike 先归档其插件 API 的权限接口形状（以官方 SDK 文档与源码为准，外部事实不臆造）；I2 再实现 `dsh-plugin-governance-gate`——把 dsh 的权限询问转发为 `POST /gate`，paused 时经 dsh 自身的审批 UI 或我们控制台完成。发布按其生态要求登记（plugin 清单/topic）。**外部依赖风险显式化**：若其权限插件接口与我们 gate 语义不匹配，spike 结论决定降级为"文档级集成配方"并记录原因。

## 12. 对比页与定位（P0-3 + P2-6）

三页 docs 对比（`docs/compare-vs-agt.md`、`docs/compare-vs-langgraph-interrupts.md`、`docs/compare-vs-harness-permissions.md`），统一纪律：**只列可验证事实 + 各自适用场景 + "何时选对方"段落**——对比页是 SEO 入口与诚实信号，不是攻击位。README 标题区关键词收窄为 approvals / audit chain / human-in-the-loop（通用词 "agent governance" 不与 AGT 争）。

## 13. 实施顺序

旗舰链 Phase A（协议地基）→ B（治理接线）→ C（审批闭环）→ D（演示与文档）→ E（门禁）；并行链 F（零配置启动）→ G（对比页与定位）→ H（OTel 导出）→ I（dsh 插件）→ J（社区模式）。F 的 D1/D2 演示路径与 A–E 的 demo 共用内存下游 server。详见 [tasks.md](./tasks.md)。
