// Keep this inventory aligned with the registered API routes. The reference test
// checks both missing documentation and documentation for nonexistent routes.
import type { DocsText as LocalizedText, DocsEndpoint as ApiEndpoint, DocsAccess as Access, DocsGroupId as GroupId } from '@andrea/contracts'
export type { DocsText as LocalizedText, DocsEndpoint as ApiEndpoint, DocsAccess as Access, DocsGroupId as GroupId } from '@andrea/contracts'
export const bi = (zh: string, en: string): LocalizedText => [zh, en]
export const accessLabels: Record<Access, LocalizedText> = {
  public: bi('公开', 'Public'), account: bi('账户登录', 'Account'),
  publisher: bi('开发者 / 管理员', 'Developer / administrator'),
  editor: bi('项目编辑权限', 'Project editor'), manager: bi('项目管理权限', 'Project manager'),
  admin: bi('admin / root', 'admin / root'), root: bi('仅 root', 'root only'),
  direct: bi('站点允许的直传用户组', 'Configured direct-upload roles'),
  setup: bi('首次初始化', 'First-time setup'), ygg: bi('Yggdrasil 协议', 'Yggdrasil protocol'),
}
export const groups = [
  { id: 'projects', title: bi('项目与版本', 'Projects & versions') },
  { id: 'publishing', title: bi('发布与发布令牌', 'Publishing & tokens') },
  { id: 'uploads', title: bi('文件、分片与直传', 'Files, multipart & direct uploads') },
  { id: 'downloads', title: bi('下载与镜像', 'Downloads & mirrors') },
  { id: 'dependencies', title: bi('依赖与跨加载器', 'Dependencies & loader bridges') },
  { id: 'accounts', title: bi('账户与 API Key', 'Accounts & API keys') },
  { id: 'collaboration', title: bi('组织与项目成员', 'Organizations & members') },
  { id: 'activity', title: bi('收藏、通知与统计', 'Favorites, notifications & statistics') },
  { id: 'github', title: bi('GitHub Actions 缓存', 'GitHub Actions cache') },
  { id: 'administration', title: bi('站点管理与快照', 'Administration & snapshots') },
  { id: 'minecraft', title: bi('Minecraft 与融合验证', 'Minecraft & federated authentication') },
  { id: 'compatibility', title: bi('Modrinth 兼容接口', 'Modrinth compatibility') },
] as const
const none = bi('无需请求体；替换路径中的 :参数。', 'No body; replace any :parameters in the path.')
const endpoint = (group: GroupId, method: ApiEndpoint['method'], path: string, title: LocalizedText, access: Access, input: LocalizedText, output: string, scope?: string, note?: LocalizedText): ApiEndpoint => ({ group, method, path, title, access, input, output, scope, note })
const e = endpoint
const json = (fields: string) => bi(`JSON：${fields}`, `JSON: ${fields}`)
const query = (fields: string) => bi(`查询参数：${fields}`, `Query: ${fields}`)
const project = '/api/v1/projects/:slug'
const account = '/api/v1/account'
const admin = '/api/v1/admin'
const session = '/api/v1/publish/uploads'
const role = 'role: admin | editor | reviewer | member'
const downloadQuery = query('game_version?, loader?, version_id?, channel=release|beta|alpha, file_id?, source?')
const tokenInput = json('name (1–80), scopes?: ["release:write"]')
const reviewInput = json('decision: "approve" | "reject", note?')
const resolveInput = json('versionId, gameVersion, loader, side: "client" | "server", loaderVersion?, selectedOptionalDependencies?: string[], enabledFeatures?: string[], installedVersions?: string[], fileSelections?: { [versionId]: fileId }')
export const endpoints: ApiEndpoint[] = [
  e('projects', 'GET', '/api/v1/docs', bi('按当前权限获取 API 文档', 'Get API documentation for your permissions'), 'public', query('format=json|markdown, lang=zh-CN|en-US, project?=<slug>'), '200 ApiDocumentation / text/markdown', undefined, bi('使用当前会话或 Bearer 令牌鉴权。project 只筛选项目上下文，不能指定 role 提升权限。响应不缓存。', 'Uses the current session or Bearer credentials. project selects context; a role parameter cannot elevate access. Responses are not cached.')),
  e('projects', 'GET', '/api/v1/health', bi('服务状态', 'Service health'), 'public', none, '200 { ok, service }'),
  e('projects', 'GET', '/api/v1/catalog', bi('完整可见项目目录', 'Visible project catalog'), 'public', none, '200 Catalog'),
  e('projects', 'GET', '/api/v1/projects', bi('搜索与筛选项目', 'Search and filter projects'), 'public', query('query?, type?, loader?, game_version?, category?, client_side?, server_side?, status?, sort=relevance|downloads|followers|updated, offset=0, limit=20 (≤100)'), '200 { projects, total, offset, limit, catalogRevision }', undefined, bi('loader 可重复且需全部匹配；game_version、category 可重复且匹配其中之一。未登录仅返回公开可见内容。', 'Repeat loader to require all loaders; repeated game_version and category values match any. Anonymous requests only see public content.')),
  e('projects', 'GET', project, bi('项目详情', 'Project details'), 'public', none, '200 Project + { canEdit, isFavorite, downloads, followers }'),
  e('projects', 'GET', `${project}/versions`, bi('项目版本列表', 'Project versions'), 'public', none, '200 { versions }'),
  e('projects', 'GET', `${project}/site`, bi('项目独立展示页', 'Standalone project page'), 'public', none, '200 text/html'),
  e('projects', 'GET', `${admin}/projects`, bi('可管理项目', 'Manageable projects'), 'publisher', none, '200 { projects }'),
  e('projects', 'POST', `${admin}/projects`, bi('创建项目', 'Create a project'), 'publisher', json('Project: id, slug, title, type, description, loaders: [], gameVersions: [], versions: []'), '201 { project }', 'project:create', bi('type: mod / modpack / resourcepack / shader / plugin / tool。可附带 body、license、iconUrl、links、cdnRules；组织项目需 ownerType="organization" 与 ownerId，并拥有组织管理权限。', 'type: mod / modpack / resourcepack / shader / plugin / tool. Optional body, license, iconUrl, links and cdnRules. Organization projects require ownerType="organization", ownerId and organization management rights.')),
  e('projects', 'PUT', `${admin}/projects/:slug`, bi('更新项目及版本', 'Update a project and its versions'), 'editor', json('Project'), '200 { project }', 'project:write', bi('提交完整 Project，不是局部 PATCH。先读取现有项目再修改；versions 同样会被替换。', 'Send a complete Project, not a partial PATCH. Read the project before editing; versions are replaced too.')),
  e('projects', 'DELETE', `${admin}/projects/:slug`, bi('删除数据库项目', 'Delete a stored project'), 'manager', none, '200 { ok }'),
  e('publishing', 'POST', `${project}/publish`, bi('发布 / 替换版本', 'Publish / replace a version'), 'editor', json('version: Version, replace?: boolean'), '201 / 200 { releaseId, project, versionId, status, version }', 'release:write', bi('Version 必填 id、version、type、gameVersions、loaders、files。重复 version.id 返回 VERSION_EXISTS，replace=true 才替换。数据库项目可发布；待审核时 status=pending_review，不能视为已公开。支持 files[].uploadId 引用已完成的发布上传会话。', 'Version requires id, version, type, gameVersions, loaders and files. Duplicate version.id returns VERSION_EXISTS unless replace=true. Only stored projects can be published. status=pending_review means not yet public. files[].uploadId can reference completed publish uploads.')),
  e('publishing', 'GET', `${project}/publish-tokens`, bi('列出项目发布令牌', 'List project publish tokens'), 'manager', none, '200 { tokens }', 'project:write'),
  e('publishing', 'POST', `${project}/publish-tokens`, bi('创建单项目发布令牌', 'Create a project-bound publish token'), 'manager', tokenInput, '201 { token, tokenInfo }', 'project:write', bi('token 仅返回一次。允许 project:read、release:write、release:publish；实际上传与发布需 release:write。令牌不能用于其他项目的发布。', 'The secret is returned once. Allowed scopes: project:read, release:write, release:publish. Upload and publishing require release:write. Publishing is bound to this project.')),
  e('publishing', 'DELETE', `${project}/publish-tokens/:id`, bi('撤销发布令牌', 'Revoke a publish token'), 'manager', none, '200 { ok }', 'project:write'),
  e('uploads', 'POST', `${project}/files`, bi('表单上传项目文件', 'Upload a project file as a form'), 'editor', bi('multipart/form-data：file；上限为 512 MiB 与站点限制的较小值。', 'multipart/form-data: file; limited to the lower of 512 MiB and the site limit.'), '201 { id, name, size, source }', 'release:write', bi('流量经过 Worker，也受 Cloudflare 请求大小限制。返回 source 后仍需发布版本。', 'Bytes pass through the Worker and are subject to Cloudflare request limits. Publish a version using the returned source.')),
  e('uploads', 'POST', session, bi('创建发布上传会话', 'Create a publish upload session'), 'account', bi('必填查询 project=<slug>；JSON: filename, size (≤512 MiB), contentType?, sha256?', 'Required query project=<slug>; JSON: filename, size (≤512 MiB), contentType?, sha256?'), '201 { uploadId, uploadUrl, method, expiresAt, partSize, completeUrl }', 'release:write', bi('会话有效期 1 小时。大于 100 MiB 且适配器支持分片时返回 partSize=8388608，否则为 null。sha256 当前仅保存，不代表已校验。最终发布仍检查项目编辑权限。', 'Sessions last one hour. Files above 100 MiB use partSize=8388608 if the adapter supports multipart, otherwise null. sha256 is stored, not verified. Publishing still requires project editing rights.')),
  e('uploads', 'PUT', `${session}/:id`, bi('上传整个文件并完成会话', 'Upload the whole file and complete'), 'account', bi('原始文件字节；大小必须等于声明的 size；需要 Authorization。', 'Raw file bytes; must match the declared size. Authorization required.'), '200 { uploadId, status: "complete", storageKey }', 'release:write', bi('仅用于非分片会话；成功后无需再调用 complete。流量经过 Worker。', 'Non-multipart sessions only; no subsequent complete call. Bytes pass through the Worker.')),
  e('uploads', 'PUT', `${session}/:id/parts/:part`, bi('上传一个分片', 'Upload one part'), 'account', bi('原始字节；part 为 1–10000；保存响应中的 etag。', 'Raw bytes; part is 1–10000. Keep the returned etag.'), '200 { part, etag }', 'release:write'),
  e('uploads', 'POST', `${session}/:id/complete`, bi('合并分片并完成会话', 'Complete a multipart upload'), 'account', json('parts: [{ partNumber, etag }]'), '200 { uploadId, status: "complete", storageKey }', 'release:write'),
  e('uploads', 'POST', '/api/v1/storage/direct-uploads', bi('申请 COS 直传 URL', 'Request a COS direct-upload URL'), 'direct', json('filename, size, contentType?, purpose: "project-file", projectSlug'), '201 { uploadId, uploadUrl, method: "PUT", expiresAt, completeUrl }', undefined, bi('需启用直传并将 COS 设为主存储；项目文件仍需编辑权限。省略 purpose 时上传账户资源。上限为 512 MiB 与站点限制的较小值。', 'Enable direct uploads and select COS as primary storage. Project files still require editing rights. Omit purpose for account assets. Limited to the lower of 512 MiB and the site limit.')),
  e('uploads', 'POST', '/api/v1/storage/direct-uploads/:id/complete', bi('确认直传完成', 'Confirm a direct upload'), 'direct', none, '200 { id, name, size, source } / { id, url, name, size }', undefined, bi('先向 uploadUrl PUT 文件，再用同一账户调用 completeUrl。项目文件返回的 source 加到 files[].sources；此 uploadId 不能当成发布会话 uploadId。', 'PUT bytes to uploadUrl first, then call completeUrl as the same account. Add the returned source to files[].sources. This uploadId is not a publish-session uploadId.')),
  e('uploads', 'POST', `${account}/uploads`, bi('上传头像 / 皮肤等账户资源', 'Upload account assets'), 'account', bi('multipart/form-data: file, purpose?；最多 20 MiB，purpose=skin 时仅 PNG/JPEG 且 ≤2 MiB。', 'multipart/form-data: file, purpose?; up to 20 MiB. purpose=skin accepts PNG/JPEG up to 2 MiB.'), '201 { id, url, name, size }'),
  e('downloads', 'GET', '/api/v1/files/:fileId', bi('文件信息', 'File metadata'), 'public', none, '200 { id, filename, description, size, hashes, url, sources, primary }'),
  e('downloads', 'GET', '/api/v1/files/:fileId/sources', bi('下载源与当前分流结果', 'Sources and selected mirror'), 'public', query('source?=<source-id>'), '200 { file, selected, mirrors, region }'),
  e('downloads', 'GET', '/api/v1/files/:fileId/download', bi('固定下载入口与统计', 'Stable download entry and counting'), 'public', query('source?=<source-id>'), '302 Location: selected source', undefined, bi('记录下载请求 / 跳转事件，不是下载完成次数。指定不存在的 source 返回 404。', 'Counts download requests / redirects, not completed transfers. An unknown source returns 404.')),
  e('downloads', 'GET', `${project}/resolve`, bi('按环境解析下载文件', 'Resolve a file for an environment'), 'public', downloadQuery, '200 { project_id, version_id, version, game_versions, loaders, file }', undefined, bi('无法唯一选定时返回 409 AMBIGUOUS_VERSION / AMBIGUOUS_FILE；显式指定 version_id / file_id。', 'Ambiguous choices return 409 AMBIGUOUS_VERSION / AMBIGUOUS_FILE; specify version_id / file_id.')),
  e('downloads', 'GET', `${project}/download`, bi('按环境解析并下载', 'Resolve and download'), 'public', downloadQuery, '302 Location: selected source'),
  e('downloads', 'GET', '/api/v1/storage/:id{.+}', bi('存储对象固定地址', 'Stable storage object URL'), 'public', bi('id 是可含 / 的存储 key，使用上传响应中的 URL。', 'id is a storage key that may contain /. Use the URL from the upload response.'), '302 Location / 200 file bytes', undefined, bi('COS 私有桶跳转到临时签名 URL；R2 binding / 本地存储可能通过应用返回字节。该入口不计项目下载量。', 'Private COS redirects to a temporary signed URL; R2 bindings / local storage may serve bytes through the app. This route does not count project downloads.')),
  e('dependencies', 'GET', '/api/v1/dependencies/external', bi('绑定 Modrinth / CurseForge 项目', 'Resolve Modrinth / CurseForge projects'), 'public', query('provider=modrinth|curseforge, projectId, gameVersion, loader, versionId?'), '200 { reference, title, versions: [{ id, version }] }', undefined, bi('CurseForge 项目与文件 ID 为数字，服务端需配置 CurseForge API Key。', 'CurseForge project and file IDs are numeric; the server needs a CurseForge API key.')),
  e('dependencies', 'POST', '/api/v1/dependencies/resolve', bi('解析完整依赖树', 'Resolve a dependency tree'), 'public', resolveInput, '200 { success, installable, nodes, edges, errors, warnings, manifest, unresolvedExternal }', undefined, bi('HTTP 200 不等于可安装；检查 success 和 installable。依赖按版本声明，可指定版本范围、加载器、游戏版本、可选依赖、联动与 loaderBridges。', 'HTTP 200 does not imply installability; check success and installable. Declare dependencies per version, including version constraints, loaders, game versions, optional dependencies, integrations and loaderBridges.')),
  e('dependencies', 'POST', '/api/v1/dependencies/preview', bi('预览未保存项目的依赖', 'Preview dependencies for an unsaved project'), 'publisher', json('project: Project, input: DependencyRequest'), '200 dependency resolution result'),
  e('dependencies', 'GET', `${project}/versions/:versionId/dependencies`, bi('读取版本依赖声明', 'Read version dependency declarations'), 'public', none, '200 { dependencies, loaderBridges, loaders, gameVersions }'),
  e('dependencies', 'GET', `${project}/dependents`, bi('读取反向依赖', 'Read dependent projects'), 'public', none, '200 { dependents }'),
  e('accounts', 'POST', '/api/v1/auth/register', bi('注册账户', 'Register an account'), 'public', json('email, password (8–128), inviteCode?'), '201 { account, accessToken, tokenType, expiresIn } / 202 { account, pendingApproval }'),
  e('accounts', 'POST', '/api/v1/auth/login', bi('登录', 'Log in'), 'public', json('email, password (8–128)'), '200 { account, accessToken, tokenType, expiresIn } + cookies'),
  e('accounts', 'POST', '/api/v1/auth/logout', bi('退出浏览器会话', 'Log out of a browser session'), 'public', bi('携带会话 Cookie；不撤销 API Key。', 'Send the session cookies. Does not revoke API keys.'), '200 { ok }'),
  e('accounts', 'GET', '/api/v1/me', bi('当前账户与权限', 'Current account and role'), 'public', none, '200 { account: Account | null }'),
  e('accounts', 'PATCH', `${account}/profile`, bi('更新个人资料', 'Update profile'), 'account', json('metadata: { username?, displayName?, bio?, avatarUrl?, location?, websiteUrl?, githubUrl?, links? }'), '200 { account }'),
  e('accounts', 'GET', '/api/v1/users', bi('搜索协作者', 'Search collaborators'), 'account', query('query?, project?'), '200 { users }', undefined, bi('最多 20 位开发者或管理员。', 'Up to 20 developers or administrators.')),
  e('accounts', 'GET', '/api/v1/users/:id', bi('公开个人主页', 'Public user profile'), 'public', none, '200 { profile, projects }'),
  e('accounts', 'GET', `${account}/api-keys`, bi('列出自己的开发者 API Key', 'List your developer API keys'), 'account', none, '200 { apiKeys }'),
  e('accounts', 'POST', `${account}/api-keys`, bi('创建开发者 API Key', 'Create a developer API key'), 'account', json('name (1–80), scopes?: string[]'), '201 { apiKey, token }', undefined, bi('默认 scopes=["read"]，不会授予写权限。项目创建、编辑和发布分别使用 project:create、project:write、release:write。secret token 仅创建时返回。', 'Default scopes=["read"] does not grant writes. Use project:create, project:write and release:write for creation, editing and publishing. The secret token is returned only at creation.')),
  e('accounts', 'DELETE', `${account}/api-keys/:id`, bi('撤销自己的 API Key', 'Revoke your API key'), 'account', none, '200 { ok }'),
  e('collaboration', 'GET', '/api/v1/organizations', bi('我的组织', 'My organizations'), 'account', none, '200 { organizations }'),
  e('collaboration', 'POST', '/api/v1/organizations', bi('创建组织', 'Create an organization'), 'account', json('slug, name, description?, avatarUrl?'), '201 { organization }'),
  e('collaboration', 'GET', '/api/v1/organizations/:slug', bi('组织详情', 'Organization details'), 'public', none, '200 { organization, members, projects }'),
  e('collaboration', 'GET', `${project}/members`, bi('项目成员', 'Project members'), 'public', none, '200 { members }'),
  e('collaboration', 'POST', `${project}/members`, bi('添加成员', 'Add a member'), 'manager', json(`accountId | email, ${role}`), '201 { members }'),
  e('collaboration', 'PATCH', `${project}/members/:accountId`, bi('修改成员角色', 'Change a member role'), 'manager', json(role), '200 { members }'),
  e('collaboration', 'DELETE', `${project}/members/:accountId`, bi('移除成员', 'Remove a member'), 'manager', none, '200 { ok }'),
  e('collaboration', 'POST', `${project}/invitations`, bi('邀请协作者', 'Invite a collaborator'), 'manager', json(`email, ${role}`), '201 { invitation }'),
  e('collaboration', 'GET', `${account}/invitations`, bi('我的邀请', 'My invitations'), 'account', none, '200 { invitations }'),
  e('collaboration', 'PATCH', `${account}/invitations/:id`, bi('接受 / 拒绝邀请', 'Accept / decline an invitation'), 'account', json('status: "accepted" | "declined"'), '200 { ok }'),
  e('activity', 'GET', `${account}/notifications`, bi('我的通知', 'My notifications'), 'account', none, '200 { notifications }'),
  e('activity', 'PATCH', `${account}/notifications/:id/read`, bi('标记通知已读', 'Mark a notification as read'), 'account', none, '200 { ok }'),
  e('activity', 'GET', `${account}/favorites`, bi('账户收藏夹', 'Account favorites'), 'account', none, '200 { favorites, projects }'),
  e('activity', 'GET', `${project}/favorite`, bi('收藏状态与数量', 'Favorite status and count'), 'public', none, '200 { favorite, count }', undefined, bi('未登录返回 favorite=false、count=0；公开收藏总数请读取项目详情的 followers。', 'Anonymous requests return favorite=false, count=0. Read project followers for the public total.')),
  e('activity', 'PUT', `${project}/favorite`, bi('收藏项目', 'Favorite a project'), 'account', none, '200 { favorite, count }'),
  e('activity', 'DELETE', `${project}/favorite`, bi('取消收藏', 'Remove a favorite'), 'account', none, '200 { favorite, count }'),
  e('activity', 'GET', `${admin}/overview`, bi('Dashboard 与下载 / 收藏统计', 'Dashboard, downloads and favorites'), 'publisher', none, '200 { accounts, projects, versions, files, downloads, favorites, topDownloads, topFavorites }'),
  e('github', 'GET', '/api/v1/github/actions/artifacts', bi('读取共享缓存 / 代理请求', 'Read shared cache / proxy request'), 'public', query('owner, repo, page=1, per_page=30 (≤100), refresh=1?, proxy=1?'), '200 { enabled, cached?, data? } / 424 cache miss', undefined, bi('共享缓存与服务端代理分别受站点开关控制。先查缓存，客户端直连 GitHub 并提交新结果；连不上时才用 proxy=1。关闭共享缓存时返回 enabled=false。', 'Shared caching and server proxying have separate site switches. Check cache, fetch GitHub from the client and submit fresh data; use proxy=1 as a fallback. Disabled shared caching returns enabled=false.')),
  e('github', 'POST', '/api/v1/github/actions/artifacts/cache', bi('提交客户端 GitHub 查询结果', 'Submit a client GitHub result'), 'public', bi('查询 owner, repo, page?, per_page?；JSON: { total_count, artifacts }，最多 2 MB。', 'Query owner, repo, page?, per_page?; JSON: { total_count, artifacts }, up to 2 MB.'), '200 { enabled, saved? }'),
  e('administration', 'GET', '/api/v1/settings', bi('公开站点配置', 'Public site settings'), 'public', none, '200 { settings: { appearance, registration, githubActions } }'),
  e('administration', 'GET', '/api/v1/setup/status', bi('初始化状态', 'Setup status'), 'public', none, '200 { initialized, requiresToken }'),
  e('administration', 'POST', '/api/v1/setup/initialize', bi('初始化站点和 root', 'Initialize site and root account'), 'setup', json('token?, siteName, email, password'), '201 initialization result', undefined, bi('仅未初始化时可用；部署配置了初始化令牌时必须提供。', 'Only available before initialization; a configured setup token must be supplied.')),
  e('administration', 'GET', `${admin}/settings`, bi('管理配置（存储、缓存、验证等）', 'Manage storage, cache and authentication settings'), 'admin', none, '200 { settings }', undefined, bi('admin 获取的凭据字段会脱敏；root 可管理站点身份和凭据。', 'Credentials are redacted for admin; root can manage site identity and credentials.')),
  e('administration', 'PUT', `${admin}/settings`, bi('保存站点配置', 'Save site settings'), 'admin', json('registration, moderation, appearance?, storage?, githubActions?, ygg?, mojang?'), '200 { settings }', undefined, bi('先 GET 再修改并 PUT；registration 和 moderation 必填。不要用省略字段的示例覆盖实际设置。', 'GET, edit, then PUT. registration and moderation are required. Preserve existing settings when updating.')),
  e('administration', 'GET', `${admin}/accounts`, bi('账户列表', 'List accounts'), 'admin', none, '200 { accounts }'),
  e('administration', 'PATCH', `${admin}/accounts/:id/verification`, bi('审批账户', 'Approve an account'), 'admin', json('approved: boolean'), '200 { ok, verifiedAt }'),
  e('administration', 'PATCH', `${admin}/accounts/:id/role`, bi('修改账户角色', 'Change account role'), 'admin', json('role: "user" | "developer" | "admin" | "root"'), '200 { ok, id, role }', undefined, bi('涉及 root 的角色变更仅 root 可操作，不能降级自己或最后一个 root。', 'Only root can change root roles. Self-demotion and removing the last root are rejected.')),
  e('administration', 'DELETE', `${admin}/accounts/:id`, bi('删除账户', 'Delete an account'), 'admin', none, '200 { ok }'),
  e('administration', 'GET', `${admin}/reviews`, bi('审核队列', 'Review queue'), 'admin', none, '200 { reviews }'),
  e('administration', 'POST', `${admin}/reviews/projects/:slug`, bi('审核项目', 'Review a project'), 'admin', reviewInput, '200 { ok, status }'),
  e('administration', 'POST', `${admin}/reviews/files/:fileId`, bi('审核文件', 'Review a file'), 'admin', reviewInput, '200 { ok, status }'),
  e('administration', 'GET', `${admin}/database/export`, bi('明文快照导出（旧入口）', 'Plaintext snapshot export (legacy)'), 'root', none, '200 snapshot bundle'),
  e('administration', 'POST', `${admin}/database/export`, bi('加密快照导出', 'Encrypted snapshot export'), 'root', json('password (≥12)'), '200 encrypted snapshot envelope'),
  e('administration', 'POST', `${admin}/database/import`, bi('导入快照', 'Import a snapshot'), 'root', bi('JSON：明文 bundle，或加密导出对象附加 password。', 'JSON: plaintext bundle, or the encrypted export object with password.'), '200 import counts', undefined, bi('format=andrea-modpost-bundle、schemaVersion=1。导入可能部分完成，失败后先检查返回信息与服务端日志。', 'format=andrea-modpost-bundle, schemaVersion=1. Imports can partially complete; inspect the response and server logs on failure.')),
  e('administration', 'GET', `${admin}/storage/sync`, bi('查询多存储同步状态', 'Read storage replication status'), 'admin', query('key'), '200 { status }'),
  e('administration', 'POST', `${admin}/storage/sync`, bi('同步到其他存储', 'Replicate to other storage providers'), 'admin', json('key? | keys?: string[] | projectSlug?, providerIds?: string[]'), '200 { ok, force, results }', undefined, bi('每次 1–1000 个对象；逐项检查 results 的结果。', '1–1000 objects per request; inspect each item in results.')),
  e('minecraft', 'PATCH', `${account}/minecraft-profile`, bi('更新自己的皮肤与披风', 'Update your skin and cape'), 'account', json('skinUrl?: string | null, capeUrl?: string | null'), '200 { account }'),
  e('minecraft', 'PATCH', `${admin}/accounts/:id/minecraft-profile`, bi('管理 Minecraft UUID', 'Manage a Minecraft UUID'), 'root', json('uuid, skinUrl?, capeUrl?, source?: "local" | "mojang" | "upstream"'), '200 { ok, id, minecraftUuid, uuidSource }'),
  e('minecraft', 'GET', `${account}/mojang/device-code`, bi('发起微软设备授权', 'Start Microsoft device authorization'), 'account', none, '200 device-code response', undefined, bi('站点需启用 Mojang 集成并配置 Client ID。', 'The site must enable Mojang integration and configure a client ID.')),
  e('minecraft', 'POST', `${account}/mojang/poll`, bi('完成微软授权并同步档案', 'Complete Microsoft authorization and sync profile'), 'account', json('deviceCode'), '200 { ok, account: { id, minecraftUuid, skinUrl, capeUrl, uuidSource, name } }'),
  e('minecraft', 'GET', '/api/ygg/meta', bi('Yggdrasil 服务元信息', 'Yggdrasil service metadata'), 'public', none, '200 Yggdrasil metadata'),
  ...['server-config', 'config', 'server'].map(path => e('minecraft', 'GET', `/api/ygg/${path}`, bi('Minecraft 服务端接入配置', 'Minecraft server configuration'), 'public', none, '200 server configuration')),
  e('minecraft', 'POST', '/api/ygg/authserver/authenticate', bi('游戏账户认证', 'Authenticate a game account'), 'ygg', json('username, password, clientToken?'), '200 { accessToken, clientToken, availableProfiles, selectedProfile }'),
  e('minecraft', 'POST', '/api/ygg/authserver/refresh', bi('刷新游戏令牌', 'Refresh a game token'), 'ygg', json('accessToken, clientToken?'), '200 refreshed Yggdrasil session'),
  ...['validate', 'invalidate', 'signout'].map(path => e('minecraft', 'POST', `/api/ygg/authserver/${path}`, bi({ validate: '校验游戏令牌', invalidate: '注销游戏令牌', signout: '退出游戏认证' }[path]!, { validate: 'Validate game token', invalidate: 'Invalidate game token', signout: 'Sign out of game authentication' }[path]!), 'ygg', json('accessToken'), '204 / Yggdrasil error', undefined, bi('当前 signout 实现按 accessToken 撤销，不是按用户名和密码注销所有会话。', 'The current signout implementation revokes an accessToken; it does not sign out all sessions by username and password.'))),
  e('minecraft', 'POST', '/api/ygg/sessionserver/session/minecraft/join', bi('登记加入服务器', 'Register a server join'), 'ygg', json('accessToken, selectedProfile, serverId'), '204'),
  e('minecraft', 'GET', '/api/ygg/sessionserver/session/minecraft/hasJoined', bi('检查加入服务器会话', 'Check a server join'), 'ygg', query('username, serverId'), '200 profile / 204'),
  e('minecraft', 'GET', '/api/ygg/sessionserver/session/minecraft/profile/:uuid', bi('读取游戏档案与材质', 'Read game profile and textures'), 'ygg', query('unsigned=true?'), '200 game profile'),
  e('minecraft', 'POST', '/api/ygg/api/profiles/minecraft', bi('按玩家名称批量查档案', 'Look up profiles by name'), 'ygg', bi('JSON 字符串数组，最多 100 个名称。', 'JSON string array, up to 100 names.'), '200 profiles[]'),
]

// Both compatibility prefixes register the same read-only subset.
const compatibilityRoutes: Array<[string, LocalizedText, LocalizedText, string]> = [
  ['/search', bi('兼容搜索', 'Compatible search'), query('query?, project_type?, offset=0, limit=10 (≤100)'), '{ hits, offset, limit, total_hits }'],
  ['/project/:id', bi('兼容项目详情', 'Compatible project details'), none, 'Modrinth project'],
  ['/project/:id/version', bi('兼容版本列表', 'Compatible version list'), query('game_versions?, loaders?, version_type?'), 'Modrinth versions[]'],
  ['/version/:id', bi('兼容版本详情', 'Compatible version details'), none, 'Modrinth version'],
  ['/version_file', bi('按 SHA-1 / SHA-512 查版本', 'Find a version by SHA-1 / SHA-512'), query('hash'), 'Modrinth version'],
  ...['game_version', 'loader', 'category', 'project_type', 'license'].map(tag => [`/tag/${tag}`, bi(`兼容标签：${tag}`, `Compatible tags: ${tag}`), none, 'tags[]'] as [string, LocalizedText, LocalizedText, string]),
]
for (const prefix of ['/v2', '/api/modrinth/v2']) for (const [path, title, input, output] of compatibilityRoutes) {
  endpoints.push(e('compatibility', 'GET', `${prefix}${path}`, title, 'public', input, `200 ${output}`, undefined, bi('仅实现列出的读取子集，不是完整 Modrinth API。列表过滤用重复查询参数，不是 JSON 数组字符串。', 'Only the listed read-only subset is implemented, not the entire Modrinth API. Repeat query parameters for list filters; do not encode JSON arrays.')))
}
