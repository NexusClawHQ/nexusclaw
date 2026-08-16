<div align="center">

<img src="https://nexusclaw.cn/assets/home/hero-dashboard.webp" alt="NexusClaw — AI-native CRM with governed digital employees" width="760">

# NexusClaw — AI 原生 CRM 与数字员工平台

**让 AI 员工在受治理的边界内交付真实业务产出——而不只是软件席位。**

An AI-native CRM and digital-employee governance platform. This repository is
the self-hostable, auditable **Community edition** (AGPL-3.0-only).

[![License: AGPL-3.0-only](https://img.shields.io/badge/license-AGPL--3.0--only-007ec6)](LICENSE)
[![Release: v0.1.0-community](https://img.shields.io/badge/release-v0.1.0--community-8250df)](https://github.com/NexusClawHQ/nexusclaw-community/releases/tag/v0.1.0-community)
[![Website: nexusclaw.cn](https://img.shields.io/badge/website-nexusclaw.cn-2da44e)](https://nexusclaw.cn)

[官网](https://nexusclaw.cn) · [能力总览](https://nexusclaw.cn/zh/capabilities) · [快速开始](#快速开始) · [能力边界](#能力边界community-v01) · [社区与支持](#社区与支持)

</div>

---

## NexusClaw 是什么

NexusClaw 是 AI 原生 CRM 与数字员工治理平台：**数字员工在受治理的边界内执行真实业务任务**；
人的修正与真实结果经发布闸门沉淀为**可评审、可回滚**的能力资产。

本仓库（`nexusclaw-community`）是 NexusClaw 的开源社区版——可自部署、可审计的运行时切片，
聚焦安全关键路径：**已认证意图 → 执行器 → 受控工具 → 审计与归因记录**。

<img src="https://nexusclaw.cn/assets/home/platform-overview.png" alt="NexusClaw 平台运行平面：业务上下文、Agent 执行链、治理与信任层、企业连接" width="860">

> 上图为完整平台运行平面概览（详见[官网能力总览](https://nexusclaw.cn/zh/capabilities)）。
> Community v0.1 开源快照交付其中的**治理内核**，能力边界见[下表](#能力边界community-v01)。

## 为什么值得关注

以下三条均可在本仓库与自部署实例中独立验证：

| | 特性 | 如何验证 |
|---|---|---|
| 🛡️ | **治理优先的数字员工**：未认证执行默认拒绝（deny-by-default）；每一次 agent 执行都有完整审计链（执行记录、推理步骤、事件外发） | 阅读源码中的权限与执行路径；自部署后实测 |
| 🔍 | **可审计的开源发布**：每个快照经确定性导出与多层泄漏扫描；SBOM、第三方许可与对应源头记录随树发布；运行实例提供 `GET /source` 合规披露端点 | 检查仓库内 `sbom.cdx.json`、`THIRD_PARTY_NOTICES.md`；启动后访问 `GET /source` |
| ⚡ | **快速上手**：单机 Docker Compose 实测全栈就绪 **35 秒**（应用监听 <1 秒；实测于 2026-08-15，单机 Docker 环境） | 按下方[快速开始](#快速开始)自测 |

## 能力边界（Community v0.1）

| ✅ 本快照包含 | ⏳ 不包含（roadmap，非承诺） |
|---|---|
| 工作区与成员认证 | 可视化构建器 |
| 受治理的 agent 执行（deny-by-default 自治） | 打包与模板市场 |
| 执行审计链 | 企业模块 |
| AGPL 源头合规（`GET /source` 对应源头披露） | 计费与商业化能力 |

完整平台的六大能力域——**数字员工 / 成长回路 / 治理与审计 / 部署形态 / CLI 与开发者 / 集成与移动**——
见[官网能力总览](https://nexusclaw.cn/zh/capabilities)；商业许可（双许可）见
[docs/licensing-faq.md](docs/licensing-faq.md)。

## 快速开始

```sh
cp .env.example .env
# 编辑 .env：把每个 replace-with-... 值替换为新的本地密钥，
# 或你将发布的对应公开源码的 HTTPS URL

docker compose up --build
```

后端默认监听 `http://localhost:3000`（可用 `COMMUNITY_PORT` 覆盖宿主端口）。
完整环境要求与源码构建见下方 [Operational guide](#operational-guide-english)。

## 社区与支持

<table>
<tr>
<td width="260">

<img src="https://nexusclaw.cn/community/wechat-qr.png" alt="NexusClaw 微信群二维码" width="230">

</td>
<td valign="top">

**微信群**：扫码加入社区群（长期有效；如无法扫码请在 GitHub 提交 issue）。

- 🐛 **问题反馈**：欢迎提交 [GitHub Issues](https://github.com/NexusClawHQ/nexusclaw-community/issues)
- 🔒 **安全漏洞**：请勿公开讨论——按 [SECURITY.md](SECURITY.md) 走私有披露渠道
- 📄 **商业许可**：双许可咨询见 [docs/licensing-faq.md](docs/licensing-faq.md)
- 🚧 **代码贡献**：v0.1 阶段暂不受理（`code-contributions-closed`），issue 与非代码反馈欢迎，
  政策详见 [CONTRIBUTING.md](CONTRIBUTING.md)

</td>
</tr>
</table>

---

# Operational guide (English)

## Included in this snapshot

- the Community backend runtime and shared contracts;
- fail-closed permission and RAG authorization paths;
- Agent identity and attribution invariants;
- executor, audit and deterministic smoke-provider support;
- PostgreSQL baseline and Docker Compose deployment inputs.

Commercial learning, model-routing, billing/metering, enterprise identity and
encryption implementations are not part of the Community snapshot. Their
absence must not make permission or audit behavior fail open. See
[docs/architecture.md](docs/architecture.md) for the boundary.

This repository is a release snapshot. Development happens in a private
source-of-truth repository, and approved changes are exported here as reviewed,
sealed snapshots. Public pull requests are proposals; see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Requirements

- Docker with Compose v2; or
- Node.js 22.18.x, npm 11.6.x, PostgreSQL 17 and Redis 7.4 for a source build.

## Start with Docker Compose

Copy `.env.example` to `.env`, replace every `replace-with-...` value with a
new local secret or the HTTPS URL of the exact corresponding public source,
then run:

```sh
docker compose up --build
```

The backend listens on `http://localhost:3000` by default. Override
`COMMUNITY_PORT` to select another host port. Stop the stack with:

```sh
docker compose down
```

Add `--volumes` only when you intentionally want to delete the local database
and Redis data.

Every API response advertises `COMMUNITY_SOURCE_URL`, and `GET /source`
returns the same corresponding-source location and license. Operators who
modify the program must publish the source matching their deployed version and
update this URL; do not leave it pointing to an unmodified upstream snapshot.
See [docs/source-compliance.md](docs/source-compliance.md) for the publication
and ingress verification contract.

Startup time is quoted only as a recorded measurement: single-host Docker
Compose reached full-stack readiness in 35 seconds (application listening in
under 1 second; measured 2026-08-15 on a single-machine Docker environment).
No general startup-time promise is made beyond that measurement.

## Source build

```sh
npm ci --ignore-scripts
npm run build
npm start
```

Set the variables documented in `.env.example` before starting the backend.
No sibling repository, private registry, developer home configuration or
external LLM credential is required for the deterministic smoke path.

## License and security

The Community snapshot is licensed under `AGPL-3.0-only`; see [LICENSE](LICENSE),
[NOTICE](NOTICE), and [docs/licensing-faq.md](docs/licensing-faq.md). Dependency
licenses remain their respective owners' licenses.

Please report vulnerabilities privately as described in
[SECURITY.md](SECURITY.md). Do not place secrets, personal data or exploit
details in a public issue.
