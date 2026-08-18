# Design — Hosted Playground（访客 60 秒治理闭环体验）

> Spec ID: `hosted-playground` · 上游: [requirements.md](./requirements.md)
> 状态: Draft · **可视化基线: [assets/mockup/playground.html](./assets/mockup/playground.html)**

---

## 1. 总体思路

**复用而非新建**：playground 不是第四个前端，而是 community runtime 的一个**匿名、即焚、限流的访问面**。三段式：

1. **静态落地页 `/playground`**（零依赖单页，同 console 形态）：hero + 唯一主按钮 + 实时时间轴 + 审计链 + CTA。
2. **会话层**（新 `community/playground/` 模块）：匿名签发短期 JWT、workspace-per-session、TTL 回收、内存限流。
3. **执行层**：完全复用现有 `communityExecuteAgent / communityDecideApproval / communityAgentExecution` 读模型——治理管线零改动。

## 2. 会话模型（核心设计决策）

**workspace-per-session**（选定）vs shared-workspace+scope 过滤（否决）：

| 维度 | workspace-per-session | shared+scope |
|---|---|---|
| 数据隔离 | 现有所有查询已按 workspaceId 过滤，**天然隔离，零查询改动** | 每个查询追加 scope 条件，侵入读模型 |
| 回收 | 删 workspace 级联（外键 CASCADE 已存在） | 逐表按 scope 清理，易漏 |
| 成本 | 每会话 seed 一份轻量 agent/角色（见 §3） | 无 |

会话创建流程（`POST /playground/session`）：

```
限流检查(IP) → 创建 workspace(id=pg_<uuid>, playground:true) →
轻量 seed(角色/权限/用户/agent/工具, 见§3) → 签发 JWT(30min, claims:
{ playground:true, workspaceId, principalRole }) → 返回 { token, expiresAt }
```

复用认证：`CommunityGqlAuthGuard` 已按 Bearer 校验——playground JWT 走同一签名密钥与校验路径，principal 类型加 `playground` 标记。

## 3. 轻量会话种子

复用 `CommunityDemoSeedService` 的插入形状但独立实现（`PlaygroundSeedService`，避免 demo seed 与会话 seed 耦合）：workspace + 最小角色（只挂 demo 两个 dry-run 工具的 sensitiveOps）+ playground 用户 + demo agent（prompt/description 复用常量）+ 对象元数据。固定生成 UUID（非固定字面量——与 demo seed 的幂等语义不同，这里每次会话新生成）。插入耗时目标 <300ms（6 张单行插入）。

## 4. 匿名 principal 权限收窄

- JWT claims 携带 `playground: true`；
- 认证服务签发的 principal 映射到会话角色；
- **写守卫**：`communityExecuteAgent / communityDecideApproval` 在 principal.playground 时强制 `where workspaceId = claims.workspaceId`（现有实现已按 principal workspace 过滤——补断言测试）；
- **读守卫**：playground principal 的 agents/executions/growth 查询天然只会看到自己 workspace（同上）；
- **面收窄**：`communityModelSource` 返回确定性标记；其余管理面（无）不存在。

## 5. 限流与回收

- **限流**（`PlaygroundRateLimiter`，内存令牌桶，零依赖）：
  - 会话创建：3 / IP / 小时；执行：20 / IP / 小时；审批：40 / IP / 小时；
  - 超限返回 429 + COPY 文案（zh/en）；单实例并发活跃会话上限 200（超出返回"稍后再试"）；
  - 部署多实例时限流为单机口径（文档注明，v1 不引入共享存储）。
- **TTL reaper**（`PlaygroundSessionReaper`，`@Cron` 每 5 分钟）：
  - 扫描 `playground = true` 的 workspace，`lastActiveAt`（会话表新列或 workspace 元数据 JSON）超 30 分钟 → 删除 workspace（级联执行/审批/审计）+ 吊销 JWT（内存黑名单或依赖 DB 消失后 principal 校验失败——选后者：校验时回查 workspace 存在性，天然失效）；
  - 启动时清扫孤儿（playground workspace 无活跃会话）。
- **BYO 强制禁用**：`assertPlaygroundProfile()` 在 playground profile 启动时检查 `parseCommunityByoLlmConfig` 结果非 null 即抛错（fail-fast），保证托管面无密钥。

## 6. 前端落地页（零依赖单页）

形态同 console（TS 导出静态 HTML 常量，`GET /playground` 由 `PlaygroundController` 返回）：

```
┌ hero: "60 秒，跑一次真实的 AI 治理闭环"  [▶ 运行治理闭环] （唯一主按钮） ┐
│ 三步说明条: 点击运行 → L3 暂停时你批准 → 查看审计链                       │
├ 实时时间轴（运行后出现）:                                                │
│  ● 会话就绪 → ● L1 客户查询(放行+审计) → ⏸ L3 发信等待批准 [批准/拒绝]   │
│  → ● 执行完成                                                           │
├ 审计链卡（完成后展开）: execution/步骤/工具调用/事件流（复用 console 时间 │
│  轴渲染与 JSON 着色代码——从 console script 抽出共享段或复制保持零依赖）   │
├ CTA 区: ★ GitHub 仓库 | ⌘ 自托管三行命令(复制按钮) | 商业版了解           │
└ 页脚: 会话 30 分钟后自动清理 · 无注册 · 确定性剧本无真实外发              ┘
```

- 轮询复用 `communityAgentExecution` 查询；审批调 `communityDecideApproval`；
- COPY map zh/en 双表（守卫测试同 console）；
- 令牌仅存内存变量（不落 localStorage——会话即焚语义，刷新即重开会话）。

## 7. 部署形态

- compose 增加 `playground` 服务（或 backend 同服务 + `PLAYGROUND_PROFILE=true` 环境变量 + `/playground` 路由仅在该 profile 注册）——**选后者**：一个镜像两种人格，profile 只改 env；
- `PLAYGROUND_TTL_MINUTES`（默认 30）、`PLAYGROUND_MAX_CONCURRENT`（200）、`PLAYGROUND_RATE_*` 可配；
- README 新增 "Host a playground" 小节（EN+ZH）。

## 8. 测试策略

| 测试 | 断言 |
|---|---|
| `playground-session.service.spec` | 会话创建（workspace+seed+JWT）；并发上限；workspace 回查失效 |
| `playground-rate-limiter.spec` | 令牌桶阈值与 429；键按 IP |
| `playground-session-reaper.spec` | TTL 过期删除；活跃保留；启动清扫 |
| `playground-guard.spec` | BYO 强制禁用（设置了 env 即抛）；principal playground 断言查询不可跨 workspace |
| `playground-page.guard.spec` | 零外部资源 / textContent-only / COPY 奇偶（同 console 守卫） |
| 既有 48+43+门禁 | 全部保持 |

## 9. 实施顺序

Phase Q（会话与安全后端）→ R（落地页前端）→ S（compose profile + README）→ T（托管准备：安全自查清单 + 门禁收尾）。详见 [tasks.md](./tasks.md)。
