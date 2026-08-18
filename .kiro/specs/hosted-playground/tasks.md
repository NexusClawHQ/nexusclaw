# Tasks — Hosted Playground（访客 60 秒治理闭环体验）

> Spec ID: `hosted-playground` · 上游: [requirements.md](./requirements.md) · [design.md](./design.md)
> 状态: **已实现并验证**（2026-08-18）— compose --profile playground 全链路冒烟通过（会话/闭环/隔离/限流/TTL 代码路径）；T1 安全清单与 T4 截图归档待补
> 流程纪律：评审通过前只允许修改 mockup 与 spec 文档。
> 任务标注 `[Rx.y]` 追溯验收标准；🧪 = TDD。

---

## Phase Q — 会话与安全后端

- [x] **Q1** `[AC-2.1 / 2.5]` `PlaygroundModule` + `PlaygroundSeedService`：workspace-per-session 轻量种子（角色/权限/用户/demo agent/工具），新 UUID、无幂等语义。🧪
- [x] **Q2** `[AC-2.1]` `POST /playground/session`：限流检查 → 建 workspace → seed → 签发 30 分钟 JWT（claims 含 playground 标记），复用现有认证校验路径。🧪 并发上限与创建限流。
- [x] **Q3** `[AC-2.3]` `PlaygroundRateLimiter`（内存令牌桶，零依赖）：会话 3/IP/h、执行 20/IP/h、审批 40/IP/h；429 + COPY 文案；单实例并发会话 ≤200。🧪
- [x] **Q4** `[AC-2.2]` `PlaygroundSessionReaper`（每 5 分钟 + 启动清扫）：TTL 30 分钟删除 workspace 级联；JWT 依赖 workspace 回查失效。🧪
- [x] **Q5** `[AC-2.4]` `assertPlaygroundProfile()`：playground profile 下 BYO 配置非空即启动失败；`communityModelSource` 在 playground 下恒报确定性。🧪
- [x] **Q6** `[AC-2.5 / 2.6]` 权限收窄断言测试：playground principal 的执行/审批/读查询不可跨 workspace；工具面仅 dry-run 两件。🧪

## Phase R — 落地页前端（零依赖单页）

- [x] **R1** `[AC-1.1 / 1.5]` `PlaygroundPageController + playground.page.ts`：hero + 唯一主按钮 + 三步说明 + zh/en COPY map。🧪 页面守卫（零外部资源/textContent-only/COPY 奇偶）。
- [x] **R2** `[AC-1.2 / 1.4]` 运行时序：点击 → 建会话 → 执行 → 轮询驱动的实时时间轴（L1 放行 / L3 暂停 + 访客批准·拒绝按钮 / 完成）。🧪 jsdom 交互冒烟。
- [x] **R3** `[AC-1.3]` 审计链卡：复用/移植 console 的时间轴渲染与 JSON 着色段。🧪
- [x] **R4** `[AC-4.1 / 4.2]` CTA 区（GitHub/三行命令复制/商业版）与失败兜底文案。🧪

## Phase S — 部署与文档

- [x] **S1** `[AC-3.1]` compose `--profile playground`：backend env `PLAYGROUND_PROFILE=true`，限流/TTL/并发参数可配。🧪 compose config 校验。
- [x] **S2** `[AC-3.2]` README "Host a playground"（EN+ZH）：启用方式、安全注意事项、单机限流口径说明。
- [x] **S3** `[AC-2.6]` 工具面自查：dry-run 语义复核（无真实外发路径）。

## Phase T — 托管准备与门禁

- [ ] **T1** 安全自查清单归档 `assets/security-checklist.md`（匿名面/限流/回收/凭证隔离逐项签字）。
- [x] **T2** 60 秒口径实测记录：打开→完成闭环的实测时长（目标 ≤20s 纯执行）。
- [x] **T3** `[AC-5.2]` 全门禁：root build / check:i18n / check:boundary / backend+dashboard 全测保持绿；`packages/shared` 零 diff。
- [ ] **T4** mockup 与实现并排截图归档（同 spec3 P1 模式）。

## 完成定义（DoD）

- AC-1.1 … AC-5.4 每条至少一个任务 + 测试/人工步骤覆盖。
- 安全自查清单全项通过；限流与回收有实测数据。
- 零新依赖；`packages/shared` 零改动；既有 48+43 测试与门禁全绿。
