import type { DocsGuide as ApiGuide } from '@andrea/contracts'
import { bi } from './reference.js'

export const projectExample = {
  id: 'example-mod', slug: 'example-mod', title: 'Example Mod', type: 'mod',
  description: 'An example Minecraft mod', loaders: ['fabric'], gameVersions: ['1.21.1'], versions: [],
}
export const githubFileExample = {
  id: 'example-mod-1.0.0-jar', name: 'example-mod-1.0.0.jar', primary: true,
  sources: [{ id: 'github', kind: 'github_release', region: 'GLOBAL', priority: 200, url: 'https://github.com/OWNER/REPO/releases/download/v1.0.0/example-mod-1.0.0.jar' }],
}
export const versionExample = {
  id: 'example-mod-1.0.0', version: '1.0.0', type: 'release', gameVersions: ['1.21.1'], loaders: ['fabric'],
  publishedAt: '2026-01-01T00:00:00Z', changelog: '## Changes\nFirst release.', files: [githubFileExample],
}
export const dependencyExample = {
  id: 'fabric-api', dependencyType: 'required',
  external: { provider: 'modrinth', projectId: 'P7dR8mSH' },
  appliesTo: { loaders: ['fabric'], gameVersions: ['1.21.1'], side: 'both' },
}
export const dependencyRequestExample = { versionId: 'example-mod-1.0.0', gameVersion: '1.21.1', loader: 'fabric', side: 'client', selectedOptionalDependencies: [], enabledFeatures: [], installedVersions: [], fileSelections: {} }

const pretty = (value: unknown) => JSON.stringify(value, null, 2)

export function createGuides(base: string): ApiGuide[] {
  return [
    { id: 'quickstart', title: bi('开始接入', 'Getting started'), paragraphs: [
      bi('以下命令使用 Bash、curl 和 jq。BASE 指向当前 API 服务；先把 TOKEN、PROJECT 和示例文件名替换为自己的值。公开读取通常无需令牌，JSON 写入请求使用 Content-Type: application/json。路径中的 :slug、:id 等是占位符，实际值应做 URL 编码。', 'Commands use Bash, curl and jq. BASE points to the current API service; replace TOKEN, PROJECT and file names. Public reads usually need no token. JSON writes use Content-Type: application/json. Replace and URL-encode :slug, :id and other path parameters.'),
    ], code: `export BASE=${JSON.stringify(base)}\nexport TOKEN="YOUR_API_KEY_OR_PROJECT_TOKEN"\nexport PROJECT="example-mod"\n\ncurl --fail-with-body "$BASE/api/v1/projects?limit=20"\ncurl --fail-with-body -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/me"` },
    { id: 'authentication', title: bi('API Key、发布 Token 与权限', 'API keys, publish tokens and permissions'), paragraphs: [
      bi('在账户页创建开发者 API Key；自动化请求通过 Authorization: Bearer <token> 发送。创建时返回的 token 只显示一次。浏览器也可以使用登录 Cookie；CI 应使用专用凭据。', 'Create a developer API key on the account page and send Authorization: Bearer <token>. The secret is returned once. Browsers can also use login cookies; CI should use a dedicated credential.'),
      bi('project:create 用于创建项目；project:write 用于完整更新项目和管理发布 Token；release:write 用于文件上传与版本发布。默认 read 不包含这些写权限，release:publish 单独也不能发布。', 'project:create creates projects; project:write updates full projects and manages publish tokens; release:write uploads files and publishes versions. Default read does not grant these writes, and release:publish alone cannot publish.'),
      bi('Scope 不会提升账户角色。项目编辑者通常需要开发者角色和项目 owner/admin/editor 身份，或所属组织的 owner/admin；项目管理不包含 editor。站点 admin/root 可管理项目。目录中列出的 scope 是对应接口实际校验的 scope，未标注的接口仍按账户角色和资源权限检查。', 'Scopes do not elevate account roles. Editing generally requires the developer role plus project owner/admin/editor or owning organization owner/admin membership. Project management excludes editors. Site admin/root can manage projects. Scopes shown in the directory are enforced by those endpoints; other endpoints still check account and resource permissions.'),
      bi('推荐给每个 GitHub 仓库单独创建绑定项目的发布 Token，设置 release:write。不要把 API Key、发布 Token 或 COS 密钥写入公开仓库。', 'Create a separate project-bound publish token with release:write for each GitHub repository. Store secrets in GitHub Actions secrets, not repository files.'),
    ], code: `curl --fail-with-body "$BASE/api/v1/projects/$PROJECT/publish-tokens" \\\n  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\\n  --data '{"name":"GitHub Actions","scopes":["release:write"]}'` },
    { id: 'create-project', title: bi('创建与管理项目', 'Create and manage projects'), paragraphs: [
      bi('下方为最小 Project 请求体，保存为 project.json。POST /api/v1/admin/projects 创建项目；PUT /api/v1/admin/projects/:slug 接收完整项目，不是补丁。更新前读取已有内容以保留版本、依赖和其他元数据。', 'Save this minimal Project body as project.json. POST /api/v1/admin/projects creates it. PUT /api/v1/admin/projects/:slug accepts a full project, not a patch. Read existing data before updating to preserve versions, dependencies and other metadata.'),
      bi('创建项目需要开发者或管理员角色和 project:create。尽管路径包含 admin，开发者也能管理自己的项目；静态 Catalog 项目不通过数据库发布接口更新。', 'Creating requires a developer or administrator role and project:create. Despite the admin path, developers can manage their own projects. Static catalog projects are not updated through database publishing endpoints.'),
    ], payload: pretty(projectExample), payloadLabel: 'project.json', code: `curl --fail-with-body "$BASE/api/v1/admin/projects" \\\n  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\\n  --data-binary @project.json` },
    { id: 'release-modes', title: bi('三种发布方式', 'Three publishing modes'), paragraphs: [
      bi('仅 GitHub：files[].sources 写入 github_release 下载地址，无需向本站传文件。下方是完整的发布请求体，保存为 release.json 后 POST 到 /api/v1/projects/:slug/publish。替换 OWNER/REPO 和版本、加载器、游戏版本。', 'GitHub only: put a github_release URL in files[].sources without uploading to this site. Save the complete body below as release.json and POST it to /api/v1/projects/:slug/publish. Replace OWNER/REPO, version, loader and game version.'),
      bi('仅本站：先上传文件。表单上传或 COS 直传返回 {id,name,size,source}，将其转换为 {id,name,size,sources:[source]} 放入 version.files。发布上传会话则可使用 files:[{uploadId,primary:true}]，服务端会补齐文件与 managed 源。', 'Managed only: upload first. Form and COS direct uploads return {id,name,size,source}; convert that to {id,name,size,sources:[source]} in version.files. Publish sessions instead support files:[{uploadId,primary:true}], with file metadata and a managed source filled in by the server.'),
      bi('双源：同一个 file 的 sources 同时包含 managed 与 github_release，或使用 uploadId 加 GitHub sources。设两者为 GLOBAL，GitHub priority=200、managed=50 可优先选 GitHub；地区匹配优先于 priority，项目 CDN 规则也可能参与选择。不是给 publish 传一个 mode 字段。', 'Hybrid: put managed and github_release sources on the same file, or combine uploadId with GitHub sources. With both GLOBAL, GitHub priority=200 and managed=50 favors GitHub. Region matching outranks priority and project CDN rules may participate. There is no mode field on publish.'),
      bi('版本 id 必须稳定且唯一；重复发布返回 409，明确需要替换时设置 replace=true。收到 pending_review 表示待审核。本站返回的固定 URL 可长期保存；不要保存 COS 临时签名地址。', 'Use a stable, unique version id. Duplicate publishing returns 409; set replace=true for intentional replacement. pending_review means awaiting moderation. Keep the stable site URL, not an expiring COS signature.'),
    ], payload: pretty({ version: versionExample, replace: false }), payloadLabel: 'release.json', code: `curl --fail-with-body "$BASE/api/v1/projects/$PROJECT/publish" \\\n  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\\n  --data-binary @release.json` },
    { id: 'upload-sessions', title: bi('上传会话与分片流程', 'Upload sessions and multipart flow'), paragraphs: [
      bi('1. POST /api/v1/publish/uploads?project=<slug>，传 filename、size、contentType；记录 uploadId、uploadUrl、partSize 和 completeUrl。所有会话接口都需要同一账户和 release:write。', '1. POST /api/v1/publish/uploads?project=<slug> with filename, size and contentType. Save uploadId, uploadUrl, partSize and completeUrl. Session endpoints require the same account and release:write.'),
      bi('2. partSize=null 时向 uploadUrl PUT 原始文件字节，成功即完成。partSize 非空时按该大小切片（最后一片可更小），逐片 PUT /api/v1/publish/uploads/:id/parts/1、/2 等，记录每片 etag。', '2. If partSize=null, PUT raw bytes to uploadUrl; this completes the upload. Otherwise split at partSize (the last part may be smaller), PUT parts to /api/v1/publish/uploads/:id/parts/1, /2, etc., and collect each etag.'),
      bi('3. 分片上传结束后向 completeUrl POST 下方结构。4. 调用 publish，files 中引用该 uploadId。分片仍经过 Worker，只是每次请求更小；它不是 COS 直传。会话有效期 1 小时，发布会话 size 上限为 512 MiB。', '3. POST the body below to completeUrl after all parts finish. 4. Publish with that uploadId in files. Multipart still passes through the Worker in smaller requests; it is not COS direct upload. Sessions last one hour and declare up to 512 MiB.'),
    ], code: pretty({ parts: [{ partNumber: 1, etag: 'ETAG_RETURNED_BY_PART_1' }, { partNumber: 2, etag: 'ETAG_RETURNED_BY_PART_2' }] }) },
    { id: 'direct-upload', title: bi('COS 直传：文件不经过 Worker', 'COS direct uploads: bytes bypass the Worker'), paragraphs: [
      bi('站点设置中启用直传、配置允许的用户组（默认 admin/root），并选择腾讯云 COS 主存储。私有桶也支持签名直传与签名下载，无需改成公有桶。浏览器上传还需 COS CORS 允许站点来源、PUT 和 Content-Type。', 'Enable direct uploads, configure allowed roles (default admin/root) and select Tencent COS as primary storage. Private buckets support signed uploads and downloads. Browser uploads also need COS CORS allowing the site origin, PUT and Content-Type.'),
      bi('先向平台申请签名地址，再直接 PUT 到 COS，最后向平台确认。COS PUT 不携带平台 Authorization；Content-Type 与申请时一致。完成后返回文件 source，再发布版本。', 'Request a signed URL from the platform, PUT directly to COS, then confirm with the platform. Do not send platform Authorization to COS; use the same Content-Type as requested. Publish a version using the returned file source.'),
      bi('平台申请和确认请求仍经过 Worker，但文件字节不经过。适用上限仍为 512 MiB 与站点文件大小限制的较小值。此处返回的 uploadId 不能用于 files[].uploadId；应使用 complete 的 source。', 'Signing and confirmation still contact the Worker, but file bytes bypass it. The lower of 512 MiB and the site file limit still applies. This uploadId is not valid as files[].uploadId; use the source from completion.'),
    ], code: `export FILE="example-mod-1.0.0.jar"\nSIZE=$(wc -c < "$FILE" | tr -d ' ')\njq -n --arg filename "$FILE" --arg project "$PROJECT" --argjson size "$SIZE" \\\n  '{filename:$filename,size:$size,contentType:"application/octet-stream",purpose:"project-file",projectSlug:$project}' > direct.json\ncurl --fail-with-body "$BASE/api/v1/storage/direct-uploads" \\\n  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\\n  --data-binary @direct.json > session.json\ncurl --fail-with-body -X PUT "$(jq -r .uploadUrl session.json)" \\\n  -H "Content-Type: application/octet-stream" --data-binary "@$FILE"\ncurl --fail-with-body -X POST "$(jq -r .completeUrl session.json)" \\\n  -H "Authorization: Bearer $TOKEN" > uploaded.json\njq '{id,name,size,primary:true,sources:[.source]}' uploaded.json > file.json` },
    { id: 'dependencies-guide', title: bi('按版本声明依赖', 'Declare dependencies per version'), paragraphs: [
      bi('将依赖放入 version.dependencies。dependencyType 支持 required、optional、recommended、integration、incompatible、embedded；站内目标用 projectId/versionId，站外目标用 external，两者不可混用。下方示例绑定 Modrinth Fabric API。', 'Use version.dependencies. dependencyType supports required, optional, recommended, integration, incompatible and embedded. Use projectId/versionId for local targets or external for third-party targets, not both. The example binds Modrinth Fabric API.'),
      bi('versionConstraint 可用 {scheme:"semver",range:">=1.0.0 <2.0.0"} 或 {scheme:"exact",versions:["1.0.0"]}。appliesTo 限定加载器、游戏版本、端和 loaderRange；when.feature 与 when.installedProjectIds 声明条件。', 'versionConstraint accepts {scheme:"semver",range:">=1.0.0 <2.0.0"} or {scheme:"exact",versions:["1.0.0"]}. appliesTo limits loaders, game versions, side and loaderRange. when.feature and when.installedProjectIds express conditions.'),
      bi('跨加载器用 version.loaderBridges 声明 fromLoader、toLoader、viaProjectId，可加 viaVersionId/viaRange、gameVersions、side。解析时会把桥接项目加入必要依赖；这只是安装关系声明，不保证任意 Mod 实际兼容。', 'Declare version.loaderBridges with fromLoader, toLoader and viaProjectId, optionally viaVersionId/viaRange, gameVersions and side. Resolution adds the bridge as a required dependency; declarations do not guarantee runtime compatibility for arbitrary mods.'),
      bi('第二段 JSON 是 POST /api/v1/dependencies/resolve 的请求体；替换 versionId 后查询依赖树与安装清单。', 'The second JSON block is a POST /api/v1/dependencies/resolve body. Replace versionId to request a dependency tree and installation manifest.'),
    ], payload: pretty(dependencyExample), payloadLabel: 'version.dependencies[]', code: pretty(dependencyRequestExample) },
    { id: 'actions-example', title: bi('GitHub Actions 自动发布', 'Publish from GitHub Actions'), paragraphs: [
      bi('保存为 .github/workflows/lunapost.yml。在 GitHub 配置 Secret LUNAPOST_TOKEN（release:write），Variables LUNAPOST_URL、LUNAPOST_PROJECT、LUNAPOST_GAME_VERSION、LUNAPOST_LOADER。可选 LUNAPOST_PUBLISH_MODE=github / managed / hybrid，默认 github。', 'Save as .github/workflows/lunapost.yml. Configure secret LUNAPOST_TOKEN (release:write) and variables LUNAPOST_URL, LUNAPOST_PROJECT, LUNAPOST_GAME_VERSION and LUNAPOST_LOADER. Optional LUNAPOST_PUBLISH_MODE=github / managed / hybrid defaults to github.'),
      bi('示例要求 Release 已附加且仅有一个非 sources 的 JAR，否则主动报错，避免发错文件。多文件项目应按实际产物构造 files。managed/hybrid 使用表单上传，仍受 Worker 请求大小限制；大文件请改用上方分片或获授权的 COS 直传。', 'This example requires exactly one non-sources JAR already attached to the release, otherwise it fails to avoid publishing the wrong asset. Build files explicitly for multiple assets. managed/hybrid use form uploads and remain subject to Worker request limits; use multipart or authorized COS direct upload for large files.'),
      bi('再次运行同一版本会返回 VERSION_EXISTS；检查已发布结果后再决定是否 replace=true。示例会输出服务端响应以显示 published 或 pending_review。', 'Rerunning the same version returns VERSION_EXISTS. Inspect the published result before choosing replace=true. The response shows published or pending_review.'),
    ], code: actionsWorkflow },
    { id: 'errors', title: bi('错误、缓存与兼容范围', 'Errors, caching and compatibility'), paragraphs: [
      bi('业务接口通常返回 {error:{code,message,details?}}。400 表示参数或模型错误；401 未认证；403 角色、scope 或项目权限不足；404 资源不可见或上传会话失效；409 表示版本冲突、静态项目不可修改、选择不唯一或直传不可用。按 code 判断，不要匹配翻译后的 message。', 'Application errors usually return {error:{code,message,details?}}. 400 indicates invalid input; 401 unauthenticated; 403 insufficient role, scope or project rights; 404 invisible resource or expired session; 409 version conflict, static project, ambiguous selection or unavailable direct uploads. Branch on code, not translated message text.'),
      bi('413 可能来自站点限制，也可能是 Cloudflare 返回的 HTML；先检查 Content-Type。422 检查文件大小或上传是否完成；424 是 GitHub 缓存未命中且没有使用代理；502 DIRECT_UPLOAD_SIGNING_FAILED 检查 COS 配置；503 STORAGE_UNAVAILABLE 检查存储是否配置。', '413 may be a site limit or an HTML error from Cloudflare; inspect Content-Type first. 422 can indicate a size mismatch or incomplete upload; 424 a GitHub cache miss without proxy; 502 DIRECT_UPLOAD_SIGNING_FAILED requires checking COS settings; 503 STORAGE_UNAVAILABLE means storage is unavailable.'),
      bi('GitHub Actions 缓存默认关闭。共享缓存开关、TTL、代理开关及服务端 GitHub API Key 在站点设置中配置；用户本地偏好控制缓存优先/直连优先和本地缓存。刷新使用 refresh=1；只有实在无法直连时才请求 proxy=1，且站点必须允许代理。', 'GitHub Actions caching is off by default. Site settings control shared caching, TTL, proxy access and the server GitHub key. Local preferences choose cache-first/direct-first and local caching. Refresh uses refresh=1; use proxy=1 as fallback only when direct access fails and the site allows proxying.'),
      bi('Modrinth 兼容接口只提供目录列出的只读子集，两个前缀 /v2 与 /api/modrinth/v2 等价；没有完整 Modrinth 写入 API。Yggdrasil 使用独立的游戏认证协议和错误格式，不使用开发者 API Key 代替游戏 accessToken。', 'Modrinth compatibility provides only the listed read-only subset at equivalent prefixes /v2 and /api/modrinth/v2, not Modrinth write APIs. Yggdrasil has separate game credentials and error formats; developer API keys do not replace game accessTokens.'),
    ], code: pretty({ error: { code: 'VERSION_EXISTS', message: 'Version already exists' } }) },
  ]
}

export const actionsWorkflow = `name: Publish to LunaPost
on:
  release:
    types: [published]
permissions:
  contents: read
jobs:
  publish:
    runs-on: ubuntu-latest
    env:
      GH_TOKEN: \${{ github.token }}
      TOKEN: \${{ secrets.LUNAPOST_TOKEN }}
      BASE: \${{ vars.LUNAPOST_URL }}
      PROJECT: \${{ vars.LUNAPOST_PROJECT }}
      GAME_VERSION: \${{ vars.LUNAPOST_GAME_VERSION }}
      LOADER: \${{ vars.LUNAPOST_LOADER }}
      MODE: \${{ vars.LUNAPOST_PUBLISH_MODE || 'github' }}
      REPOSITORY: \${{ github.repository }}
    steps:
      - name: Publish release asset
        shell: bash
        run: |
          set -euo pipefail
          : "\${TOKEN:?}" "\${BASE:?}" "\${PROJECT:?}" "\${GAME_VERSION:?}" "\${LOADER:?}"
          BASE="\${BASE%/}"
          case "$MODE" in github|managed|hybrid) ;; *) exit 1 ;; esac
          TAG=$(jq -r '.release.tag_name' "$GITHUB_EVENT_PATH")
          ASSETS=$(jq '[.release.assets[] | select(.name | endswith(".jar")) | select(.name | endswith("-sources.jar") | not)]' "$GITHUB_EVENT_PATH")
          test "$(jq length <<< "$ASSETS")" -eq 1
          NAME=$(jq -r '.[0].name' <<< "$ASSETS")
          URL=$(jq -r '.[0].browser_download_url' <<< "$ASSETS")
          SIZE=$(jq '.[0].size' <<< "$ASSETS")
          jq -n --arg id "$PROJECT-$TAG-jar" --arg name "$NAME" --arg url "$URL" --argjson size "$SIZE" \\
            '{id:$id,name:$name,size:$size,primary:true,sources:[{id:"github",kind:"github_release",region:"GLOBAL",priority:200,url:$url}]}' > file.json
          if [ "$MODE" != github ]; then
            mkdir -p assets
            gh release download "$TAG" --repo "$REPOSITORY" --pattern "$NAME" --dir assets
            test -f "assets/$NAME"
            curl --fail-with-body "$BASE/api/v1/projects/$PROJECT/files" \\
              -H "Authorization: Bearer $TOKEN" -F "file=@assets/$NAME" > uploaded.json
            jq --slurpfile upload uploaded.json --arg mode "$MODE" \\
              '.sources = (if $mode == "managed" then [] else .sources end) + [($upload[0].source | .priority = 50)]' file.json > combined.json
            mv combined.json file.json
          fi
          jq --slurpfile file file.json --arg id "$PROJECT-$TAG" --arg game "$GAME_VERSION" --arg loader "$LOADER" \\
            '{version:{id:$id,version:.release.tag_name,type:(if .release.prerelease then "beta" else "release" end),gameVersions:[$game],loaders:[$loader],publishedAt:.release.published_at,changelog:(.release.body // ""),files:$file},replace:false}' "$GITHUB_EVENT_PATH" > release.json
          curl --fail-with-body "$BASE/api/v1/projects/$PROJECT/publish" \\
            -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
            --data-binary @release.json
`
