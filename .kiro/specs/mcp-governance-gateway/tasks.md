# Tasks — MCP 治理网关

> 状态: **Draft — 待评审**（评审通过前只允许修改本三件套与 mockup，不落实现代码）
> 任务标注 `[Rx.y]` 追溯 requirements.md 验收标准；🧪 = TDD（先写失败测试）。

---

## Phase A — 协议地基（MCP server 形态）

- [ ] **A1** `[AC-1.1 / AC-5.1]` `McpGatewayModule` 骨架：Streamable HTTP endpoint，仅在 `SIDECAR_MCP_UPSTREAMS` 配置时注册；未配置时 sidecar 行为逐字节一致（noop 回归测试先行）。🧪
- [ ] **A2** `[AC-3.1]` 下游连接管理：解析上游声明、建立 MCP client 连接、启动健康检查与失败降级（下游不可达时其工具消失而非网关崩溃）。🧪
- [ ] **A3** `[AC-1.3]` 工具聚合与 `<server>__<tool>` 命名空间；tools/list 聚合快照与缓存失效。🧪
- [ ] **A4** `[AC-2.1]` 可见性过滤：默认隐藏未授权工具；`exposeDeniedTools` 开关两分支。🧪

## Phase B — 治理接线

- [ ] **B1** `[AC-2.2]` `tools/call` → `POST /gate` 映射：聚合名作为 toolName，输入作为 toolInput。🧪
- [ ] **B2** `[AC-1.2]` allow 路径：转发下游 → `/complete` 落链 → 忠实返回（isError 透传，网关不吞改）。🧪
- [ ] **B3** `[AC-2.1]` blocked 路径：isError 结构化拒绝文本，拒绝记录落链。🧪
- [ ] **B4** `[AC-2.3]` paused 路径（elicitation 分支）：宿主声明 capability 时发起批准/拒绝二选一，同调用内继续或返回拒绝。🧪

## Phase C — 审批闭环（兜底路径）

- [ ] **C1** `[AC-2.3]` paused 路径（兜底分支）：结构化 pending 结果（`approval_id` + 可读说明），原始参数封存。🧪
- [ ] **C2** `[AC-2.4]` 复用现有控制台与 `POST /approvals/:id/decide` 审批 MCP pending（无需新审批面）。🧪
- [ ] **C3** `[AC-2.4]` 批准后代执行 + `/complete` 落链；拒绝路径原调用永不执行。🧪
- [ ] **C4** `[AC-2.4]` meta-tool `governance_pending__lookup`：取回执行结果/拒绝说明；meta-tool 自身过 gate 可审计。🧪

## Phase D — 演示与文档

- [ ] **D1** `[AC-4.1]` 内存 demo 下游 server（echo / counter / L3 `demo.send_notice`），`SIDECAR_MCP_DEMO=memory` 启用。
- [ ] **D2** `[AC-4.1]` 演示路径冒烟脚本：一命令起 demo → MCP 客户端走完 L1 放行 / L3 暂停批准 / 审计链。
- [ ] **D3** `[AC-3.2]` 三宿主一屏配置示例：Claude Code / OpenClaw / deepseek-harness（文档）。
- [ ] **D4** `[AC-4.2]` README（EN+ZH）"作为 MCP 网关"章节 + 审批协议留白叙事；CHANGELOG/ROADMAP 对齐。

## Phase E — 门禁与收尾

- [ ] **E1** `[AC-5.3]` 协议 e2e（内存 fixture）：聚合 / 拒绝 / 暂停-批准 / 暂停-拒绝四路径全链。
- [ ] **E2** `[AC-5.2]` 依赖与 license 门禁：SDK 仅入 sidecar、其余八包零依赖断言、THIRD_PARTY_NOTICES 与 file-licenses 重生成。
- [ ] **E3** `[AC-5.3]` 全门禁回归：root build / vitest / pnpm verify / check:boundary / check:i18n 全绿。
- [ ] **E4** `[AC-5.4]` 命名与边界自查：无商业词汇、`packages/shared` 零 diff。

## 完成定义（DoD）

- AC-1.1 … AC-5.4 每条至少一个任务 + 测试或文档步骤覆盖。
- 四条 e2e 路径（放行/拒绝/暂停批准/暂停拒绝）在内存 fixture 上全绿。
- 未配置 MCP 时 sidecar 与现状逐字节一致的回归测试在 CI 常驻。
- MCP 演示可在无外部凭证、无外部 MCP server 的环境复现。
