# 版本依赖、联动与安装清单

依赖声明保存在每个发布记录的 `versions[].dependencies`。同名版本在不同加载器上应创建不同版本 ID；只有同一文件确实跨加载器兼容时才共用发布记录。现有 SQLite/D1 项目 JSON 和静态 Catalog 均可携带新字段，无需增加数据库表。

## 关系和约束

| dependencyType | 行为 |
| --- | --- |
| required | 自动解析，缺失或约束冲突会阻止生成可安装清单 |
| optional | 默认不安装；选择后参与完整约束解析 |
| recommended | 默认不安装，展示作者推荐；选择后解析 |
| integration | 单向联动声明，不自动安装；目标已安装但版本不满足时报告警告 |
| incompatible | 目标出现在安装环境中且匹配约束时报告冲突 |
| embedded | 已内嵌，不额外下载 |

```json
{
  "id": "config-library",
  "projectId": "stable-library-project-id",
  "dependencyType": "required",
  "versionConstraint": { "scheme": "semver", "range": ">=2.0.0 <3.0.0" },
  "appliesTo": { "loaders": ["fabric"], "gameVersions": ["1.20.1"], "side": "client" },
  "reason": "配置界面"
}
```

`projectId` 使用稳定项目 ID，而不是 slug。可用 `versionId` 锁定精确发布记录；也可以单独使用 `versionId`，解析器会查找所属项目。同时指定项目、版本和范围时，所有约束必须成立。没有范围代表任意兼容版本。

版本范围使用标准 SemVer，支持比较符、区间、`^`、`~`、`||`。不会将 `r6` 或日期等任意版本号强行转换成 SemVer。此类版本使用：

```json
{ "scheme": "exact", "versions": ["r6", "r7"] }
```

`appliesTo` 描述声明在何种环境下生效，不描述目标 Mod 的版本。其加载器/游戏版本列表为空时表示不限制，side 可选 `both/client/server`。`loaderRange` 是加载器自身的 SemVer 版本条件；解析涉及此条件时必须输入 `loaderVersion`。

`when.installedProjectIds` 要求所有指定项目已在安装图中；`when.feature` 要求指定功能出现在请求的 `enabledFeatures`。两者同时设置时采用 AND。解析器每次扩展图都会重新检查条件，因此新增依赖也能触发联动。条件只支持正向存在判断，避免否定条件导致不稳定的解析。

## API

- `GET /api/v1/projects/:slug/versions/:versionId/dependencies`：原始声明和支持环境。
- `GET /api/v1/projects/:slug/dependents`：当前访问者可见的反向依赖发布记录。
- `POST /api/v1/dependencies/resolve`：按环境解析安装图。

请求示例：

```json
{
  "versionId": "my-mod-fabric-1.20.1",
  "loader": "fabric",
  "gameVersion": "1.20.1",
  "side": "client",
  "loaderVersion": "0.16.0",
  "selectedOptionalDependencies": ["optional-rule-id"],
  "installedVersions": [],
  "enabledFeatures": [],
  "fileSelections": {}
}
```

可选依赖优先通过声明 `id` 选择，旧声明没有 ID 时使用项目 ID。`installedVersions` 是站内发布记录 ID，表示已安装且不可自动替换的版本。`fileSelections` 将发布记录 ID 映射到文件 ID，用于一个发布记录包含多个可安装文件的情况。

返回 `success`、`installable`、`nodes`、`edges`、`errors`、`warnings` 和 `manifest`。`success` 表示版本图可满足；`installable` 还要求每个新增版本都能确定一个文件。文件不明确时返回 `FILE_SELECTION_REQUIRED`，前端必须让用户选择后重新解析，不能直接把部分清单当作完整安装方案。

安装清单包含项目 ID、版本 ID、文件 ID、文件名、稳定下载 URL 以及已有 SHA-1/SHA-512。已安装版本不会重复进入清单。下载链接指向本站 API，使用者应相对于 API 服务地址解析。清单是解析时快照，不会执行安装；启动器下载后应验证声明的 hash。

## 解析规则

解析器先固定根版本和已安装版本，再递归尝试满足游戏版本、加载器、客户端/服务端和版本约束的候选。共享依赖只选择一个版本。有后续冲突时回溯候选，而不是无条件选择最新版本。

循环依赖被标记为 `CYCLE`，节点去重且不会无限展开。版本冲突报告当前依赖路径与已选择版本的来源路径。缺失目标、不可见目标或没有兼容版本都不会伪造下载结果。候选自动选择限于 listed 发布，显式根/已安装版本允许 unlisted，draft/archived 不进入解析。

计算限制为 200 个项目节点、5000 次搜索和约 1.5 秒搜索预算。触达限制返回 `LIMIT`。每个版本最多 200 条声明。所有 API 查询都使用当前访问者的项目可见范围。

## 前端

项目编辑器“版本与文件”内每个版本都有依赖编辑区：搜索项目、选择发布记录、设置六类关系、版本范围、环境和触发条件。下方可以预览尚未保存的依赖图。

项目页“依赖与安装清单”支持选择发布版本、加载器、游戏版本和运行端；可填写已安装版本和功能开关，选择可选依赖，查看树与错误路径，选择文件并导出 JSON 安装清单。变更输入后必须重新解析才允许导出。

新增组件支持中文/英文标签，旧项目没有依赖时正常显示空声明。

## 元数据导入

编辑器支持粘贴 `fabric.mod.json` 和 Forge/NeoForge `mods.toml`，导入必需/可选/推荐/冲突声明。Fabric 多个范围按 OR 保留；常见 Maven 区间转成对应的 SemVer 比较表达式。不支持的范围会报错，要求手动选择精确版本或版本集合，不会静默放宽。

外部 Mod ID 与本站项目 ID 不等价。导入后必须显式映射项目，再加入声明。Minecraft、Java、Fabric Loader 等环境项不要映射成普通库项目，应在版本环境或加载器条件中设置。导入的是文本元数据，不会解压或执行上传 JAR。

## Modrinth 兼容

标准 `dependencies` 只输出其协议可表达的旧式简单关系。范围、环境条件、推荐和联动不能完整表达，因此完整声明输出到扩展字段 `modpost_dependencies`。需要自动安装完整依赖的客户端应使用本站 resolve API；仅使用标准 Modrinth 字段的客户端不能执行这些扩展规则。

## 验证

- `pnpm --filter @andrea/api exec node --import tsx --test tests/*.test.ts`
- `pnpm -r typecheck`
- `pnpm -r build`
- 启动 Web 开发服务到 9016 后：`pnpm --filter @andrea/web exec node --import tsx tests/dependencies.browser.mjs`

浏览器测试通过内存 Hono API 验证真实请求与保存链路，不修改本地业务数据库。可通过 `CHROME_PATH` 指定已安装浏览器。

## 跨加载器兼容中间层

不同加载器不会被一律视为互斥。每个发布版本可通过 `loaderBridges` 显式声明经过验证的桥接路线，例如：

```json
{
  "fromLoader": "fabric",
  "toLoader": "forge",
  "viaProjectId": "connector-project-id",
  "viaRange": ">=1.0.0 <2.0.0",
  "gameVersions": ["1.20.1"],
  "side": "both",
  "reason": "此发布记录已验证的兼容组合"
}
```

选择 Forge 环境后，解析器允许该 Fabric 发布参与安装，并自动添加中间层的必需依赖。中间层本身必须原生支持目标加载器；其依赖同样进入解析。`viaVersionId` 可锁定中间层发布记录，与范围同时填写时取交集。每个发布版本对一个目标加载器只能声明一条路线，避免含糊选择。

原生加载器的依赖规则继续生效：依赖库也必须原生兼容目标环境，或声明自己的桥接路线，不能因为主 Mod 已桥接就跳过检查。原加载器特定规则中的 `loaderRange` 使用桥接声明的 `fromLoaderVersion`（中间层提供的原加载器 API 版本），不能拿目标加载器版本冒充。

原生安装不引入中间层；缺失中间层、版本冲突、游戏版本或运行端不匹配都会阻止生成可安装清单。声明描述作者验证的组合，解析通过并不等同于实际启动测试，也不会推断任意 Mod 都可以跨加载器运行。

编辑器提供桥接声明表单，项目页提供目标加载器选择并显示采用的路线。反向依赖包含中间层的使用者。Modrinth 扩展字段 `modpost_loader_bridges` 保留这些声明；标准客户端仍需接入本站解析 API 才能使用桥接安装计划。

## Modrinth / CurseForge 站外依赖

依赖编辑器新增“依赖来源”：站内项目、Modrinth、CurseForge。选择外部来源，输入 MR 项目 ID / slug 或 CF 数字项目 ID，点击“查询并绑定”，会保存平台的稳定项目 ID，并列出该发布环境下的版本。可锁定 MR version ID 或 CF file ID，也可保留任意兼容版本。无需在本站创建镜像项目，不会复制文件或增加本站项目记录。

```json
{
  "dependencyType": "required",
  "external": {
    "provider": "modrinth",
    "projectId": "P7dR8mSH",
    "versionId": "rvI2dfzR"
  },
  "reason": "Fabric API"
}
```

CF 对应 `provider: "curseforge"`，`projectId` 和 `versionId` 分别为项目数字 ID 与文件数字 ID（使用字符串保存）。外部目标与站内 `projectId/versionId/fileName` 互斥，原有六类关系、环境条件、可选开关和版本约束仍生效。

解析器按需读取官方 API，递归处理平台声明的依赖，复用同一个冲突检查和回溯解析过程。不会仅根据 slug、文件名或名称把 MR 与 CF 项目当成同一项目，也不会自动在两个平台之间切换下载来源。CF 的版本显示名通常不是 SemVer，应优先锁定 file ID；只有符合 SemVer 的上游版本号才能匹配 SemVer 范围。

清单节点使用 `external:modrinth:<projectId>` 或 `external:curseforge:<projectId>`；版本 ID 使用 `external:<provider>:<versionId>`。已安装的外部版本可通过这个完整版本 ID 传入 `installedVersions`，会保持锁定且不重复下载。`external:` 是保留命名空间。清单保留官方 CDN 下载 URL 与平台提供的 hash。外部下载不经过本站下载统计，也不代表本站审核过对应文件。

CF 禁止分发或没有直接下载地址时返回 `EXTERNAL_DOWNLOAD_UNAVAILABLE`，`installable` 为 false，页面提供原站链接供手动安装；不会猜测 CDN URL、绕过分发限制或静默生成不完整安装清单。MR/CF 超时、限流、缺失版本、错误归属及不兼容环境均明确报告。

### 配置与接口

- MR 公共接口无需 API Key。
- CF 在服务端设置 `CURSEFORGE_API_KEY`（Node 环境变量 / Worker secret），示例见 `.env.example`。密钥不进入前端、Catalog 或导出清单。未配置时仍可保存 CF 引用，查询与解析会提示 `CF_KEY_REQUIRED`。
- `GET /api/v1/dependencies/external?provider=modrinth&projectId=fabric-api&loader=fabric&gameVersion=1.20.1`：规范化项目引用和列出兼容版本；可带 `versionId` 验证版本归属。
- `POST /api/v1/dependencies/resolve`：同时支持站内与站外依赖。
- `POST /api/v1/dependencies/preview`：发布者登录后提交 `{ project, input }`，解析未保存编辑内容；不写数据库。

外部接口固定为官方域名，不接受自定义 API 地址。每次解析限制 60 次上游请求、约 20 秒上游时间预算、每次响应 4 MB、30 轮依赖扩展，每个项目当前环境最多读取 300 个版本，CF 分页读取。超限明确失败，避免截断后声称完整解析。单次调用内缓存相同请求，不持久缓存上游数据。

纯静态部署没有服务端代理，不能在线解析外部引用；需要配置动态 API。标准 Modrinth 兼容接口不将站外 ID 冒充本站 ID，完整引用保存在 `modpost_dependencies` 扩展字段。

验证包含 MR 传递依赖、可选依赖、冲突、固定版本归属、已安装版本、CF 密钥与禁止下载、上游错误、API 保存以及浏览器绑定/草稿预览/保存/移动端流程。MR 公共接口已实测 Fabric API 项目与版本查询；CF 使用响应夹具验证，真实联调需部署者提供 API Key。
