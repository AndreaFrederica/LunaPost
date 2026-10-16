# GitHub Actions 自动发布 API

本文定义 GitHub Actions 将 Mod、Modpack、资源包或插件发布到 LunaPost 的接口。目标是让仓库只需要保存一个项目级发布令牌，Action 在构建完成后可以安全、可重复地上传产物并创建版本。

## 发布流程

Action 使用项目令牌执行以下步骤。发布可以选择三种文件模式：

- `managed`：文件上传到 LunaPost 的 R2，由平台托管并提供稳定下载地址。
- `github_release`：不上传文件，只登记 GitHub Release 资产链接；平台保存元数据并通过稳定下载地址 302 到 GitHub。
- `hybrid`：同时上传到 R2 并登记 GitHub Release，默认优先 GitHub，R2 作为备用源。

三种模式可以在同一个版本中混用，例如主 JAR 使用 `hybrid`，调试包使用 `github_release`，站点图标使用 `managed`。

### `managed` 模式

1. `POST /api/v1/publish/uploads` 创建上传会话并声明文件名、大小和 SHA-256。
2. 按返回的 `uploadUrl` 上传二进制文件。小文件可直接 `PUT`，大文件使用分片上传。
3. `POST /api/v1/projects/{slug}/publish` 提交版本元数据和上传文件引用。

### `github_release` 模式

直接调用发布接口，不创建上传会话。每个文件提供 GitHub 仓库、tag 和 asset 名称，服务端解析并校验 Release 资产：

```json
{
  "mode": "github_release",
  "repository": "Andrea/example-mod",
  "tag": "v1.4.0",
  "asset": "example-mod-1.4.0.jar",
  "size": 183420,
  "sha256": "<64 lowercase hex>",
  "primary": true,
  "fileType": "mod"
}
```

服务端只接受 GitHub Release 资产，不接受任意外部 URL，避免把发布 API 变成开放代理。服务端使用 GitHub API 确认仓库、tag、asset 和下载地址；公开仓库不需要额外密钥，私有仓库需要项目绑定的 GitHub App 或只读令牌。哈希可以由 Action 提供，也可以由服务端下载资产头部/内容后计算；无法验证哈希时发布进入 `pending_review`。

### `hybrid` 模式

同时提供上传会话和 GitHub Release 资产：

```json
{
  "mode": "hybrid",
  "uploadId": "upl_01...",
  "github": {
    "repository": "Andrea/example-mod",
    "tag": "v1.4.0",
    "asset": "example-mod-1.4.0.jar",
    "sha256": "<64 lowercase hex>"
  },
  "filename": "example-mod-1.4.0.jar",
  "sha256": "<64 lowercase hex>",
  "primary": true,
  "fileType": "mod"
}
```

`uploadId` 和 GitHub 资产必须具有相同文件名、大小和 SHA-256。服务端分别校验两份内容，校验失败时不会把不一致的源加入同一个文件。发布后只有一个稳定 `fileId`，但包含两个下载源：GitHub 默认优先，R2 作为失败回退。

现有区域和优先级策略继续生效。客户端也可以使用 `source=github-release` 或 `source=managed-r2` 强制选择源；正常客户端不需要知道源 URL。

API 校验项目权限、文件哈希、版本唯一性、依赖关系和站点审核策略，返回 `published`、`pending_review` 或 `rejected`。

发布接口必须使用 `Idempotency-Key`。同一个项目、版本和幂等键重复请求只能产生一个版本，Action 重试不会产生重复文件或重复发布。

## 认证和权限

除了项目级发布令牌，还支持账户级开发者 API Key。开发者 API Key 可以用于创建和管理项目，但权限同时受账户角色和 scope 限制：只有 `developer`、`admin`、`root` 账户可以执行写操作，普通用户即使拿到写 scope 也只能读取允许的数据。

建议的账户级 scope：

| 作用域 | 能力 |
| --- | --- |
| `project:create` | 创建项目，并将当前账户设为所有者 |
| `project:read` | 读取当前账户可见的项目、成员和发布状态 |
| `project:write` | 修改项目元数据、版本配置、依赖和成员 |
| `release:write` | 上传文件和创建发布 |
| `release:publish` | 请求公开发布；仍受站点审核策略约束 |
| `release:delete` | 撤回草稿或待审核发布 |

推荐的 GitHub Actions 配置方式是使用项目级发布令牌；需要由 Action 自动创建项目或管理多个项目时，才使用账户级开发者 API Key。账户级 Key 不允许通过请求参数切换账户，也不能修改不属于当前账户或组织成员范围内的项目。

请求使用：

```http
Authorization: Bearer lp_live_xxxxxxxxx
```

令牌只在创建时返回一次，数据库只保存哈希。令牌应绑定项目，而不是绑定整个账户；撤销账户 API Key 不应影响其他项目的发布。

建议作用域：

| 作用域 | 用途 |
| --- | --- |
| `project:read` | 读取项目和发布状态 |
| `release:write` | 创建上传会话、上传文件、创建版本 |
| `release:delete` | 撤回尚未公开的发布 |
| `release:publish` | 绕过草稿状态并请求公开审核 |

项目令牌只能访问绑定项目。即使账户是管理员，令牌也不能通过 URL 修改其他项目。所有发布接口记录令牌 ID、项目、GitHub repository、commit SHA 和 GitHub Actions run ID。

所有机器凭据统一通过 `Authorization: Bearer ...` 传递。服务端先解析 Key，再检查 `account.role` 和 scope，最后调用现有的 `canManageProject` / `canAdminProject` 规则。缺少凭据返回 `401`，角色不足返回 `403 ACCOUNT_ROLE_REQUIRED`，scope 不足返回 `403 SCOPE_REQUIRED`。

账户级 Key 的典型调用：

```http
POST /api/v1/admin/projects
Authorization: Bearer lp_live_developer_xxxxxxxxx
Content-Type: application/json
```

```http
PUT /api/v1/admin/projects/example-mod
Authorization: Bearer lp_live_developer_xxxxxxxxx
```

这两个接口分别需要 `project:create` 和 `project:write`；发布接口还需要 `release:write`。项目成员的 owner/admin/editor 权限仍然生效，API Key 不会绕过项目成员权限。

## 创建上传会话

```http
POST /api/v1/publish/uploads
Authorization: Bearer lp_live_xxxxxxxxx
Content-Type: application/json
Idempotency-Key: build-${{ github.run_id }}-${{ hashFiles('build/libs/*.jar') }}
```

```json
{
  "filename": "example-mod-1.4.0.jar",
  "size": 183420,
  "sha256": "<64 lowercase hex>",
  "contentType": "application/java-archive"
}
```

响应：

```json
{
  "uploadId": "upl_01...",
  "uploadUrl": "https://lunapost.sirrus.cc/api/v1/publish/uploads/upl_01...",
  "method": "PUT",
  "expiresAt": "2026-10-16T05:00:00Z",
  "partSize": null
}
```

文件大小、扩展名和 Content-Type 仍由站点审核策略限制。上传完成后服务器重新计算 SHA-256；客户端声明的哈希不匹配时返回 `422 HASH_MISMATCH`，且上传对象不可被发布。

大于 100 MiB 时返回分片会话：

```json
{
  "uploadId": "upl_01...",
  "partSize": 8388608,
  "parts": 24,
  "completeUrl": "https://lunapost.sirrus.cc/api/v1/publish/uploads/upl_01.../complete"
}
```

分片使用 R2 multipart upload。Action 完成所有分片后提交每个分片的 ETag 到 `completeUrl`。

## 发布版本

```http
POST /api/v1/projects/example-mod/publish
Authorization: Bearer lp_live_xxxxxxxxx
Idempotency-Key: release-example-mod-1.4.0
Content-Type: application/json
```

```json
{
  "version": "1.4.0",
  "type": "release",
  "loaders": ["fabric", "neoforge"],
  "gameVersions": ["1.21.1"],
  "status": "listed",
  "featured": false,
  "publishedAt": "2026-10-16T04:00:00Z",
  "description": "Example Mod 1.4.0",
  "changelog": "修复启动崩溃并更新依赖。",
  "dependencies": [
    {
      "projectId": "fabric-api",
      "dependencyType": "required",
      "versionConstraint": { "scheme": "semver", "range": ">=0.100.0" },
      "appliesTo": { "loaders": ["fabric"], "gameVersions": ["1.21.1"] }
    }
  ],
  "files": [
    {
      "mode": "managed",
      "uploadId": "upl_01...",
      "filename": "example-mod-1.4.0.jar",
      "primary": true,
      "fileType": "mod",
      "loaders": ["fabric", "neoforge"]
    },
    {
      "mode": "hybrid",
      "uploadId": "upl_01...",
      "filename": "example-mod-1.4.0.jar",
      "sha256": "<64 lowercase hex>",
      "github": {
        "repository": "Andrea/example-mod",
        "tag": "v1.4.0",
        "asset": "example-mod-1.4.0.jar"
      },
      "primary": true,
      "fileType": "mod",
      "loaders": ["fabric", "neoforge"]
    },
    {
      "mode": "github_release",
      "repository": "Andrea/example-mod",
      "tag": "v1.4.0",
      "asset": "example-mod-1.4.0-sources.jar",
      "sha256": "<64 lowercase hex>",
      "primary": false,
      "fileType": "source-jar"
    }
  ],
  "source": {
    "provider": "github",
    "repository": "Andrea/example-mod",
    "ref": "refs/tags/v1.4.0",
    "commitSha": "<40 hex>",
    "workflow": "release.yml",
    "runId": "123456789"
  }
}
```

文件 ID 由服务端根据项目、版本、模式和内容哈希生成；GitHub Action 不应自行生成平台文件 ID。`managed` 文件使用平台稳定存储 URL，`github_release` 文件使用平台稳定 URL 但源为 GitHub Release，`hybrid` 文件使用同一个稳定 URL 并在两个源之间自动分流。相同 SHA-256 的托管文件可以被重新提交，服务端返回已有文件引用，避免 R2 重复存储。

三种模式都支持后续补充镜像。将 GitHub Release 文件迁移到 R2 时创建新的 source，不改变 file ID 和稳定下载 URL；如果文件内容哈希改变，必须创建新文件和新版本。对于 `hybrid`，GitHub 是默认主源，R2 只承担失败回退和明确选择 R2 的流量。

成功响应：

```json
{
  "releaseId": "rel_01...",
  "project": "example-mod",
  "versionId": "example-mod-1.4.0",
  "status": "pending_review",
  "files": [{ "id": "example-mod-1.4.0-jar", "name": "example-mod-1.4.0.jar", "sha256": "..." }],
  "url": "https://lunapost.sirrus.cc/projects/example-mod/versions/example-mod-1.4.0"
}
```

如果站点审核策略为自动通过，状态为 `published`；如果需要人工审核，文件和版本保持 `pending_review`，不会出现在公开目录，但项目所有者可以在后台查看。

## 查询和撤回

```http
GET /api/v1/projects/example-mod/releases/1.4.0
GET /api/v1/projects/example-mod/releases?limit=20
DELETE /api/v1/projects/example-mod/releases/rel_01...
```

删除只允许撤回 `draft` 或 `pending_review`。已经公开的版本使用 `POST .../archive` 归档，不删除稳定下载地址和历史下载统计。

## GitHub Actions 示例

令牌应保存为 GitHub 仓库或环境 Secret：`LUNAPOST_TOKEN`。令牌不写入日志，也不作为命令参数传递。

```yaml
- name: Build
  run: ./gradlew build

- name: Publish to LunaPost
  env:
    LUNAPOST_TOKEN: ${{ secrets.LUNAPOST_TOKEN }}
    LUNAPOST_URL: https://lunapost.sirrus.cc
  shell: bash
  run: |
    set -euo pipefail
    file="build/libs/example-mod-${GITHUB_REF_NAME#v}.jar"
    size=$(stat -c '%s' "$file")
    sha256=$(sha256sum "$file" | cut -d' ' -f1)
    key="${GITHUB_REPOSITORY}-${GITHUB_SHA}-${sha256}"

    upload=$(curl --fail-with-body -sS "$LUNAPOST_URL/api/v1/publish/uploads" \
      -H "Authorization: Bearer $LUNAPOST_TOKEN" \
      -H 'Content-Type: application/json' \
      -H "Idempotency-Key: $key" \
      --data "{\"filename\":\"$(basename "$file")\",\"size\":$size,\"sha256\":\"$sha256\",\"contentType\":\"application/java-archive\"}")
    upload_id=$(jq -r .uploadId <<<"$upload")
    upload_url=$(jq -r .uploadUrl <<<"$upload")
    curl --fail-with-body -sS -X PUT "$upload_url" --upload-file "$file"

    curl --fail-with-body -sS "$LUNAPOST_URL/api/v1/projects/example-mod/publish" \
      -H "Authorization: Bearer $LUNAPOST_TOKEN" \
      -H 'Content-Type: application/json' \
      -H "Idempotency-Key: $key-release" \
      --data "$(jq -n \
        --arg version "${GITHUB_REF_NAME#v}" \
        --arg uploadId "$upload_id" \
        --arg filename "$(basename "$file")" \
        --arg sha256 "$sha256" \
        --arg repo "$GITHUB_REPOSITORY" \
        --arg sha "$GITHUB_SHA" \
        --arg workflow "$GITHUB_WORKFLOW" \
        --arg runId "$GITHUB_RUN_ID" \
        '{version:$version,type:"release",loaders:["fabric"],gameVersions:["1.21.1"],status:"listed",files:[{uploadId:$uploadId,filename:$filename,sha256:$sha256,primary:true,fileType:"mod"}],source:{provider:"github",repository:$repo,commitSha:$sha,workflow:$workflow,runId:$runId}}')"
```

## 错误和重试

统一返回 `{ "error": { "code", "message", "details" } }`。Action 可以重试 `408`、`429` 和 `5xx`；`400`、`401`、`403`、`409`、`422` 应先修正输入或令牌权限。

关键错误码：`INVALID_TOKEN`、`PROJECT_SCOPE_REQUIRED`、`UPLOAD_EXPIRED`、`HASH_MISMATCH`、`VERSION_EXISTS`、`INVALID_DEPENDENCIES`、`FILE_TYPE_BLOCKED`、`REVIEW_REQUIRED`。

## 实现顺序

1. 增加 API Key Bearer 校验、账户级 scope、项目绑定和作用域检查；现有账户 API Key 兼容迁移，但发布令牌默认只能绑定一个项目。
2. 增加 `publish_uploads`、`publish_releases`、`publish_tokens` 表和 R2 multipart 生命周期清理。
3. 实现小文件 `managed` 上传和幂等发布；接入现有 `projectSchema`、`versionSchema`、`validateDependencies` 和审核策略。
4. 实现 `github_release` 资产解析、白名单校验、`hybrid` 双源校验和 GitHub provenance。
5. 实现大文件分片上传和发布查询。
6. 增加 OpenAPI 文档、Action 示例和端到端测试。

