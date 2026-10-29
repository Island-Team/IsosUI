# IsosUI

IsosUI 是公开的 IsOS 配置图编辑器源码，采用 Apache-2.0 许可证。编辑器在本仓库维护；IsOS 提供本地 API，Island-web 托管固定版本的前端构建产物。

## 开发与构建

使用 Node.js 22 和 npm 10 或更新版本：

```bash
npm ci
npm run dev
npm test
npm run build
```

`npm run build:local` 输出 `dist/local/`，使用同源 `/api/isos/v2`。`npm run build:hosted` 输出 `dist/hosted/`，资源路径以 `/isosui/` 开头，直接访问本机 `http://127.0.0.1:16000/api/isos/v2`。本机 IsOS 服务必须允许准确的托管来源。启动 IsOS 并打开编辑器后即可直接连接本机端口，无需令牌。旧版令牌片段在加载后会移除，令牌只保存在内存中。

## 工作台

配置图画布占满编辑器视口。图标工具栏可打开节点库、配置、连接、诊断、EOS、EGIA 和缩略图窗口；图标均有辅助标签和提示。“收起工具栏”可隐藏可选工具组。拖动窗口标题可移动，拖动右下角可调整大小，标题栏按钮可收起、浮动或停靠在左侧、右侧、底部。窗口布局只保存在当前浏览器中；“重置布局”恢复初始布局，不会修改部署图。窄屏幕上窗口显示为抽屉。桌面标准控件约 30 像素高，触屏目标至少 44×44 像素。

选择节点会打开配置窗口。EOS 和 EGIA 内置节点使用 IsOS `/api/isos/v2/profiles` 返回的类型化字段；所有图节点也可编辑软件包、启动参数和高级 JSON 设置。验证会按图路径显示错误；应用在验证后保存修订版本。刷新前会提示放弃本地修改。撤销和重做只影响本地草稿。

两个构建目录都包含 `index.html`、`assets/`、`IslandTeam.png` 和 `manifest.json`。清单包含 UI 版本、源码提交、构建目标和 IsOS API v2 版本。IsOS 在 `/en/isos` 与 `/cn/isos` 提供本地页面；Island-web 在对应路径提供托管 HTML，并把资源放在 `/isosui/`。

手动发布工作流从现有的 `v<package version>` 标签构建两个压缩包与 `SHA256SUMS`。普通开发和固定提交构建不需要发布版本。
