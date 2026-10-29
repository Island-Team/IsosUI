# IsosUI

IsosUI 是公开的 IsOS 配置图编辑器源码，采用 Apache-2.0 许可证。编辑器在本仓库维护；IsOS 提供本地 API，Island-web 托管固定版本的前端构建产物。

## 开发与构建

使用 Node.js 22 和 npm 10 或更新版本：

```bash
npm ci
npm run dev
npm run build
```

`npm run build:local` 输出 `dist/local/`，使用同源 `/api/isos/v2`。`npm run build:hosted` 输出 `dist/hosted/`，资源路径以 `/isosui/` 开头，直接访问本机 `http://127.0.0.1:16000/api/isos/v2`。本机 IsOS 服务必须允许准确的托管来源。通过 `isos open` 打开编辑器，或输入临时令牌；令牌只保存在内存中，页面加载后会移除 URL 片段。

两个构建目录都包含 `index.html`、`assets/`、`IslandTeam.png` 和 `manifest.json`。清单包含 UI 版本、源码提交、构建目标和 IsOS API v2 版本。IsOS 在 `/en/isos` 与 `/cn/isos` 提供本地页面；Island-web 在对应路径提供托管 HTML，并把资源放在 `/isosui/`。

手动发布工作流从现有的 `v<package version>` 标签构建两个压缩包与 `SHA256SUMS`。普通开发和固定提交构建不需要发布版本。
