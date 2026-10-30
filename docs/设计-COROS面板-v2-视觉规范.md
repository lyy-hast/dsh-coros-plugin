# COROS Sport 主面板 v2 · 视觉评审与设计规范

> 对象：DSH 桌面端插件「高驰运动 / COROS Sport」进入入口后的 main 面板
> 评审依据：`.review-probe/shots/user-panel.png`（1510×1209，DPR 1.5 → CSS 视口 1006.7×806.0）
> 实现依据：`lib/client.js`（755 行）、`lib/coros-api.js`（504 行）、`lib/index.js`
> 可运行视觉稿：`.review-probe/design/panel-v2.html`（1400 / 1006 / 640 / 520 / 519 五档实测）
> 全部尺寸为 CSS px（截图值已 ÷1.5）。浅色主题令牌实测值用于 fallback。

---

## A. 现状截图评审

### A1 信息层级

| # | 位置 | 现象 |
|---|---|---|
| A1-1 | 卡1「绑定设备」= 首屏第一张卡，y 137.3–229.3 | 序列号 `W35B063695`（y 190.7）与保修 `2028-03-19 10:44:40`（y 216.7）占据了首屏最贵的位置，而这类设备标识是「一辈子看一次」的信息；每日决策数据（恢复/睡眠）反而排在其后。优先级倒置。 |
| A1-2 | 卡2 首行 y 317.3 | 主指标「恢复状态 100% · Fresh」与卡1 的序列号、保修日期完全同字号（13px）、同字重（400）；面板内只有 2 个文字色，`#61666B` 次要色像素 5052 vs `#0F1115` 主色 1803 → **灰色像素是黑色的 2.8 倍**，视觉重心不在主指标上。 |
| A1-3 | 「训练安排」整块 | 渲染顺序 Devices→Vitals→Activities→Health→Schedule（`lib/client.js:572-654`），训练安排排最后，且 `empty` 时直接 `return null`（`lib/client.js:558-570`）。用户在 806px 高的首屏里完全看不到「今天该练什么」——而这是心率/睡眠之外最高频的问题。 |
| A1-4 | 「近期运动」卡 | 只列单条记录（运动名 + 日期 + 4 个 meta），没有「近 7 天跑了多少 km / 几次」的周汇总，无法一眼判断训练量。 |
| A1-5 | 成绩预测 | `parseFitness` 已返回 `predictions[]`（`lib/coros-api.js`），DICT 也定义了 `predictions` 键（中 `成绩预测` / 英 `Predictions`），但渲染代码零引用 → 已解析的数据被丢弃。 |

### A2 排版与网格

| # | 位置 | 现象 |
|---|---|---|
| A2-1 | 四张卡统一 880px 通栏，内容全部左对齐 | 卡片内宽 879.3，ink 横向范围：卡1 只到 x=306（右空白 **647 = 74%**）、卡2 到 x=260（**79%**）、卡3 到 x=934.7（**2%**）、卡4 到 x=304。同一列里 74% / 79% / 98% 三种填充率并存，视觉节奏断裂。 |
| A2-2 | 标签列 `minWidth: 88px`（`lib/client.js:217`） | 值列被硬钉在 x≈190。中文最长标签「最大摄氧量」右边界 157.3，距值列还有 31px 空隙；英文「Threshold pace」实测 90px **已溢出 88px 列宽 2px**，切英文即挤。 |
| A2-3 | 卡3 日期右对齐 x 869.3–934.7 | 卡3 用 `space-between` 把日期推到右边缘，而卡1/卡2 的值全部左贴 label 列 → 同一屏里「值」有两套水平基准。 |
| A2-4 | 卡4 裸日期 y 751.3 + 无标签 meta y 771.3 | 两者都从卡片左内边距 92.7 起，与上方 Field 的 label 92.7 / value 190 双列结构错位，形成**第三套对齐基线**。 |
| A2-5 | 页头留白 | `pageStyle` 内边距 `24px 28px 48px`（`lib/client.js:179-187`）+ `innerStyle maxWidth 880`（`:189`），而宿主页面容器自身已有 `padding: 0 clamp(24px,4vw,48px) 48px` 与 `> * max-width: 960px` → 双重留白：卡左边界 74.0、右侧余 53.4，两侧不等，且内容比宿主允许的窄 80px。 |

### A3 间距与节奏

| # | 位置 | 现象 |
|---|---|---|
| A3-1 | 卡间 14.7px / 行间 26px / 记录间 38.6px | 三套不同的垂直节奏同时出现在一列里；而它们的分隔手段完全相同（都是 1px `#F5F5F5`），层级无法区分。 |
| A3-2 | 卡1 高 136.7 只装 4 行（ink 高 91.3）；卡2 高 190 装 6 行 | 通栏 880 的容器里留白率 >50%，卡高度由最宽的容器宽度决定，而不是由内容决定。 |
| A3-3 | 页头按钮顶边 y 46，h1 带 56–71 | `alignItems:'flex-start'`（`lib/client.js:191-197`）使 32px 高按钮的重心比 20px 标题的视觉重心高约 6px，页头左右两半不在同一条视觉线上。 |
| A3-4 | 卡内首距 19 / 卡间 14.7 | **组内间距 > 组间间距**，违背接近性原则 → 观感是「一张长白纸上的几条细线」，而不是「几张分组的卡」。这是“卡片没有边界感”的结构性原因（不只是颜色问题）。 |

### A4 视觉一致性

| # | 位置 | 现象 |
|---|---|---|
| A4-1 | 卡片背景 | 实测卡内 `#FFFFFF` 与页面背景 `#FFFFFF` **完全相同**——`cardStyle: background: C.layer1`（`lib/client.js:199-205`），浅色主题下 `bg-layer-1` 与 `bg-base` 同值。卡片只剩 1px `#F5F5F5` 边框，对比度 **1.09:1**（非文本元素需 ≥3:1）。 |
| A4-2 | 按钮边框 `#E5E5E5` | 对比度 **1.26:1**，同样不达 3:1，按钮边界几乎不可见。 |
| A4-3 | 全面板用色 | 14 个令牌实际只用了 6 个；success 0 像素、error 0 像素，状态语义只靠文字。侧栏图标是品牌红、点进去后完全没有品牌色，入口与内部断裂。（注：宿主 `brand-primary` 实为 `#0F1115`，品牌红无法通过令牌获得，见 A6 令牌真相校正） |
| A4-4 | 卡2 首行值「100% · Fresh」 | 英文枚举 `Fresh` 在中文界面直接透出，未做本地化映射；同一串里「深睡」永远不显示——`lib/client.js:548` 读 `day.deep`，而 `lib/coros-api.js:471` 输出字段名是 `sleepDeep`（`day.deep` 恒为 `undefined`）。 |
| A4-5 | 三种卡 | 卡1 = Field 列表、卡3 = 记录列表、卡4 = Field + 裸块，三者语义完全不同却共用同一外观，组件语义没有分化。 |

### A5 可读性

| # | 位置 | 现象 |
|---|---|---|
| A5-1 | 卡3 meta 行 x 92.7–282.7 | 12px 里用 `·` 串起 4 个数值（`7.11 km · 35:32 · 5:00 /km · 157 bpm`）成长句，扫读成本高；数字未用 `tabular-nums`，跨行不对齐。 |
| A5-2 | 保修值 `2028-03-19 10:44:40` | 原始字符串直出精确到秒，信息价值低却占据主卡位置。 |
| A5-3 | 中英混排 | 标签中文、状态值英文、单位英文（`/km`、`bpm`）三者无统一规则。 |
| A5-4 | 交互 | 按钮只有默认样式，无 `:focus-visible`（键盘可达性弱）；登录 iframe 固定 `height:520px`（`lib/client.js:312-439`），窄窗会被压缩。 |

### A6 可访问性量化（浅色主题实测）

| 组合 | 比值 | 判定 |
|---|---|---|
| `label-primary #0F1115` / `#FFFFFF` | 18.90:1 | AAA ✓ |
| `label-secondary #61666B` / `#FFFFFF` | 5.80:1 | AA 正文 ✓ |
| `label-secondary #61666B` / `bg-overlay #E9ECF2` | 4.90:1 | AA 正文 ✓ |
| 卡边框 `border-l2 rgba(0,0,0,.10)` / `#FFFFFF` | **1.25:1** | 图形 ✗（需 3:1） |
| 卡边框 `border-l4 #00000029` / `#FFFFFF` | **1.74:1** | 图形 ✗ |
| brand `#E8503A` / `#FFFFFF` | 3.72:1 | 图形 ✓ / 正文 ✗ |
| brand `#E8503A` / `bg-overlay #E9ECF2` | 3.15:1 | 图形 ✓ |
| success `#22C55E` / `#FFFFFF` | **2.28:1** | 图形 ✗ |
| warn `#F59E0B` / `#FFFFFF` | **2.15:1** | 图形 ✗ |
| idle `#D4D4D4` / `#FFFFFF` | **1.48:1** | 图形 ✗ |
| error `#F25A5A` / `#FFFFFF` | 3.29:1 | 图形 ✓ / 正文 ✗ |
| focus `state-business-primary #4176E6` / `#FFFFFF` | 4.23:1 | 图形 ✓ / AAA-large ✓ |

> 上表全部用宿主 asar 中 `--dsw-static-*` 的真实值算出（`node .review-probe/contrast.mjs` 可复算）。修正前文档引用的 `#10B981 / #9CA3AF / #EF4444` 是 Tailwind 默认色，**不是本宿主的值**，已替换。

**硬约束（写进规格）**：`state-success / warn / idle` 在白底上达不到 3:1，**不能单独承载有意义的图形信息**。任何状态必须「文字词 + 图形」双编码；颜色只能作为 <12px 的辅助（8px 圆点、2px 描边），且圆点必须 `aria-hidden`，语义由文字承担。`brand` 只能用于图形与描边，不能做 13px 正文色。

**⚠ 令牌真相校正（实测 asar，推翻先前若干假设）**

| 令牌 | 浅色真实值 | 影响 |
|---|---|---|
| `--dsw-alias-bg-base` | `#FFFFFF` | — |
| `--dsw-alias-bg-layer-1` | `#FFFFFF` | 与 base 同色，**不可用于分层** |
| `--dsw-alias-bg-layer-2` | `#FFFFFF` | 与 base 同色，**不可用于分层**；Hero 底色若用它 = 不可见 |
| `--dsw-alias-bg-overlay` | `#E9ECF2` | **唯一有可见色差的抬升面**，Hero 必须用它 |
| `--dsw-alias-brand-primary` | `#0F1115`（近黑） | **不是 #E8503A**。设计稿要求「环用 brand 色」实际渲染是黑色圆环 |
| `--dsw-focus-ring-color` | 未定义（主题层无值） | 必须写 `var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary))` |
| `--dsw-radius-xs/sm/md/lg/xl/panel` | `4 / 8 / 12 / 16 / 20 / 28 px` | 文档原 fallback `10px`/`6px` 是错的 |
| `--dsw-elevation-stroke/soft/panel/prominent` | 存在 | 「14 令牌里没有 elevation」的论断不成立 |

**品牌色落地决定**：`#E8503A` 只存在于本插件 `icon.svg`。侧栏图标用 `#E8503A` 是对的（图标是插件自有资产），但**面板内部不强行注入品牌红**——宿主 `brand-primary` 语义是「主色」，在本主题里就是近黑。Hero 双环的进度色改用 `var(--dsw-alias-label-primary)`（近黑，18.90:1，最稳），品牌红仅保留在侧栏图标与 Hero 环的 `stroke` 可选点缀位，且必须有非颜色冗余编码。

---

## B. 新版信息架构与布局

### B1 区块顺序与理由

| 序 | 区块 | 版式 | 为什么在这个位置 |
|---|---|---|---|
| 1 | **Hero：恢复状态 + 4 项指标** | `bg-overlay` 填充条（r16 / p20），88px 双环 + 状态词 + 4 列指标（VO2max / 跑步水平 / 阈值配速 / 近 7 天跑量） | 一眼结论优先：今天能不能练、身体什么水平、这段时间练了多少 |
| 2 | **训练安排** | 分区行列表（日期列 76 + 标题 + 说明） | 最高频的「今天练什么」，必须在首屏第一分区 |
| 3 | **近期运动** | 分区行列表（名称 + 日期 / 右侧 4 列指标） | 已发生的事实，与训练安排形成「计划 vs 实际」对照 |
| 4 | **健康与睡眠** | 2×2 KPI + 7 日睡眠柱 + 均值注脚 | 解释前两块为什么是这样 |
| 5 | **成绩预测** | 2×2 指标格（15/600） | 能力评估的延伸，弱于恢复但强于设备 |
| 6 | **绑定设备** | 单行内联（名称 · 序列号 · 保修至日期） | 元信息，收进末尾一行 |
| 7 | 脚注 | 11/16 | 数据来源 + 更新时间 |

宽档（容器 ≥940）两栏：左列 `训练安排 / 近期运动`，右列 `健康与睡眠 / 成绩预测 / 绑定设备`，`grid-template-columns: minmax(0,1.62fr) minmax(320px,1fr)`，`column-gap:32`。Hero 跨两栏。
窄档（<940）单列，顺序同 B1（训练安排 → 近期运动 → 健康 → 预测 → 设备）。

### B2 响应式行为（由容器宽度驱动，不依赖 props）

`CSS.supports('container-type: inline-size')` 在本宿主实测为 `true`，`@container` 规则实测生效（Chrome 155）。面板收不到 props 但容器宽度随主区变化 → **用 container query 挂在根节点上**。

| 断点（容器宽） | 布局 | 实测 |
|---|---|---|
| ≥940 | 两栏 1.62:1，hero = 88px 环 + 文字列 + 4 指标同行 | 1400 → 623.3 / 384.7，hero 高 128 |
| 940（临界，实测 941/940 两栏，939 单列） | 两栏塌单列，hero 指标下沉为整行 4 列 | 939 → 单列，hero 高 188 |
| 520–939 | 单列，hero 两行（环+状态 / 指标 4 列），动作行两行（名称+日期 / 4 指标） | 640 → hero 188，动作行 88 |
| <520 | 指标 2×2，动作行 2×2，健康/预测改单列 | 519 → hero 248，动作行 134 |

五种宽度实测均无 `scrollWidth > clientWidth`、无元素越界、无文字截断（`clipped = []`）。

### B3 页高（首屏预算）

| 宽度 | 整页高 | 结论 |
|---|---|---|
| 1400 | 861 | — |
| 1006（用户实测视口） | 861 | 806 可视高度内可看到 **h1/副标题/hero/训练安排/近期运动/健康与睡眠/成绩预测/绑定设备**，仅脚注末尾 15px 需滚动 |
| 640 | 1550 | 单列自然变长，属预期 |

对比现状：首屏只能看到 3.5 张卡，训练安排 **0 可见**。

---

## C. 组件级规格

### C1 间距刻度（4 基准）

| 记号 | 值 | 用途 |
|---|---|---|
| `--s1` | 4 | 图标↔文字、单位↔数值 |
| `--s2` | 8 | 分区标题↔首行、柱图 gap、动作行窄档下行 |
| `--s3` | 12 | 行内 padding-y、动作行列 gap、标签↔值（横向） |
| `--s4` | 16 | 页头 gap、状态词↔圆点、指标分隔线 padding-left、状态块 padding |
| `--s5` | 20 | hero padding、指标列 padding-left（窄档） |
| `--s6` | 24 | 页头 padding-top、健康格 column-gap、窄档分区 margin-top |
| `--s7` | 28 | 分区间距（宽档 `.sec { margin-top }`） |
| `--s8` | 32 | 两栏 column-gap、脚注 margin-top |
| `--s10` | 40 | 页面左右 padding 上限、页面 padding-bottom |

页面左右 padding：`clamp(16px, 3.5cqw, 40px)`（跟随**容器**宽度而非视口，实测 1400→40、1006→35.2、640→22.4、520→18.2）。

### C2 字号 / 字重 / 行高

| 语义 | size / weight / line-height | 用于 |
|---|---|---|
| Page title | 20 / 500 / 28 | 昵称（h1） |
| Metric XL | 24 / 700 / 28 | 环中心 `100%`（`tabular-nums`，`letter-spacing:-.01em`） |
| Status | 18 / 600 / 24 | 「状态良好 / Ready to train」 |
| Metric L | 18 / 600 / 24 | hero 4 指标、健康 4 KPI |
| Metric M | 15 / 600 / 22 | 成绩预测值 |
| Section title | 14 / 500 / 20 | 分区标题（与宿主 `.sectionTitle` 一致） |
| Body | 13 / 400 / 20 | 副标题、说明、整页基准 |
| Body strong | 13 / 600 / 20 | 运动名、训练标题、设备名、行内数值 |
| Meta | 12 / 400 / 18 | 标签（`hk`/`act-k` 上方标签）、日期、单位、分区右侧计数 |
| Micro | 11 / 400 / 16 | 动作行指标标签、柱图 x 轴、脚注 |

规则：数值一律 `font-variant-numeric: tabular-nums`；单位比数值小 1 档且用 `label-secondary`，与数值**同基线**（`margin-left:2px`，不换行）。

### C3 圆角 / 边框 / 分隔线

| 项 | 值 | 说明 |
|---|---|---|
| 圆角 · 容器 | `var(--dsw-radius-lg, 16px)` | Hero 条、空/错误态块 |
| 圆角 · 控件 | `var(--dsw-radius-sm, 8px)` | 文字按钮、状态块内按钮 |
| 圆角 · 胶囊 | `999px` | 状态圆点 |
| 圆角 · 柱 | `2px 2px 0 0` | 睡眠柱顶部 |
| 分隔线 | `0.5px solid var(--dsw-alias-border-l2)` | 分区行之间、指标之间（与宿主 `.facts`/`.rows` 规范一致） |
| 边框 | `0.5px solid border-l2` | 仅用于空态/错误态块轮廓 |
| 阴影 | `var(--dsw-elevation-stroke)` | 仅用于 Hero 条，与底色 `bg-overlay` 叠加；宿主存在 `--dsw-elevation-stroke/soft/panel/prominent`，但浅色下几乎不可见，**不作为主要层级手段** |

圆角优先复用宿主令牌族 `--dsw-radius-xs/sm/md/lg/xl`（已在 `pluginmanager.js` 中确认为宿主实际使用的令牌）；括号内为浅色主题下实测 fallback，保证令牌缺失时也可渲染。行内边距按宿主 `.V7pFBG_row{padding:12px 2px}` 对齐为 `padding:12px 2px`（2px 横向内缩，使分隔线与文字起点一致）。

为什么不用 1px `border-l1`：`border-l1` 在白底上 1.09:1，看不见；`border-l2` 为 `#E5E5E5`（1.26:1），0.5px 在半透明下更轻但**位置精确、成组出现**——靠“成组的细线”而不是“强对比的框”建立层级，与宿主自身风格一致。

### C4 对齐规则（三条，不得增加）

1. **左基线**：所有文本块、分区标题、行内容一律贴容器左边缘（0 缩进）。不允许“二级缩进列表”。
2. **右基线**：分区右侧计数（`本周 3 项`）、动作行 4 列指标、页头按钮组，一律贴容器右边缘。
3. **指标列**：多列指标用 `grid` 等分 + `text-align:right`（宽档动作行）或左对齐（KPI 格），同一区块内**只用一种**。

明确禁止：用 `minWidth` 硬钉标签列（现状 88px 的问题）；裸日期/无标签行直接贴在 Field 结构下方（现状卡4 的问题）。

### C5 空态 / 错误态 / 加载态

| 态 | 规格 |
|---|---|
| **空态** | 块级：`padding:16`、`0.5px border-l2`、`r16`、13/20 `label-secondary`；16px 内联 SVG 图标（日历/列表）+ 一句「该账号还没有训练计划 · No training plan on this account yet」。**分区标题与右侧计数保留**，块不消失。 |
| **错误态** | 同上容器；图标描边改 `state-error`；文案说明「读取失败，已保留上次数据」；右侧 28px 文字按钮「重试 Retry」（`margin-left:auto`）。单分区失败不影响其他分区（`Promise.allSettled` 已有）。 |
| **加载态** | 骨架：每行 `padding:12px 2px`，2 条 12px 高、`bg-overlay` 底色、`r4` 的条，宽度 34%/62%，行间 8。禁止整页 spinner。 |
| **登录/过期** | 保持现有 iframe 结构，但 `height` 改 `min(520px, 70vh)`；过期提示改「文字 + `state-warn` 8px 圆点」双编码。 |

### C6 交互与焦点

- 文字按钮：`height:28px`、无边框、`padding:0`、hover 用 `box-shadow: 0 0 0 6px bg-overlay`（不改变布局）、`focus-visible: outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-alias-state-business-primary, #4176e6); outline-offset:2px`。
- 焦点令牌 `--dsw-focus-ring-width` / `--dsw-focus-ring-color` 为宿主实际使用（已在 `pluginmanager.js` 中确认），优先复用而非自造。**但 `--dsw-focus-ring-color` 在浅色主题下未定义**，宿主自身的兜底写法是 `var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary))`，因此本方案也必须带这个兜底，否则 `outline` 会退化成 `currentColor`。
- 页头对齐：宿主 `.V7pFBG_pageHead` 用 `align-items:flex-start`，但宿主标题为 20/500/28、按钮高 32，二者重心本就相差 6px；本方案改为 `align-items:flex-end` 让按钮底边与副标题基线成组，是**有意改进**，不视为违背宿主规范。
- 「退出登录」用 `label-secondary` + 字重 400 弱化，与「刷新」拉开主次。
- 全部动效遵守 `prefers-reduced-motion: reduce`。
- 图表（睡眠柱）必须 `role="img"` + `aria-label` 提供完整文字描述。

---

## D. 视觉稿（可照做）

### D1 宽档 ≥940（以 1400 容器为例，实测值）

```
page: max-width 1120, margin 0 auto, padding 0 clamp(16px,3.5cqw,40px) 40px   ← 1400 时 padding=40，内容宽 1040

┌───────────────────────────────────────────────────────────────────────────────┐
│  lyy                                                      ↻ 刷新   退出登录    │ head: padding 24 0 20; gap 16; align-items flex-end
│  COROS 账号 · 设备与运动健康总览 · 近 7 天                                      │ h1 20/500/28; sub 13/20 margin-top 4
│                                                                    h=96       │
├───────────────────────────────────────────────────────────────────────────────┤
│ ┌ hero  bg-overlay  r16  p20  h128 ─────────────────────────────────────────┐ │ margin-top 0（紧接 head）
│ │  ┌──┐   恢复状态 12/18        │最大摄氧量│跑步水平│阈值配速│近7天跑量│      │ │ grid: 88px 154.1px 1fr；column-gap 20
│ │  │◯ │   ● 状态良好 18/600/24  │57 ml/kg │77 /100 │4:53 /km│46.8 km │      │ │ 环 r40 stroke8，dasharray 251.33，rotate -90
│ │  │100│   完全恢复·10月31日…12 │18/600/24│        │        │         │      │ │ 指标列 4×179.5，padding-left 16，border-left .5px l2
│ │  └──┘                        │         │        │        │         │      │ │ 第一列无 border-left
│ └───────────────────────────────────────────────────────────────────────────┘ │
│                                        ↓ .sec { margin-top:28 }               │
│ ┌ 左列 623.3 ─────────────────────┐  32  ┌ 右列 384.7 ────────────────────┐   │
│ │ 训练安排              本周 3 项 │      │ 健康与睡眠             近 7 天  │   │ sec-h: margin-bottom 8
│ │ 今天   Base 3 · 10 km…   h=64  │      │ ┌ 2col gap24 / row-gap14 ─────┐ │   │ title 14/500/20；sec-m 12/18
│ │ ───────────────── .5px l2 ──── │      │ │ 静息心率      HRV 基线      │ │   │ KPI 项：hk 12/18 + 2 + value 18/600/24
│ │ 明天   阈值间歇 5×1000m         │      │ │ 52 bpm        78 ms         │ │   │
│ │ ───────────────── .5px l2 ──── │      │ │ 昨晚睡眠      昨日步数      │ │   │
│ │ 11-01  长距离 22 km            │      │ │ 7h 38min      1,782         │ │   │
│ │                                │      │ └────────────────────────────┘ │   │
│ │ 近期运动   近 7 天·6 次·46.8km │      │  [7 根柱] h40 gap8，柱 2px 顶圆 │   │ chart margin-top 16
│ │ 室内跑 10-30 07:12   7.11 35:32│      │  7.6 6.4 7.1 8.2 6.8 7.2 7.3     │   │ bar-v 11/14；xlab 11/16
│ │                      km  时长  │      │   24  25  26  27  28  29  30    │   │ 当天柱 label-secondary，其余 border-l2
│ │ ───────────────── .5px l2 ──── │      │ 7 天平均 7h15 · 深睡1h12 · REM… │   │ chart-note 12/18 margin-top 10
│ │ 户外跑 10-29 18:40   5.02 26:11│      │                                 │   │
│ │ ───────────────── .5px l2 ──── │      │ 成绩预测           来自体能评估 │   │
│ │ …（最多 4 条，行高 60）         │      │ 5 km 19:42   10 km 41:08        │   │ preds 2col gap24/14，值 15/600/22
│ │                                │      │ 半马 1:31:20 全马 3:12:40       │   │
│ │                                │      │                                 │   │
│ │                                │      │ 绑定设备                 1 台   │   │
│ │                                │      │ COROS PACE 4 · W35B… · 保修至…  │   │ dev: padding 10 0，单行 flex-wrap
│ └────────────────────────────────┘      └─────────────────────────────────┘   │
│  数据来自 COROS MCP · 更新于 2026-10-30 16:42         foot 11/16 margin-top 32 │
└───────────────────────────────────────────────────────────────────────────────┘
```

关键数值：hero 128；`.sec` 间距 28；`.sec-h` 高 28（20+8）；`.pl` 行 64（12+20+2+18+12）；`.act` 行 60（12+36+12，act-nums 4×72 + gap 12 = 324）；`.hgrid` 高 ~106；`.chart` 106；`.preds` 98；`.dev` 40；`foot` 16。

### D2 窄档 520–939（以 640 为例，实测）

```
page padding = 22.4（clamp），内容宽 595.2

┌───────────────────────────────────────────────┐
│ lyy                        ↻ 刷新             │ head 仍 flex-end，按钮不与标题抢行
│ COROS account · devices, workouts…            │ sub 可自然折行
├───────────────────────────────────────────────┤
│ ┌ hero r16 p20 h188 ────────────────────────┐ │ grid: 88px 1fr；row-gap 16
│ │  ◯ 88     恢复状态 12/18                   │ │ 第 1 行：环 + 文字列（447.2）
│ │  100%     ● 状态良好 18/600/24             │ │
│ │           完全恢复 · 10月31日 08:00 前 12  │ │
│ │ ─────────────────────────────────────────  │ │ 第 2 行：metrics 跨两列
│ │ 最大摄氧量  跑步水平  阈值配速  近7天跑量   │ │ 4×138.8，padding-left 16，border-left .5px
│ │ 57 ml/kg    77 /100   4:53 /km  46.8 km    │ │
│ └───────────────────────────────────────────┘ │
│ 训练安排                          本周 3 项   │
│ 今天    Base 3 · 10 km 轻松跑 + 4×800m        │ pl-when 76px 定宽，标题与说明折行不缩进
│         有氧基础 · 预计 55 分钟 · 5:30–5:50   │
│ ─────────────────── .5px l2 ───────────────── │
│ …                                              │
│ 近期运动          近 7 天 · 6 次 · 46.8 km    │
│ 室内跑 10-30 07:12                            │ 第 1 行：名称 + 日期（grid 1fr）
│ 7.11      35:32      5:00       157           │ 第 2 行：4 等分指标，左对齐，h=88
│ km        时长       配速 /km   bpm           │
│ ─────────────────── .5px l2 ───────────────── │
│ 健康与睡眠                           近 7 天  │
│ 静息心率             HRV 基线                 │ 2×2，column-gap 24
│ 52 bpm               78 ms                    │
│ 昨晚睡眠             昨日步数                  │
│ 7 h 38 min           1,782                    │
│ [柱] h40 gap8 … 24 25 26 27 28 29 30          │
│ 7-day avg 7h 15min · Deep 1h 12min · REM …    │
│ 成绩预测                     from fitness     │
│ 5 km 19:42           10 km 41:08              │
│ 绑定设备                          1 device    │
│ COROS PACE 4 · W35B063695 · Warranty until …  │
└───────────────────────────────────────────────┘
```

### D3 <520（极端窄）

指标 2×2（`padding-left:20`、偶数列加 border-left）、动作行指标 2×2、健康/预测单列。实测 519 时 hero 248、动作行 134，无截断。

### D4 空 / 错误 / 骨架（窄档片段）

```
训练安排 · Training schedule
┌───────────────────────────────────────────────┐  padding16, .5px l2, r16
│ ▤  该账号还没有训练计划 · No training plan…   │  图标 16px 描边 label-secondary
└───────────────────────────────────────────────┘
体能评估 · Fitness
┌───────────────────────────────────────────────┐
│ ⊙  读取失败，已保留上次数据 · Failed to load…  │  图标描边 state-error
│                                    重试 Retry │  28px 文字按钮 margin-left auto
└───────────────────────────────────────────────┘
近期运动 · Recent activities             加载中
▬▬▬▬▬▬▬▬▬ 34%                                  12px 高，bg-overlay，r4
▬▬▬▬▬▬▬▬▬▬▬▬▬▬ 62%
```

---

## E. 按优先级排列的调整清单

### P0（不改则新设计不成立）

| # | 改什么 | 为什么 | 怎么改 |
|---|---|---|---|
| P0-1 | 四张等宽白卡 → Hero 填充条 + 分区行列表 | 浅色主题 `bg-layer-1 == bg-base == #FFFFFF`，卡片边框 1.09:1，无法表达层级；且组内距 19 > 组间距 14.7，卡片语义本身没建立 | 删 `cardStyle` 的 background/border/radius（`lib/client.js:199-205`），新增 `.hero`（`bg-overlay`、r16、p20）与 `.sec`（`title 14/500` + `.rows` 用 `0.5px solid border-l2` 分隔） |
| P0-2 | 区块顺序：训练安排提到第一位，绑定设备降到末尾 | 首屏 5 块里「今天练什么」当前 0 可见；设备元信息占了首屏第一张卡 | `Dashboard`（`:572-654`）渲染顺序改为 `Hero → 训练安排 → 近期运动 → 健康与睡眠 → 成绩预测 → 绑定设备`；宽档左列承载前两块 |
| P0-3 | Hero 建立唯一主指标 | 现状恢复状态与序列号同 13px/400；面板里灰像素是黑像素 2.8 倍 | 88px SVG 双环（底 `border-l2` / 进度 `label-primary`，stroke 8，`dasharray 251.33`，`rotate(-90 44 44)`）+ 中心 24/700；右侧状态词 18/600；4 指标 18/600。**环用 `label-primary`（18.90:1）而非 brand**——宿主 brand 是近黑，语义上等价但更稳；品牌红只出现在侧栏图标 |
| P0-4 | 修两个真 bug | 「深睡」永远不显示；英文枚举 `Fresh` 直出 | `lib/client.js:548` `day.deep` → `day.sleepDeep`；新增 `levelMap`：`Fresh/Rising/…` → 中文「状态良好/恢复中/…」，英文加 `Ready to train` 等 |
| P0-5 | 去掉双重留白 | 插件 `padding 24/28 + maxWidth 880` 叠在宿主 `padding clamp(24,4vw,48) + max-width 960` 上，两侧留白不等 | `pageStyle` padding 改 `0 clamp(16px,3.5cqw,40px) 40px`；`innerStyle` maxWidth 改 `1120px`；根节点加 `container-type: inline-size` |

### P1（决定“好不好用”）

| # | 改什么 | 为什么 | 怎么改 |
|---|---|---|---|
| P1-1 | 废弃 `minWidth 88px` 标签列，改「标签在上、数值在下」的指标格 | 中文最长标签后留 31px 空隙；英文 `Threshold pace` 90px 已溢出 88px | 指标格：`hk` 12/18 `label-secondary` + `value` 18/600/24（hero、健康、预测统一） |
| P1-2 | 近期运动行改 4 列指标（右对齐 72px 列） | meta 长句（`7.11 km · 35:32 · 5:00 /km · 157 bpm`）扫读成本高；未用 tabular-nums | `.act` grid `1fr auto`；`.act-nums` `4×72px / gap 12 / text-align right`；上值 13/600/20、下标签 11/16；窄档（<940）下沉为 4 等分左对齐 |
| P1-3 | 健康与睡眠：2×2 KPI + 7 日睡眠柱 + 均值注脚 | 现状裸日期 + 无标签 meta 形成第三套对齐基线，且深睡/REM 解析了却不用 | `.hgrid` 2 列；柱图 7 个 div（`bg-overlay` 柱 / 当天 `label-primary`），高 40 + gap 8，顶部 11px 数值、底部 11px 日期；`role="img"` + `aria-label`；注脚给 7 天均值/深睡/REM |
| P1-4 | 落地「成绩预测」分区 | `predictions[]` 已解析、DICT 已定义、渲染零引用 | 2×2 格，值 15/600/22；标签由 `*Prediction` 键裁剪为 `5 km / 10 km / Half marathon / Marathon` |
| P1-5 | 训练安排行加日期列，空态不再消失 | 现在 `empty` 直接 `return null`，用户看不到“没有计划”这个事实 | `.pl-when` 76px（今天/明天/11-01）；空态用 C5 的空态块，**保留分区标题**；只取前 3 条 |
| P1-6 | 按钮改文字按钮，页头 `align-items:flex-end` | 32px 描边按钮（边框 1.26:1）与 20px 标题重心差 6px，页头噪声大 | `.tbtn`：28px 高、无边框、hover 用 `box-shadow 0 0 0 6px bg-overlay`；退出登录用 `label-secondary`；`focus-visible` 2px `state-business-primary` + offset 2 |

### P2（打磨）

| # | 改什么 | 为什么 | 怎么改 |
|---|---|---|---|
| P2-1 | 数值统一 `tabular-nums` | 多行数值不对齐，扫读跳 | 所有数值类 span 加 `font-variant-numeric: tabular-nums` |
| P2-2 | 单位降一档并同基线 | 单位与数值同字号同级，干扰读数 | `font-size:12; color:label-secondary; margin-left:2px` |
| P2-3 | 设备行合并为单行，保修只到日 | `2028-03-19 10:44:40` 秒级信息无价值 | `COROS PACE 4 · W35B063695 · 保修至 2028-03-19`，`padding 10 0`，flex-wrap |
| P2-4 | 近期运动限 4 条 | 长列表会把后续分区挤出首屏 | `records.slice(0,4)`，分区右侧给「近 7 天 · N 次 · 合计 km」 |
| P2-5 | 脚注 11/16 + 更新时间 | 现状 11px 但无更新时间，用户无法判断数据新旧 | `foot` 11/16 `label-secondary`，`margin-top 32`；显示 `fetchedAt` |
| P2-6 | 键盘与动效 | 按钮无 focus 样式；无 reduced-motion 处理 | `:focus-visible` 统一 `outline: var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))` + offset 2；`@media (prefers-reduced-motion: reduce)` 关闭过渡 |
| P2-7 | 登录 iframe 高度自适应 | 固定 520px 在窄窗挤压 | `height: min(520px, 70vh)` |

---

## F. 数据字段取舍

### F1 用上（首屏/一级）

| 字段 | 位置 | 呈现 |
|---|---|---|
| `profile.nickname` | h1 | 20/500/28 |
| `range.days` | 副标题、分区右侧 | 「近 7 天」 |
| `recovery.percent` | Hero 环中心 | 24/700 |
| `recovery.level` | Hero 状态词 | 18/600 + 8px 圆点（需本地化映射） |
| `recovery.estimatedFullRecovery` | Hero 注 | 12/18 |
| `fitness.vo2max` / `runningLevel` / `thresholdPace` | Hero 指标 1–3 | 18/600 + 单位 12 |
| `activities.range` 汇总（`records` 求和）→ 周跑量 | Hero 指标 4 | 18/600 + 单位 12（例 `46.8 km`） |
| `fitness.predictions[]` | 成绩预测分区 | 15/600/22 |
| `activities.records[].sportType` | 近期运动行首 | 13/600 |
| `…date` | 同行 | 12/18 次要色 |
| `…distance` / `duration` / `averagePace` / `averageHeartRate` | 右侧 4 列 | 13/600 + 11/16 标签 |
| `health.restingHeartRate` / `hrvBaseline` | 健康 2×2 | 18/600 |
| `health.days[].date` / `sleepTotal` | 7 日柱 + x 轴 | 柱高线性映射，11px 值/日期 |
| `health.days[].sleepDeep` / `sleepRem` | 柱图注脚 | 12/18（修 bug 后才可用） |
| `health.days[].steps` | 健康 KPI | 18/600 |
| `schedule.entries[].title` (+ 展开的 pipe 字段) | 训练安排行 | 13/600 + 12/18 说明 |
| `devices[].name` | 绑定设备行 | 13/600 |
| `fetchedAt` | 脚注 | 11/16 |

### F2 弱化 / 收进次级区

| 字段 | 处理 | 理由 |
|---|---|---|
| `devices[].serialNumber` | 与设备名同行，12/18 `label-secondary` | 校验设备时需要，但不需要独立成行 |
| `devices[].warrantyExpires` | 截断到日期（去时分秒），同行次要色 | 秒级精度无价值 |
| `devices[].bluetoothId` / `modelName` | 首版不显示 | 与 `name` 重复或过于底层 |
| `devices.count` | 分区右侧计数「1 台」 | 不占正文 |
| `activities.records[].calories` | 首版不进动作行 | 4 列已满，第 5 列会把行宽推到折行 |
| `activities.range` | 折成分区右侧「近 7 天 · 6 次 · 46.8 km」，同一数值复用为 Hero 第 4 指标 | 作为上下文而非正文 |

### F3 首版不显示

| 字段 | 理由 |
|---|---|
| `activities.records[].location` / `labelId` / `sportTypeCode` | 室内跑无 location；后两者是内部标识 |
| `health.days[].calories` / `exercise` / `sleepLight` / `sleepAwake` | 与 `sleepTotal` 信息重叠；首版面板目标不是睡眠结构分析 |
| `profile.gender` / `height` / `weight` / `birthday` | 账号资料，不是运动面板的核心问题 |
| `*.raw`（全部解析器的原始文本） | 仅排障用，绝不进入 UI |

信息密度上限（硬规则）：**首屏 ≤ 3 个视觉层级 + ≤ 1 个图表 + ≤ 4 个动作行**。超过即移到次级区或折叠。

---

## 附：实现落点索引（`lib/client.js`）

| 现状 | 行号 | 动作 |
|---|---|---|
| `pageStyle` / `innerStyle` | 179-189 | P0-5 改 padding + maxWidth + container-type |
| `headerStyle` | 191-197 | P1-6 `align-items: flex-end` |
| `cardStyle` | 199-205 | P0-1 拆成 `.hero` + `.sec` |
| `cardTitleStyle` | 207-214 | P0-1 改 14/500/20 + `margin-bottom:8` |
| `rowStyle` / `keyStyle` / `valueStyle` | 216-218 | P1-1 废弃 minWidth 88 |
| `buttonStyle` | 220-236 | P1-6 改文字按钮 |
| `Vitals` | 472-488 | P0-3 拆成 Hero（环 + 状态 + 4 指标） |
| `Activities` | 490-526 | P1-2 + P2-4 |
| `Health` | 528-556 | P1-3（含 `:548` 的 `day.deep` → `day.sleepDeep`） |
| `Schedule` | 558-570 | P1-5 空态不再 `return null` |
| `Dashboard` | 572-654 | P0-2 重排 + 宽档两栏 |
| DICT | 25-122 | 新增 `levelMap` 与训练安排日期/说明文案 |
