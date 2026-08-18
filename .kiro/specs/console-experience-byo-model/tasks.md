# Tasks — 控制台体验升级 + BYO 模型演示路径

> Spec ID: `console-experience-byo-model` · 上游: [requirements.md](./requirements.md) · [design.md](./design.md)
> 状态: Draft（待评审）
> 任务标注 `[Rx.y]` 追溯到验收标准。**TDD 纪律：每个带测试标记（🧪）的任务先写测试再写实现。**
> **执行状态 2026-08-18**: A–E/F1–F4 已实现并通过门禁；F5 人工验收（compose 起栈 + 真实 BYO 端点）待执行。
> 前端线（Phase A–C）与后端线（Phase D–E）可两人并行；Phase F 为合流收尾。

---

## Phase A — 前端骨架：文件拆分与设计令牌

- [x] **A1** `[AC-3.3]` 将 `community-demo-console.page.ts` 拆分为 `styles.ts / body.ts / script.ts` 三导出常量，`.page.ts` 保留为唯一拼装点，`COMMUNITY_DEMO_CONSOLE_HTML` 对外形状不变；controller 零改动。验证：`npm run build -w @nexusclaw/backend` 通过，`GET /console` 返回内容与拆分前 byte-equivalent（临时 diff 脚本对比）。🧪
- [x] **A2** `[AC-1.1]` 扩展 `:root` 令牌体系（间距/圆角/阴影/等宽字体/JSON 高亮色/时间轴色），保持品牌色 `--brand: #3452d9` 与既有状态色不变；主栏加宽至 1180px，增加 720px 单列降级。零外部资源引用。🧪（守卫断言：styles 常量内无 `http://` / `https://` / `@import` / `url(`）
- [x] **A3** `[AC-1.9]` 标签页改 `role="tablist"/"tab"/"tabpanel"` + 方向键导航；所有图标化控件补 `aria-label`（新 COPY 键进 zh/en 两表）。

## Phase B — 审计链时间轴主视觉

- [x] **B1** `[AC-1.2]` 实现 `renderAuditTimeline(execution, events)` 纯 DOM 构建器：execution 根节点 → ReAct 步骤节点（thought/action/observation 三段）→ 内嵌 tool call 行（permission/guardrail/duration 三芯片）→ outbox 事件流节点；默认折叠至一层深度；click 委托切换 `collapsed`。替换 `auditDetail` 现渲染。
- [x] **B2** `[AC-1.3 / AC-1.8]` 实现 `highlightJson(value)`：极简 tokenizer 五类 token（string-key/string/number/bool/null）→ `createElement('span') + textContent` 分段，替换 `jsonBlock()` 内部实现，对外签名不变。🧪（渲染正确性 + 复制内容仍为合法 JSON）
- [x] **B3** `[AC-1.4]` 芯片体系复核：状态/风险/判定芯片全部走既有稳定代码键（`s-*` / `r-L1` / `verdict-*`），确认无新增展示字符串作状态键。
- [x] **B4** `[AC-1.5]` 运行视图复用时间轴渲染器：轮询周期内增量更新 `runExecution` 区域步骤节点与状态芯片，无需手动刷新。🧪（jsdom：模拟 guardrail_pending → 审批 → done 的轮询序列，断言 DOM 更新）

## Phase C — 审批卡片与 i18n 收口

- [x] **C1** `[AC-1.6]` 审批列表卡片化：风险芯片 + 描述 + 折叠工具输入 JSON + 批准/拒绝 + 可选意见；决定提交后卡片淡出并显示关联执行跳转。
- [x] **C2** `[AC-1.7]` COPY map 新增键补齐 zh/en（预计 ~25 键：时间轴节点名、折叠提示、aria 标签、模型徽标占位、双模式 hint）。🧪 `console-guard.spec.ts` 断言 zh/en 键集合相等。

## Phase D — BYO 配置与适配器（后端线）

- [x] **D1** `[AC-2.1 / 2.2 / 2.3]` 新建 `community/byo/community-byo-llm.config.ts`：三变量绑定校验（全空→null / 全设→config / 部分→启动抛错枚举缺失项）+ base URL 合法性校验。🧪 先写 `community-byo-llm.config.spec.ts` 四分支用例。
- [x] **D2** `[AC-2.4 / 2.5]` 新建 `community/byo/community-byo-llm.adapter.ts`：`implements ExecutorModelPort`；原生 `fetch` + `AbortController`（超时取执行约束 `timeoutMs`）；`responseFormat==='json'` 时附 `response_format`；`usage` 缺失时 token 估算兜底；`aiProviderStamp.resolutionSource='community_byo_env'`。🧪 mock fetch 全路径。
- [x] **D3** `[AC-2.4 / 2.5]` 导出纯函数 `stripFencesAndValidate(content)`：剥 ```json 围栏 → `JSON.parse` 预校验 → 失败抛错（fail-closed，不猜不修复）。🧪 三种围栏变体 + 非法 JSON 用例。
- [x] **D4** `[AC-2.6]` 实现 `sanitizeByoError(error)`：只保留 HTTP 状态码与 base URL host，丢弃响应体原文与密钥；接入 adapter 全部异常路径。🧪 断言错误消息不含 key / 响应体 / 完整 URL。
- [x] **D5** `[AC-2.2]` 新建 `community-model-provider.factory.ts`，在 `community-agent-runtime.module.ts` 现有 `ExecutorModelPort` 绑定点替换为工厂注入；`community-runtime-adapters.ts` 的 smoke 类零改动。🧪 两种 env 形态下模块解析出正确实现类。

## Phase E — GraphQL 元数据与徽标接线（依赖 D 线）

- [x] **E1** `[AC-2.7]` 新增只读查询 `communityModelSource { kind modelId providerKind }`：resolver 读注入配置单例；无密钥、无 base URL。🧪 两种模式返回形状 + 密钥不出现。
- [x] **E2** `[AC-2.7]` 控制台 header 徽标 + `run.hint` 双模式文案（`run.hint.smoke` / `run.hint.byo` 按 `kind` 选择）+ 登录页 hint 同步。🧪 jsdom 双模式断言。

## Phase F — 文档、环境与门禁收尾

- [x] **F1** `[AC-2.2 / 2.7]` `.env.example` 增加带注释的 `COMMUNITY_LLM_*` 块（默认注释态）。
- [x] **F2** `[AC-2.1 / 2.7]` README 快速开始（EN + 中文介绍两节）补"两种演示模式"说明：默认确定性零凭证路径不变；BYO 三变量接入法与兼容端点列表（DeepSeek/通义/豆包/智谱/vLLM/Ollama）。
- [x] **F3** `[AC-3.4]` 新增 `console-guard.spec.ts` 汇总守卫：渲染路径源码零 `innerHTML`；COPY zh/en 键奇偶；`status.*` 键为稳定代码枚举。
- [x] **F4** `[AC-3.1 / 3.2]` 全门禁跑通并记录：根 `npm run build`、`check:i18n`、`check:boundary`、backend 全测、dashboard 全测；确认根与 backend `package.json` dependencies 无 diff（零新依赖）；确认 `packages/shared` 无 diff（边界纪律）。
- [ ] **F5** 人工验收清单：按 README 快速开始起栈 → 默认模式跑通 L1/L3 闭环并截图对比旧版；配置 BYO 三变量重启 → 徽标切换 → 真实模型跑通闭环（L3 仍暂停）→ 审计链 `aiProviderStamp` 显示 `community_byo_env`；错误路径验证：错 key → 执行 failed 且错误消息脱敏。

## 完成定义（DoD）

- 需求追溯矩阵全绿：AC-1.1 … AC-3.4 每条至少被一个任务 + 一个测试/人工步骤覆盖。
- Phase F4 门禁输出零失败；`git diff` 确认零新依赖、`packages/shared` 零改动。
- 审计链视图在 1440px 与 720px 宽度下截图各一张，归档入 spec 目录 `assets/` 作为视觉基线。
