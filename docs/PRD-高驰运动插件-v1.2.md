# 高驰运动插件 PRD v1.2 —— 指令生成训练计划

| 项 | 内容 |
| --- | --- |
| 版本 | v1.2 |
| 状态 | 已定稿，进入实现 |
| 前置版本 | v1.0（首版只读面板）、v1.1（工具面与迭代定档） |
| 范围 | DSH 桌面端插件 `dsh-coros-sport` |
| 结论 | 功能成立；首版产出「会话内计划文本」，**不写入 COROS** |

---

## 1. 背景与问题

用户原话诉求：

> 安装插件后，支持用户通过 dsh 指令 + 提示词生成训练计划；当没有训练安排时，可以引导用户创建一个训练计划；用户点击创建，打开一个新会话，自动选择指令。

这句话混了两件价值与风险完全不同的事，必须先拆开：

| 拆分 | 内容 | 真实价值 | 风险 | 本版处置 |
| --- | --- | --- | --- | --- |
| **A. 入口与引导** | 空态 CTA → 新会话 + 预填提示词 | 把「看到空面板不知道做什么」的死路，变成有下一步的路径 | 低（无写操作） | **做** |
| **B. 生成并写入 COROS** | 调用 `createTrainingPlan` 落库 | 用户最终想要的（手表里有计划） | 高（推翻只读承诺 + 写工具未实测） | **不做**，留 v1.3 |

### 1.1 为什么首版不写回 COROS（三条硬理由）

1. **推翻对外承诺**：`README.md:7` 与 `README.md:120` 两处承诺「只读，不会修改你的训练计划或运动记录」。
2. **已被定档 M2**：工具暴露（F17）与写回（F20a）在 `docs/PRD-高驰运动插件-v1.1.md:151`、`:155`、`:170`。
3. **写工具真实效果从未验证**：`docs/PRD-高驰运动插件-v1.1.md:563`。

### 1.2 一个必须先修的现存缺陷

空态文案与判据不一致：

- 判据：`lib/client.js:1265` 的 `!data || data.empty || entries.length === 0`
- 数据来源：`lib/index.js:115` 调用 `queryTrainingSchedule` **不带参数**
- 工具契约：省略日期 = **本自然周周一至周日**
- 文案：`lib/client.js:56`「该账号还没有训练计划」

于是「有计划但本周休息」的用户会看到「还没有训练计划」。若在此基础上加 CTA，会把这类用户引导去创建**重叠计划**——而 `createTrainingPlan` 是新建而非合并。

**这是本版的第一优先级，与是否新增功能无关。**

---

## 2. 目标用户与场景

| 项 | 内容 |
| --- | --- |
| 谁 | 已装本插件、已登录 COROS 的自用型/开发者用户（同 v1.1 §2.1） |
| 场景 1 | 首次装插件，打开面板是空的 —— 最低意图 |
| 场景 2 | 旧计划刚结束 / 换季 / 新赛季备战 —— 最高意图 |
| 场景 3 | 比赛报名后需要一份周期化安排 |

**未验证的假设**：目标用户多数已有官方教练给的计划，空态命中率可能偏低。若真实命中率低，本功能优先级应让位给「查看/调整现有计划」。该假设需实测校验，**不得当作结论**。

---

## 3. 空态判定口径（本方案最关键的决定）

现状把四种不同状态折叠成了一句账号级断言。本版拆分为四态（下表判据即 `lib/client.js` 中 `ScheduleSection` 的实际代码）：

| 状态 | 判定条件 | 文案 | 给 CTA？ |
| --- | --- | --- | --- |
| **S0 加载中** | `!data && props.loading` | 骨架屏 | 否 |
| **S1 从未创建过计划（D3）** | `library.conclusive === true && library.empty === true` | 「你还没有训练计划，可以生成一份」+ 边界声明 | **是** |
| **S2 有计划但本周期无课（D2）** | `library.conclusive === true && library.empty === false`（卡片 meta 显示「共 N 个计划」） | 「本周暂无训练课」 | **否** |
| **S3 判定不了** | `library` 缺失、`conclusive !== true`，或板块级请求失败 | 「本周暂无训练课」/ 错误块 + 重试 | 否 |

**为什么 CTA 只给 S1**：`createTrainingPlan` 是新建而非合并，工具契约明确要求「存在重叠进行中计划时必须先解释风险并让用户确认」。给「有计划但本周休息」的用户推 CTA，等于生产重叠计划。

**为什么 S3 不能降级成 S1**：计划库查询失败，或返回的措辞无法证明覆盖了全部状态时，「查不到」不等于「不存在」。S3 一律保持中立 —— 漏给一次入口只是少一个按钮，错给一次入口会产生重叠计划。

**D2 的观察窗口 = 14 天**：与 `createTrainingPlan` 的 `planStartDate` 必须落在 `[今天, 今天+14 天]` 的约束天然对齐。

**D3 的数据来源**：`queryTrainingPlanLibrary` 传 `statusList: [0, 1, 2]`（全部状态），并由 `conclusive` 校验返回措辞确实覆盖了这三种状态（见 §7.2）。

---

## 4. 端到端路径

```
面板空态(S1) → [生成训练计划] → startSession(prompt=完整模板) → 新会话草稿就绪
   → 用户改三个填空 → 发送 → 模型生成计划文本 → 用户自行录入 COROS App
```

| 步 | 实现 | 风险 | 降级 |
| --- | --- | --- | --- |
| 1 空态 | 四态拆分，S1 加 CTA | 误判 → 重叠计划 | 见 §3 |
| 2 点击 | `ctx.uiWorkspace.startSession(undefined, { prompt, whenDraftExists: 'replace' })` | 无 Workspace 时不建会话 | 用户看到「请先选择工作区」提示 |
| 3 新会话 | `startSession` → `openWorkspace` → `prepareDraft` → `requestDraftInitialization` | 准备失败 | toast「暂时无法填入草稿」 |
| 4 指令 | **不承诺 chip**，prompt 传纯文本，Enter 仍按命令裁决 | chip 不渲染 | 显示 `/coros-plan …` 文本，回车照常当命令 |
| 5 补提示词 | 预填三项填空 | 空白指令 → 模型乱编 | 模板含默认值 |
| 6 结果 | 会话内文本 + 明确「未写入 COROS」声明 | 用户以为写进手表 | 文案 + README 双声明 |

### 4.1 关键设计决定：模板写进 prompt，不依赖 chip

用户原话要求「自动选择指令」。经核验：

- `startSession` 的 `prompt` 路径**只接受纯文本**（`dsh-client-ui-conversation/lib/client.js:15110-15125` → `setDraft(string)`）。
- 结构化草稿能力**确实存在**（同文件 `:15037-15048`，schema `z.object({token})` 在 `:4346`），但 `conversation.input.shell(id)` 未被 README 承诺为公开 API。

**因此本版把完整提示词模板直接写进 prompt**，使功能在 chip 完全不渲染时依然完整可用。chip 作为可选增强，不作为验收项。

---

## 5. 指令设计：`/coros-plan`

```js
ctx.inject(['commands'], (commandCtx) =>
  commandCtx.effect(() =>
    commandCtx.commands.register({
      name: 'coros-plan',
      description: '读取高驰账号的训练数据，并结合你的提示词生成一份训练计划',
      input: { hint: '训练目标，例如：6 周后跑完 10 公里' },
      handler: ...
    }),
  ),
)
```

**`input` 必须声明**：`dsh-client-ui-commands/lib/client.js:1578` 的 `if (desc.input !== void 0)` 才产生 claim，不声明则永远不会有 chip。

**为什么用 `ctx.inject` 而不是模块级 `inject`**：见 §7.1 第 4 点 —— 模块级 `inject` 缺 `commands` 会让整个插件连带面板一起不加载。

### 5.1 提示词模板必须内置的四件东西

1. **边界声明**：生成的是建议文本，不会写入 COROS。
2. **三项填空**：目标赛事/目标、期望周数（4–16）、每周可训天数。
3. **`createTrainingPlan` 硬约束摘要**：周数 4–16、起始日 ≤14 天、仅跑/骑/越野、不支持力量训练。
4. **要求先检查重叠**：即使本版不写库，用户拿着文本去 App 录入同样会撞重叠。

### 5.2 本版不做

- 面板内一键生成（需跨插件结果回写契约，宿主未提供）。
- 提示词注入真实体能/恢复数据（`ctx.commands.register` 在服务端可 `runTool`，但 handler 能否 `agent.followup` 未验证，成本未知）。

---

## 6. 需求清单

| ID | 需求 | 优先级 | 价值证据 | 验收标准 |
| --- | --- | --- | --- | --- |
| **R1** | 空态四态拆分 + 双文案 + 加载态不显示空态 | P0 | 现存口径冲突；加载中闪空态 | 有计划账号看不到 CTA；加载中不出现空态文案 |
| **R2** | S1 空态加 CTA + 「不写入 COROS」声明 | P0 | 空态当前是纯文本死路 | 点击 → 草稿就绪；含边界声明；zh/en 双语 |
| **R3** | 服务端加 `queryTrainingPlanLibrary` 用于 D3 判定 | P0 | 无此数据无法区分 S1/S2 | S1/S2 判定准确；单查询失败不影响其他区块 |
| **R4** | 注册 `/coros-plan`（声明 `input`） | P0 | 用户诉求的「dsh 指令」那一半 | 命令在 `/` 菜单可见且可执行 |
| **R5** | 点击 → `startSession` + 完整模板 prompt | P0 | 用户诉求核心 | 有工作区：会话+草稿就绪；无工作区：明确提示不静默 |
| R6 | chip 自动选中 | P1 | 体验提升，非成立项 | 命令声明 `input` 后 chip 渲染；失败退化为文本且回车仍按命令执行 |
| R7 | ~~提示词注入真实体能/恢复数据~~ | **已完成**（随 R4 一起） | 质量提升，非成立项 | handler 内 `collectOverview` + `buildPlanBriefing` 把真实数据写进 followup 消息 |
| R8 | 结果写回 COROS | P2（M2） | 价值最高 | 需先改 README 与 PRD 定档 + 确认流 + 回读校验 |
| R9 | 面板内一键生成 | P2 | — | 跨插件契约缺失 |

---

## 7. 改动面

| 文件:位置 | 改动 |
| --- | --- |
| `lib/index.js:35` | **不**改模块级 `inject`（仍为 `['webServer']`）；命令注册包在 `ctx.inject(['commands'], …)` 里（见 §7.1 第 4 点） |
| `lib/index.js:105-132` | 加 `planLibrary` 并行 job |
| `lib/index.js`（apply 尾部） | `ctx.commands.register(...)` |
| `lib/coros-api.js`（末尾） | 新增 `parseTrainingPlanLibrary` |
| `lib/client.js:1806` | **不** inject `'uiWorkspace'`，改为 `ctx.get('uiWorkspace')` 惰性可选读取（见 §7.1） |
| `lib/client.js:1246-1272` | `ScheduleSection` 四态分支 + CTA |
| `lib/client.js:1782-1804` | apply 内加创建 handler |
| `lib/client.js:56`、`:117` | zh/en 新文案 |
| `cordis.patch.yml` | **无需改动** |
| `package.json` | 可选加 `peerDependencies` |

**不需要新依赖**：`commands` 与 `uiWorkspace` 均由宿主 bundle 提供。

### 7.1 实现期偏离 PRD 的四点

1. **`uiWorkspace` 不写进 `inject`**。PRD 原计划 `inject` 加 `'uiWorkspace'`。实测 `ctx.get(name)`（`cordis/lib/index.js:763-772`）在服务缺失时返回 `undefined` 而非抛错，且动态插件门面 `dsh-cordis-client-runner/lib/client.js:328-352` 的 `ctx.get` 走 `readService(name, false)` 不要求声明。写进 `inject` 的代价是：宿主若改名，整个面板会被 parking；而 CTA 只需降级成一条提示。故改为惰性读取 + 分支降级。
2. **空态判据从 `empty` 改为 `conclusive && empty`**。见 §7.2，这是实测推翻原设计的一处。
3. **`/coros-plan` handler 在服务端直接 `runTool` 后 `followup`**，而不是像 PRD 假设的「把模板塞进 prompt 让模型自己查」。理由：插件本就没有向会话侧暴露 COROS 工具（`lib/index.js` 全仓无 `ctx.tools` 注册），模型无从查起；服务端已有带 401 重试的 `runTool`，取数成本可控。R7（注入真实数据）因此**顺带完成**，不再是 P1。
4. **`commands` 用 `ctx.inject(['commands'], …)` 局部注入，不写进模块级 `inject`**。写进模块级 `inject` 会让未装 `@deepseek-ai/dsh-commands` 的 profile 把**整个插件**判为未就绪 —— 连只读面板一起消失，代价远大于失去一条指令。模型来自 `dsh-agent-preset/skills/cordis-plugin-development/references/practices.md:20`（「Put optional services in `inject` or `ctx.inject([...], ...)` so the plugin stays inactive in profiles without them」）与 `dsh-agent-tool-presentation/lib/index.js:42`、`dsh-api-gateway/lib/index.js:772-775` 的既有写法。`.review-probe/host-smoke.mjs` 对此有断言：无 `commands` 时仍注册 6 条路由，命令被 parking。

### 7.2 实测推翻原设计：计划库的「空」是散文且措辞随过滤条件变化

原 PRD 假设 `queryTrainingPlanLibrary` 返回结构化的空标志。实测（真机、真 token、`statusList=[0,1,2]`）返回的是一句散文：

```
No training plans found in the user's plan library for status filter:
not started, in progress, completed (all; statusList=[0,1,2]).
```

而**不带** `statusList` 时是另一句，含义完全不同：

```
No in-progress training plans found (statusList omitted, server default [1]).
Not-started library originals and completed plans were not searched. ...
```

第二句只能说「没有进行中的计划」，不能证明库是空的。若把两句都当空，就会给**已有计划**的用户显示创建入口 —— 正是 §3 要避免的失败方向（`createTrainingPlan` 是新建而非合并，会叠出重叠计划）。

因此 `parseTrainingPlanLibrary` 返回 `{ empty, conclusive, total, inProgress, plans, raw }`，其中 `conclusive` 只在「解析出计划」或「文本自证覆盖了全部状态」时为真：

```js
const scope = /for status filter:\s*(.+)$/im.exec(source)
const coversWholeLibrary =
  scope !== null && ['not started', 'in progress', 'completed'].every((s) => scope[1].toLowerCase().includes(s))
const conclusive = plans.length > 0 || (negative && allStatuses && coversWholeLibrary)
```

调用方声称的 `allStatuses` 必须与服务端自己的措辞一致，只信声明会误判（回归用例已验证：单靠 `allStatuses` 会让 `completed-only` 的回复被当成空库）。面板只在 `conclusive !== true` 时归入 S3 中立空态。

---

## 8. 风险

| 风险 | 影响 | 触发条件 | 可推翻的证据 |
| --- | --- | --- | --- |
| A 空态命中率低 | 功能价值缩水 | 目标用户多已有计划（未验证） | 实测 3 个账号的 `queryTrainingPlanLibrary` |
| B 用户误以为已写入 COROS | 信任损失 > 功能价值 | 文案无边界声明 | 5 人访谈出现「已同步」类误解 |
| C 无 Workspace 走不通 | 该路径完全不可用 | `dsh-client-ui-workspace/lib/client.js:1510-1517` | 真实环境点一次 |
| D chip 依赖无契约 API | 升级后静默失效 | 宿主版本升级 | 宿主补类型声明 |
| E 不可度量 | 无法验证成败 | Web 端不挂载 `productAnalytics` | 能证明 `ctx.get('productAnalytics')` 可用 |
| F 建完面板不刷新 | 用户误判「没生效」 | `load()` 仅挂载时跑（`lib/client.js:1590`） | 本版无写入，暂不触发；R8 时必须修 |
| **G 空库文案漂移** | 误判 S1，给已有计划者叠出第二个计划 | 服务端改写散文措辞（`§7.2` 已实测到同一工具两种措辞） | 出现「有计划却被判定 empty」的实例报告 |
| **H 服务端返回结构与解析器假设不符** | 计划列表解析为 0 条 → 误判 S1 | 真实库里有计划时字段排版与本机空库样本不同（**本机库为空，非空样本未实测**） | 用有计划账号跑一次 `.review-probe/plan-lib-live.mjs`（打印字段键名，不打印数据） |

---

## 9. 验收清单

下表区分**已在代码/真机验证**与**仍待人工验证**两栏，避免把「写完」当「验完」。

| # | 动作 | 完成标准 | 状态 |
| --- | --- | --- | --- |
| 1 | S1/S2 判定 | 无计划账号看得到 CTA（真机确认为 S1），有计划账号看不到 | **部分**：本机空库 → S1，已实测；有计划账号 → S2 未实测（风险 H） |
| 2 | 加载态 | 首屏不出现空态文案 | **代码已改**：`!data` 分支先看 `loading`；待视觉确认 |
| 3 | 命令注册 | `/coros-plan` 出现在 `/` 菜单且可执行 | **待人工**：需重启桌面端 |
| 4 | CTA 全链路 | 点击 → 新会话 → 草稿含 `/coros-plan ` | **待人工**（`startSession` 返回 void，无法自动断言） |
| 5 | 无工作区 | 有明确提示，非静默 | **代码已改**：宿主 toast + 面板 `planCreateUnavailable` 双保险 |
| 6 | 双语 | zh/en 文案齐全 | **已验证**：全文件无 `noSchedule` 残留，5 个新键双语齐备 |
| 7 | 边界声明 | CTA 旁与 README 均写明「不写入 COROS」 | **已完成**：`planEmptyHint` 内含声明；README 三处（首段/使用节/隐私节） |
| 8 | 解析器回归 | 三种真实措辞 + 有/无计划共 8 组用例全绿 | **已完成**：`node .review-probe/parse-plan-test.mjs` → ALL PASS |

---

## 10. 未验证与开放问题

**未验证**：chip 在真实时序下是否渲染；`conversation.input.shell(id)` 是否为公开 API；命令目录在「新建会话 + 立即预填」时序下是否已 ready；空态真实命中率；用户对「只出文本」的接受度。

**已解除的未验证项**（本轮实测）：
- ~~handler 能否 `followup`~~ → 可以。`agent.followup(message)` 进入 `dsh-agent-loop` 的 next-turn 队列，`message.id` 唯一即可，无需宿主包（见 `.review-probe` 中 `createTextMessage` 手写等价物）。
- ~~空库返回文本的措辞~~ → 已取到真实措辞，且发现同工具两种措辞，已据此加 `conclusive`（§7.2）。
- ~~`ctx.get('uiWorkspace')` 是否安全~~ → 安全，服务缺失返回 `undefined`，不抛错。

**仍然未验证的**：
- **非空计划库的真实文本排版**（风险 H）。本机账号计划库为空，只验证了「空」的两种措辞；「有计划」时的字段行格式按同族工具（`queryTrainingSchedule` / `queryDevices` 的 `N. 标题` + 缩进 `Key: value` 样式）推断。若有计划账号返回不同排版，`total` 会算成 0 → 误判 S1。**建议上线前用一个有计划账号跑一次 `.review-probe/plan-lib-live.mjs`**（它会打印字段键名，不打印运动员数据）。
- 点击 CTA 的完整链路（需要重启桌面端手动点一次）。

**本版已定**：CTA 口径采用 D3（S1），避免重叠计划；首版接受「只出文本、不写入 COROS」。

**待验证的开放项**：若实测空态命中率过低，应把资源转向「查看/调整现有计划」。
