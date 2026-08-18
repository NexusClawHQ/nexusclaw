# Design — MCP 治理网关

> Spec ID: `mcp-governance-gateway` · 上游: [requirements.md](./requirements.md)
> 状态: Draft · 复用红线: gate / approvals / audit-chain / guardrail 四包**零改动**，本 spec 只新增"协议适配层"

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

## 8. 实施顺序

Phase A（协议地基）→ B（治理接线）→ C（审批闭环）→ D（演示与文档）→ E（门禁）。详见 [tasks.md](./tasks.md)。
