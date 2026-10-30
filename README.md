# 高驰运动 · dsh-coros-sport

在 DeepSeek Harness 桌面端里直接登录高驰（COROS）账号，查看你的设备、运动记录、恢复与体能状态、每日健康数据。

登录在应用窗口内完成 —— 不弹系统浏览器、不跳外部应用、不需要手工粘贴令牌。

> 当前版本 `0.1.0`，首版范围只读：所有数据都是查询，不会修改你的训练计划或运动记录。

---

## 目录

- [功能](#功能)
- [安装](#安装)
- [使用](#使用)
- [工作原理](#工作原理)
- [数据与隐私](#数据与隐私)
- [区域](#区域)
- [配置](#配置)
- [故障排查](#故障排查)
- [开发](#开发)
- [许可](#许可)

---

## 功能

安装后，桌面端左侧面板列表会出现「高驰运动」入口（位于「插件市场」之后、「自动化任务」之前）。点击进入：

| 区块 | 内容 | 数据来源（MCP 工具） |
| --- | --- | --- |
| 账号 | 昵称、性别、身高、体重、生日 | `queryUserInfo` |
| 设备 | 绑定的高驰设备名称、蓝牙 ID、型号、序列号、保修到期 | `queryDevices` |
| 恢复 | 恢复百分比、状态等级、预计完全恢复时间 | `queryRecoveryStatus` |
| 体能 | VO₂max、跑力等级、阈值配速、5K/10K/半马/全马预测 | `queryFitnessAssessmentOverview` |
| 运动记录 | 近 7 天活动的类型、日期、地点、距离、时长、配速、平均心率、卡路里 | `querySportRecords` |
| 健康 | 逐日步数、卡路里、锻炼时长、压力、睡眠分期，以及静息心率与 HRV 基线 | `queryDailyHealthData` |
| 训练计划 | 本周安排的训练课 | `queryTrainingSchedule` |

七个区块并行加载，任何一个失败只影响它自己的卡片，不会让整页白屏。

## 安装

前提：DeepSeek Harness 桌面端已安装并至少启动过一次（需要 profile 目录已初始化）。

**方式一：本地目录安装（推荐用于开发）**

1. 获取代码：

   ```bash
   git clone <repo-url> dsh-coros-sport
   cd dsh-coros-sport
   ```

2. 在 Harness 会话里安装该目录：

   ```
   plugin_manager  action=install_bundle  target=D:\path\to\dsh-coros-sport
   ```

   其中 `target` 必须是**绝对路径**。安装工具会自行处理依赖与 profile 里的 bundle 注册，请不要手工编辑 profile 的 `package.json` 或 `cordis.patch.yml`。

3. 重启桌面端，左侧面板列表即出现「高驰运动」。

**方式二：从 npm 安装**

```
plugin_manager  action=install_bundle  target=dsh-coros-sport
```

安装结果里 `application` 为 `applied` 才算生效；若出现 `warnings`，按其提示处理后再重启。

## 使用

1. 点击左侧「高驰运动」。
2. 首次进入是一个登录页，点「登录高驰账号」。
3. 登录表单会**在面板内部**展开：输入高驰账号（邮箱/手机号）与密码，按页面提示完成授权。
4. 授权成功后表单自动收起，数据立即加载。
5. 之后每次打开都是直接显示数据，直到令牌过期。

令牌过期后页面会提示重新登录，点击即可，无需重新输入任何配置。

**退出登录**：面板右上角菜单可以清除本机保存的令牌。

## 工作原理

高驰官方 MCP 服务使用 OAuth 2.0 授权码 + PKCE。本插件的完整流程：

```
点击登录
   ↓
动态注册客户端 (POST /connect/register)  →  client_id
   ↓
创建 CLI 登录会话 (POST /api/v1/cli/login-sessions)  →  loginUrl
   ↓
在面板内用 iframe 打开 loginUrl  ← 你在这里输入账号密码并授权
   ↓
轮询会话状态 (POST .../claim, X-Poll-Token)  →  authorized + loginTicket
   ↓
用 loginTicket 换授权码 (GET /oauth2/authorize?login_ticket=...)
   ↓
换令牌 (POST /oauth2/token, PKCE code_verifier)  →  access_token + refresh_token
   ↓
调用 MCP 工具 (POST /mcp, JSON-RPC tools/call)
```

几个实现上的关键点：

- **令牌 30 天、refresh token 180 天，且每次刷新都会换发新的 refresh token**。所以刷新必须串行（单飞），否则并发刷新会让其中一个令牌作废。
- **`loginTicket` 一次性**：拿到后必须立刻兑换授权码，不能存起来稍后再用。
- 高驰的 `tools/call` 返回的是一段**人类可读的纯文本**，不是 JSON，所以每个区块都有对应的文本解析器。
- MCP 传输是无状态的（`protocolVersion 2025-06-18`），不需要 `Mcp-Session-Id`，也不发 `notifications/initialized`。

## 数据与隐私

- **密码不落盘**。密码只在你本机的浏览器环境里提交给高驰的登录页（`opencn.coros.com`），插件本身从不读取、不存储、不转发它。
- **只保存令牌**。令牌存在 Harness 的 `credentials` 服务里（`CredentialKey = coros-sport:oauth`）；该服务不可用时退回 `~/.dsh-coros-sport/token.json`，文件权限 `0600`。
- **不经过第三方服务器**。所有请求从你的机器直连高驰官方端点（`mcpcn.coros.com` / `mcpeu.coros.com` / `mcpus.coros.com`），插件没有自建后端。
- **退出登录会删除本机令牌**，并在高驰侧调用 `revoke` 端点尝试吊销。
- 面板只读取数据，**不会写入或修改**你在高驰的任何训练计划、课程或记录（首版不含写能力）。

## 区域

高驰把服务分成三个集群，账号属于哪个就选哪个，选错会登录失败或查不到数据：

| 区域 | 端点 |
| --- | --- |
| 中国大陆（默认） | `https://mcpcn.coros.com` |
| 欧洲 | `https://mcpeu.coros.com` |
| 北美 | `https://mcpus.coros.com` |

默认是 `cn`。如果你在海外注册的账号，可在 Harness 的插件配置里改 `region` 为 `eu` 或 `us`。

## 配置

插件配置项（在 profile 的 bundle patch 里可覆盖）：

| 键 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `region` | `"cn" \| "eu" \| "us"` | `"cn"` | 高驰服务区域 |
| `issuer` | `string` | 空 | 直接指定 issuer，覆盖 `region` 的推导（自建代理时用） |
| `overviewDays` | `number` | `7` | 运动记录与健康数据的默认回溯天数 |

## 故障排查

**左侧没有出现「高驰运动」**

- 确认安装结果的 `application` 是 `applied`，且已重启桌面端。
- 若面板列表被折叠到「更多」里，点「更多」查看；侧栏折叠成图标轨道时面板列表整列隐藏，展开侧栏即可。
- 插件加载失败时入口不会出现 —— 查看 Harness 日志里的 `dsh-coros-sport` 相关报错。

**登录页白屏或一直转圈**

- 这台机器需要能访问 `opencn.coros.com` 与 `mcpcn.coros.com`。企业网络可能拦截。
- 若内嵌登录页被网络策略拦截，面板会提示改用系统浏览器完成登录（同一套授权流程，只是窗口不同）。

**登录后立刻又要求登录**

- 多半是区域选错。确认账号归属后用对应的 `region` 重试。

**数据区块显示「加载失败」**

- 单个区块失败不影响其他区块。重新加载页面即可重试。
- 若全部失败且提示未授权，说明令牌已过期，重新登录。

**授权成功但卡在等待**

- `loginTicket` 是一次性的，若同一授权重复被消费会失败。关闭面板重新登录一次即可。

## 开发

```
dsh-coros-sport/
├── lib/
│   ├── index.js       Host 半边：Cordis 插件入口、HTTP 路由、数据聚合
│   ├── coros-auth.js  登录会话与令牌生命周期（单飞刷新、轮换）
│   ├── coros-api.js   纯协议层：OAuth 请求、MCP 调用、文本解析器
│   └── client.js      Client 半边：侧栏入口 + 主面板 UI
├── locale/{zh,en}.json  插件元数据（标题、描述）
├── icon.svg           侧栏与插件列表图标
├── cordis.patch.yml   bundle patch
└── package.json
```

`lib/coros-api.js` 不依赖 Cordis、DSH 或文件系统，可以脱离宿主直接测试：

```bash
node -e "import('./lib/coros-api.js').then(m => console.log(m.parseDevices(text)))"
```

**调试路由**（Host 半边暴露的本地 HTTP 接口）：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/coros-sport/status` | 当前登录状态 |
| POST | `/coros-sport/login/start` | 创建登录会话，返回 `loginUrl` |
| POST | `/coros-sport/login/poll` | 轮询会话状态 |
| POST | `/coros-sport/login/cancel` | 取消登录 |
| POST | `/coros-sport/logout` | 退出登录并清除令牌 |
| GET | `/coros-sport/overview` | 聚合后的面板数据 |

**UI 约定**：面板只用 Harness 主题令牌（`--dsw-alias-*`），不引入任何 `@deepseek-ai/dsh-client-*` 包；React 由宿主的浏览器模块表提供。

## 许可

[MIT](./LICENSE) © 2026 dsh-coros-sport contributors

本项目与高驰（COROS）官方无隶属关系，是第三方开源集成。「COROS」「高驰」是其各自权利人的商标，此处仅用于说明对接对象。
