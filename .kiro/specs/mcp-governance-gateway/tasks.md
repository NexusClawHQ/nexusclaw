# Tasks — MCP 治理网关

> 状态: **Draft — 待评审**（评审通过前只允许修改本三件套与 mockup，不落实现代码）
> 任务标注 `[Rx.y]` 追溯 requirements.md 验收标准；🧪 = TDD（先写失败测试）。

---

## Phase A — 协议地基（MCP server 形态）

- [x] **A1** `[AC-1.1 / AC-5.1]` `McpGatewayModule` 骨架：Streamable HTTP endpoint，仅在 `SIDECAR_MCP_UPSTREAMS` 配置时注册；未配置时 sidecar 行为逐字节一致（noop 回归测试先行）。🧪
- [x] **A2** `[AC-3.1]` （不可达上游降级为其工具消失，含回归测试） （httpUpstream 已实现并可选启用；下游健康检查降级待真实 server 联调） 下游连接管理：解析上游声明、建立 MCP client 连接、启动健康检查与失败降级（下游不可达时其工具消失而非网关崩溃）。🧪
- [x] **A3** `[AC-1.3]` 工具聚合与 `<server>__<tool>` 命名空间；tools/list 聚合快照与缓存失效。🧪
- [x] **A4** `[AC-2.1]` 可见性过滤：默认隐藏未授权工具；`exposeDeniedTools` 开关两分支。🧪

## Phase B — 治理接线

- [x] **B1** `[AC-2.2]` `tools/call` → `POST /gate` 映射：聚合名作为 toolName，输入作为 toolInput。🧪
- [x] **B2** `[AC-1.2]` allow 路径：转发下游 → `/complete` 落链 → 忠实返回（isError 透传，网关不吞改）。🧪
- [x] **B3** `[AC-2.1]` blocked 路径：isError 结构化拒绝文本，拒绝记录落链。🧪
- [x] **B4** `[AC-2.3]` paused 路径（elicitation 分支）：宿主声明 capability 时发起批准/拒绝二选一，同调用内继续或返回拒绝。🧪

## Phase C — 审批闭环（兜底路径）

- [x] **C1** `[AC-2.3]` paused 路径（兜底分支）：结构化 pending 结果（`approval_id` + 可读说明），原始参数封存。🧪
- [x] **C2** `[AC-2.4]` 复用现有控制台与 `POST /approvals/:id/decide` 审批 MCP pending（无需新审批面）。🧪
- [x] **C3** `[AC-2.4]` 批准后代执行 + `/complete` 落链；拒绝路径原调用永不执行。🧪
- [x] **C4** `[AC-2.4]` meta-tool `governance_pending__lookup`：取回执行结果/拒绝说明；meta-tool 自身过 gate 可审计。🧪

## Phase D — 演示与文档

- [x] **D1** `[AC-4.1]` 内存 demo 下游 server（echo / counter / L3 `demo.send_notice`），`SIDECAR_MCP_DEMO=memory` 启用。
- [x] **D2** `[AC-4.1]` （scripts/mcp-smoke.ts，SMOKE_PASS 六步全过；首次失败暴露的僵尸进程问题已修复为异常驱动清理） （人工 HTTP 冒烟已通过：握手/tools/list/echo/danger/L3 暂停/控制台批准/meta-tool 取果/审计；脚本化待做） 演示路径冒烟脚本：一命令起 demo → MCP 客户端走完 L1 放行 / L3 暂停批准 / 审计链。
- [x] **D3** `[AC-3.2]` （docs/mcp-client-config.md：Claude Code 已验证形状，OpenClaw/dsh 标注以官方文档为准） （三宿主一屏配置示例待做） 三宿主一屏配置示例：Claude Code / OpenClaw / deepseek-harness（文档）。
- [x] **D4** `[AC-4.2]` README（EN+ZH）"作为 MCP 网关"章节 + 审批协议留白叙事；CHANGELOG/ROADMAP 对齐。

## Phase E — 门禁与收尾（旗舰链）

- [x] **E1** `[AC-5.3]` 协议 e2e（内存 fixture）：聚合 / 拒绝 / 暂停-批准 / 暂停-拒绝四路径全链。
- [x] **E2** `[AC-5.2]` （零外部依赖红线测试落地，uuid×3/zod×1 记为存量债务；NOTICES/file-licenses 重生成随下次密封快照——生成器在私有源仓库） （SDK 已仅入 sidecar、其余八包零依赖保持；THIRD_PARTY_NOTICES/file-licenses 由私有快照管道生成，随下次密封快照重生成） 依赖与 license 门禁：SDK 仅入 sidecar、其余八包零依赖断言、THIRD_PARTY_NOTICES 与 file-licenses 重生成。
- [x] **E3** `[AC-5.3]`（governance 199 测试 + root build + check:boundary 本地全绿；CI #32155986609 全绿） （governance 66 测试 + check:boundary 全绿；root build/CI 随推送验证） 全门禁回归：root build / vitest / pnpm verify / check:boundary / check:i18n 全绿。
- [x] **E4** `[AC-5.4]` 命名与边界自查：无商业词汇、`packages/shared` 零 diff。

## Phase F — 零配置启动（P0-2）

- [x] **F1** `[AC-6.2]` 存储抽象：memory（默认）/ sqlite / postgres 三模式端口实现，模式仅凭环境变量切换。🧪
- [x] **F2** `[AC-6.2]` 审计链跨模式等价测试：同一场景三模式产出同构审计记录。🧪
- [x] **F3** `[AC-6.1]` `npx @agent-governance/sidecar` bin 包装器 + 单容器 `docker run` （bin 实测 746ms 就绪；npm 发布按 RELEASE.md 发布流程执行） 入口；内置 demo 场景默认加载。🧪
- [x] **F4** `[AC-6.1]` （实测记录：本机 746ms / 容器 979ms） 30 秒就绪实测记录归档（同 playground T2 纪律）。
- [x] **F5** `[AC-6.3]` 生产路径回归：现有 compose 文档与行为不变；memory/sqlite 用途标注（README EN+ZH）。

## Phase G — 对比页与定位收窄（P0-3 + P2-6 矩阵）

- [x] **G1** `[AC-7.1]` `docs/compare-vs-agt.md`：与 Microsoft AGT 的事实对比（形态/语言/审批/审计/合规/集成面）+ "何时选 AGT"段落。
- [x] **G2** `[AC-7.2]` README（EN+ZH）标题区与仓库描述关键词收窄：approvals / audit chain / human-in-the-loop。
- [x] **G3** `[AC-7.3]` `docs/compare-vs-langgraph-interrupts.md`：interrupts 框内建 vs 跨框架 sidecar 的适用场景。
- [x] **G4** `[AC-7.3]` `docs/compare-vs-harness-permissions.md`：Claude Code / OpenClaw 内建权限 vs 独立治理层。
- [x] **G5** 三页对比的事实核查清单归档（每行主张可链接到代码或文档）。

## Phase H — OTel 审计导出（P1-4）

- [x] **H1** `[AC-8.1]` span 映射实现：execution→`invoke_agent`、tool call→`execute_tool`、审批→event；semconv 属性命名以测试断言防漂移。🧪
- [x] **H2** `[AC-8.2]` outbox 可选消费方：OTLP/HTTP JSON 自实现导出（零依赖红线），未启用零成本。🧪
- [x] **H3** `[AC-8.3]` Langfuse 或 Jaeger 接收验证示例（导出→查询到治理事件端到端）。
- [x] **H4** 全门禁回归与 license 自查（无新增运行时依赖）。

## Phase I — deepseek-harness 权限插件（P1-5）

- [x] **I1** `[AC-9.1]` （结论：answerer 瀑布接口语义完全兼容，无需降级为文档配方；结论与源码引用归档于适配包 README） spike：以 dsh 官方 SDK 文档与源码核实权限插件接口形状，结论归档（含不匹配时的降级预案）。
- [x] **I2** `[AC-9.1]` `dsh-plugin-governance-gate` 适配包：权限询问→`POST /gate`，paused 经 dsh 审批 UI 或本控制台。🧪（以 I1 结论为准）
- [x] **I3** `[AC-9.2]`（npm 已发布 dsh-plugin-governance-gate@0.1.0（账号 luyun-nexusclaw，公网可装，干净目录 4 文件验证）；dsh-plugin topic 已加仓库，README 回链本仓库） 生态登记：dsh 插件清单/topic 可发现 + 回链本仓库。

## Phase J — 社区模式松动（P2-6）

- [x] **J1** `[AC-10.1]` CONTRIBUTING 修订提案：开放 examples/docs/recipes PR 通道 + 代码 PR 开放条件成文；**维护者签署后生效**。
- [x] **J2** `[AC-10.2]` 首批 good-first-issue ×3（本 spec 各工作流的文档/示例任务），打标可检索。

## 完成定义（DoD）

- AC-1.1 … AC-10.2 每条至少一个任务 + 测试或文档步骤覆盖。
- 旗舰链：四条 e2e 路径（放行/拒绝/暂停批准/暂停拒绝）在内存 fixture 上全绿；未配置 MCP 时 sidecar 与现状逐字节一致的回归测试 CI 常驻。
- 零配置链：`npx` 一命令 30 秒就绪有实测记录；审计记录跨三存储模式等价。
- 定位链：三页对比上线且每行主张经事实核查；README 关键词收窄完成。
- 互操作链：OTel 导出示例在 Langfuse 或 Jaeger 端到端复现。
- 生态与社区链：dsh spike 结论归档（实现或降级二选一有据）；CONTRIBUTING 修订经维护者签署；good-first-issue ≥3。
