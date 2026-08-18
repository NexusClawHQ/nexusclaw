# Design — 控制台体验升级 + BYO 模型演示路径

> Spec ID: `console-experience-byo-model` · 上游: [requirements.md](./requirements.md)
> 状态: Draft（待评审）

---

## 1. 总体思路

两条互相独立、可分别合入的改造线：

1. **前端（纯视觉重构，零逻辑变更）**：保持"TypeScript 导出静态 HTML 字符串、无构建工具链"的交付形态不变，只重写 HTML 结构与 CSS，并把审计链视图升级为时间轴主视觉。数据通道（GraphQL 查询集 `Q`）、轮询逻辑、认证流程全部复用。
2. **后端（BYO 模型适配线）**：在 `ExecutorModelPort` 现有接缝上新增第二个实现 `CommunityByoLlmModelProviderAdapter`，由启动期工厂根据 `COMMUNITY_LLM_*` 环境变量决定注入哪一个实现。执行器、治理门、审计链零改动——这正是本设计的论证重点：**治理与模型来源正交**（L3 暂停由工具 `riskLevel` 驱动而非剧本驱动，见 `executor-engine.service.ts` 工具注册表升级门）。

## 2. 前端设计

### 2.1 文件组织（AC-3.3）

`community-demo-console.page.ts` 预计从 588 行增长到约 1300 行。拆分为同目录三文件，controller 拼装：

```
closed-loop/
  community-demo-console.styles.ts   # 导出 COMMUNITY_DEMO_CONSOLE_STYLES
  community-demo-console.body.ts     # 导出 COMMUNITY_DEMO_CONSOLE_BODY（含骨架 DOM）
  community-demo-console.script.ts   # 导出 COMMUNITY_DEMO_CONSOLE_SCRIPT（COPY map + 逻辑）
  community-demo-console.page.ts     # 拼装三段为 COMMUNITY_DEMO_CONSOLE_HTML（公共导出不变）
```

对外导出 `COMMUNITY_DEMO_CONSOLE_HTML` 与 controller 均不变，`.page.ts` 成为唯一拼装点。仍然零依赖、零构建。

### 2.2 设计令牌（AC-1.1）

扩展现有 `:root` 变量表为完整令牌体系（保持现有品牌色 `--brand: #3452d9` 不变，避免视觉识别漂移）：

- 色彩：`--bg / --card / --ink / --muted / --line`（沿用）+ 状态色组（`--ok/-warn/-err/-idle/-run` 沿用）+ 新增高亮组 `--hl-key / --hl-str / --hl-num / --hl-bool / --hl-null`（JSON 着色专用）与时间轴组 `--tl-line / --tl-node / --tl-node-active`。
- 尺度：`--sp-1..--sp-6`（4px 基线）、`--radius-sm/md/lg`、`--shadow-1/2`、`--font-mono`。
- 响应式：`max-width: 1180px` 主栏 + `@media (max-width: 720px)` 单列降级。

### 2.3 审计链时间轴（AC-1.2，主视觉）

`auditDetail` 区域重绘为四层垂直时间轴，数据源仍是 `Q.execution` + `Q.events` 两个查询的合流：

```
┌ 执行 (agent_executions) ──────────── [status chip] [model-source chip] ┐
│ input / outputSummary / 耗时 / tokens                                    │
├─ ● 步骤 #1  thought 摘要 ──────────── [L1 chip] 12ms ─┤ (可折叠)
│    ├ 思考 reasoning / 计划 plan
│    ├ 动作 tool_call: demo.customer_lookup
│    │    └ 工具输入 JSON（着色）          ← tool_call_records 节点
│    └ 观察 observation 输出（着色）
├─ ● 步骤 #2  … [L3 chip] [verdict: escalated]
│    └ ⏸ 等待人工审批 → 批准恢复（事件流出 outbox 节点）
└─ ● 事件流 (outbox_events) 3 条（可折叠）
```

实现要点：

- `renderAuditTimeline(execution, events)` 纯 DOM 构建器，与现有 `el()` 助手同一风格；每个节点 `details/summary` 风格的折叠由 `class="collapsed"` + click 委托实现（不用 `<details>`，因为 summary 内需要放芯片）。
- `toolCallRecords` 与 `reactSteps` 的关联：现状是两个列表各自平铺。设计上按 `toolName + stepIndex` 顺序并排进步骤节点（数据已含对齐顺序），tool call 行内直接展示 `permissionCheck / guardrailCheck / durationMs` 三芯片。
- 默认折叠到一层深度：执行展开、步骤折叠、事件流折叠（AC-1.2 的"默认折叠至一层"）。

### 2.4 JSON 语法着色（AC-1.3 / AC-1.8）

`highlightJson(value)` 替换现有 `jsonBlock()` 内部实现（对外签名不变，返回 `<pre class="json">`）：

- `JSON.stringify(value, null, 2)` 后跑一遍极简 tokenizer（正则扫描 `"(?:[^"\\]|\\.)*"(-?\d+|true|false|null)` 等五类 token），每个 token 一个 `createElement('span') + textContent`，class 对应 `--hl-*`。
- **安全不变量**：全函数只允许 `createElement` / `textContent`，禁止任何字符串拼进 `innerHTML`——这是守卫测试的断言点（见 §5）。
- 着色不改变内容语义：复制粘贴得到的仍是合法 JSON。

### 2.5 运行 / 审批视图与 i18n（AC-1.5 / 1.6 / 1.7 / 1.9）

- 运行视图：`runExecution` 区域改为复用时间轴渲染器（同一函数，输入为轮询中的 execution），轮询周期内增量更新步骤节点；`run.hint` 文案双模式（见 §3.6）。
- 审批视图：卡片化（风险芯片 + 描述 + 折叠的工具输入 JSON + 批准/拒绝 + 可选意见），批准后卡片淡出并显示关联执行跳转链接。
- 键盘可达：标签页用 `role="tab"` + arrow-key 导航；折叠节点与审批按钮为原生 `button`，天然可达；所有图标化控件补 `aria-label`（文案进 COPY map）。
- COPY map 键奇偶：新增键约 25 个（时间轴节点名、模型徽标、折叠提示等），zh/en 同步；新增守卫测试遍历两表 `Object.keys` 断言集合相等。

## 3. 后端 BYO 设计

### 3.1 配置契约（AC-2.1 / 2.2 / 2.3）

`.env.example` 新增（带注释块）：

```dotenv
# --- BYO real-LLM demo path (optional; unset = deterministic smoke, no network) ---
# All three must be set together or none. OpenAI-compatible chat completions endpoint
# (DeepSeek / Qwen / Doubao / Zhipu / vLLM / Ollama all expose one).
#COMMUNITY_LLM_BASE_URL=https://api.deepseek.com/v1
#COMMUNITY_LLM_API_KEY=replace-with-your-key
#COMMUNITY_LLM_MODEL=deepseek-chat
```

解析规则（新文件 `community/byo/community-byo-llm.config.ts`）：

| 状态 | 结果 |
|---|---|
| 三项全空 | `null` → 注入 smoke provider（现状不变） |
| 三项全设 | `CommunityByoLlmConfig` → 注入 BYO adapter |
| 部分设置 | 启动抛错，错误消息枚举缺失项（fail-fast，AC-2.3） |

额外校验：`BASE_URL` 必须是 `https?://` 合法 URL（解析失败即启动报错）；`MODEL` 非空字符串。不做白名单——任意 OpenAI 兼容端点都允许（自托管 vLLM 是一类合法目标）。

### 3.2 适配器（AC-2.4 / 2.5 / 2.8）

新文件 `community/byo/community-byo-llm.adapter.ts`：

```ts
@Injectable()
export class CommunityByoLlmModelProviderAdapter implements ExecutorModelPort {
  // chat(): request.messages → OpenAI chat.completions 请求体
  //   - responseFormat === 'json' 时附 response_format: { type: 'json_object' }
  //     （端点不支持则忽略该字段，由 §3.3 围栏剥离兜底）
  //   - fetch + AbortController，超时取 constraints.timeoutMs（已有执行预算字段）
  //   - 返回 content 直传执行器；aiProviderStamp:
  //       resolutionSource: 'community_byo_env', modelId, providerKind: 'openai_compatible'
}
```

关键决策与理由：

- **只做 OpenAI 兼容一种协议**。DeepSeek、通义、豆包、智谱、vLLM、Ollama 均暴露兼容端点，一种协议覆盖 95% 评估者；Anthropic 原生协议留给后续（商业版 `ProviderAdapter` 体系已有，不重复建设）。
- **原生 `fetch`，零新依赖**（AC-3.1）。Node 22 引擎已保证。
- **messages 直传**：`ChatRequest.messages` 的 `{role, content}` 形状与 chat.completions 兼容；executor 已通过 system prompt 枚举工具与 JSON 契约（这正是 smoke provider 依赖标记判相的原因——提示词形状已固定），BYO 无需改提示词。
- **token 计量**：优先取响应 `usage` 字段；端点缺失时按现有 smoke 的 `length/4` 估算兜底（保持 `ExecutionResult.totalTokens` 字段形状不变）。
- **错误脱敏（AC-2.6）**：统一 `sanitizeByoError(error)` —— 只保留 `HTTP <status>` + `new URL(baseUrl).host`，丢弃响应体原文与 key；抛给执行器的错误经既有 `LLM call failed` 路径落 `failed` 状态（fail-closed，AC-2.5）。

### 3.3 响应稳健性（AC-2.4 / 2.5）

真实模型常见偏差在 adapter 层归一，执行器零感知：

1. 剥离 markdown 围栏：` ```json … ``` ` / ` ``` … ``` ` 包裹。
2. `JSON.parse` 预校验：失败即抛错（不猜、不修复——治理演示宁可失败也不静默容错）。
3. 预校验通过后原样返回，`{thought, action}` 结构校验仍归执行器（单一职责，避免双处校验漂移）。

`stripFencesAndValidate(content)` 导出为纯函数，独立单测。

### 3.4 注入工厂（AC-2.2）

`community/byo/community-model-provider.factory.ts`：

```ts
export const EXECUTOR_MODEL_PORT = Symbol('EXECUTOR_MODEL_PORT'); // 若社区模块已有 token 则复用

// useFactory: (config) => config ? new CommunityByoLlmModelProviderAdapter(config)
//                                   : new CommunityModelProviderAdapter()
```

在 `community/runtime/community-agent-runtime.module.ts` 现有 `ExecutorModelPort` 绑定点替换为工厂注入。smoke provider 类保持原位原样（`community-runtime-adapters.ts` 不动，删改风险隔离）。

### 3.5 GraphQL 元数据（AC-2.7）

现有 community resolver 集合新增只读查询：

```graphql
communityModelSource {
  kind            # 'deterministic_smoke' | 'byo_env'  ← 稳定代码，非展示串
  modelId         # 'community-deterministic-smoke-v1' | env COMMUNITY_LLM_MODEL
  providerKind    # 'community-local' | 'openai_compatible'
}
```

不含密钥、不含 base URL（host 也不给——徽标不需要）。resolver 读注入的配置单例，无新表、无新实体。

### 3.6 控制台模型徽标（AC-2.7）

- header 副标题旁常驻徽标：`确定性剧本`（idle 色）/ `BYO: deepseek-chat`（run 色），点击展开一行说明。
- `run.hint` 拆为两键：`run.hint.smoke`（现有文案）与 `run.hint.byo`（说明接的是真实模型、治理门不变、如何切换回确定性）——按 `communityModelSource.kind` 选择。
- 登录页 hint 同步提示当前模式。

## 4. 数据与治理影响评估

- **零 schema 变更**：无新表、无迁移；`aiProviderStamp` 既有字段承载 BYO 谱系（`resolutionSource` 已是自由字符串字段）。
- **治理不变量**：BYO 路径复用 executor 全部五段式（权限 → 护栏 → 工具 → 审计 → outbox）；`deny-by-default` 与 L3 升级门在工具注册表，模型替换不触及。**这是本设计最重要的不变量，评审重点。**
- **边界纪律（AC-3.2）**：新增路径全部位于 `packages/backend/src/community/` 下；命名 `byo / community-byo-*` 避开 `check-community-boundary.mjs` 的 banned pattern（platform-admin / workforce / billing…）；`packages/shared` 零改动。

## 5. 测试策略（AC-3.4）

| 测试 | 断言要点 | 位置 |
|---|---|---|
| `community-byo-llm.config.spec.ts` | 全空→null；全设→config；部分→抛错并枚举缺失项；URL 非法→抛错 | community/byo |
| `community-byo-llm.adapter.spec.ts` | 围栏剥离（三种变体）；不可解析内容抛错；fetch 超时 AbortController 触发；错误消息不含 key/响应体；`usage` 缺失时 token 估算；`response_format` 附加逻辑（mock fetch） | community/byo |
| `community-model-source.resolver.spec.ts` | 两种模式下返回形状；密钥不出现 | community |
| `console-guard.spec.ts` | 渲染路径源码扫描：`innerHTML` 零出现；COPY map zh/en 键集合相等；`status.*` 键仍为稳定代码枚举 | closed-loop |
| `console-interaction.spec.ts`（jsdom） | 时间轴折叠交互、标签键盘导航、审批卡片渲染 | closed-loop |
| 既有套件回归 | `npm run build` / `check:i18n` / `check:boundary` / backend 全测 | 根 |

## 6. 实施顺序建议

前端线与后端线可并行；徽标（§3.6）依赖 §3.5，放在最后接线。详见 [tasks.md](./tasks.md)。
