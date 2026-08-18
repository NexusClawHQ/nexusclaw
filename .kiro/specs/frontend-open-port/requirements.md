# Requirements — 原系统 frontend 开源移植（core 导出管线扩展）

> Spec ID: `frontend-open-port`
> 状态: **Proposed — 路线已定，等待 F2 边界确认后全量执行**
> 决策依据：厂商 2026-08-17 战略修订（「代码保密性不再是护城河……变现完全押注闭源智能层与企业版」）+ 2026-08-18 产品决策（「完全一模一样开源，只去掉自我成长和学习沉淀」）。
> 工作纪律：**一切改动在 `nexusclaw-core`（owner 仓）进行，经确定性导出刷新 `nexusclaw-public`**——直接改 public 会被下次导出覆盖（extraction-plan 落点纪律）。本仓现有 8 笔 showcase 提交须先回迁 core。

## 1. 背景与现状判定

- 当前 public 前端（/app dashboard、/console、/playground）为本会话从零构建，**定位是过渡橱窗**，与原系统差距是本质性的（原 frontend：4589 个 TS/TSX 源文件、94 依赖、Ant Design/Apollo/CodeMirror 全家桶、完整 CRM 域 + 数字员工 + 审批 + 审计）。
- 原系统源码在 `nexusclaw-core/packages/frontend`（本机私有仓），导出管线已存在（`scripts/open-source/*`：闭包 → 清单 → 版权账本 → 许可 → 门禁）。
- 已知管线阻塞：`phase-3-legal-inputs.mjs` 引用的 `open-source/public-root/` 已被拆分移除（提交 40cac1277），管线自拆分后未再跑通。

## 2. 用户故事与验收标准（EARS）

### US-1 视觉与交互一模一样（访客）

- **AC-1.1**：社区版 `/app` 应当由原系统 frontend 构建产物提供——同一套 Ant Design 组件、布局、路由结构与交互，与商业版界面一致（允许社区版隐藏未开放模块的导航入口，不允许重写视觉）。
- **AC-1.2**：登录、工作台、数字员工（列表/详情/**系统提示词可编辑**/能力配置）、审批、审计链、AI 对话/执行流在社区构建中应当真实可用，对接社区后端 GraphQL 面。
- **AC-1.3**：系统提示词编辑不再标注商业版——提示词与员工基础配置属于本地数据操作，社区版完整开放。

### US-2 闭源边界只保留智能层（产品决策）

- **AC-2.1**：`ai-workforce-learning`（自我成长/学习沉淀）及其依赖闭包不进快照，路线与前端入口一并剔除；商业入口以预览呈现。
- **AC-2.2**：除 2.1 外的模块是否全部放开，以 **F2 产出的《可开放模块清单》** 为准经产品确认后执行；CRM 域（客户/线索/商机/案例）默认放开（厂商决策），billing/CPQ 等变现域在 F2 清单中单独标注由产品逐项勾选。
- **AC-2.3**：`forbidden-content-policy` / `boundary-disposition-rules` / `check-community-boundary` 同步修订，导出门禁保持可执行（不是删除门禁，是重定义边界）。

### US-3 管线与工程（维护者）

- **AC-3.1**：导出闭包纳入 `packages/frontend`（含裁剪规则）与 frontend 构建链（Dockerfile.community / compose.community.yml 增加构建阶段）；94 个依赖过 `dependency-license-policy` 审查，产物 NOTICE/SBOM 齐全。
- **AC-3.2**：codegen 对齐：frontend 以 community 后端 schema 重新生成，或后端补齐 frontend 所需 GraphQL 面（以 F2 缺口清单为准，二者组合）。
- **AC-3.3**：phase-3 legal-inputs 阻塞修复（公开源稿来源改为 public 仓回流或恢复源稿目录），管线全程跑通并留证。
- **AC-3.4**：本仓（public）现有 8 笔 showcase 提交回迁 core 并入 community 层，随后由导出统一刷新——BYO/治理成长读模型/playground 等 backend 资产保留，过渡 dashboard 在 frontend 就绪后退役。

### US-4 质感红线（用户核心诉求）

- **AC-4.1**：社区版首屏观感应当达到原系统水准（真实产品组件体系），杜绝"学习作品"感；验收方式为原系统与社区版同页并排截图对照。

## 3. 阶段计划（F1–F5）

| 阶段 | 内容 | 产出 |
|---|---|---|
| **F1** | 管线修复 + public 工作回迁 core（保命步骤） | 管线 dry-run 通过；8 笔提交进 core |
| **F2** | 裁剪测绘：routes 依赖闭包分析（2485 行路由表 × modules/pages × generated schema 引用） | 《可开放模块清单 + 后端 GraphQL 缺口清单 + 依赖许可审查表》→ **产品确认边界** |
| **F3** | 闭包/门禁/构建链改造（frontend 进快照，学习层剔除） | 含 frontend 的快照构建 |
| **F4** | 后端面补齐（缺口 resolver/裁剪前端调用）+ 提示词编辑开放 | 社区栈端到端可用 |
| **F5** | 导出刷新 public + 并排截图验收 + 文料（README/CHANGELOG） | 新 public 发布 |

## 4. 非目标

- 不开源学习回路/模型微调/范例库（唯一闭源智能层）。
- 不在本 spec 内做官方托管决策（playground 托管另议）。
- 过渡 dashboard/console/playground 的去留是 F5 验收后的清理项，不在移植期内删除（保底可用）。
