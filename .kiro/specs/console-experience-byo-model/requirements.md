# Requirements — 控制台体验升级 + BYO 模型演示路径

> Spec ID: `console-experience-byo-model`
> 状态: Draft（待评审）
> 范围声明: 本 spec 覆盖 P0 方向之一——`/console` 演示面的产品级视觉重构 + 环境变量级 BYO（bring-your-own）真实 LLM 演示路径。产品橱窗信息架构（侧边导航、数字员工、训练成长 UI、商业版预览卡）已拆分至姊妹 spec `product-showcase-dashboard`，两 spec 可并行开发；React Governance Dashboard 的视觉重构也归该 spec。

---

## 1. 背景与动机

社区版的转化漏斗在演示面断裂：

1. **观感瓶颈**。`/console` 是 GitHub 访客接触本项目的第一个（往往也是唯一的）可交互界面。当前实现是一个功能性但视觉过时的单页管理界面，访客在 30 秒内形成"玩具项目"的主观判断，后端治理内核的工程投入无法被感知。
2. **模型配置缺口**。演示路径只提供确定性 smoke provider，评估者无法观察"真实 LLM 在治理边界内的行为"，与商业平台的差距不可见，导致"能力缺失"的误读。
3. **竞品窗口**。AI agent 治理赛道（Invariant Guardrails、Edictum 等）正在涌入，行业趋势是治理从最佳实践变为合规要求。演示面的第一印象误差在窗口期内持续损失转化率。

对标结论（详见 2026-08-18 案例检索）：Dify 证明产品级自托管演示驱动采纳；Langfuse 证明"值得截图"的开源界面是最便宜的营销漏斗；OPA 证明库优先路线不依赖 UI 但仍需 60 秒可体验的入口。

## 2. 现状锚点（改造对象）

| 组件 | 位置 | 现状 |
|---|---|---|
| 演示控制台 | `packages/backend/src/community/closed-loop/community-demo-console.page.ts`（588 行） | 单导出常量 `COMMUNITY_DEMO_CONSOLE_HTML`；登录 / 运行 / 审批 / 审计链四个视图；zh-en COPY map；textContent-only DOM 构建 |
| 控制台路由 | `community-demo-console.controller.ts` | `GET /console` 返回静态 HTML |
| 确定性模型 | `packages/backend/src/community/community-runtime-adapters.ts` → `CommunityModelProviderAdapter implements ExecutorModelPort` | 三阶段剧本（L1 查询放行 → L3 发信暂停 → 完成摘要），阶段由 transcript 标记推导 |
| 执行器 JSON 契约 | `modules/agent-runtime/executor/executor-engine.service.ts`（~L1245, L1364-1434） | `responseFormat: 'json'`，解析 `{thought, action}`；L3 暂停由工具 riskLevel 驱动，与模型无关 |
| GraphQL 演示面 | `communitySignIn / communityAgents / communityExecuteAgent / communityAgentExecution / communityPendingApprovals / communityDecideApproval / communityAgentExecutions / communityExecutionEvents` | 控制台唯一数据通道 |
| 环境配置 | `.env.example` | `DATABASE_* / JWT_SECRET / COMMUNITY_SOURCE_URL / PORT / NODE_ENV` |

## 3. 用户故事与验收标准（EARS）

### US-1 产品级控制台视觉（评估者）

**US-1** 作为评估 NexusClaw 的开发者，我希望打开 `/console` 就看到一个现代、专业的治理控制台，以便在几分钟内判断项目是否值得深入采用。

- **AC-1.1 视觉体系**：当页面加载时，系统应当基于统一的设计令牌（色彩、间距、字体尺度、圆角、海拔阴影）呈现界面，且不发起任何外部网络请求（零 CDN 字体/脚本/样式）。
- **AC-1.2 审计链时间轴**：当查看一次执行的审计详情时，系统应当以垂直时间轴呈现 execution → ReAct steps → tool calls → outbox events 四层证据链，每个节点可独立展开/折叠，默认折叠至一层深度。
- **AC-1.3 JSON 展示**：当展示工具输入、工具输出或事件 payload 时，系统应当渲染带语法着色的只读 JSON 块，并保留现有的深色代码块质感。
- **AC-1.4 语义芯片**：当展示执行状态、风险等级、权限/护栏判定时，系统应当以语义色芯片呈现；芯片的状态键必须是稳定代码（复用现有 `status.*` / riskLevel 枚举），禁止新增展示字符串作为状态键。
- **AC-1.5 运行视图实时性**：当任务提交后，系统应当在轮询周期内更新执行进度（步骤时间轴 + 当前状态芯片），无需手动刷新页面。
- **AC-1.6 审批卡片**：当存在待审批项时，系统应当以卡片形式展示风险芯片、工具输入预览（折叠 JSON）、批准/拒绝操作与可选意见输入。
- **AC-1.7 i18n 完整性**：当切换语言（zh/en）时，所有新增界面字符串应当由 COPY map 双语提供；COPY map 的 zh 与 en 键集合必须完全一致（奇偶校验进入测试）。
- **AC-1.8 注入安全不变量**：当渲染任何服务端返回数据时，系统应当仅通过 `textContent` / `createElement` 构建节点，禁止将不可信数据拼接进 `innerHTML`（语法着色实现同样受此约束）。
- **AC-1.9 键盘可达**：当仅使用键盘操作时，标签页切换、审批决定、JSON 折叠节点均应当可完成（Tab / Enter），交互控件应当带有 `aria-label`。

### US-2 BYO 真实模型演示路径（评估者）

**US-2** 作为想观察"真实 LLM 跑在治理边界内"的评估者，我希望通过环境变量接入自己的 OpenAI 兼容端点（DeepSeek、通义、豆包、智谱、vLLM 等均兼容），以便对比确定性剧本与真实模型在相同治理门下的行为。

- **AC-2.1 默认确定性不变**：当未配置任何 `COMMUNITY_LLM_*` 环境变量时，系统应当使用现有确定性 smoke provider，行为与当前版本完全一致（零外呼、零凭证、CI 与文档快速开始路径不变）。
- **AC-2.2 BYO 激活**：当 `COMMUNITY_LLM_BASE_URL`、`COMMUNITY_LLM_API_KEY`、`COMMUNITY_LLM_MODEL` 三项全部配置时，系统应当在启动时构造真实模型适配器并注入 `ExecutorModelPort`，替代 smoke provider。
- **AC-2.3 部分配置拒绝启动**：当三项中任意一项缺失而其余已配置时，系统应当在启动时失败并输出明确指出缺失项的错误（fail-fast 防呆，禁止静默回退到确定性模式）。
- **AC-2.4 治理契约保持**：当 BYO 模型返回响应时，执行器应当以与确定性路径完全相同的 `{thought, action}` JSON 契约解析与执行，并经过相同的 deny-by-default 权限、L3 审批暂停与审计链落库——治理语义与模型来源无关。
- **AC-2.5 失败安全（fail-closed）**：当 BYO 端点不可达、超时或返回不可解析内容时，执行应当以明确错误状态失败；任何 BYO 故障不得导致治理检查被跳过或降级。
- **AC-2.6 凭证不泄漏**：`COMMUNITY_LLM_API_KEY` 的值不得出现在日志、GraphQL 响应、审计记录、错误消息或 `aiProviderStamp` 中；BYO 错误消息只包含脱敏后的状态码与端点 host，不回显响应体原文。
- **AC-2.7 运行时可观测**：当控制台加载时，系统应当展示当前模型来源徽标——`确定性剧本` 或 `BYO: <modelId>`——并且运行提示（run.hint）文案按模式区分说明。
- **AC-2.8 谱系戳记**：当 BYO 路径执行时，每步 ReAct 的 `aiProviderStamp` 应当记录 `resolutionSource: 'community_byo_env'` 与真实 `modelId / providerKind`，使审计链可区分两种来源。

### US-3 快照纪律（维护者）

**US-3** 作为项目维护者，我希望本次改造不引入新依赖、不破坏现有门禁，以便社区版保持可审计、可导出的快照纪律。

- **AC-3.1 零新依赖**：控制台不新增任何前端依赖；后端 BYO 调用使用 Node 22 原生 `fetch`（含 `AbortController` 超时），`package.json` 的 dependencies 不发生变化。
- **AC-3.2 边界门禁保持**：`npm run check:boundary`、`npm run check:i18n` 与现有测试套件应当继续通过；BYO 适配器与新增命名必须位于 community 树内，且不命中边界检查器的商业版词汇禁则（platform-admin / workforce / billing 等）。
- **AC-3.3 单文件约束保持**：控制台应当保持"无构建工具链"交付形态——仍为 TypeScript 导出的静态 HTML 字符串，由 `GET /console` 直接返回（允许拆分为多个导出常量拼装，禁止引入打包器或框架）。
- **AC-3.4 测试覆盖**：模型来源工厂（env → provider 选择）、BYO 响应围栏剥离与校验、BYO 错误路径脱敏、COPY map zh/en 键奇偶、JSON 着色构建器、控制台关键交互冒烟，均应当有对应的自动化测试。

## 4. 非目标（明确不做）

- 模型管理 UI / 数据库化的 provider 配置面（商业版 `AIProviderConfig` 控制面的领地，本 spec 只做环境变量级单实例接入）。
- streaming、多模型路由、能力协商（`streaming` / `tool_calling` 等在 `ai-provider-runtime.registry` 中仍为 NOT_WIRED，保持不动）。
- 可视化构建器、审批流设计器等商业版界面。
- React Governance Dashboard（`packages/dashboard`）的视觉重构（独立 spec）。
- hosted playground（P1 方向，独立 spec）。

## 5. 依赖与风险

| 风险 | 缓解 |
|---|---|
| 单文件膨胀（588 → 预估 1200+ 行）影响评审 | 拆分为 `COMMUNITY_DEMO_CONSOLE_STYLES / _BODY / _SCRIPT` 三常量同文件（或同目录三文件）导出，controller 拼装；逻辑与样式分区注释 |
| JSON 语法着色引入注入面 | 着色器只输出 `createElement('span') + textContent` 分段节点，实现代码进守卫测试（禁止 `innerHTML` 字样出现在渲染路径） |
| 真实模型输出偏离 JSON 契约导致演示翻车 | adapter 层剥离 markdown 围栏 + 可解析性校验，失败即 fail-closed 报错；README 说明推荐 temperature 与提示词兼容性 |
| 泄漏 API key | 错误消息构造统一走脱敏函数；守卫测试扫描 adapter 源码禁止引用原始 env 值进入任何日志/异常文本 |
| 误伤商业边界 | 命名避开 banned pattern；`check:boundary` 进 CI 任务清单 |
