# 内建 GitHub Markdown Wiki 与协作服务计划

状态：规划中

本文描述 Andrea Modpost 后续建设内建 Wiki、Git 仓库、Commit、Issue 和 Pull Request 协作能力的目标、架构、数据模型、实施阶段、风险和验收标准。当前阶段只做方案记录，不包含本功能的业务实现。

## 1. 背景与目标

Andrea Modpost 当前已经支持项目详情页、Markdown 内容、Wiki 外链或内嵌 HTML、项目成员权限、账户体系、SQLite/D1 存储和文件存储。现有 Wiki 能力适合展示一段已经生成的内容，无法提供持续编辑、版本历史、分支协作和项目讨论。

后续需要为每个项目提供一套内建的 GitHub Markdown 风格 Wiki 服务：

- 每个项目拥有独立的 Wiki Git 仓库。
- Wiki 页面以 Markdown 文件作为源文件。
- 支持 Web 编辑器和标准 Git 客户端。
- 支持分支、Commit、历史、Diff 和回滚。
- 支持 Issue、评论、标签、指派人和里程碑。
- 支持 Pull Request、Review、合并和冲突处理。
- Commit、Issue、Pull Request 可以相互关联，并与项目绑定。
- 复用当前账户、项目成员和通知权限。
- 自托管环境使用本地 Git 服务，云端环境可以使用 Forgejo/Gitea 作为 Git provider。

## 2. 当前基础与兼容原则

当前仓库已经具备以下基础：

- Hono API：`apps/api/src/app.ts`
- 账户和项目存储：`apps/api/src/auth.ts`、`apps/api/src/sqlite-auth.ts`
- SQLite/D1 迁移目录：`migrations/`
- R2/本地文件存储适配器：`apps/api/src/storage.ts`、`apps/api/src/node-storage.ts`
- 项目页和项目编辑器：`apps/web/src/pages/ProjectPage.vue`、`apps/web/src/pages/ProjectEditorPage.vue`
- 已有 `wikiUrl`、`wikiHtml` 项目字段。
- 已有完整项目成员角色和项目管理权限检查。
- 已有 GFM Markdown 渲染和 HTML 清洗逻辑。

兼容策略如下：

1. 现有 `wikiUrl` 和 `wikiHtml` 保留。
2. 未启用内建 Wiki 的项目继续使用现有 Wiki 外链或 HTML 内容。
3. 启用内建 Wiki 后，项目页优先使用 Git Wiki。
4. 现有静态 Catalog 项目不会因为 Wiki 功能而失效。
5. Git 仓库内容是 Wiki 文件历史的权威来源，数据库只保存索引、协作状态和缓存。

## 3. 推荐的总体架构

系统分为四层：

```text
Web UI
  ├── Wiki 页面、编辑器、历史、Diff
  ├── Issue 和 Pull Request 页面
  └── 项目活动和通知

Modpost API
  ├── Wiki 页面 API
  ├── Git Smart HTTP 鉴权和路由
  ├── Commit、Issue、PR 协作 API
  ├── 权限检查和通知
  └── Git push 后的索引任务

Wiki Repository Provider
  ├── LocalGitProvider
  └── ForgejoProvider（云端或后续部署）

数据层
  ├── Git bare repository：Markdown 文件和完整 Git 历史
  ├── SQLite/D1：Issue、PR、评论、索引和权限辅助数据
  └── R2/本地文件存储：Wiki 图片和附件
```

Git 协议层建议复用标准 Git 服务端能力，不从零实现 packfile、delta object、receive-pack 和协议 v2。自托管模式使用系统 Git 与 `git-http-backend` 或等价的标准实现；云端模式通过 Forgejo/Gitea provider 访问 Git 仓库。

API 与 provider 之间使用统一接口：

```ts
interface WikiRepositoryProvider {
  createRepository(projectId: string): Promise<void>
  listBranches(projectId: string): Promise<WikiBranch[]>
  getTree(projectId: string, ref: string): Promise<WikiTreeEntry[]>
  getFile(projectId: string, ref: string, path: string): Promise<WikiFile | null>
  listCommits(projectId: string, ref?: string): Promise<WikiCommit[]>
  createBranch(input: CreateWikiBranchInput): Promise<WikiBranch>
  createCommit(input: CreateWikiCommitInput): Promise<WikiCommit>
  compare(input: CompareWikiInput): Promise<WikiDiff>
  merge(input: MergeWikiInput): Promise<WikiMergeResult>
}
```

## 4. Git 仓库设计

### 4.1 仓库组织

自托管模式下，每个项目拥有一个 bare repository：

```text
data/git/wiki/<project-id>.git/
```

项目 ID 使用内部 ID 映射，不能由用户直接传入文件系统路径。对外提供稳定的 clone 地址：

```text
https://<host>/git/wiki/<project-slug>.git
```

### 4.2 Git Smart HTTP 路由

计划支持：

```text
GET  /git/wiki/:slug/info/refs?service=git-upload-pack
POST /git/wiki/:slug/git-upload-pack
POST /git/wiki/:slug/git-receive-pack
```

其中：

- `upload-pack` 支持 clone 和 fetch。
- `receive-pack` 支持 push。
- 读取权限按照项目公开状态和账户角色判断。
- 写入权限至少要求项目 `owner`、`admin` 或允许提交的 `editor`。
- 默认分支禁止强制推送。
- 所有 push 写入审计日志。

### 4.3 Git hook 与索引

Git push 可能绕过普通 Web API，因此需要 `post-receive` hook 或 provider webhook。收到 push 后提交一个 `wiki_sync_jobs` 任务：

1. 记录旧 SHA、新 SHA 和 ref。
2. 解析新增 commit。
3. 计算变更文件。
4. 更新页面索引和渲染缓存。
5. 解析 Commit 中的 Issue/PR 引用。
6. 发送通知。
7. 记录同步成功或失败。

同步失败时需要支持重试和管理员手动重新索引。

## 5. Markdown Wiki 规范

第一版兼容 GitHub Wiki 常用约定：

- `Home.md`：Wiki 首页。
- `_Sidebar.md`：侧边栏。
- `_Footer.md`：页脚。
- Markdown 文件路径对应页面路径。
- 相对链接自动解析到 Wiki 页面。
- 支持 GFM 表格、任务列表、脚注、Alert、代码高亮和删除线。
- 页面标题默认取第一个一级标题，也允许 front matter 覆盖。
- 图片和附件支持 `assets/` 引用。
- 不允许脚本、危险 CSS、表单控件和不安全 URL。

示例：

```text
Home.md
_Sidebar.md
guides/install.md
guides/configuration.md
api/authentication.md
assets/install-screen.png
```

图片和大附件默认走现有 Storage/R2，不直接将大量二进制文件写入 Git 仓库。Markdown 使用稳定的项目资源 URL 引用附件。

## 6. 页面和前端交互

项目页新增 Wiki、Issues、Pull Requests、Commits 入口。

计划新增页面：

```text
/projects/:slug/wiki
/projects/:slug/wiki/:path
/projects/:slug/wiki/edit/:path
/projects/:slug/wiki/history
/projects/:slug/wiki/branches
/projects/:slug/wiki/compare
/projects/:slug/issues
/projects/:slug/issues/:number
/projects/:slug/pulls
/projects/:slug/pulls/:number
```

Wiki 页面需要支持：

- 页面树。
- 页面搜索。
- 分支选择。
- 编辑 Markdown。
- 实时预览。
- 查看原始文件。
- 查看当前页面历史。
- 查看 Diff。
- 创建分支。
- 创建 Pull Request。
- 查看最近活动。

Web 编辑器提交时携带 `baseSha`。如果页面已经被其他人修改，后端返回冲突信息，要求用户查看 Diff 后重新合并，避免静默覆盖内容。

## 7. Commit 机制

Commit 支持两个来源：

1. 标准 Git 客户端 push。
2. Web 编辑器创建 Commit。

Web 编辑器创建 Commit 的流程：

```text
读取页面和 baseSha
  ↓
用户修改 Markdown
  ↓
提交路径、内容、分支、baseSha、Commit message
  ↓
服务端检查权限和版本冲突
  ↓
Git provider 创建 Commit
  ↓
更新索引和缓存
  ↓
解析关联关系并发送通知
```

Commit message 支持以下引用：

```text
Fix installation guide

Fixes #12
Refs #8
```

计划支持：

- `Fixes #12`
- `Closes #12`
- `Resolves #12`
- `Refs #12`
- `Related to #12`

合并 PR 后，`Fixes`、`Closes`、`Resolves` 引用可以自动关闭对应 Issue。

## 8. Issue 机制

Issue 由数据库保存，Git 仓库保存 Wiki 文件和历史。这样可以稳定处理评论、通知、标签、指派和状态变更。

Issue 功能包括：

- 创建、编辑、关闭、重新打开。
- 评论和评论编辑。
- 标签。
- 指派人。
- 里程碑。
- 关联 Commit。
- 关联 Pull Request。
- 锁定讨论。
- 项目内搜索。
- 站内通知。

Issue 编号按项目递增：

```text
/projects/luna-launcher/issues/12
```

Issue 可以通过 Commit message、PR 描述或网页操作与 Commit、PR 建立关系。

## 9. Pull Request 机制

Pull Request 表示一个 Wiki 分支向目标分支合并的请求。

流程：

```text
创建分支
  ↓
提交 Wiki 修改
  ↓
创建 PR
  ↓
展示文件 Diff
  ↓
评论和 Review
  ↓
检查保护规则
  ↓
合并或关闭
  ↓
重新索引目标分支
```

第一版 PR 功能包括：

- 标题和正文。
- 源分支和目标分支。
- Draft PR。
- Commit 列表。
- 文件 Diff。
- 行级或文件级评论。
- Approve。
- Request changes。
- 关闭和重新打开。
- 合并冲突提示。
- 合并后自动关闭关联 Issue。

默认分支保护规则：

- `owner`、`admin` 可以合并。
- `editor` 可以创建分支、提交和 PR。
- `reviewer` 可以审核。
- 默认分支禁止强制推送。
- 有冲突时禁止合并。
- 可配置是否需要至少一个审核通过。
- 合并后保留 merge commit 或 squash commit 策略。

## 10. 数据模型

### 10.1 Wiki 仓库

```text
wiki_repositories
  id
  project_id
  provider
  repository_key
  default_branch
  visibility
  created_at
  updated_at
```

### 10.2 分支和 Commit 索引

```text
wiki_branches
  repository_id
  name
  head_sha
  protected
  created_by
  created_at

wiki_commits
  id
  repository_id
  sha
  branch
  parent_shas_json
  author_id
  author_name
  author_email
  message
  changed_files_json
  created_at
```

### 10.3 页面索引

```text
wiki_pages
  repository_id
  path
  title
  current_sha
  rendered_html
  content_hash
  updated_at
```

SQLite 可以使用 FTS5 为页面标题和 Markdown 纯文本建立索引。D1 先使用前缀和项目范围查询，后续再增加专用搜索服务。

### 10.4 Issue

```text
issues
  id
  project_id
  number
  title
  body
  state
  author_id
  assignee_id
  milestone_id
  locked
  created_at
  updated_at
  closed_at

issue_comments
  id
  issue_id
  author_id
  body
  created_at
  updated_at

issue_labels
  issue_id
  label_id

issue_events
  id
  issue_id
  actor_id
  type
  data_json
  created_at
```

### 10.5 Pull Request

```text
pull_requests
  id
  project_id
  number
  title
  body
  source_branch
  target_branch
  head_sha
  base_sha
  merge_sha
  author_id
  state
  draft
  created_at
  updated_at
  merged_at
  closed_at

pull_request_reviews
  id
  pull_request_id
  reviewer_id
  state
  body
  commit_sha
  created_at

pull_request_comments
  id
  pull_request_id
  author_id
  path
  line
  body
  created_at
```

### 10.6 关联关系

```text
project_references
  id
  project_id
  source_type
  source_id
  target_type
  target_id
  reference_type
  commit_sha
  created_at
```

`source_type` 和 `target_type` 可以是 `commit`、`issue`、`pull_request` 或 `wiki_page`。`reference_type` 可以是 `fixes`、`closes`、`references`、`related`、`mentions`。

## 11. API 规划

### Wiki

```text
GET    /api/v1/projects/:slug/wiki
GET    /api/v1/projects/:slug/wiki/tree
GET    /api/v1/projects/:slug/wiki/pages/:path
GET    /api/v1/projects/:slug/wiki/raw/:path
GET    /api/v1/projects/:slug/wiki/commits
GET    /api/v1/projects/:slug/wiki/branches
POST   /api/v1/projects/:slug/wiki/branches
POST   /api/v1/projects/:slug/wiki/commits
GET    /api/v1/projects/:slug/wiki/compare
POST   /api/v1/projects/:slug/wiki/assets
POST   /api/v1/projects/:slug/wiki/reindex
```

### Git Smart HTTP

```text
GET    /git/wiki/:slug/info/refs
POST   /git/wiki/:slug/git-upload-pack
POST   /git/wiki/:slug/git-receive-pack
```

### Issue

```text
GET    /api/v1/projects/:slug/issues
POST   /api/v1/projects/:slug/issues
GET    /api/v1/projects/:slug/issues/:number
PATCH  /api/v1/projects/:slug/issues/:number
POST   /api/v1/projects/:slug/issues/:number/comments
POST   /api/v1/projects/:slug/issues/:number/labels
POST   /api/v1/projects/:slug/issues/:number/close
POST   /api/v1/projects/:slug/issues/:number/reopen
```

### Pull Request

```text
GET    /api/v1/projects/:slug/pulls
POST   /api/v1/projects/:slug/pulls
GET    /api/v1/projects/:slug/pulls/:number
PATCH  /api/v1/projects/:slug/pulls/:number
GET    /api/v1/projects/:slug/pulls/:number/diff
POST   /api/v1/projects/:slug/pulls/:number/comments
POST   /api/v1/projects/:slug/pulls/:number/reviews
POST   /api/v1/projects/:slug/pulls/:number/merge
POST   /api/v1/projects/:slug/pulls/:number/close
POST   /api/v1/projects/:slug/pulls/:number/reopen
```

## 12. 权限设计

复用现有全局角色和项目成员角色：

| 角色 | Wiki 阅读 | Wiki 写入 | Issue | PR | 合并 |
| --- | --- | --- | --- | --- | --- |
| owner | 完全 | 完全 | 完全 | 完全 | 可以 |
| admin | 完全 | 完全 | 完全 | 完全 | 可以 |
| editor | 项目可见范围 | 分支和 Commit | 创建、评论 | 创建和更新 | 按保护规则 |
| reviewer | 项目可见范围 | 无 | 评论 | Review | 否 |
| member | 项目可见范围 | 按项目设置 | 创建、评论 | 查看 | 否 |
| 游客 | 公开项目 | 无 | 查看公开内容 | 查看公开内容 | 否 |

组织项目需要同时检查组织成员角色和项目成员角色。所有写操作都必须经过服务端权限检查，前端按钮隐藏不能作为安全边界。

## 13. 安全与运维要求

Git 仓库和 Markdown 内容需要加入以下限制：

- 仓库路径只允许由内部项目 ID 解析。
- 禁止路径穿越、危险符号链接和未授权 submodule。
- 限制仓库总大小、单个 pack 大小和单文件大小。
- 限制 clone、fetch、push 和 API 请求频率。
- 默认分支禁止 force push。
- 禁止执行仓库内脚本和 Git hook。
- Markdown 继续使用现有 HTML、CSS、表单和 URL 清洗策略。
- 附件使用独立 Storage，并限制 MIME 类型和大小。
- 记录 push、分支保护修改、Issue 状态变化、PR review 和 merge 审计事件。
- Git provider 需要定期备份，数据库和 Git 仓库必须可以分别恢复。
- 同步失败需要重试队列和管理员可见状态。

## 14. 实施阶段

### 阶段 0：接口和部署决策

- 确认自托管是否允许依赖系统 Git。
- 确定本地 Git repository 根目录和备份策略。
- 定义 `WikiRepositoryProvider` 接口。
- 定义项目 Wiki 配置和权限规则。
- 编写迁移和 API 契约。

交付物：架构决策记录、数据库迁移草案、provider 接口和测试夹具。

### 阶段 1：只读 Wiki

- 创建项目 Wiki repository。
- 导入初始 `Home.md`。
- 实现页面树、页面读取和 Markdown 渲染。
- 支持 `_Sidebar.md`。
- 支持页面搜索和渲染缓存。
- 保留旧 `wikiUrl` 和 `wikiHtml` 回退逻辑。

交付物：项目 Wiki 页面可以稳定浏览。

### 阶段 2：Web 编辑和 Commit

- Wiki Markdown 编辑器。
- base SHA 冲突检测。
- Web Commit。
- Commit 历史和 Diff。
- 分支创建和切换。
- Wiki 图片和附件上传。

交付物：项目成员可以在网页完成文档修改并查看历史。

### 阶段 3：Git 客户端

- Git Smart HTTP。
- clone、fetch、push。
- Git 认证与项目权限映射。
- post-receive hook。
- push 后索引、缓存和通知。
- 默认分支保护和仓库配额。

交付物：用户可以使用标准 Git 客户端管理项目 Wiki。

### 阶段 4：Issue

- Issue、评论、标签、指派和里程碑。
- Issue 状态和通知。
- Issue 与 Commit、Wiki 页面和 PR 关联。
- `Fixes #n`、`Closes #n` 等引用解析。

交付物：每个项目拥有独立的问题跟踪区。

### 阶段 5：Pull Request

- 分支对比和 PR 创建。
- PR 评论和 Review。
- 审核规则。
- 合并、冲突检测和 merge commit。
- 合并后更新 Wiki 页面并关闭关联 Issue。

交付物：项目 Wiki 支持完整的文档协作流程。

### 阶段 6：云端 provider 和运维

- Forgejo/Gitea provider。
- Webhook 重试和同步队列。
- Git 仓库备份与恢复。
- 管理后台仓库健康状态。
- 搜索、统计和审计报表。

交付物：自托管和云端部署使用统一业务接口。

## 15. 测试计划

### API 测试

- Wiki 仓库创建和项目绑定。
- 页面读取和路径安全。
- Web Commit。
- base SHA 冲突。
- 分支权限。
- Git push 鉴权。
- 默认分支保护。
- Issue 生命周期。
- PR 创建、Review、冲突和合并。
- `Fixes #n` 自动关联。
- 删除账户或成员后的权限清理。

### 前端测试

- Wiki 页面渲染。
- GFM 表格、任务列表、Alert、脚注和代码块。
- Wiki 编辑器预览。
- Diff 页面。
- Issue 和 PR 状态变化。
- 权限角色下的按钮和页面访问。

### 安全测试

- 路径穿越。
- 恶意 Markdown HTML。
- 危险 URL 和 CSS。
- symlink、submodule 和 hook。
- 未授权 clone、push、merge。
- 超大文件和超大 pack。
- 并发 Commit 和并发合并。

## 16. 风险与取舍

### Git 协议复杂度

标准 Git Smart HTTP、认证和并发写入是主要技术风险。解决方案是使用系统 Git 或 Forgejo/Gitea，Modpost 负责业务层和权限层。

### Cloudflare Worker 限制

Worker 不能直接运行 Git 子进程，也不适合维护 bare repository。云端需要独立 Git 服务，或者将 Git provider 抽象为外部服务。

### 数据一致性

Git push、数据库索引、页面渲染和通知不能依赖单个事务完成。需要同步任务表、重试、幂等索引和手动重建能力。

### 仓库增长

Wiki 图片和附件会快速增加 Git 仓库大小。附件默认放在 R2/Storage，Git 只保存引用。

### Markdown 安全

Wiki 内容来自项目协作者，必须继续使用白名单清洗。预览和公开页面应使用同一套安全渲染器，避免预览和发布行为不一致。

### Issue/PR 范围膨胀

第一版只做项目内部协作，不立即实现 CI、Actions、Packages、代码审查机器人或完整 GitHub API 兼容层。

## 17. 第一版不包含的内容

- CI/CD 工作流。
- GitHub Actions 兼容执行器。
- 通用代码仓库托管。
- Git LFS。
- 在线运行用户提交的脚本。
- 跨项目 Issue。
- 邮件服务和复杂订阅规则。
- 完整 GitHub API 兼容。
- 公开的任意 Git repository 创建功能。

## 18. 验收标准

第一版完整交付至少应满足：

1. 管理员可以为项目启用内建 Wiki。
2. 项目页面可以读取 `Home.md`、侧边栏和其他 Markdown 页面。
3. 项目成员可以在网页编辑 Markdown 并创建 Commit。
4. 页面有可查看的提交历史和 Diff。
5. 用户可以使用标准 Git 客户端 clone 和 push。
6. 默认分支有权限保护和 force push 防护。
7. Issue 支持创建、评论、关闭和重新打开。
8. PR 支持创建、查看 Diff、Review、合并和冲突提示。
9. Commit、Issue 和 PR 可以互相引用。
10. `Fixes #n` 或 `Closes #n` 在 PR 合并后能关闭对应 Issue。
11. 项目角色权限在 API 和前端均生效。
12. Markdown 内容经过统一安全清洗。
13. Git 同步失败可重试并在管理后台发现。
14. SQLite 自托管部署和云端 provider 均有数据备份与恢复方案。

## 19. 推荐决策

推荐采用以下顺序：

```text
LocalGitProvider
  → Wiki 页面和 Web Commit
  → Git Smart HTTP
  → Issue
  → Pull Request
  → ForgejoProvider
```

自托管版本优先使用标准 Git 程序和本地持久化目录，保证 Git 客户端兼容性；云端版本使用 Forgejo/Gitea 作为 Git provider，保持 Modpost 的 Wiki、Issue、PR 和权限 API 不变。这样可以控制第一版复杂度，同时为后续完整协作能力保留扩展空间。

