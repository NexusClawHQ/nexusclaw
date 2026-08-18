# Requirements — MCP 治理网关（把 gate 装进 MCP 的分发面）

> Spec ID: `mcp-governance-gateway`
> 状态: **Draft — 评审中**
> 上游: 无（首个面向 MCP 生态的 spec）；战略依据: 2026-08-18 热点对比分析（MCP 2026-07-28 规范刻意不定义审批协议，网关补位）
> 定位宣言: agent 获取工具的主通道已经是 MCP。让 agent 以标准 MCP 客户端身份连上本网关，它的每一次 `tools/call` 就自动经过 deny-by-default 权限、L0–L4 风险评估、L2/L3 人工审批与审计链——**治理零改造地进入 MCP 分发面**。

---

## 1. 背景与动机

- MCP 已成为 agent—工具连接的事实标准（2026-07-28 规范：无状态化、OAuth 2.1 强化、"治理优先"基调），但规范**刻意不定义通用审批协议**，把人审交互留给实现方——这正是本内核 L2/L3 暂停→批准→恢复+审计的完整能力所在，目前却没有以 MCP 形态交付。
- Microsoft Agent Governance Toolkit 以嵌入式安全中间件进入同层（.NET/Azure 优先）；我们的差异化是框架中立 sidecar + 审批流 + 合规审计链。MCP 网关形态同时回应两者：把自己放到所有 MCP 宿主（Claude Code / OpenClaw / deepseek-harness 等）都能接的位置。
- 现有 gate API 需要调用方改造（wrap_tool / Gate 节点）；MCP 网关是**零改造接入路径**——宿主只改一行 MCP server 配置。

## 2. 产品形态

```
MCP 宿主（Claude Code / OpenClaw / deepseek-harness / 任意 MCP 客户端）
   │  标准 MCP（Streamable HTTP）
   ▼
agent-governance MCP 网关（sidecar 新人格）
   │ ① tools/list：聚合下游各 MCP server 工具，按权限过滤可见性
   │ ② tools/call：每次调用 → POST /gate（现有治理管线，零改动）
   │      allow   → 转发下游 server → complete 落链 → 忠实返回
   │      blocked → 结构化拒绝结果（isError）→ 拒绝本身落链
   │      paused  → elicitation 人审（客户端支持时）／结构化 pending 结果（兜底）
   │ ③ L2/L3 批准后：网关代为执行 → complete 落链 → 结果可取
   ▼
下游 MCP servers（filesystem / github / postgres / 自建…，凭证由运营者配置）
```

## 3. 用户故事与验收标准（EARS）

### US-1 MCP 宿主用户（把网关当工具聚合器）

- **AC-1.1 标准接入**：当宿主以标准 MCP 客户端配置指向网关 endpoint 时，系统应当完成 MCP 握手并聚合全部已配置下游 server 的工具，无需任何宿主侧代码改造。
- **AC-1.2 调用透传**：当被允许的工具被调用时，系统应当忠实转发输入并忠实返回下游结果（含结构化内容与 isError 语义），网关不吞改业务数据。
- **AC-1.3 命名空间**：当多个下游 server 存在同名工具时，系统应当以稳定命名空间（`<server>__<tool>`）聚合，避免冲突且对宿主可预测。

### US-2 治理负责人（安全/合规）

- **AC-2.1 默认拒绝**：当工具未被显式授权时，系统应当使其不出现在 `tools/list`（权限即可见性，默认），且任何直呼其名的调用被拒绝并落审计链；可见性暴露可显式配置（`exposeDeniedTools`）。
- **AC-2.2 逐调用风险评估**：当每次 `tools/call` 发生时，系统应当执行与现有 gate API 完全一致的 L0–L4 风险评估并记录 `guardrailCheck`/`riskLevel`。
- **AC-2.3 暂停语义**：当 L2/L3 风险触发时，系统应当优先用 MCP elicitation 向宿主用户请求批准；宿主不支持 elicitation 时，返回结构化 pending 工具结果（含 `approval_id` 与可读说明），审批经现有控制台/HTTP 通道完成。
- **AC-2.4 批准与拒绝闭环**：当人工批准后，系统应当以网关代执行方式完成原调用（原始参数已封存）并落链；当拒绝时，系统应当返回结构化拒绝结果且原调用永不执行。
- **AC-2.5 审计等价**：当任何 MCP 调用发生后，系统应当产生与现有面同构的审计记录（execution → steps → toolCallRecords：permissionCheck/guardrailCheck/输入/输出/审批人）。

### US-3 集成者（接入自有 MCP 工具面）

- **AC-3.1 下游声明**：当运营者配置下游 servers（URL/传输/凭证）时，系统应当通过环境变量或声明文件完成，且凭证只存在于网关侧、永不下发给宿主。
- **AC-3.2 宿主配置示例**：文档应当提供至少三种主流宿主（Claude Code、OpenClaw、deepseek-harness）的一屏 MCP server 配置示例。

### US-4 评估者（60 秒判断价值）

- **AC-4.1 一命令演示**：当评估者启动演示模式时，系统应当以内置内存下游 server（无需任何外部 MCP server 与凭证）呈现完整 L1 放行 / L3 暂停批准 / 审计链闭环。
- **AC-4.2 叙事落位**：README（EN+ZH）应当新增"作为 MCP 网关"章节，并明确本网关补位 MCP 规范留白的审批协议（呼应 Microsoft AGT 差异化定位）。

### US-5 纪律延续（维护者）

- **AC-5.1 可选启用**：当未配置任何下游 MCP server 时，系统应当与现状 sidecar 行为完全一致（端点、console、gate API 逐字节不变），MCP 能力零成本不加载。
- **AC-5.2 依赖边界**：MCP SDK 只允许进入 `@agent-governance/sidecar` 的依赖树（其余八包零运行时依赖红线保持），并通过 license 审计入 THIRD_PARTY_NOTICES。
- **AC-5.3 测试与门禁**：全部既有门禁保持绿；新增协议级 e2e（内存 MCP fixture 覆盖聚合/拒绝/暂停-批准/暂停-拒绝四路径与 elicitation 两分支）。
- **AC-5.4 命名纪律**：新代码与路径遵循社区边界命名规则（无商业词汇），`packages/shared` 零改动。

## 4. 非目标（明确不做）

- 不做下游凭证的 OAuth 完整资源服务器实现（下游认证凭证由运营者经 env 提供）。
- 不做响应内容脱敏与工具 schema 改写（v2 方向，届时对照 AGT 的 response governance 明确差异）。
- 不做 elicitation 的宿主端 UI（由 MCP 客户端按协议呈现）。
- 不做多实例网关路由/高可用（单实例口径，同 playground 限流纪律）。
- 不做 stdio 传输的一等支持（v1 交付 Streamable HTTP；stdio 仅记录为后续方向）。
