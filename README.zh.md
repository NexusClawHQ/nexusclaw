<div align="center">

# agent-governance

[English](README.md) | 中文

**面向 AI 代理的默认拒绝（deny-by-default）治理内核。**

权限 · L0–L4 护栏 · 人工审批 · 不可变审计链 ——
Apache-2.0、框架无关的库。

[![CI](https://github.com/NexusClawHQ/nexusclaw-agent-governance/actions/workflows/ci.yml/badge.svg)](https://github.com/NexusClawHQ/nexusclaw-agent-governance/actions/workflows/ci.yml)
[![npm: @agent-governance/contracts](https://img.shields.io/npm/v/@agent-governance%2Fcontracts)](https://www.npmjs.com/package/@agent-governance/contracts)
[![npm: n8n-nodes-nexusclaw-governance](https://img.shields.io/npm/v/n8n-nodes-nexusclaw-governance)](https://www.npmjs.com/package/n8n-nodes-nexusclaw-governance)
[![PyPI: nexusclaw-agent-governance](https://img.shields.io/pypi/v/nexusclaw-agent-governance)](https://pypi.org/project/nexusclaw-agent-governance/)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-007ec6)](LICENSE)

由 [NexusClaw](https://nexusclaw.cn)（AI 原生 CRM 与受治理的数字员工）出品——
本库即其生产环境正在运行的治理内核。

[快速开始](#快速开始) · [包](#包) · [适配器](#适配器) ·
[参考实现](#参考实现) · [仓库内容边界](#仓库内容边界) · [社区与支持](#社区与支持)

</div>

---

## agent-governance 是什么

agent-governance 是**面向 AI 代理的默认拒绝（deny-by-default）治理内核**：
每次执行从"什么都不允许"开始，任何工具、对象、操作的访问只能通过显式、
可审计的策略获得；每一次授权、拒绝、暂停、审批与执行步骤都会写入**不可变
审计链**。它不接管你的代理——保留你自己的框架（LangGraph / CrewAI / n8n /
Dify 或普通脚本），把工具调用接入 gate API，权限、L0–L4 风险规则、人工审批
与审计记录就交给内核。

本仓库是运行 NexusClaw 生产数字员工的治理内核的开源（Apache-2.0）版本，
由 [NexusClaw](https://nexusclaw.cn)（AI 原生 CRM 与数字员工治理平台）出品，
以三种形态交付：

1. **库**——`governance/` 下九个框架无关的 npm 包（核心包零运行时依赖），
   以及 Python / n8n / Dify 适配器；
2. **gate API**——sidecar HTTP 接口：`POST /gate` 裁决，`/gate/:id/complete`
   记录结果，三行代码接入任意框架；
3. **参考实现**——可运行的全栈切片（后端 + 浏览器控制台 + 仪表盘，
   Docker Compose），用确定性场景端到端演示内核；无需外部 LLM 凭证，
   也可通过任意 OpenAI 兼容端点接入真实模型、在相同治理门下运行。

## 快速开始

**A — 以库的形式接入**

```sh
npm install @agent-governance/contracts
# 或安装 Python 客户端：
pip install nexusclaw-agent-governance
```

三行代码为你的代理的工具加治理：

```python
from agent_governance import GovernanceClient

gov = GovernanceClient("http://127.0.0.1:7899")        # sidecar
update_customer = gov.wrap_tool(update_customer)        # 受治理 + 可审计
```

三个闭环演示（浏览器 / 终端 / 接入自有代理）见
[examples/governance-closed-loop.md](examples/governance-closed-loop.md)，
均无需私有代码、无需外部 LLM 凭证。

**B — 运行参考实现**

```sh
cp .env.example .env   # 把每个 replace-with-... 替换为本地密钥
docker compose up --build
```

打开 **http://localhost:3000/console**（零依赖演示页）或
**http://localhost:3000/app**（参考仪表盘），用种子账号 `demo` /
`nexusclaw-demo` 登录，运行任务即可观察受治理闭环：L1 客户查询放行并审计、
L3 跟进邮件暂停等待审批、批准后恢复执行、审计链全程可查。默认确定性剧本
无需任何 LLM 凭证；设置 `.env` 中三个 `COMMUNITY_LLM_*` 变量（任意 OpenAI
兼容端点：DeepSeek / 通义 / 豆包 / 智谱 / vLLM / Ollama）即可观察真实模型
在相同治理门下运行——权限、护栏、L3 审批与审计链两种模式完全一致，
部分配置会拒绝启动而不是静默降级。

## 包

`governance/packages/`（Apache-2.0，已发布至 npm）：

| 包 | 职责 |
|---|---|
| `@agent-governance/contracts` | 端口与版本化契约——零依赖接缝 |
| `@agent-governance/permission` | 默认拒绝的工具访问、RAG 授权、数据范围过滤、字段脱敏 |
| `@agent-governance/guardrail` | L0–L4 风险规则 |
| `@agent-governance/approval` | 人工审批暂停/恢复 |
| `@agent-governance/audit-chain` | 执行 → 步骤 → 工具调用 → outbox 事件 |
| `@agent-governance/outbox` | 事务性审计事件投递（默认 PG NOTIFY） |
| `@agent-governance/governor` | 速率与上下文限额 |
| `@agent-governance/executor` | 组装全部包的受治理 ReAct 循环 |
| `@agent-governance/sidecar` | HTTP 面：受治理场景端点、gate API、迷你控制台 |

## 适配器

- **Python**：零依赖客户端（`wrap_tool`、`run_approved`），PyPI 包
  `nexusclaw-agent-governance`
- **n8n**：Governance Gate / Approve / Pending 节点，npm 包
  `n8n-nodes-nexusclaw-governance`
- **Dify**：可导入的 OpenAPI custom-tool schema

## 参考实现

`packages/backend` + `packages/dashboard` + `packages/shared` 构成可运行的
参考切片，端到端走通内核自己的契约（与适配器同一套 GraphQL 面）。它是
**内核的演示，不是 NexusClaw 产品**；仓库里有什么、上文就列了什么：

- **`/console`**——零依赖浏览器闭环：运行 → L3 暂停 → 审批 → 恢复 → 审计时间线；
- **参考仪表盘**（React + Vite，Apache-2.0，中英双语）——可视化内核自身的
  产出：执行时间线、审批队列、工具调用记录（权限/护栏检查、输入输出）、
  outbox 事件流与审计派生的成长时间线。所有数字来自审计链，无任何伪造。

可选：为访客托管匿名 playground——无需注册、无需对方装 Docker 的 60 秒
治理闭环：`docker compose --profile playground up -d` 后打开
`http://localhost:3002/playground`。每位访客获得独立一次性工作区（空闲 30
分钟回收）、仅确定性干跑剧本、按 IP 限流，且该接入面强制禁用 BYO 模型
变量——匿名托管永不接触凭证。

## 仓库内容边界

本仓库内所有内容均为 Apache-2.0 并已在上面列出：治理内核库、适配器、
参考实现切片。

商业版 NexusClaw 平台额外包含：可视化构建器、打包与模板市场、商业学习与
模型路由回路、计费/计量、企业身份与加密模块——这些保持商业（见
[docs/licensing-faq.md](docs/licensing-faq.md)）。它们的缺失不得让权限或
审计行为 fail-open：参考切片实现保守策略或在能力缺失时返回稳定的不可用码
（[docs/architecture.md](docs/architecture.md)）。

面向审计与合规评审的映射（SOC 2 / EU AI Act / ISO 27001 / 等保 2.0）见
[docs/compliance-mapping.md](docs/compliance-mapping.md)：默认拒绝权限、
L0–L4 护栏、人工审批与审计链分别对应哪些控制项、每条记录能提供什么证据。

## 社区与支持

<table>
<tr>
<td width="260">

<img src="https://nexusclaw.cn/community/wechat-qr.png" alt="NexusClaw 微信群二维码" width="230">

</td>
<td valign="top">

**微信群**：扫码加入社区群（长期有效；如无法扫码请在 GitHub 提交 issue）。

- 🐛 **问题反馈**：欢迎提交 [GitHub Issues](https://github.com/NexusClawHQ/nexusclaw-agent-governance/issues)
- 🔒 **安全漏洞**：请勿公开讨论——按 [SECURITY.md](SECURITY.md) 走私有披露渠道
- 📄 **商业许可**：商业版咨询见 [docs/licensing-faq.md](docs/licensing-faq.md)
- 🚧 **代码贡献**：现阶段暂不受理（`code-contributions-closed`），issue 与非代码反馈欢迎，
  政策详见 [CONTRIBUTING.md](CONTRIBUTING.md)

</td>
</tr>
</table>
