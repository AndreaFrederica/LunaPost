# GitHub Actions 自动发布 API

本文定义 GitHub Actions 将 Mod、Modpack、资源包或插件发布到 LunaPost 的接口。目标是让仓库只需要保存一个项目级发布令牌，Action 在构建完成后可以安全、可重复地上传产物并创建版本。

## 发布流程

Action 使用项目令牌执行以下步骤：

1. `POST /api/v1/publish/uploads` 创建上传会话并声明文件名、大小和 SHA-256。
2. 按返回的 `uploadUrl` 上传二进制文件。小文件可直接 `PUT`，大文件使用分片上传。
3. `POST /api/v1/projects/{slug}/publish` 提交版本元数据和上传文件引用。
4. API 校验项目权限、文件哈希、版本唯一性、依赖关系和站点审核策略，返回 `published`、`pending_review` 或 `rejected`。

发布接口必须使用 `Idempotency-Key`。同一个项目、版本和幂等键重复请求只能产生一个版本，Action 重试不会产生重复文件或重复发布。

## 认证和权限

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
      "uploadId": "upl_01...",
      "filename": "example-mod-1.4.0.jar",
      "primary": true,
      "fileType": "mod",
      "loaders": ["fabric", "neoforge"]
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

文件 ID 由服务端根据项目、版本和内容哈希生成；GitHub Action 不应自行生成平台文件 ID。相同 SHA-256 的文件可以被重新提交，服务端返回已有文件引用，避免 R2 重复存储。

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

1. 增加 API Key Bearer 校验、项目绑定和作用域检查；现有账户 API Key 兼容迁移，但发布令牌默认只能绑定一个项目。
2. 增加 `publish_uploads`、`publish_releases`、`publish_tokens` 表和 R2 multipart 生命周期清理。
3. 实现小文件上传和幂等发布；接入现有 `projectSchema`、`versionSchema`、`validateDependencies` 和审核策略。
4. 实现大文件分片上传、GitHub provenance 和发布查询。
5. 增加 OpenAPI 文档、Action 示例和端到端测试。

