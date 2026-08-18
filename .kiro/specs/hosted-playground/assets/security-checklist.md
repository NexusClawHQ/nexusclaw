# Playground 安全自查清单（spec hosted-playground · T1）

> 实例：本地 compose `--profile playground`（3002 端口）· 自查日期：2026-08-18
> 每项附验证方式与结果；官方托管上线前须在目标环境复跑本清单。

| # | 项 | 验证方式 | 结果 |
|---|---|---|---|
| 1 | 匿名面仅暴露两路由（`GET /playground`、`POST /playground/session`），关闭时 404 | curl：backend(3001) `/playground` → 404；playground(3002) → 200 | ✅ |
| 2 | workspace 隔离：会话间/对 demo 工作区互不可见 | 伪造 token 调 `communityAgents` → `Invalid access token`；会话 token 仅返回本会话 agent | ✅ |
| 3 | 凭证隔离：playground profile + `COMMUNITY_LLM_*` 拒绝启动 | `assertPlaygroundProfile` 单测（3 用例）+ 启动路径接线 | ✅ |
| 4 | 工具面封闭：仅两个 dry-run 工具，无真实外发 | 会话 seed 的 `guardrailRules.allowedTools` 仅 demo 两件（发送为干跑 marker `demo-dry-run`）；代码路径复核 | ✅ |
| 5 | 限流生效：会话 3/IP/时 | 连续 4 次创建：201/201/201/**429** | ✅ |
| 6 | 执行限额：20/IP/时 + 10/会话 | registry 单测（5 用例）覆盖两级限额与普通用户豁免 | ✅ |
| 7 | TTL 回收：30 分钟空闲级联删除 + 启动孤儿清扫 | reaper 单测路径 + recycleWorkspace 删除序列（审批→执行(级联步骤/工具)→护栏日志→outbox→agent→成员→权限→用户→角色→对象→workspace） | ✅ 代码路径；30 分钟实窗等待未跑（逻辑单测覆盖） |
| 8 | 令牌即焚：workspace 删除后 token 失效 | 认证每请求回查 user/membership（`authenticate` 实现复核）；token 不落浏览器存储（页面守卫断言无 localStorage/sessionStorage） | ✅ |
| 9 | 页面零外部资源 / 无 innerHTML / COPY 奇偶 | 页面守卫测试 5 用例 | ✅ |
| 10 | 单实例口径：限流与 reaper 为进程内存 | 实现复核（Map）；README 安全注意事项注明多实例需外部状态 | ✅（已知边界） |

## 已知边界（托管前须决策）

- **多实例**：水平扩容时限流/会话注册表不共享——官方托管需单实例或引入 Redis（新 spec）。
- **代理链路**：`@Ip()` 取直连地址；托管于 CDN/反代后须配置可信 `X-Forwarded-For`，README 已注明。
- **双实例共栈**：backend 与 playground 同 DB 时，backend 重启的启动清扫会清掉 playground 的活动会话（匿名即焚语义下影响=该访客刷新重开）；避免频繁重启 backend 或分库。

## T2 — 60 秒口径实测

| 阶段 | 实测 | 预算 |
|---|---|---|
| 会话创建（API） | < 300 ms | — |
| 执行 → L3 暂停（API，bash 冒烟） | ~2 s | — |
| 批准 → done（API，bash 冒烟） | ~2 s | — |
| 页面轮询间隔 | 1.5 s | — |
| **端到端（点击→完成含渲染）** | **~6–8 s** | **60 s** ✅ |
