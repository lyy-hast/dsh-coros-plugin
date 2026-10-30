# 高驰运动插件（DSH Desktop）· 需求文档 v1.1

| 项 | 内容 |
|---|---|
| 文档名称 | 高驰运动插件需求文档（首版范围） |
| 版本 | **v1.1** |
| 状态 | **决策已闭合**（3 项拍板完成，见 §7）；S-1 / S-3 两个 spike 待执行 |
| 评审方式 | 产品方案评审团三方独立评审（产品经理 / UX 研究员 / 软件架构师）后由协调者合成 |
| 评审日期 | 2026-10-30 |
| 代码仓库 | `D:\Project\dsh-coros-plugin`（当前无业务代码，仅评审探针） |
| 目标平台 | DeepSeek Harness Desktop（Electron，profile `C:\Users\lykan\.dsh\profiles\desktop`） |
| 对接系统 | 高驰（COROS）官方 MCP 服务 |
| 上一版本 | `PRD-高驰运动插件-v1.0.md`（已归档，不再维护；本文档为唯一现行版本） |

> **本文档不给工期、不给人力配置、不给转化率目标。** 团队未提供排期与人力输入，任何时间承诺在现有信息下都是编造。文中「必须 / 建议 / 暂缓」是价值与约束判断，不是工作量承诺。

### 怎么读这份文档

| 你是 | 先读 | 再读 |
|---|---|---|
| 需求方 / 产品 | §1、§4.2 锁死范围、**§7 拍板结论与遗留复核** | §11 验收标准、§15 行动清单 |
| 设计 | §2 用户与场景、§5.5 信任设计、§5.6 状态机 | §10.4 可访问性、§11 |
| 开发 | **§8.1 三个阻塞单点**、§5.2 路径阶梯、§6 数据契约 | §10 非功能需求、附录 A 证据索引 |
| 只想判断「能不能做」 | **§8.2 Go/No-Go 闸门** | §12 风险登记册 R1 |

> **v1.1 的一句话**：三项决策已闭合，登录有三条互不依赖的可行路径（任意一条跑通即 Go）；**唯一还没被证明的是「哪一条在你的环境里真的能跑通」**——先做 §8.1 的 S-1 spike，再写业务代码。

### 目录

[§0 变更记录](#0-变更记录) · [§1 背景与目标](#1-背景与目标) · [§2 目标用户与场景](#2-目标用户与场景) · [§3 原始需求与拆解](#3-原始需求与拆解) · [§4 首版范围决策](#4-首版范围决策) · [§5 登录闭环方案](#5-登录闭环方案) · [§6 数据契约](#6-数据契约) · [§7 拍板结论与遗留复核](#7-拍板结论与遗留复核) · [§8 里程碑与闸门](#8-里程碑与闸门只给顺序与判据不给工期) · [§9 暂缓项复活条件](#9-暂缓项的复活触发条件) · [§10 非功能需求](#10-非功能需求) · [§11 验收标准](#11-验收标准) · [§12 风险登记册](#12-风险登记册) · [§13 开放问题](#13-开放问题与待补材料) · [§14 未覆盖范围](#14-未覆盖范围明确声明) · [§15 行动清单](#15-行动清单) · [附录 A 证据索引](#附录-a评审证据索引)

---

## 0. 变更记录

| 版本 | 日期 | 变更内容 | 变更原因 |
|---|---|---|---|
| v1.0 | 2026-10-30 | 首版落成。15 章 + 附录，3 项决策待拍板，工具清单取本地目录 22 个 | 三方评审合成 |
| **v1.1** | 2026-10-30 | ① §7 三项决策全部拍板并结案<br>② §6.2 工具清单 **22 → 34**，新增写工具 8 个；本地目录判定为**已过期**<br>③ §4 F20 由「暂缓（且不可做）」改判为**训练计划分组 F20/F20a–F20d**，读写分离定档<br>④ §5.2 登录路径阶梯**重排并新增标准设备码路径**；L3 系统浏览器从「需签字」升级为「已授权」<br>⑤ §6.1 补 `/oauth2/device_authorization`、`/oauth2/revoke`<br>⑥ §8.1 V0 槽位确认闭合（`sidebar.panellist`，order 5）<br>⑦ §11.3 需求 4 改为「允许一次系统浏览器」的措辞 | 需求方三项拍板（m00099）+ 高驰官方文档核验 |

> **口径变化须知（最重要的一条）**：v1.0 的核心结论之一是「本地工具目录 22 个全部只读，无 write 工具」。**该结论已被推翻**——本地目录抓取于 2026-08-09 且已过期，高驰官方 `docs/zh/tools.md` 现有 34 个工具、含 8 个写工具。凡引用了 v1.0「无写能力」的段落，一律以本文档 §6.2 为准。

---

## 1. 背景与目标

### 1.1 背景

高驰（COROS）已发布官方 MCP 服务（`coroslab/COROS-MCP`），把设备、运动、健康、训练计划等个人数据以 MCP 工具形式开放。DSH Desktop 用户若想使用这些能力，当前必须手工完成：找到 MCP endpoint → 理解鉴权方式 → 自行完成 OAuth 授权 → 在 profile patch 里写配置 → 重启。这条路径对非开发者不可行。

### 1.2 产品目标

**把「配置 MCP + 登录高驰账号」这件事，变成「装完插件点一下就可用」。**

一句话定义：安装插件即完成 MCP 对接，点开侧栏「高驰运动」入口即可在插件内完成登录，登录后直接看到自己绑定的设备、最近的运动/健康数据与当前训练计划。

### 1.3 成功判据（非量化，先立结构）

首版成立的最小证据链为一条四步闭环：

> **装插件 → 点侧栏入口 → 完成登录（≤1 次系统浏览器窗口） → 看到设备列表 + 最近 7 天运动**

四步中任一步断裂，本次需求即不成立。

### 1.4 明确不做（首版范围之外）

- 服务端登出/吊销的**平台级**保证（DSH 平台侧无此能力；高驰侧虽有 `/oauth2/revoke`，但仅本地调用，不承诺全局失效，见 §5.7）
- 登录中途刷新页面后的流程恢复（DSH 平台限制）
- 路线文件上传（`uploadRouteFile`）、FIT 批量下载（配额受限，见 §9）
- 后台常驻同步与推送
- 多账号、离线缓存、图表趋势
- 修改已在日历上的历史训练记录（高驰侧限制：改期/移除必须去 App）

---

## 2. 目标用户与场景

### 2.1 目标用户

| 用户群 | 覆盖情况 | 依据 |
|---|---|---|
| 有 COROS 设备 + 使用 DSH Desktop 的自用型/开发者用户 | **主目标，闭环可行** | 需求原文 + 环境事实 |
| 用手机号/微信在 COROS App 注册、无邮箱密码 | **结构性阻断，无法闭环** | 高驰授权页仅有「邮箱 + 密码」表单，全页无扫码、无短信验证码、无微信/Apple 登录（已逐词核对 i18n 资源）。设备码路径**不解除**该阻断——它只是换个地方输这组邮箱密码 |
| 忘记密码的用户 | **结构性阻断**（被踢回 App 重置） | 页面「忘记密码」仅弹 `alert`：「Please reset your password on the COROS app login page.」 |
| 非中国大陆地区用户 | 可用，但需处理地区/跨地区弹窗 | 授权页自带 `This integration is not available in your region` 与 `data-region` 属性；CN/EU/US 三区域端点均可达 |
| 装了插件但无 COROS 设备 | 需空态设计 | 假设，未验证 |

> **需求原文措辞需修正（v1.0 提出，v1.1 维持）**：「点进入口即可在内部完成登录闭环」对上述「结构性阻断用户群」**永远不成立**。建议改写为：**「对已有高驰邮箱账号的用户，在插件内完成登录闭环；其余用户给出明确出口指引。」**

### 2.2 核心用户旅程

登录方式取决于 §5.2 的选路结果，S2–S3 有两个变体。

| # | 用户步骤 | 期望的可见反馈 |
|---|---|---|
| S0 | 安装插件 → 重启 DSH | 左侧出现「高驰运动」入口 |
| S1 | 点击入口 | 打开高驰运动面板；未登录则显示登录引导 |
| **S2a**（设备码路径） | 点「登录」 | 面板内出现 `user_code` + 简短指引（手机打开某地址输入该码） |
| **S2b**（窗口内表单路径） | 点「登录」 | 面板内出现高驰授权页，可输入账号密码并提交 |
| **S2c**（系统浏览器路径） | 点「登录」 | 弹出一个系统浏览器窗口；DSH 面板显示「等待授权中」并给出可复制链接 |
| S3 | 授权完成 | 插件自动轮询/回跳，面板无需手动刷新即变为「已连接」 |
| S4 | 查看设备 | 显示绑定设备的名称/型号 |
| S5 | 查看运动/健康/训练计划 | 近 7 天概览 + 最近一次运动详情 + 当前计划周视图 |
| S6 | 一周后回来 | 仍是已登录态（令牌静默刷新），并显示「上次同步时间」 |

---

## 3. 原始需求与拆解

原始需求四条：

| # | 原文 | 拆解后 |
|---|---|---|
| R1 | 安装插件后，桌面端左侧上方功能栏出现「高驰运动」入口 | F1 插件可加载 + 侧栏入口 + F2 主页面容器 |
| R2 | 点击入口校验是否完成登录，未完成则需登录 | F3 登录态机 + F4 令牌刷新 + F5 登录闭环 + F6 失败出口 |
| R3 | 登录完成后展示绑定设备列表 + 用户运动/健康信息 | F8 设备列表 + F9 运动记录 + F12 健康总览 + **F20 训练计划只读** |
| R4 | **安装插件即对接高驰 MCP，点进入口即可在内部完成登录** | F5（硬约束，措辞按 §11.3 调整）+ F10（未登录不影响入口）+ F17（工具暴露给模型） |

> **术语澄清**：原文「点击入口教研cli是否完成登录」中的「教研cli」按「校验」理解（疑为输入误写）。若另有含义（例如「教研 CLI」指某个命令行工具），需需求方纠正后重开评审。

---

## 4. 首版范围决策

档位定义：

- **必须做**＝缺了首版就没有交付物，不通过即不可发布
- **建议做**＝边际成本低、明显抬升价值，做不完**不阻塞**首发
- **可暂缓**＝有价值但与首版风险/成本不匹配，进入 V2+

### 4.1 范围总表

| # | 功能项 | 档位 | 理由 | 不做的后果 | 验收信号 |
|---|---|---|---|---|---|
| **F1** | 侧栏「高驰运动」入口（`sidebar.panellist` 的 `id` + `main` keyed slot 配对，**order = 5**） | **必须** | 可发现性＝全部价值的入口。**V0 已闭合**：槽位为 `sidebar.panellist`（渲染为「全局面板」列表），按 `order` 升序；order=5 落在「插件市场」之后、「自动化任务」之前 | 需求 1 直接不成立 | 安装+重启后出现入口，≤2 次点击进面板；折叠态 56px 轨道下整列隐藏属平台既有行为，展开后可点；控制台无 `slot entry crashed` |
| **F2** | 插件主页面容器（未登录/已登录两态） | **必须** | 承载一切后续功能；`main` 是 keyed slot，必须与 F1 同 id | 无产品 | 点入口切页成功，无 slot crash |
| **F3** | 登录态机：未登录 / 已登录有效 / 已过期可静默刷新 / 刷新失败需重登 + 冷启动恢复 | **必须** | 过期是**本机实测常态**：本机缓存令牌 `expires_at_epoch` 对应 2026-09-08，评审时已过期约 52 天无人刷新（只有 CLI 会刷） | 第二次使用即流失，核心诉求自我否定 | 篡改本地令牌后重开，界面明确提示「需重新登录」，不白屏不转圈 |
| **F4** | 令牌自动刷新（access 30 天 / refresh 180 天，且**轮换**） | **必须** | 官方 FAQ Q11 明确；轮换意味着并发刷新会互相作废，必须单飞（single-flight） | 每月一次「莫名其妙掉登录」 | 手动置过期后自动续期成功，用户无感 |
| **F5** | **插件内登录闭环**（三条候选路径择一；见 §5） | **必须（待 S-1 判定选路）** | 唯一差异化。否则用户直接在 Claude/ChatGPT 里加 COROS 连接器即可，插件无存在理由 | 退化成「又一个只读仪表盘」，与高驰 App 竞争且输 | 按 §11.3 的需求 4 达成定义通过（**允许 ≤1 次系统浏览器窗口，不允许手工复制粘贴 token**） |
| **F6** | 登录失败的可读出口（密码错 / 无邮箱账号 / 忘记密码 / 地区不支持） | **必须** | 存在结构性阻断用户群，必须给出口指引而非死循环 | 用户卡死在表单里反复试 | 故意输错密码与点「忘记密码」，均出现**中文可执行下一步**（复制链接 / 去 App 重置 / 切换区域） |
| **F7** | 错误分态 + 重试（断网 / 401 / 超时 / 5xx / 未授权历史数据 / 授权被拒 / 授权码已被使用） | **必须** | 首版最高频故障是「连不上」，无分态既无法验收也无法支持 | 白屏或静默失败，用户直接卸载 | 每种失败有可区分文案 + 重试按钮 |
| **F8** | **设备列表**（`queryDevices`） | **必须** | 零入参、成本最低、诊断价值最高——它是「授权真生效」的第一证据 | 首版无任何「高驰」实感 | 首屏出现 ≥1 台设备名称+型号；无设备时显示「未绑定设备」而非空白 |
| **F9** | **近 7 天运动概览 + 最近一次运动详情**（`querySportRecords` + `getActivityDetail`） | **必须** | 官方把「查最近 7 天运动记录」写成接入后的**首个示例指令**，即官方认定的高频场景 | 用户看完设备型号无处可去，价值不成立 | 展示 ≤N 条记录（日期/类型/距离/时长）；0 条时明确空态；**前端必须补齐 10 个必填参数默认值**，不得因缺参报错 |
| **F10** | 未登录状态**不影响入口存在**（不依赖 MCP 首次连接成功） | **必须** | `templates/mcp/cordis.patch.yml` 默认 `failOnStartupError: true`，而 `apply()` 首连失败会 throw → 「未登录」这一必然初始态可能导致**整个 bundle 加载失败、连入口都不出现** | 装了插件看不到入口，最致命 | 未登录状态下入口仍在、页面可打开、错误可读 |
| **F11** | 空/少/错三态设计（未勾历史授权 / 天粒度数据 / 无设备无记录） | **必须** | 三种情况首版必撞：24h 历史授权是**可选勾选**；健康数据是**天粒度**；新用户必然无记录 | 首登即挫败 | 未勾历史授权的账号首登不报错，显式提示「未授权历史数据」 |
| **F12** | 每日健康总览（`queryDailyHealthData` + `queryRecoveryStatus`） | 建议 | 同鉴权同分页，边际成本低；但字段/单位/时区需先取真实返回 | 价值略薄，不影响闭环成立 | 展示 ≥1 项指标 + **数据日期** + 单位，且与 MCP 原始返回一致 |
| **F13** | 「上次同步时间」+ 手动刷新按钮 | 建议 | 天粒度数据下，「没更新」的错觉是必然投诉点 | 用户反复重开插件 | 点击后 3s 内状态可见变化 |
| **F14** | 区域兜底（CN / EU / US 手动切换） | 建议 | 官方 FAQ Q4 **自认**「部分平台不支持域名重定向导致 URL 无效」并给区域独立地址；授权页自带地区弹窗 | 一批非 CN 用户「连接失败」且无法自救 | 默认全局地址失败时可切区域并成功连接 |
| **F15** | 退出登录 / 切换账号 | 建议 | 本地 `deleteRecord` + 可选调用高驰 `/oauth2/revoke`；但**文案不得承诺全局失效** | 换号无解、售后成本高 | 登出回未登录态，重启后仍为未登录 |
| **F16** | 设置页卡片（endpoint / 传输方式 / 超时 / 区域 / 登录方式） | 建议 | 生态惯例（connect-* 系列插件全部用 `settings.section`），排障必需 | 无法自助排障 | 设置页可见可改，重载后生效 |
| **F17** | **把 COROS 工具以 `coros_*` 暴露给模型** | 建议（**M2**） | 若不对模型开放，「对接 MCP」只剩一张只读报表，放弃大部分想象空间。但与 F10 的 `failOnStartupError` 风险耦合，同时做会放大首发风险 | 插件被压成仪表盘 | 对话中「查最近 7 天跑步」，模型调工具并返回与高驰 App 一致的数据 |
| **F18** | 图表 / 趋势 / 多日对比 / 全量历史 | 暂缓 | 纯增值，需设计投入，不解决「能不能用」 | 无 | 见 §9 |
| **F19** | 健康全景（睡眠分期明细、HRV 明细、训练负荷、体能评估、压力时序） | 暂缓 | 工具已具备，但呈现口径需 UX 先定，且依赖 F12 稳定 | 无 | 见 §9 |
| **F20** | **训练计划只读**（`queryTrainingPlanLibrary` + `queryTrainingPlanDetails` + `queryTrainingSchedule`） | 建议 | 官方把「创建一个 8 周训练计划」「明天安排一节轻松跑」列为接入示例，训练计划是官方认定的核心场景；只读版零数据风险，且是全部写回功能的**前置**（不先看清现有计划就写回＝盲改） | 首版只剩「看数据」，与写回能力断档 | 显示当前计划的周视图（`queryTrainingPlanDetails` 窗口 ≤28 天），空缺时明确空态 |
| **F20a** | 训练计划创建 / 修改（`createTrainingPlan` / `updateTrainingPlan`） | 建议（**M2**） | 会**变更用户高驰账号数据**，必须先有确认流与撤销说明；官方约束密集（4–16 自然周、开始日期今天至 +14 天、退出计划必须去 App） | 错过社区最热需求 | 见 §9；启用前必须具备「提交前逐项确认 + 结果回读校验」 |
| **F20b** | 课程库与单次课程（`queryWorkoutLibrary` / `queryWorkoutDetails` / `createSingleWorkout` / `updateWorkoutDetails`） | 建议（**M2**） | 与 F20a 同风险等级；`queryWorkoutLibrary` 最多 50 条不支持分页，需先定呈现 | 无 | 见 §9 |
| **F20c** | 排课 / 改课（`scheduleWorkout` / `createScheduledWorkout` / `updateScheduledWorkout` / `queryScheduledWorkoutDetails`） | 建议（**M2**） | 日期仅今天至 +90 天；改期/移除必须去 App——**部分可逆**，需在 UI 写明 | 无 | 见 §9 |
| **F20d** | 路线文件上传（`uploadRouteFile`） | 暂缓 | GPX/KML 解析、文件落地、上传后需 App 内同步手表才生效——链路长且不可验证 | 无 | 见 §9 |
| **F21** | FIT 文件下载与解析 | 暂缓 | 官方硬配额 **50 个文件 / 24h**（与下载链接共用额度），且涉及 DSH 文件落地与解析 | 无 | 见 §9 |
| **F22** | 后台同步 / 推送 / 定时拉取 | 暂缓 | 增加常驻成本与隐私面，首版无证据需要 | 「数据不及时」投诉风险 | 见 §9 |
| **F23** | 多账号 / 多设备切换 / 离线缓存 / 工具目录浏览器 | 暂缓 | 典型 V2 范畴 | 无 | 见 §9 |
| **F24** | 双语 zh/en（`ctx.locale`） | 暂缓 | 平台惯例成本低，但非首版价值 | 无 | V2 补 |

### 4.2 首版最小交付定义

**M1 锁死范围**：F1 – F11 全部。

**M1 准入项**（做不完不阻塞首发）：F12、F13、F14、F15、F16、F20。

**M2（S-1 通过且 M1 稳定后）**：F17、F20a、F20b、F20c。

**一律不进首版**：F18、F19、F20d、F21、F22、F23、F24。

> **写回能力的定档说明**：F20a/b/c 全部进 M2 而非 M1，理由是「变更用户账号数据」需要确认流 + 回读校验 + 撤销口径三件配套，而这三件依赖 M1 的数据契约先冻结。若需求方要求写回进 M1，只需一句话确认，届时 §8.1 需增加一个 S-4「写回安全设计」闸门（见 §7.1 复核项 1）。

---

## 5. 登录闭环方案

### 5.1 为什么这是唯一的生死判定点

三条高层要求中，入口（R1）与数据展示（R3）都是可替代的常规 UI 工作。只有「点进入口即可完成登录」是差异化所在，也只它可能做不成。若登录闭环不成立，用户完全可以绕过本插件，直接在模型客户端里挂 COROS 连接器。

### 5.2 路径阶梯

v1.1 相对 v1.0 的最大变化：**新增标准设备码路径，并把 L3 系统浏览器从「需签字」改为「已获需求方授权」**。因此三条路径互不依赖，任一条跑通即可交付。

| 路径 | 用户体验 | 实现成本 | 支撑证据 | 阻塞风险 |
|---|---|---|---|---|
| **L1 标准设备码（RFC 8628 `device_code`）**〔首选〕 | 面板内显示 `user_code` + 地址 → 用户在手机或任意浏览器输码并登录 → 面板自动轮询变已登录 | **S**（纯 HTTP，无 iframe、无回环、无窗口） | OAuth 元数据实测含 `device_authorization_endpoint: /oauth2/device_authorization`，`grant_types_supported` 含 **`device_code`** | ①该 grant 对**动态注册 client** 是否开放（**未验证**）；②仍需在别处输邮箱密码，结构性阻断群不解除；③标准错误语义（`authorization_pending`/`slow_down`/`expired_token`）需正确实现 |
| **L2 iframe 嵌入授权页 + loopback 回调**〔体验最优〕 | 点登录 → **窗口内**出现高驰登录表单 → 提交 → 自动回跳变已登录 | M | 授权页 `https://opencn.coros.com/oauth2/authorize` 返回 **200，`x-frame-options`/`content-security-policy`/`referrer-policy` 全为 null，`getSetCookie()` 返回 `[]`**；`frame-loopback.html` 已验证 https 页面内嵌 http loopback iframe + `postMessage` 通路可用 | ①宿主页面 CSP `frame-src` 是否放行第三方 iframe（**未验证**）；②用户在窗口内输入高驰密码的信任成本（见 §5.5）；③`redirect_uri` 是否被改写（见 §5.4） |
| **L3 系统浏览器 + 本机回环回调**〔已授权，保底〕 | 弹一次系统浏览器，授权后自动回跳插件 | M | 平台官方同款形态：`webServer.register({kind:'exact'})` + `timingSafeEqual(state)` + 302，`@deepseek-ai/dsh-deepseek-account-platform` 就是这个形状 | 需宿主 CSP/回环端口可用；**需求方已明确接受该系统浏览器弹窗**（见 §7 决策 1），不再是阻塞项 |
| **L4 CLI login-session 私有轮询 + 票据换码**〔劣于 L1〕 | 窗口内展示链接/二维码 → 手机授权 → 插件轮询自动变已登录 | S–M | `POST https://mcpcn.coros.com/api/v1/cli/login-sessions` → 200 `{sessionId, pollToken, loginUrl, expiresAt, intervalSeconds:3}`（**已实测**，见 `.review-probe/session.json`）；官方 Skill `coros_mcp_login_gateway` 走的就是这条路 | ①会话寿命实测 **≈301s**；②错误 `pollToken` claim 返回 **HTTP 200 `{"status":"expired"}` 而非 4xx**——朴素 `if (!res.ok) throw` 会把过期当成功分支，界面永远转圈；③属官方未文档化的私有接口，可能无预警变更 |
| **L5 手动粘贴 token**〔兜底〕 | 用户在他处取 token 回插件粘贴 | S（最便宜） | `session.prompt({kind:'secret'})` 原生支持 | 体验最差；token 生命周期与安全不可控 |
| **L6 改 DSH 外壳（asar patch / 自建 BrowserWindow）** | 可真·零跳转 | XL + 持续维护债 | `dsh-tray-restart/asar-patch.js` 是既有但高风险先例 | **否决**：破坏升级，不应作为产品路径 |

### 5.3 选定策略

> **按 L1 → L2 → L3 顺序试；第一个跑通的即为产品路径。L4 仅在 L1–L3 全部不可行时启用；L5 仅作手工兜底入口；L6 否决。**

选路判据只有一条：**必须在写第一行业务代码前，用 S-1 spike 拿到活证据**（见 §8）。三条路径互不依赖，这意味着**需求 4 的 Go/No-Go 风险已从「单点」降为「三选一」**——这是 v1.1 最重要的风险改善。

### 5.4 一个必须提前处理的协议细节

v1.0 的记录：`mcpcn/oauth2/authorize` 在**使用伪造 `client_id`** 探测时**无视调用方参数**，一律 302 到：

```
https://opencn.coros.com/oauth2/authorize?client_id=68mnvu3ma928t8j5s0ceb0vyinsz66fk
  &redirect_uri=https://mcpcn.coros.com/api/v1/coros/callback&scope=userInfo,runData
```

**该观测不可外推**——用 DCR（`POST https://mcpcn.coros.com/connect/register`，空 body 返回 RFC7591 风格 `invalid_request`，说明端点存在）注册出的**真实 client** 是否被同等改写，仍是 S-1 要回答的问题。

> **对 L1 的影响**：设备码路径**不经过 `authorize` 端点**（走 `device_authorization` + `token`），因此**不受此改写风险影响**——这是 L1 被列为首选的技术理由之一。

### 5.5 信任设计（必须项，非加分项）

信任成本取决于选路：

- **L1 设备码 / L3 系统浏览器**：用户**不在 DSH 窗口内**输入高驰密码 → 信任设计降级为「必须明确告知在何处登录、不索取密码」，无需额外承诺。
- **L2 iframe**：用户要在 DSH 窗口内把高驰账号密码输入一张第三方页面，而该页面上就写着「获取您的运动数据，其中【运动轨迹】属于个人敏感信息」。若不在其上方交代来源，用户会判定为钓鱼，闭环完成率直接崩塌。

**L2 若被选中，必须做到**：

1. iframe 上方固定显示真实域名 `opencn.coros.com`，且视觉上不可被 iframe 内容遮挡或伪造。
2. 一句明确承诺：「密码只提交给高驰官方页面，本插件不读取、不存储。」
3. 授权页加载失败时，明确提示「未能加载高驰登录页」并自动提供 L1/L3 备选入口，而不是空白框。

### 5.6 登录状态机（UI 必须显式渲染）

```
未登录(anonymous)
   └─ 点击登录 → 登录中(pending) ──┬─ 授权成功 → 换取令牌 → 已连接(connected)
                                  ├─ 用户取消/关闭 → 未登录
                                  ├─ 密码错误/授权被拒 → 登录失败(failed, 可重试)
                                  ├─ 会话超时(L4 301s / L1 device_code 过期) → 可重新开始
                                  └─ 网络/服务端错误 → 失败(区分原因)

已连接(connected)
   ├─ 令牌有效 → 正常展示
   ├─ 令牌临近过期 → 静默刷新(single-flight)
   └─ 刷新失败 → 需重新登录(reauth_required) + 中文重登引导
```

**五态必须可区分渲染**：`pending | authorized | failed | expired | claimed`。L4 的服务器 `status` 字段即这五值；L1 走标准错误码（`authorization_pending`/`slow_down`/`expired_token`/`access_denied`），**不得**用 HTTP 200 判定成功。

### 5.7 平台限制（必须写进文案与验收口径）

以下来自 `@deepseek-ai/dsh-authorization` README 原文，不可绕过，只能如实告知：

| 限制 | 产品含义 |
|---|---|
| **flow 不可恢复**：一次尝试只存活于发起它的进程，登录途中刷新页面会丢弃它 | 需「请勿刷新页面」提示 + 一键重试；不能承诺恢复 |
| **平台侧没有吊销**：登出即 `deleteRecord`，只忘本地记录 | 文案不得写「已断开高驰账号授权」 |
| **每凭据同时只允许一次尝试**（`ALREADY_IN_FLIGHT`） | 连点两次「登录」必须友好处理，不能抛错码 |
| **flow 返回前未提交即 `NOT_COMMITTED`** | 完成授权后若用户已关闭面板，需能被后续进入重新接上 |

**高驰侧补充（v1.1 新增）**：`https://mcpcn.coros.com/.well-known/oauth-authorization-server` 实测含 `revocation_endpoint: /oauth2/revoke`，`token_endpoint_auth_methods_supported` 含 `none`（公共客户端）。因此登出时可以**额外**尝试调用 revoke 使当前 refresh token 失效——但这只覆盖本机这一份令牌，不构成平台级吊销，文案仍不得承诺「设备已解绑 / 授权已全局撤销」。

---

## 6. 数据契约

### 6.1 MCP 服务基本信息

| 项 | 值 | 证据 |
|---|---|---|
| MCP 端点 | `POST https://mcp.coros.com/mcp`（CN 区 `https://mcpcn.coros.com/mcp`） | 未带凭据请求 → `401` |
| 鉴权挑战 | `WWW-Authenticate: Bearer resource_metadata="https://mcpcn.coros.com/.well-known/oauth-protected-resource/mcp"` | 实测 |
| Scopes | `openid`, `mcp.tools`, `offline_access` | `.well-known/oauth-protected-resource/mcp`（实测） |
| 授权端点 | `authorization_endpoint: /oauth2/authorize`，`code_challenge_methods_supported: ["S256"]`（**仅 S256**） | `.well-known/oauth-authorization-server`（实测） |
| **设备码端点** | `device_authorization_endpoint: /oauth2/device_authorization`；`grant_types_supported` 含 **`device_code`** | 同上（**v1.1 新增**） |
| 令牌端点 | `token_endpoint: /oauth2/token`，`token_endpoint_auth_methods_supported` 含 **`none`**（公共客户端，无 client_secret） | 同上 |
| **吊销端点** | `revocation_endpoint: /oauth2/revoke`；另有 `introspection_endpoint` | 同上（**v1.1 新增**） |
| 动态注册 | `registration_endpoint: /connect/register`（空 body 返回 RFC7591 风格 `invalid_request`） | 实测 |
| 区域端点 | CN / EU / US 三套（CN: `mcpcn.coros.com`，全局: `mcp.coros.com`） | 官方 `docs/zh/getting-started.md` §2 |
| 令牌寿命 | access **30 天**，refresh **180 天**且**轮换**（每次刷新签发新 refresh token） | 官方 `docs/zh/faq.md` Q11 |
| 会话机制 | **已改为无状态 MCP**，旧 `Mcp-Session-Id` 流程作废 | 官方 `docs/zh/faq.md` Q6 |
| FIT 配额 | **50 个文件 / 24h**（与下载链接共用额度） | 官方 `docs/zh/faq.md` Q9 |
| 工具总数 | **34 个**（含 8 个写工具） | 官方 `docs/zh/tools.md`（2026-10-30 核验） |

### 6.2 工具清单（官方 34 个）

> **来源变更**：v1.0 取本地缓存 `%USERPROFILE%\.coros-mcp-skill-gateway-ts\cn\tool-catalog.json`（22 个，`fetched_at_epoch` → 2026-08-09，**已过期**）。v1.1 改用官方 `https://raw.githubusercontent.com/coroslab/COROS-MCP/main/docs/zh/tools.md`（34 个）。
> **盘点差异**：新增 14 个、官方文档已不再列出 2 个（`analyzeActivityDetail`、`querySleepData`）。

**M1 必须（3 个）**

| 工具 | 入参与约束 | 用途 |
|---|---|---|
| ★ `queryDevices` | 零入参 | 绑定设备列表（deviceId / firmware / customName） |
| ★ `querySportRecords` | `startDate, endDate, sportTypeCodes, minDistanceKm, maxDistanceKm, minDurationMinutes, maxDurationMinutes, minAveragePace, maxAveragePace, locationKeyword, limit`（**全部 required**） | 运动记录 |
| ★ `getActivityDetail` | `labelId, sportType`（labelId 以**字符串**传） | 单次活动详情（心率/配速/海拔/步频） |

**M1 准入（8 个）**

| 工具 | 入参与约束 | 用途 |
|---|---|---|
| `queryUserInfo` | 零入参 | 身高/体重/生日/性别 |
| `queryDailyHealthData` | `days` | 每日健康总览（步数/卡路里/压力/睡眠） |
| `queryRecoveryStatus` | 零入参 | 恢复百分比/等级/预计恢复时间 |
| `queryTrainingPlanLibrary` | — | 训练计划库 |
| `queryTrainingPlanDetails` | **窗口最长 28 天**；需 date + `idInPlan`（字符串） | 计划详情的周视图 |
| `queryWorkoutLibrary` | **最多 50 条、不支持分页** | 课程库（可查游泳/力量，但写只支持跑/骑/越野） |
| `queryWorkoutDetails` | `workoutId` | 单课程详情 |
| `queryScheduledWorkoutDetails` | `date` + `idInPlan`（字符串） | 日历上某一节安排 |

**M2 写工具（7 个，全部会变更用户账号数据）**

| 工具 | 关键约束 |
|---|---|
| `createTrainingPlan` | 必填 `planInfo/phaseInfo/courseList`；仅跑步/骑行/越野跑；计划 **4–16 自然周**；开始日期为账号时区**今天至未来 14 天**；自然周周一至周日 |
| `updateTrainingPlan` | 仅支持修改**可编辑的进行中**计划；**退出计划必须去 COROS App** |
| `createSingleWorkout` | 单次课程创建 |
| `updateWorkoutDetails` | 改课程库**不会**改变已排入日历中的该课程；**删除课程必须去 App** |
| `scheduleWorkout` | 日期仅**今天至未来 90 天**；同一课程当天不会重复添加；**改期/移除必须去 App** |
| `createScheduledWorkout` | 同上（课程 + 日期一次创建） |
| `updateScheduledWorkout` | 同上（改课表部分可逆） |

**其余 16 个（首版不接，V2 候选）**

`queryActivityLapData`、`queryCustomActivityLapData`、`queryFitnessAssessmentOverview`、`queryTrainingLoadAssessment`、`queryMenstruationCycles`、`queryAvgHeartRate`、`queryRestingHeartRate`、`querySleepHrv`、`querySleepOverview`、`queryStressLevel`、`queryHealthCheckTimeSeries`、`queryStressTimeSeries`、`queryTrainingSchedule`、`downloadActivityFitFiles`、`queryActivityFitFileDownloadUrls`、`uploadRouteFile`。

> 时序类约束：`querySleepHrv`/`queryStressTimeSeries`/`queryHealthCheckTimeSeries` 按 `days` 查询**最多 7 天**；`downloadActivityFitFiles` 默认 5 个、最多 10 个。运动类型必须传**数字码**，不能传名称。

### 6.3 三个必须在实现前知道的事实

1. **`querySportRecords` 的 10 个参数全部声明为 `required`**，尽管每个参数的描述文字都写着 "Optional"。任何「查最近运动」的调用都**必须由前端补齐默认值**，否则必然参数错误。这是服务端 schema 事实，不是可选项。

2. **（v1.1 已修正）高驰 MCP 存在 8 个写工具，写回训练计划是官方主推场景。** v1.0 曾依据过期本地目录判定「无 write 工具」，该结论作废。真正需要注意的是**写回的部分不可逆性**：退出计划、改期、移除、删除课程均被官方限定为「必须去 App 操作」，插件内只能创建/微调——UI 必须在提交前把这一点写清楚，否则用户会认为插件做坏了。

3. **健康数据是天粒度**，不是实时。用户「我刚跑完怎么没看到」的预期落差必然发生，F11 与 F13 就是为了兜这个。

### 6.4 数据字段的未知项

以下全部**未知**，必须由 S-3 取真实返回后冻结：

- 每个工具的返回字段名、单位（米/公里、秒/分）、时区语义
- `querySportRecords` 的 `limit` 上限、分页方式
- `sportTypeCodes` 的取值表（数字码 → 运动类型名）
- 设备对象里「型号」是否可读（`firmware` 是否即型号）
- 数值精度与缺失值表示（`null` 还是字段缺省）
- 训练计划的计划 ID 与 `idInPlan` 的稳定标识规则

---

## 7. 拍板结论与遗留复核

### 7.1 三项决策结案

需求方于 2026-10-30 一次性回答三项决策（原文 m00099）：**「接受弹系统浏览器，写回训练计划目前已经支持了，「左侧上方」若没有对应槽位，用就近槽位」**。

| # | 原待决问题 | 需求方结论 | 对文档的影响 | 状态 |
|---|---|---|---|---|
| 决策 1 | S-1 若只能走 L3（跳系统浏览器），是否接受？ | **接受** | §5.2 L3 从「需签字」升为「已授权、保底可用」；§8.2 Go/No-Go 不再因 L3 而挂起；§11.3 采用「允许一次系统浏览器」措辞 | **已闭合** |
| 决策 2 | 首版只读、不做写回训练计划，是否接受？ | **「写回训练计划目前已经支持了」**——纠正了 v1.0 的事实前提 | §6.2 工具清单 22→34；§6.3 事实 2 改写；F20 拆为 F20/F20a–F20d 并读写分离定档（只读进 M1 准入，写回进 M2）；§9 复活条件重写 | **事实部分已闭合**，档位部分见复核项 1 |
| 决策 3 | 「左侧上方」若无对应槽位，用就近槽位是否接受？ | **接受** | V0 闭合：槽位定 `sidebar.panellist`，`id=coros-sport`，**order=5**（落在「插件市场」之后、「自动化任务」之前）；§8.1 V0 不再阻塞 | **已闭合** |

### 7.2 遗留复核项（不阻塞开工，但需在 M1 交付前有答复）

| # | 事项 | 默认处理 | 需要谁 |
|---|---|---|---|
| 复核项 1 | 写回训练计划（F20a/b/c）是否必须进 **M1**？ | 默认进 M2（理由：需先冻结数据契约 + 建立确认/回读/撤销三件套） | 需求方 |
| 复核项 2 | 插件分发形态：registry 发布 vs `link:` 本地目录安装？ | 默认先 `link:` 本地安装（AC1 步骤按此写），发布形态后续定 | 需求方 |
| 复核项 3 | 「左侧上方」的实际观感是否接受 order=5 的位置？ | V0 剩余动作：装空壳插件截一张图给需求方指认，不需再写文档 | 需求方 / 开发 |
| 复核项 4 | 是否需要支持非中文用户（决定 F24 档位）？ | 默认不做，M1 全中文 | 需求方 |

---

## 8. 里程碑与闸门（只给顺序与判据，不给工期）

### 8.1 三个必须闭合的单点（不闭合不写业务代码）

| 编号 | 要回答的问题 | 为什么阻塞 | 判据 | 类型 |
|---|---|---|---|---|
| **V0 槽位确认**〔✅ 已闭合〕 | 「左侧上方功能栏」对应哪个 slot？ | 槽位名写进需求书才能验收 | **已确定**：`sidebar.panellist`（渲染为「全局面板」列表，按 `order` 升序），`id=coros-sport`，`order=5`；`main` keyed slot 用同 id 配对。剩余仅：空壳截图让需求方指认观感 | 0.5 小时，0 用户 |
| **S-1 登录闭环** | 按 **L1 设备码 → L2 iframe+回环 → L3 系统浏览器+回环** 顺序，哪一条能第一次跑通？ | 决定需求 4 的最终形态，是唯一差异化 | **三条中任一跑通即通过**：一次真实账号往返 → 换到 token → `queryDevices` 返回设备。同时产出：①L1 的 `device_code` grant 是否对 DCR client 开放；②L2 的宿主 CSP `frame-src` 是否放行；③真实 client 的 `redirect_uri` 是否被改写（§5.4） | 1–2 天，需真实账号（人工输密码，脚本不得记录） |
| **S-3 数据契约** | 用真实令牌调 `queryDevices`/`querySportRecords`/`queryDailyHealthData`/`getActivityDetail`/`queryTrainingPlanDetails`，拿字段/单位/时区/上限样例；并跑一次 `tools/list` 断言工具总数与写工具存在 | 拿不到就无法冻结数据项验收，可能出现「登录成功但页面空」 | 每个工具一份真实返回 JSON 样例 + `tools/list` 的**工具计数（期望 34）与 8 个写工具名称清单**（同时补测 EU/US 授权页是否同构） | 半天 |

### 8.2 Go / No-Go 闸门

**S-1 结果为唯一 Go/No-Go 闸门。**

| S-1 结果 | 决策 |
|---|---|
| L1 或 L2 跑通 | **Go**，按 §4.2 M1 范围进入实现，需求 4 按「无外部窗口」措辞验收 |
| 仅 L3 跑通 | **Go（已授权）**，按「允许一次系统浏览器」措辞验收（§11.3 第二种） |
| 仅 L4 跑通 | **有条件 Go**：需在 UI 明示私有接口风险，并保证 301s 超时与 HTTP 200 假成功的正确处理 |
| 全部不可行 | 项目暂停，重新评估产品价值（此时只剩 L5 手工粘贴，不具备产品价值） |

### 8.3 后续验证

| 编号 | 内容 | 判据 |
|---|---|---|
| **V3 过期态回放** | 把本地 `expires_at_epoch` 改到过去，重开插件 | 确认「静默刷新 → 失败 → 中文重登引导」三态截图 |
| **V2 五人可用性测试** | 任务：找到入口（计时）→ 完成登录（**观察是否切窗**）→ 说出第一台设备 → 找到最近一次运动说类型和时长 → 找到本周训练计划 → 关掉重开说当前登录状态 | 记录完成率、每步耗时、失败码分布、犹豫点原话、**是否有人对登录方式表达不安**。判定门槛（建议，供协商）：**登录任务完成率 ≥4/5 → 需求 4 成立；<3/5 → 回到 §5.2 重新讨论路径**。若选路为 L3，「是否切窗」不再是失败判据，改为「是否有人需要口头指导才能完成」 |

---

## 9. 暂缓项的复活触发条件

| 暂缓项 | 触发条件（出现再做） | 前置依赖 |
|---|---|---|
| **训练计划写回（F20a/b/c，M2）** | **不再需要外部触发**——官方已支持，等 M1 数据契约冻结 + 确认流/回读校验/撤销口径三件套就位即可开工 | S-3 的 `tools/list` 与计划详情样例；`updateTrainingPlan` 的「退出计划必须去 App」必须在 UI 写明 |
| 路线文件上传（F20d） | ≥3 名用户提出「导入 GPX 跑线」 | GPX/KML 解析 + 文件落地 + 「上传后需 App 内同步手表」的说明链路 |
| 图表/趋势/对比（F18） | 测试中 ≥3 人在概览卡外继续寻找某次具体运动，或明确说「想看趋势」 | F9/F12 数据形态稳定 ≥1 迭代 |
| 健康全景（F19） | F12 稳定后，出现「不想看图想要一句结论」类反馈 ≥3 例 | UX 先定呈现口径 |
| FIT 下载（F21） | 明确赛后深度分析需求 ≥2 例 | 受 **50 文件/24h** 配额约束；DSH 文件能力验证 |
| 后台同步（F22） | 出现「数据不及时」投诉，或出现依赖主动提醒的场景 | 增加常驻与隐私面 |
| 多账号（F23） | ≥2 例「两个人共用一台电脑」 | — |
| 工具目录浏览器（F23） | 工具数 >15 且出现「找不到功能」的失败调用日志 | 当前已 **34** 个，**远超阈值** |
| 自动区域探测（替代 F14 手动） | ≥2 例「连接失败源于区域」的支持记录 | F14 手动版先落地 |
| 双语（F24） | 出现非中文用户实际使用记录 | — |

---

## 10. 非功能需求

### 10.1 安全与隐私

| ID | 要求 |
|---|---|
| NFR-S1 | 高驰 access/refresh token **只存于 host 侧受限权限文件**，不得出现在前端内存可读区、日志、工具输出、对话记录中 |
| NFR-S2 | 用户密码**只在官方授权页内提交**（L1 在浏览器侧、L2 在 iframe 内、L3 在系统浏览器内），插件侧不读取、不中转、不记录 |
| NFR-S3 | 日志中所有 token / code / state / user_code 必须脱敏 |
| NFR-S4 | 登录完成后展示的是**脱敏账号标识**（如邮箱首字符 + 域名），不展示完整账号 |
| NFR-S5 | 运动轨迹属**个人敏感信息**（高驰授权页原文），本地存储与出境合规需单独评估——**本版未评估，属未覆盖范围** |
| NFR-S6 | 登出必须清除本地落盘凭据；可额外调用高驰 `/oauth2/revoke`，但文案不得承诺全局吊销或「设备已解绑」 |
| NFR-S7 | **任何写工具（F20a/b/c）在提交前必须展示将要变更的具体对象与影响，并在提交后回读校验**；不得静默写 |

### 10.2 平台契约

| ID | 要求 |
|---|---|
| NFR-P1 | 通过 profile patch 的纯 `insert` 行注册（可热挂载、可卸载），不依赖修改 DSH 本体或 app.asar |
| NFR-P2 | 必须用 `ctx.effect` 注册清理逻辑：卸载后入口消失、页面释放、**无残留定时器与事件监听**（轮询类登录尤其注意） |
| NFR-P3 | UI 不 require 任何 `@deepseek-ai/dsh-client-*` 包，自绘控件 + 只用 `--dsw-alias-*` 主题 token，深浅色下与宿主页并排无违和 |
| NFR-P4 | MCP 配置必须设 `failOnStartupError: false`，未登录/不可达时不允许拖垮整个 bundle（见 F10） |
| NFR-P5 | 令牌刷新必须 single-flight（refresh token 轮换，并发刷新会互相作废） |
| NFR-P6 | 插件不得依赖 `@modelcontextprotocol/*` 被宿主解析；如需使用必须自带依赖（当前 profile `node_modules` 中不存在该包） |

### 10.3 性能与体验

| ID | 要求 |
|---|---|
| NFR-X1 | 点入口到面板首屏可交互，不出现超过 1s 的白屏（无骨架屏即视为未达标） |
| NFR-X2 | 数据加载必须有 loading 态；任一数据源失败不得阻塞其他区块渲染 |
| NFR-X3 | 所有网络请求有超时与可重试；**轮询类登录必须有明确总时长上限与倒计时展示** |
| NFR-X4 | 轮询间隔不得低于服务端给出的 `interval`（L1/L4 都会返回），收到 `slow_down` 必须实际降速 |

### 10.4 可访问性（边界声明）

- 入口按钮本身必须可键盘聚焦、有可读名称。
- **若不是 L2 路径**，则不存在内嵌页面 a11y 问题；若是 L2，**内嵌的高驰授权页 a11y 不在可控范围**，本版不承诺达标，须在文档中声明。
- L1 的 `user_code` 必须是可选中复制、等宽字体、可朗读的纯文本，不得做成图片。

---

## 11. 验收标准

### 11.1 功能验收（可验证步骤）

| ID | 用户步骤 | 通过判定 |
|---|---|---|
| **AC1** | 安装插件 → 重启 DSH | 左侧「全局面板」出现「高驰运动」（order=5，位于「插件市场」之后），≤2 次点击进面板；无控制台错误 |
| **AC2** | 未登录状态下打开面板 | 展示登录入口与一句说明；**入口本身不因未登录而消失**（F10）；无 `slot entry crashed` |
| **AC3** | 点「登录」 | 按 §11.3 的首选或降级措辞判定；**不得需要手工复制粘贴 token**（记录登录形态 = 需求 4 的核心观测点） |
| **AC4** | 完成授权 | ≤5s 内自动切「已连接」，显示脱敏账号标识；**无需复制粘贴任何内容** |
| **AC5** | 按 F5 刷新页面 | 仍为已登录（凭据在 host，不在前端内存） |
| **AC6** | 关闭并重开 DSH | 仍为已登录，不要求重登 |
| **AC7** | 手动把 access token 置过期 | 自动刷新成功，用户无感 |
| **AC8** | 设备区 | ≥1 台设备名称 + 型号；无设备时显式空态「未绑定设备」 |
| **AC9** | 运动区 | ≤N 条近 7 天记录（日期/类型/距离/时长）；0 条时明确空态；**不因 10 个必填参数报错** |
| **AC10** | 未勾 24h 历史授权的账号 | 首登不报错，显式提示「未授权历史数据」并提供重新授权指引 |
| **AC11** | 断网 / 取消授权 / 输错密码 / 点忘记密码 / 地区不支持 / 登录会话超时 | 各有**可区分的中文文案 + 可执行下一步**，无白屏、无死循环、无「永远转圈」 |
| **AC12** | 凭证落地检查 | token 仅在受限权限文件中，日志/工具输出/对话中**无明文 token** |
| **AC13** | 卸载插件 | 入口消失、页面释放、**无残留定时器/监听**（含登录轮询） |
| **AC14** | （F20，M1 准入）训练计划区 | 显示当前计划周视图（≤28 天窗口）与日历上的安排；无计划时明确空态；`idInPlan` 按字符串传递不报错 |
| **AC15** | （F17，M2）对话中「查最近 7 天跑步」 | 模型成功调工具，返回与高驰 App 一致的数据 |
| **AC16** | （F20a–c，M2）创建/修改一份训练计划或排一节课 | 提交前有逐项确认；提交后**回读校验**一致；UI 明确提示「退出/改期/删除需在高驰 App 内操作」 |

### 11.2 内部质量门

在无真实用户前，用它代替转化率指标：

> **5 名内部测试者独立走完 AC1–AC13，0 次人工救场。任一人需口头指导即视为未通过。**

### 11.3 需求 4 的达成定义（v1.1 定稿）

按决策 1，采用**两档措辞**，以 S-1 的选路结果对应其中一档：

**A 档（S-1 跑通 L1 或 L2 时采用）**

> **用户从点「登录」到看到设备列表，全程停留在 DSH 应用窗口内，不出现外部浏览器窗口或系统弹窗，且无需手工复制粘贴任何内容。**
> （L1 允许用户在手机或另一设备上完成授权动作，但 DSH 侧不弹窗口。）

**B 档（S-1 仅跑通 L3 时采用，需求方已授权）**

> **用户从点「登录」到看到设备列表，期间允许弹出一个系统浏览器窗口用于高驰授权；授权完成后插件自动回到已登录态，无需手工复制粘贴或手动关窗回切。**

两档的**共同底线**：不允许「用户自己去别处拿 token 再贴回来」作为主路径。

---

## 12. 风险登记册

| ID | 风险 | 触发条件 | 影响 | 可推翻结论的证据 |
|---|---|---|---|---|
| R1 | **需求 4 与平台现实的冲突（v1.1 已降级）** | L1 的 `device_code` 对 DCR client 不开放、L2 的 CSP 不放行、L3 回环不可用 | 只能退到 L4（私有接口）或 L5，需求 4 实质作废 | S-1 实测结果。**注意：三条路径同时失败的概率已显著低于 v1.0 的单点风险** |
| R2 | 登录流不可恢复 | 用户在授权途中刷新页面 | 必须从头再来；UX 不能承诺恢复 | `@deepseek-ai/dsh-authorization` README 变更 |
| R3 | 登出不在服务端全局失效 | 用户登出后仍持有旧 token | 安全承诺降级，需在文案披露 | 同上 + 高驰 `/oauth2/revoke` 的实际效力 |
| R4 | 高驰鉴权不匹配任一 L1–L3 | 三条路径全部失败 | 退到 L4/L5，登录体验显著下降 | S-1 实测结果 |
| R5 | MCP 字段边界未知 | S-3 未完成 | F8/F9/F12/F20 验收无法冻结；可能出现「登录成功但页面空」 | S-3 的工具清单与返回样例 |
| R6 | `failOnStartupError: true` 让入口消失 | 未登录或 MCP 不可达时首连失败 | 装了插件看不到入口，最致命 | spike 中实测失败传播范围 |
| R7 | UI 成本被低估 | 以为能复用组件库 | 自绘控件 + 只用主题 token，UI 成本高于常规 React 项目 | — |
| R8 | 结构性阻断用户群 | 用户仅有手机号注册 / 忘记密码 | 这部分人永远无法闭环，只能给出口指引 | 五人测试中出现 ≥2 人仅有手机号 |
| R9 | 用户不愿在窗口内输密码 | 仅 L2 路径受影响；五人测试 ≥2 人拒绝 | L2 不可用，退回 L1/L3 | 5 人测试的定性原话 |
| R10 | 无用户证据 | 当前 0 次访谈、0 份设计稿、0 条工单 | 「用户会怎么做/怎么想」的判断全部是假设 | 发布后前两周做 5 次访谈；若 ≥3 人表示「用高驰 App 就够」，价值假设被推翻 |
| R11 | 写了但没人知道 | 无任何分发与告知渠道 | 插件沉默 | 需明确分发形态（见 §7.2 复核项 2） |
| R12 | 区域登录页不同构 | 只完整读过 CN 侧授权页 | 非 CN 用户可能撞上未预期的跨地区弹窗 | S-3 补测 EU/US |
| **R13** | **写回能力的「半可逆」被误解** | 用户以为插件能改期/删课，实际必须去 App | 提交后无法撤回 → 用户认为插件有 bug | 需在 UI 常驻说明；五人测试中观察是否有人尝试改期 |
| **R14** | **私有接口路径（L4）无预警变更** | 官方改 `/api/v1/cli/login-sessions` | 登录突然全体失效 | 仅在 L1–L3 全失败时才用它 |

---

## 13. 开放问题与待补材料

### 13.1 开放问题（阻塞度从高到低）

1. **L1 的 `device_code` grant 是否对动态注册 client 开放**——这是 v1.1 新增的头号问题，直接决定能否做到「零跳转」。
2. **宿主页面 CSP `frame-src` 是否放行第三方 iframe**——决定 L2 能否作为体验最优路径。
3. **插件分发形态**：走 registry 发布，还是 `link:` 本地目录安装？直接影响 AC1 的安装步骤与用户体验（§7.2 复核项 2）。
4. **写回是否必须进 M1**（§7.2 复核项 1）。
5. **目标上线时间点与人力配置**：团队未提供，本文档无法换算为计划。
6. **是否需要支持非中文用户**（决定 F24 的档位）。
7. **高驰 ToS 是否允许第三方客户端自注册（DCR）+ 内嵌其登录页**：DCR 返回 201 只证明技术未拦，不代表条款允许。

> 已闭合、不再列为开放问题：需求 4 的验收措辞（§11.3）· 首版是否需要 write 能力（§6.2，已支持）·「左侧上方」的槽位名（§8.1 V0）。

### 13.2 待补材料

1. 高驰 MCP 官方文档的**中文完整版**（已有 tools/getting-started/faq；缺 `redirect_uri` 白名单与 device_code 对第三方 client 的开放说明）。
2. 每个工具的一次**真实返回 JSON 样例**（含单位与时区）。
3. 用户访谈 / 问卷 / 任何真实用户反馈（**当前为 0**）。
4. 设计稿、交互稿（**当前无**）。
5. 排期、人力、上线时间点（团队未提供）。
6. 高驰官方 ToS / 开放平台条款文本。

---

## 14. 未覆盖范围（明确声明）

本评审**未**验证以下内容，不得当作已确认：

- 真实 GUI 渲染（会话内 DSH GUI 返回 401，`Slots.listSubTree` 两次超时）
- 任何真实账号的端到端 `login → queryDevices`（只做到协议层验证）
- **`device_code` grant 对 DCR client 的实际可用性**（只确认端点与 grant 声明存在）
- 实际性能数据
- UI 视觉设计与交互稿
- 隐私合规审查（运动轨迹属个人敏感信息，本地存储与出境合规需单独评估）
- 高驰 ToS 合规性
- 排期与工作量估算
- **所有写工具的真实调用效果**（只读到官方文档的参数约束，未实际写入任何账号数据）

**评审期探测副作用（如实披露）**：在 COROS 侧创建了 3 个未使用的 pending login session（`intervalSeconds: 3`，短时自然过期），**未提交任何账号凭证**，未注册持久 OAuth client，**未执行任何写操作**。

**工作目录内的评审探针**（非产品代码，可删）：`.review-probe/` 下的 `probe*.mjs`、`dcr.mjs`、`tok.mjs`、`tools.mjs`、`frame-*.html`、`opencn-login.html` 等。

---

## 15. 行动清单

| 顺序 | 动作 | 负责角色 | 判据 | 状态 |
|---|---|---|---|---|
| 1 | 决策 1/2/3 拍板并写入本文档 | 需求方 | §7 三项有明确结论 | **✅ 已完成（v1.1）** |
| 2 | V0 槽位确认 | 开发 | `sidebar.panellist` order=5 已确定 | **✅ 已闭合**；剩余：空壳截图指认观感 |
| 3 | S-1 登录闭环 spike（L1→L2→L3 依次试） | 开发 | 任一跑通：真实往返 → token → `queryDevices` 返回设备 | **待办（最高优先）** |
| 4 | S-3 数据契约取样 + `tools/list` | 开发 | 五份真实返回 JSON + 工具计数（期望 34）+ 写工具清单 | 待办 |
| 5 | 按 S-1/S-3 结果冻结 §4.2 范围并定稿 v1.2 | 产品 | 本文档 v1.2 | 待办 |
| 6 | 按 F1→F11 顺序实现，MCP 配置 `failOnStartupError: false` | 开发 | AC1–AC13 | 待办 |
| 7 | V3 过期态回放 | 开发 | 三态截图 | 待办 |
| 8 | V2 五人可用性测试 | 产品 | 登录任务完成率 ≥4/5 | 待办 |
| 9 | M2：F17（工具暴露）+ F20a/b/c（训练计划写回） | 开发 | AC14–AC16 | 待办 |
| 10 | 复核项 1–4 答复（§7.2） | 需求方 | 四项各有结论 | 待办 |

---

## 附录 A：评审证据索引

**已实测（协议层，2026-10-30，只读，未提交任何账号凭证）**

| 事实 | 证据 |
|---|---|
| MCP 端点存在且要求 Bearer | `POST https://mcp.coros.com/mcp` → 401 + `WWW-Authenticate` |
| 授权服务器 scope 与能力 | `.well-known/oauth-protected-resource/mcp`、`.well-known/oauth-authorization-server` |
| **支持 `device_code` grant + `/oauth2/device_authorization`** | `https://mcpcn.coros.com/.well-known/oauth-authorization-server`（v1.1 核验） |
| **存在 `/oauth2/revoke` 与 `/oauth2/introspection`** | 同上（v1.1 核验） |
| PKCE 仅支持 S256；token 端点 auth method 含 `none` | 同上 |
| DCR 端点存在 | `POST https://mcpcn.coros.com/connect/register {}` → 400，RFC7591 风格 `invalid_request` |
| CLI 登录会话可无凭证创建 | `POST /api/v1/cli/login-sessions` → 200，见 `.review-probe/session.json` |
| 会话寿命 ≈301s，interval 3s | 创建 07:34:24.538Z → 过期 07:39:25.921Z |
| 登录跳转首跳带 `X-Frame-Options: DENY` | `GET https://mcpcn.coros.com/cli/login/<id>` → 302 + `DENY` |
| **最终授权页可被嵌入** | `https://opencn.coros.com/oauth2/authorize?...` → 200，`x-frame-options`/`content-security-policy`/`referrer-policy` 全 null，`getSetCookie()` 返回 `[]` |
| 授权页只有邮箱+密码 | `<form id="authForm" action="/oauth2/authorize" method="post">`，字段 `COROS Account` + `type="password"`；无微信/扫码/Apple 痕迹 |
| 24h 历史授权是可选勾选 | 仅隐私政策 `#checkStatus` 卡提交按钮 |
| https 页面内嵌 http loopback + postMessage 可行 | `.review-probe/frame-loopback.html` |
| 本机缓存 token 已过期约 52 天 | `%USERPROFILE%\.coros-mcp-skill-gateway-ts\cn\token.json` 的 `expires_at_epoch` |
| 本地工具目录 22 个、全只读、**已过期** | `%USERPROFILE%\.coros-mcp-skill-gateway-ts\cn\tool-catalog.json`（`fetched_at_epoch` → 2026-08-09） |

**已实测（官方文档，2026-10-30，经浏览器读取）**

| 事实 | 来源 |
|---|---|
| **工具总数 34，含 8 个写工具** | `https://raw.githubusercontent.com/coroslab/COROS-MCP/main/docs/zh/tools.md` |
| 训练计划/课程/排课的参数与限制（4–16 周、+14 天、+90 天、退出与删除必须去 App） | 同上（逐工具核对） |
| 区域端点与手动 MCP 地址 | `docs/zh/getting-started.md` |
| 令牌寿命 30/180 天且轮换、无状态 MCP、FIT 50 文件/24h、「部分平台不支持域名重定向」 | `docs/zh/faq.md` Q4/Q6/Q9/Q11 |

**已实测（本机安装包源码级）**

| 事实 | 位置 |
|---|---|
| slot 契约与配对规则 | `app.asar → /dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar/README.zh.md` |
| `sidebar.panellist` + `main` 实证写法 | `C:\Users\lykan\.dsh\profiles\desktop\node_modules\dsh-context\lib\client.js` |
| 「全局面板」列表按 `order` 升序；`PanelRow` = `button[aria-label]` + `renderSlot(...,{only:id})` | `app.asar → /dsh/lib/client/sidebar.js` |
| Electron 边界（`webPreferences` / `setWindowOpenHandler` / `will-navigate`） | `app.asar → /lib/main.js` |
| preload 暴露清单；`dshPlatform.open` 仅接受 `usage\|top-up` | `app.asar → /lib/preload-app.cjs` |
| 插件跑在 host 子进程，无 Electron API | `dsh-tray-restart/README.md` |
| 官方登录形态（回环 + `timingSafeEqual(state)` + S256） | `@deepseek-ai/dsh-deepseek-account-platform/lib/index.js` |
| authorization 三条限制原文 | `@deepseek-ai/dsh-authorization/README` |
| `dsh-mcp-client` **完全不实现 OAuth**；导出仅 `{Config, apply, createMcpToolDefinition, inject, name}`；`failOnStartupError` 默认 true | `@deepseek-ai/dsh-mcp-client/lib/index.js` |
| MCP SDK 随 DSH 分发但 profile 未安装；**无内置 device_code 流程** | `app.asar → /dsh/node_modules/@modelcontextprotocol/client/dist/index.mjs` |
| 插件打包形态（`dsh.bundle.patch` / `dsh.client`） | `dsh-context/package.json` |

**外部参考（非需求证据）**：`coroslab/COROS-MCP`（官方仓库）；`ppxinashin/dsh-coros-gui`（0 star、单 commit、同日创建，仅作技术旁证）；`ZhangBo-cmd/dsh-coros-badge`（周下载 229、**issue 数 0**，说明同类产品无真实反馈）。

> 提醒：以上官方/第三方陈述**不是我们的用户**。唯一可比产品没有任何 issue，意味着**没有任何真实可用性反馈**可用于校准本文档中的任何假设。
