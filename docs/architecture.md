# Andrea Modpost：Modrinth 类 Mod 托管平台方案

## 1. 推荐的总体形态

建议从“元数据平台 + 下载路由层”开始，而不是一开始建设完整的文件分发 CDN：

```text
Vue 3 + Quasar 静态前端
          |
          v
Cloudflare Worker + Hono（公开 API、鉴权、下载路由）
          |
          +-- D1：项目、版本、文件、账户、权限、审计
          +-- KV：短期缓存、限流、区域路由配置
          +-- R2：以后存缩略图、签名文件、可选的自有镜像
          +-- GitHub API：Release、源码归档、Action、Webhook
          +-- GitHub Releases：第一阶段的实际下载源
```

这样可以先用 GitHub Releases 承担文件存储和带宽，Worker 只负责选择文件、校验权限、记录统计和返回下载地址。以后增加 R2、对象存储或其他镜像时，只需要增加一个 Source Adapter，不需要改前端 API。

前端应该部署为纯静态站点（Cloudflare Pages、Vercel 或任意静态主机均可），所有业务数据通过 API 获取。不要让前端直接调用 GitHub API，也不要把 GitHub Token 放进浏览器。

## 2. pnpm monorepo 结构

建议目录如下：

```text
.
├─ apps/
│  ├─ web/                 # Vue 3 + Vite + Quasar
│  └─ api/                 # Cloudflare Worker + Hono
├─ packages/
│  ├─ contracts/           # OpenAPI、Zod schema、API 类型
│  ├─ source-github/       # GitHub Release/source/action adapter
│  └─ config/              # 共享 ESLint、TSConfig、环境变量 schema
├─ migrations/             # D1 SQL migration
├─ docs/
└─ pnpm-workspace.yaml
```

前端推荐 Vue 3、TypeScript、Vite、Pinia、Vue Router、Quasar、`@tanstack/vue-query`。Quasar 负责布局、表格、筛选、对话框和响应式移动端界面；Vue Query 负责 API 缓存和失效，Pinia 只存登录状态、用户偏好和少量 UI 状态。

API 推荐 Hono，因为它在 Cloudflare Workers、Node 和 Bun 上都能运行，未来迁移执行环境的成本低。API 契约使用 OpenAPI 3.1，并从 `packages/contracts` 生成前端类型和服务端校验。

## 3. 核心领域模型

### Project

代表一个 Mod、Modpack、插件或资源包。字段至少包括：

```text
id, slug, type, title, description, body, icon_url,
owner_id, source_repo, license, status, created_at, updated_at
```

`source_repo` 保存 GitHub 仓库 URL；项目描述、图标和分类可以同步到本平台，但保留同步来源和更新时间。

### Version

代表一次可安装版本：

```text
id, project_id, version_number, version_type,
loaders[], game_versions[], changelog, github_release_id,
status, published_at
```

`version_type` 可取 `release`、`beta`、`alpha`。`loaders` 和 `game_versions` 使用关联表或 JSON，取决于查询复杂度；列表筛选多时应使用关联表。

### File

代表一个可下载文件，而不是直接等同于 GitHub Asset：

```text
id, version_id, filename, file_type, size,
sha1, sha512, md5, primary, source_id, source_key
```

`source_key` 是 GitHub asset ID、R2 object key 或第三方对象键。API 对外只暴露稳定的 file id，不暴露内部存储细节。

### Source / SourceEndpoint

用于多下载源和区域路由：

```text
source: id, kind, name, enabled, priority, config_secret_ref
endpoint: source_id, region, url_template, weight, enabled, last_check_at
```

`kind` 初期包括 `github_release`，以后可加入 `r2`、`s3`、`custom_http`。区域不应硬编码到业务代码，使用 `CN`、`US`、`EU`、`GLOBAL` 等可配置标签。

### Account / ProjectMember / ApiKey

账户初期只接 GitHub OAuth，后续可增加邮箱登录。权限采用 RBAC：`owner`、`maintainer`、`editor`、`moderator`。公开 API Key 和管理 API Key 分开，管理 Key 必须带作用域，例如 `project:write`、`release:sync`。

## 4. 下载源与区域选择

### 不要把“地区”直接当成用户可见的固定服务器

用户所在地只用于排序候选源，最终还要结合源健康状态、文件存在性、管理员优先级和用户手动选择。Worker 请求可以从 Cloudflare `request.cf.country`、`request.cf.continent`、`request.cf.colo` 得到大致位置；不能把它当成精确地址，也不要记录原始 IP。

建议下载评分为：

```text
score = region_match * 100
      + admin_priority * 10
      + health_score
      + source_weight
```

API 返回候选源而不是只返回一个裸 URL：

```json
{
  "file": { "id": "file_123", "name": "example-1.2.0.jar", "sha512": "..." },
  "selected": { "source": "github", "region": "GLOBAL", "url": "https://..." },
  "mirrors": [
    { "source": "github", "region": "GLOBAL", "url": "https://...", "available": true }
  ],
  "expires_at": null
}
```

实际下载使用稳定地址 `GET /api/v1/files/:fileId/download`。Worker 做以下事情：

1. 校验文件状态、版本状态和访问策略。
2. 根据用户显式选择的 `?source=...` 或自动区域排序选择源。
3. 记录匿名化下载事件和失败原因。
4. 默认 `302` 到 GitHub Asset URL，减少 Worker 带宽成本。

如果将来需要隐藏上游 URL、做鉴权下载或防止链接长期有效，再切换为 Worker 流式代理或生成短期签名 URL。GitHub 原始 Asset URL 本身不应由前端长期缓存为平台主链接，因为 release 更新后可能变化。

### GitHub Releases 的现实限制

GitHub Release 可以作为第一阶段源，但它不是专为 Mod 分发设计的 CDN：

- API 有速率限制，必须用 Worker 缓存和 GitHub App installation token。
- 大规模下载会受 GitHub 带宽、速率和账户策略影响。
- GitHub 的地区可用性和速度不稳定，不能承诺单一源的全球体验。

因此数据库要保存文件 checksum、size 和上游 asset id；下载时可用 `HEAD` 或定时健康任务检查，不要每次请求实时调用 GitHub API。

## 5. API 设计

公开读取接口建议以 `/api/v1` 开始：

```text
GET  /projects?query=&game_version=&loader=&type=&sort=
GET  /projects/:slug
GET  /projects/:id/versions
GET  /versions/:id
GET  /files/:id/download
GET  /files/:id/sources
GET  /search?q=
GET  /categories
GET  /loaders
GET  /health
```

账户和管理接口：

```text
GET  /auth/github/start
GET  /auth/github/callback
POST /auth/logout
GET  /me
GET  /me/api-keys
POST /me/api-keys
DELETE /me/api-keys/:id
POST /projects
PATCH /projects/:id
POST /projects/:id/versions/sync
POST /projects/:id/releases/import
POST /webhooks/github
POST /projects/:id/actions/dispatch
```

公开 API 使用分页、`ETag`、`Cache-Control` 和稳定错误格式：

```json
{ "error": { "code": "NOT_FOUND", "message": "Project not found", "request_id": "..." } }
```

下载统计必须异步写入队列或 Worker Analytics Engine，避免把 D1 写操作放在下载请求的关键路径上。

## 6. 账户、鉴权和权限

第一版推荐“GitHub OAuth + HttpOnly session cookie”：

1. 用户在 GitHub 授权页面登录。
2. Worker 用一次性 code 换取 GitHub identity。
3. 数据库保存 GitHub user id、昵称、头像和最小化 token 信息。
4. Worker 签发轮换 session，cookie 设置 `HttpOnly`、`Secure`、`SameSite=Lax`。

GitHub access token 不应返回浏览器，也不应明文存库。需要访问用户仓库时，优先使用 GitHub App installation token；OAuth token 只用于用户身份和用户明确授权的操作。

API Key 只显示一次，数据库保存 hash。所有写接口执行 CSRF 校验、权限校验、请求体 schema 校验和限流。项目发布、删除、Action dispatch、源配置变更写入审计表。

## 7. GitHub 仓库、Release、Action 和源码的接入

可以完整接入，但建议拆成四个明确功能：

### Release 同步

项目创建时绑定 `owner/repo`。同步服务通过 GitHub API 读取 Release、tag、asset、body 和 checksum，映射成平台的 Version/File。通过 `release.published`、`release.edited`、`release.deleted` Webhook 增量更新；Webhook 必须验证 HMAC 签名，并以 delivery id 去重。

初期可以只同步带特定标签的 release，例如 `modrinth` 或 `publish`，避免把仓库里的测试包全部公开。

### 源码展示和下载

项目页可以显示 GitHub 仓库、默认分支、commit、许可证和源码链接。源码下载可提供 GitHub 自动生成的 source zip/tarball，或者保存一个不可变的 commit SHA。平台不应该默认复制整个 Git 仓库到自己的存储；需要搜索源码、离线镜像或审计时再增加异步镜像任务。

### GitHub Actions

推荐 GitHub App + repository dispatch，而不是把 PAT 放在平台数据库里：

- 平台调用 `repository_dispatch`，event type 例如 `modpost_publish`。
- 仓库的 Action 负责构建 Mod、生成 changelog、上传 Release asset。
- Action 完成后发布 `release`，Webhook 触发平台同步。
- 如需从平台读取结果，Action 回调平台的签名 webhook，或者平台轮询 Actions API。

仓库可以提供一个可复制的 workflow 模板：构建、运行测试、校验 Mod 元数据、创建 Release、上传 jar 和 sha512。平台只能在用户明确安装 GitHub App 并授权仓库后执行 dispatch。

### GitHub 仓库内容同步

可以同步 README、LICENSE、logo 和元数据文件，例如仓库根目录的 `modpost.yml`：

```yaml
id: example-mod
title: Example Mod
type: mod
loaders: [fabric, neoforge]
game_versions: ["1.21.1"]
release_asset_pattern: "*.jar"
```

服务端解析后写入规范化字段，原始文件保留 commit SHA，防止分支内容漂移导致页面不可追溯。

## 8. Worker 与数据库选择

### 推荐组合

- Cloudflare Workers：API、OAuth callback、下载 302、Webhook。
- D1：关系数据、账户、权限、发布记录。
- KV：GitHub API 响应和热门项目短缓存、限流计数。
- Queues：Release 同步、Webhook 异步处理、checksum/健康检查。
- R2：图片、以后自有文件镜像。
- Cron Trigger：周期同步、源健康检查、清理过期 session。

如果你更看重 SQL 能力、长任务和本地开发，也可以用 Node.js + Hono + PostgreSQL + Redis。两套 API 契约保持一致即可；`packages/source-github` 不应依赖具体运行时。

## 9. 安全与运营边界

- 所有 GitHub webhook 验签、去重、限流。
- 解析 Release asset 时限制文件名、数量和总大小，避免恶意元数据。
- 下载 URL 不接受任意外部 URL，源必须先在数据库登记并通过管理员审核，防止 SSRF。
- 对项目创建、发布、同步、下载分别限流。
- 对公开项目做内容举报、项目下架和审计记录。
- 记录 request id、source、区域标签、状态码和耗时；不保存原始 IP。
- 下载文件展示 SHA-1/SHA-512，客户端或启动器可自行校验。

## 10. 分阶段落地

### Phase 1：可用最小版本

Vue + Quasar 项目列表、项目详情、版本列表、GitHub Release 手动绑定/同步、GitHub OAuth、D1 schema、`/files/:id/download` 302、OpenAPI 文档。

### Phase 2：自动化发布

GitHub App、Webhook 增量同步、`modpost.yml`、Action dispatch、源健康状态、下载统计、API Key。

### Phase 3：多源和规模化

R2/对象存储镜像、多个区域端点、短期签名 URL、队列化 checksum、管理员审核后台、项目成员协作。

### Phase 4：兼容生态

提供 Modrinth 风格的兼容 API 或导出格式，供启动器和第三方客户端读取；兼容层应建立在内部规范化模型之上，不要让数据库直接复制第三方字段命名。

## 11. 第一轮实现建议

第一轮可以直接建立以下可运行骨架：

```text
apps/web       # Quasar 页面：项目列表、详情、登录状态
apps/api       # Hono：health、projects、versions、download
packages/contracts
packages/source-github
migrations/0001_initial.sql
```

先完成一个“手动录入 GitHub Release -> API 返回项目和文件 -> 下载 302”的纵向切片，再接 OAuth 和 Webhook。这样能尽早验证 GitHub Release 的实际带宽、地区访问和文件命名约定，再决定什么时候引入 R2 镜像。

## 12. Git 仓库驱动的可分叉 Wiki

这个需求可以实现，而且最适合把 Wiki 内容放在 Git 仓库中。Raw URL 只作为读取入口，不能作为编辑和分叉的核心接口，因为 raw 页面通常没有版本提交、权限和合并语义。

### 推荐模型

每个项目绑定一个 Wiki repository：

```text
Project
  └─ WikiBinding
       ├─ provider: github | gitlab | gitea | forgejo | raw_http
       ├─ repository: owner/repo
       ├─ branch: main
       ├─ content_root: docs/
       └─ revision: commit SHA
```

仓库中的 Markdown 是 Wiki 的事实来源，平台数据库只保存绑定关系、索引、渲染缓存和分叉关系。建议约定：

```text
docs/
├─ index.md
├─ getting-started.md
├─ configuration.md
├─ faq.md
└─ assets/
```

页面使用 Markdown + YAML front matter：

```md
---
title: 安装指南
slug: getting-started
order: 10
game_versions: ["1.21.1"]
---

# 安装指南
```

平台在读取时解析 front matter，使用安全的 Markdown 渲染器生成 HTML，并做 HTML 清理、外链策略、图片代理和相对链接重写。每次页面都绑定一个 commit SHA，确保用户看到的内容可追溯。

### 支持的来源

建议定义统一的 `WikiProvider` 接口：

```ts
interface WikiProvider {
  getRevision(binding: WikiBinding): Promise<Revision>
  listPages(binding: WikiBinding, revision: string): Promise<PageFile[]>
  readPage(binding: WikiBinding, path: string, revision: string): Promise<string>
  createFork(binding: WikiBinding, target: ForkTarget): Promise<ForkResult>
  createChangeRequest(binding: WikiBinding, change: ChangeRequest): Promise<ChangeResult>
}
```

第一阶段实现顺序建议为：

1. GitHub repository：通过 GitHub API 读取 commit 和文件，Webhook 监听 push。
2. GitLab、Gitea、Forgejo：通过各自 API 和 webhook adapter 接入。
3. `raw_http`：只允许读取一个管理员登记的 HTTPS URL 或 URL 模板，适合自建静态 Raw 服务。

`raw_http` 来源可以用于展示自建内容，但无法提供真正的在线编辑、分支和合并请求。要支持完整分叉，最好让自建服务暴露 Git API，或者直接接入自建 Gitea/Forgejo。

### Wiki 的分叉语义

用户点击“Fork Wiki”时，平台创建一条 `WikiFork` 记录，并根据提供商能力执行不同操作：

```text
WikiFork:
id, source_wiki_id, fork_project_id, provider,
repository, branch, base_revision, status,
created_by, last_synced_at
```

对于 GitHub/GitLab/Gitea 等有 Git API 的提供商：

1. Fork 原始 Wiki repository，或者从模板创建一个新的仓库。
2. 记录 `base_revision` 和源仓库地址。
3. 平台把 fork 仓库当作新的 Wiki 来源。
4. 用户在 fork 仓库提交修改。
5. Webhook 触发平台重新索引和渲染。
6. 用户可以创建 Pull Request/Merge Request，向上游 Wiki 提交修改。

这样可以同时支持“独立 Wiki”和“向上游贡献”两种用法。上游项目可以选择是否接受外部贡献，平台只展示请求状态，不绕过仓库权限直接写入上游。

对于只有 Raw URL 的来源，分叉时复制指定 commit 或当前内容到平台管理的 Git 仓库，例如自建 Forgejo；之后这个 fork 就拥有正常的提交、分支和 Pull Request 能力。复制动作应记录原始 URL、抓取时间和源 revision，避免用户误以为它仍然与 Raw URL 自动同步。

### Wiki API

建议增加以下接口：

```text
GET  /projects/:id/wiki
GET  /projects/:id/wiki/pages
GET  /projects/:id/wiki/pages/:slug
GET  /projects/:id/wiki/revisions
POST /projects/:id/wiki/fork
POST /projects/:id/wiki/sync
POST /wiki-forks/:id/change-requests
GET  /wiki-forks/:id
```

页面响应应包含来源和版本信息：

```json
{
  "slug": "getting-started",
  "title": "安装指南",
  "html": "<h1>...</h1>",
  "source": {
    "provider": "github",
    "repository": "owner/wiki",
    "path": "docs/getting-started.md",
    "revision": "abc123"
  },
  "edit_url": "https://github.com/owner/wiki/edit/main/docs/getting-started.md",
  "fork_url": "/projects/example/wiki/fork"
}
```

### 同步与缓存

不要在每次访问页面时读取外部 Raw URL。Worker 应按以下流程工作：

1. Webhook 或定时任务发现新 commit。
2. 队列任务读取指定目录并解析 Markdown。
3. D1 保存页面索引和 revision，KV 缓存渲染后的 HTML。
4. 页面请求只读取缓存和索引；首次访问再按 commit SHA 回源。

外部内容必须设置最大文件大小、最大页面数量和最大总仓库大小。外部图片、链接和 HTML 都要经过清理，避免 XSS、钓鱼跳转和恶意超大资源。

### 来源安全

不能允许普通用户提交任意 Raw URL 后让 Worker 直接抓取，否则会产生 SSRF 和内网探测风险。来源绑定应满足以下条件：

- provider 必须来自 allowlist。
- `raw_http` 只允许 HTTPS，禁止内网 IP、非标准跳转和任意端口。
- GitHub/GitLab 等仓库通过 provider API 读取，不接受任意 API endpoint。
- webhook 验签并使用 delivery id 去重。
- 平台保存抓取的 commit/revision，页面链接优先使用固定 revision。

### 和项目版本的关系

Wiki 默认属于项目，但可以按游戏版本或 Mod 版本筛选。推荐用目录或 front matter 表示版本：

```text
docs/versions/1.21.1/getting-started.md
docs/versions/1.20.1/getting-started.md
```

如果项目使用独立 Wiki 仓库，Release webhook 可以将版本号传给 Wiki 索引任务；平台不需要复制 Wiki 内容到每个 Release，只保存页面与版本标签的关联。

### 推荐的用户体验

项目页提供“Wiki”标签，页面顶部显示：

- 当前来源仓库和 commit。
- `编辑此页`：跳转到提供商的编辑页。
- `Fork Wiki`：创建自己的仓库或平台托管 fork。
- `提交修改`：创建 Pull Request/Merge Request。
- `查看历史`：打开 commit 或 revision 列表。

这样 Wiki 的内容权属于 Git 仓库，平台可以提供接近 Modrinth 的阅读体验，同时保留 Git 的分支、历史、审阅和合并能力。

## 13. 纯静态数据绑定 GitHub 仓库的模式

如果希望第一版尽量简单，可以提供一个不依赖 D1、登录和动态数据库的 `Static Catalog Mode`。这个模式把 GitHub 仓库当作内容数据库，GitHub Actions 负责校验和构建，前端通过静态 JSON API 读取数据。

### 静态模式的结构

```text
GitHub repository
  ├─ catalog/                 # 平台数据源
  │  ├─ projects/*.yml
  │  ├─ sources.yml
  │  ├─ categories.yml
  │  └─ site.yml
  ├─ wikis/<project>/docs/    # Wiki Markdown
  ├─ .github/workflows/build.yml
  └─ schema/                  # JSON Schema
          |
          v
GitHub Actions
  ├─ 校验 YAML/Markdown/schema
  ├─ 拉取 GitHub Release 元数据
  ├─ 生成静态 API JSON
  ├─ 生成搜索索引和 Wiki HTML
  └─ 部署到 Pages、R2、S3 或静态 CDN
          |
          v
Quasar 静态前端 + /api/v1/*.json
```

`catalog` 仓库可以是平台维护的单个仓库，也可以是每个项目一个仓库再通过 Action 聚合。第一版建议使用单仓库，数据关系和构建过程更容易理解。

### 建议的数据文件

项目文件示例：

```yaml
id: example-mod
slug: example-mod
title: Example Mod
type: mod
owner: andrea
description: 一个示例 Mod
repository: https://github.com/owner/example-mod
license: MIT
loaders: [fabric, neoforge]
game_versions: ["1.21.1"]
releases:
  - version: 1.2.0
    type: release
    game_versions: ["1.21.1"]
    loaders: [fabric]
    github:
      repository: owner/example-mod
      release_tag: v1.2.0
      asset: example-mod-1.2.0.jar
    files:
      - name: example-mod-1.2.0.jar
        primary: true
        sha512: "..."
```

下载源配置示例：

```yaml
sources:
  - id: github
    kind: github_release
    region: GLOBAL
    priority: 10
  - id: cn-mirror
    kind: custom_http
    region: CN
    priority: 20
    base_url: https://mirror.example.com/mods
```

构建器把这些文件规范化为：

```text
dist/api/v1/projects.json
dist/api/v1/projects/example-mod.json
dist/api/v1/projects/example-mod/versions.json
dist/api/v1/files/<id>.json
dist/api/v1/search.json
dist/api/v1/categories.json
dist/wiki/<project>/<slug>.html
dist/assets/search-index.json
```

前端只需要配置一个 `VITE_CATALOG_BASE_URL`，然后读取静态 JSON。接口格式仍然保持 `/api/v1`，将来迁移到 Worker 动态 API 时，前端不需要重写。

### GitHub Actions 构建流程

推荐使用以下触发器：

```yaml
on:
  push:
    branches: [main]
    paths: [catalog/**, wikis/**, schema/**]
  workflow_dispatch:
  repository_dispatch:
    types: [release_published, rebuild]
```

Action 的步骤：

1. 使用 JSON Schema 校验所有 YAML 和 front matter。
2. 检查项目 slug、文件名、版本、loader 和游戏版本是否重复或冲突。
3. 读取公开 GitHub Release 元数据，确认 asset 存在、大小和 checksum 匹配。
4. 生成规范化 JSON、搜索索引和 Wiki HTML。
5. 运行链接检查、HTML 清理和构建测试。
6. 部署 `dist` 到 GitHub Pages、Cloudflare Pages、R2 或其他静态托管。
7. 发布构建摘要，包含数据 revision 和构建 commit SHA。

GitHub Release 发布后，可以由项目仓库的 Action 调用 `repository_dispatch`，触发 catalog 仓库重新构建；也可以使用 catalog 仓库的定时任务周期同步 Release。

### 静态模式下的后端边界

纯静态模式可以完整支持：

- 项目、版本、文件和 Wiki 浏览。
- 静态搜索。
- GitHub Release 下载链接。
- 版本和页面历史。
- GitHub 仓库 Fork、提交和 Pull Request。
- 地区源的预配置和前端手动选择。

纯静态模式无法独立完成：

- 动态账户 session。
- 私有项目权限。
- 实时下载统计。
- 服务端实时地区判断。
- 运行时生成短期签名下载 URL。
- 用户在站内直接修改内容并立即保存。

这些能力可以通过一个很薄的 Worker 增强，而不改变静态数据格式：

```text
/api/v1/*.json        → 静态 CDN
/files/:id/download   → Worker 根据地区选择源并 302
/auth/*               → Worker OAuth/session
/webhooks/*           → Worker 接收 GitHub webhook
/admin/*              → Worker 管理接口
```

因此建议把 `Static Catalog Mode` 作为最低成本部署选项，把 Worker 作为可选的动态层。两者共享 `packages/contracts` 的 API schema，后端实现可以互相替换。

### 静态模式的仓库绑定和发布

可以在平台配置中声明一个 catalog 仓库：

```yaml
catalog:
  provider: github
  repository: owner/modpost-catalog
  branch: main
  data_root: catalog
  build_workflow: .github/workflows/build.yml
  public_base_url: https://mods.example.com
```

如果需要多个站点或多个组织，可以为每个站点绑定不同仓库。构建产物中写入：

```json
{
  "catalog_revision": "abc123",
  "generated_at": "2026-10-14T00:00:00Z",
  "schema_version": 1
}
```

前端可以显示“数据更新时间”和 commit 链接，管理员也能通过回滚 Git commit 回滚整个目录。

### 推荐落地顺序

最小版本可以只实现：

1. `catalog` 仓库和 JSON Schema。
2. GitHub Action 生成静态 JSON。
3. Quasar 前端读取静态 JSON。
4. GitHub Release asset 作为下载源。
5. Wiki Markdown 由同一个仓库构建。
6. 可选 Worker 只处理 `/files/:id/download` 的区域选择。

当项目数量、下载量和账户需求增长后，再增加 D1、OAuth、Webhook 队列和管理员后台。这样静态部署和动态部署共用数据格式，迁移不会推翻前端和仓库内容。

## 14. 账户系统与双运行模式

账户功能应该从第一版就放在独立的 Auth 模块中，并通过接口适配不同运行环境。这样 Cloudflare Worker 和裸机 Node 服务都使用同一套账户行为。

### 账户能力

基础账户功能包括：

```text
注册：邮箱 + 密码
登录：邮箱 + 密码、GitHub OAuth
验证：邮箱验证、重新发送验证邮件
安全：修改密码、重置密码、退出所有设备
会话：HttpOnly Secure Cookie、会话撤销、设备列表
权限：user、maintainer、moderator、admin
API：个人 API Key、作用域和撤销
```

注册和密码流程建议如下：

1. 服务端校验邮箱和密码强度。
2. 使用 Argon2id 或运行时等价的内存硬哈希算法保存密码，永远不保存明文密码。
3. 发送一次性邮箱验证 token，token 只保存 hash 和过期时间。
4. 登录成功后签发随机 session id，数据库保存 session hash、过期时间、设备信息和撤销时间。
5. 浏览器只得到 `HttpOnly; Secure; SameSite=Lax` cookie。

GitHub OAuth 用于身份登录和仓库授权时要区分两个概念：登录只需要读取用户身份；访问用户仓库、创建 Fork、提交 Action dispatch 则需要 GitHub App 或明确的仓库授权。GitHub token 不返回给前端，敏感 token 使用加密存储或只保存 GitHub App installation id。

### 账户相关 API

```text
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/github/start
GET  /auth/github/callback
POST /auth/verify-email
POST /auth/forgot-password
POST /auth/reset-password
GET  /me
GET  /me/sessions
DELETE /me/sessions/:id
GET  /me/api-keys
POST /me/api-keys
DELETE /me/api-keys/:id
```

所有账户写操作都要有请求体 schema 校验、IP/账户限流、审计记录和统一错误格式。注册接口可以使用 Turnstile、验证码或按 IP/邮箱进行渐进式限流，避免被批量滥用。

### 统一的运行时抽象

代码层不要直接依赖 Cloudflare 的 `env` 或 Node 的 `process.env`。使用接口注入运行时能力：

```ts
interface AppRuntime {
  db: DatabaseAdapter
  cache: CacheAdapter
  objectStore: ObjectStoreAdapter
  mailer: MailerAdapter
  queue: QueueAdapter
  github: GitProvider
}
```

建议将 API 写成 Hono 应用，再提供两个入口：

```text
apps/api/src/entry-worker.ts  # Cloudflare Workers adapter
apps/api/src/entry-node.ts    # Node.js adapter
```

业务路由、认证、权限、Release 同步和 Wiki 逻辑共用；只有数据库、队列、邮件、对象存储和 HTTP server 入口替换。

### 数据库选择

为方便自托管，建议把 PostgreSQL 作为完整部署的标准数据库，把 SQLite 作为单机小规模部署选项。Cloudflare 部署使用 D1 adapter。三者都通过 `DatabaseAdapter` 或 Drizzle schema 对外暴露相同的数据模型。

```text
Cloudflare：D1
裸机单机：SQLite
裸机多实例：PostgreSQL
```

SQLite 适合个人站点和低并发实例；启用多个 API 实例、较多账户或大量下载统计时，应切换 PostgreSQL。迁移文件需要按 adapter 管理，避免在业务代码中写特定数据库语句。

### 两种官方部署配置

#### A. Cloudflare 托管模式

```text
Quasar build       → Cloudflare Pages
Hono API           → Cloudflare Workers
关系数据           → D1
缓存/限流          → KV
异步任务           → Queues
图片和镜像         → R2
邮件               → 外部 SMTP 或邮件 API
```

该模式适合全球访问、静态前端和边缘下载路由。账户、OAuth、Webhook 和动态 API 由 Worker 提供。

#### B. 裸机或普通 VPS 模式

```text
Caddy/Nginx        → HTTPS、静态文件和反向代理
Node.js API        → Hono + node:http
SQLite 或 PostgreSQL
本地文件/S3        → 图标、附件、可选镜像
内置 worker        → Release 同步、邮件和健康检查
systemd            → 进程守护和自动重启
```

裸机模式不依赖 Cloudflare 专有服务即可运行。需要扩容时，把内置 worker 换成 Redis/BullMQ 或独立 worker 进程即可；API 实例之间共享 PostgreSQL 和对象存储。

### Docker Compose 部署

项目应提供一个可直接修改的 `deploy/docker-compose.yml`：

```text
web      # Quasar 静态文件或 Caddy
api      # Node.js API
worker   # 异步同步和定时任务
db       # PostgreSQL，可替换为 SQLite profile
```

生产环境使用外部 PostgreSQL 和对象存储时，可以关闭 `db` 容器。所有密钥从 `.env` 或 Docker secrets 读取，仓库只提交 `.env.example`。

### 裸机安装路径

要求 Node.js LTS 和 pnpm：

```text
pnpm install --frozen-lockfile
pnpm build:web
pnpm build:api
pnpm db:migrate
pnpm start:api
pnpm start:worker
```

提供以下 systemd 服务模板：

```text
andrea-modpost-api.service
andrea-modpost-worker.service
```

Caddy 将 `/` 指向前端静态目录，将 `/api`、`/auth`、`/files` 和 `/webhooks` 反向代理到 Node API。部署脚本需要提供迁移、健康检查、日志目录和回滚到上一版本的能力。

### 静态模式中的账户边界

只有静态 JSON 和静态前端时，账户不能安全地在浏览器本地完成注册和密码保存。账户注册必须连接到 Worker 或 Node API。推荐默认开启“静态目录 + 轻量 API”部署：

```text
项目、版本、Wiki       → GitHub 构建的静态 JSON
注册、登录、账户设置    → Node/Worker API
下载重定向              → Node/Worker API
管理员修改              → Git commit / Pull Request
```

这样内容仍然是 Git 可审计、可 Fork、可回滚的静态数据，同时账户和下载能力保持正常的服务端安全边界。

### 自托管配置文件

提供 `config.example.yml`，集中配置：

```yaml
mode: static-plus-api
database:
  driver: sqlite
  url: ./data/modpost.sqlite
storage:
  driver: local
  path: ./data/storage
github:
  catalog_repository: owner/modpost-catalog
auth:
  allow_registration: true
  github_oauth: true
mail:
  driver: smtp
```

配置中不能放明文生产密钥；密钥通过环境变量覆盖，例如 `DATABASE_URL`、`GITHUB_APP_PRIVATE_KEY`、`SESSION_SECRET`、`SMTP_PASSWORD`。

### 推荐的产品默认值

第一版同时发布两个 profile：

```text
static       = 静态前端 + GitHub 构建数据，无账户和动态下载
self-hosted  = 静态前端 + Node API + SQLite + 本地文件
cloud        = Pages + Worker + D1 + KV + R2
```

三个 profile 使用相同的前端、数据格式、API contract、权限模型和 GitHub 集成。这样个人可以一条命令运行自托管版本，规模增大后也能迁移到 PostgreSQL 和 Cloudflare，而不需要重写平台。

## 15. 使用本地 Worker Runtime 自托管

可以使用 Cloudflare 开源的 `workerd` 作为本地和裸机 Worker Runtime。它是 Cloudflare Workers 使用的 JavaScript/WinterCG 运行时，适合让 Worker 代码在 Cloudflare 和自托管环境中保持一致。

需要区分三个工具：

```text
wrangler dev --local  → 本地开发和调试
Miniflare             → 测试辅助，通常由 Wrangler 集成
workerd               → 裸机/容器生产运行时
```

`wrangler dev --local` 适合开发，不应直接当作生产服务。自托管生产环境使用固定版本的 `workerd`，由 systemd、Docker 或 Kubernetes 管理。

### Worker 代码结构

前端静态资源和 API 都可以写成 Worker：

```text
apps/edge/
├─ src/entry.ts          # fetch(request, env, ctx)
├─ src/static.ts         # 静态资源路由
├─ src/api.ts            # 公开 API 和账户 API
├─ src/download.ts       # 下载源选择和 302
└─ src/webhooks.ts       # GitHub webhook
```

Cloudflare 环境使用 Workers Static Assets；自托管环境使用同一个 `fetch` handler 和构建出的 asset manifest。这样浏览器访问的 `/`、`/assets/*`、`/api/*`、`/auth/*` 和 `/files/*` 都可以由 Worker 统一处理。

### 静态资源在本地 Worker 中的两种方式

小型前端可以在构建时生成 asset manifest，将文件内容打包为 Worker module 的静态资源。大型前端更适合使用独立的静态资源服务，通过 workerd 的 service binding 或反向代理提供 `ASSETS.fetch()` 等价能力。

因此代码中使用抽象绑定：

```ts
interface AssetStore {
  fetch(request: Request): Promise<Response>
}
```

Cloudflare 绑定映射到 Workers Static Assets；自托管映射到本地 asset service 或 S3 兼容存储。业务路由不需要判断当前运行在哪个平台。

### 自托管 Worker 拓扑

推荐的最小拓扑是：

```text
Caddy/Nginx
    ↓
workerd
  ├─ web-api Worker：静态资源、公开 API、账户、下载路由
  ├─ webhook Worker：GitHub webhook 和异步任务入口
  └─ cron Worker：同步 Release、检查源健康状态
    ↓
HTTP 数据服务 / PostgreSQL / SQLite 服务
S3 兼容对象存储或本地 asset service
```

静态页面和中间 API 层都运行在 Worker 中；外部数据库和对象存储只作为 Worker binding 的实现，不把业务代码改成 Node 专用 API。

### 数据库的现实限制

`workerd` 本身不会自动提供 Cloudflare D1、KV、R2 或 Durable Objects。直接把依赖 D1 的代码复制到本地 workerd 不会自动获得 D1 能力。因此需要提供可替换的 binding：

```ts
interface DatabaseAdapter { /* query, transaction, migrate */ }
interface CacheAdapter { /* get, put, delete */ }
interface ObjectStoreAdapter { /* get, put, delete */ }
interface QueueAdapter { /* enqueue */ }
```

Cloudflare 使用 D1/KV/R2/Queues；自托管使用以下任一组合：

```text
数据库：PostgreSQL + HTTP 数据服务，或 SQLite storage service
缓存：Redis、Valkey 或内存缓存
对象：MinIO、S3 或本地文件服务
队列：Redis/Valkey 队列、PostgreSQL job 表或单独 cron Worker
```

如果目标是“所有应用逻辑都运行在 Worker 中”，数据库最好通过 HTTP binding 暴露，而不是在 Worker 内使用 Node 的 `net`、`fs` 或原生 PostgreSQL 驱动。这样才能同时兼容 workerd 和 Cloudflare Workers。

单机部署可以把 SQLite storage service 和 workerd 放在同一台机器上；多实例部署使用 PostgreSQL、Redis/Valkey 和 MinIO。账户注册、session、权限和审计数据都必须放在共享数据库中，不能只存在 Worker 内存。

### workerd 部署方式

#### Docker

```text
workerd container
├─ worker configuration
├─ bundled worker modules
└─ asset manifest
```

通过 Caddy 暴露 HTTPS，固定 workerd 版本，并将数据库、对象存储和密钥通过环境或 secret 文件注入。

#### systemd 裸机

```text
/opt/andrea-modpost/worker.capnp
/opt/andrea-modpost/dist/worker.js
/opt/andrea-modpost/dist/assets/
/etc/andrea-modpost.env
andrea-modpost-workerd.service
```

systemd 负责启动、重启和日志；Caddy 负责证书和反向代理。发布流程先构建 Worker 和 asset manifest，再替换版本目录，健康检查成功后切换当前版本。

### Workerd 兼容边界

为了保证 Cloudflare 和自托管一致，业务代码应遵守 WinterCG/Fetch API：

- 使用 `fetch`、`Request`、`Response`、`URL`、Web Crypto。
- 不使用 `fs`、`net`、`child_process`、Node stream 和 Node 专属 session 库。
- 不把 Cloudflare 特有的 `env.DB`、`env.KV` 直接写进领域服务。
- 所有平台能力通过 adapter 或 binding 注入。
- 对 workerd、Node 仅在入口层做适配。

Node 入口仍然可以保留，主要用于邮件、数据库迁移、开发工具和兼容旧部署；核心 Worker 业务代码不依赖 Node。

### 最终推荐组合

```text
前端与 API：Hono Worker
Cloudflare：Workers Static Assets + D1/KV/R2/Queues
自托管运行时：workerd
自托管数据库：SQLite service 或 PostgreSQL HTTP service
自托管对象存储：MinIO/S3
边缘代理：Caddy
开发：wrangler dev --local
```

这能满足“静态页面是 Worker、中间层也是 Worker、Cloudflare 和裸机尽量共用代码”的目标，同时把无法由 workerd 自动提供的数据库、缓存、对象存储和队列明确隔离出来。

## 16. 启动器兼容 API

为了让启动器可以切换 API，服务端提供 Modrinth API v2 风格的只读兼容层，当前入口为 `/v2` 和 `/api/modrinth/v2`。兼容层从内部 Catalog 模型生成 Modrinth 风格的 Project、Version、File、Search 和 Tag 响应；文件 URL 始终指向平台自己的稳定下载地址。

当前优先兼容：

```text
GET /project/:id
GET /project/:id/version
GET /version/:id
GET /version_file?hash=...
GET /search?query=...
GET /tag/game_version
GET /tag/loader
```

启动器必须支持自定义 API base URL 才能切换到 Andrea Modpost。官方服务地址被硬编码的启动器无法通过 DNS 或返回格式自动切换。Modrinth 的写入、认证、团队和报告接口暂不模拟；平台管理仍使用自己的 `/api/v1` API。

稳定文件链接是 `/api/v1/files/:fileId/download`。`fileId` 对应不可变文件记录，源可以从 GitHub Release 切换到区域镜像或 R2，而启动器保存的 URL、文件 id 和 hash 不变。

