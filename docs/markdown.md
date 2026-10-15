# 项目 Markdown

项目正文和更新日志使用 Marked 的 GitHub Flavored Markdown（GFM）解析器，渲染结果经过 DOMPurify 过滤后显示。

支持 CommonMark 基础语法和 GFM 表格（含列对齐）、任务列表、删除线、自动链接；另外支持 GitHub 风格标题锚点、脚注、NOTE/TIP/IMPORTANT/WARNING/CAUTION 提示块，以及常见语言的代码高亮。未知语言的代码块保留为纯文本。

README 可以使用安全 HTML，例如 `p align="center"`、`picture/source/img`、`details/summary`、`kbd`、上下标、图片宽高。脚本、事件处理器、危险 URL、内联 CSS、iframe 和可提交的表单不会执行。任务列表复选框仅用于展示。

配置 GitHub 仓库地址后，相对文档链接指向仓库的 `blob/HEAD`，相对图片和 `srcset` 指向 `raw.githubusercontent.com` 的 `HEAD`，因此不要求默认分支叫 main。带 `blob/<ref>/文件路径` 的地址会保留 ref 和 README 所在目录。普通绝对地址、站内绝对路径和文档内锚点保持原样。私有仓库的资源仍需要可公开访问的图片地址。

`picture` 中单独的 `(prefers-color-scheme: dark/light)` 条件跟随网站当前主题，支持用户手动切换主题。

GFM 是 Markdown 语法标准，不等于整个 GitHub 服务。GitHub 用户/Issue 自动关联、Mermaid 图表和数学公式渲染不属于本次渲染器支持范围。

## 检查

- `pnpm --filter @andrea/web test:markdown`：语法、相对地址、主题切图、安全过滤和 Luna README 回归测试。
- 启动 Web 开发服务器后，在 `apps/web` 下运行 `node tests/markdown.browser.mjs`：实际浏览器检查。默认地址为 `http://127.0.0.1:9012`，可通过 `WEB_URL` 覆盖；`CHROME_PATH` 可指定已有 Chromium。API 使用本地 catalog 测试数据，不修改真实项目。

浏览器检查截图保存到 `tmp/markdown-qa`。
