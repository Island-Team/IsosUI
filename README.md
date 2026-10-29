# IsosUI

IsosUI is the public source of the IsOS configuration graph editor. It is maintained independently of [IsOS](https://github.com/Island-Team/isos) and Island-web. IsOS owns the local API; Island-web hosts a pinned UI build. Both UIs connect to the IsOS process running at `127.0.0.1:16000`.

## Develop

Use Node.js 22 and npm 10 or newer:

```bash
npm ci
npm run dev
npm test
npm run build
```

The development server serves the local build on port 3000. A production local build uses same-origin `/api/isos/v2`; to exercise it, serve `dist/local` from the IsOS process. The hosted build uses `http://127.0.0.1:16000/api/isos/v2` and requires the local IsOS server to allow the exact hosted origin. Start IsOS and open the editor to connect through the local port without a token. Legacy token fragments are consumed on load and held only in memory.

## Workbench

The graph fills the editor viewport. The icon toolbar opens Node Library, Configuration, Connections, Diagnostics, EOS, EGIA, and Mini Map windows; each icon has an accessible label and tooltip. Collapse Tools hides optional toolbar groups. Drag a floating window by its title, resize its lower corner, or use its title controls to collapse, float, or dock left, right, or bottom. The layout is stored in this browser only; Reset Layout restores the initial arrangement and does not edit the deployment graph. On narrow screens, windows become drawers. Standard desktop controls are about 30 px high and touch targets are at least 44×44 px.

Select a node to open Configuration. Built-in EOS and EGIA nodes use the typed fields returned by IsOS `/api/isos/v2/profiles`; all graph nodes also expose package, launch, and advanced JSON settings. Validate reports errors by graph path, and Apply saves a revision after validation. Refresh asks before discarding local graph edits. Undo and Redo change only the local draft.

## Build contract

| Command | Output | Asset base | API base |
| --- | --- | --- | --- |
| `npm run build:local` | `dist/local/` | `/` | `/api/isos/v2` |
| `npm run build:hosted` | `dist/hosted/` | `/isosui/` | `http://127.0.0.1:16000/api/isos/v2` |

Each output has `index.html`, `assets/`, `IslandTeam.png`, and `manifest.json`. The manifest declares `schema_version: 1`, `version`, `source_commit`, `api_schema_version: 2`, and `build_target`. IsOS serves `dist/local/index.html` as the fallback for `/en/isos` and `/cn/isos`. Island-web places hosted assets under `/isosui/` and copies the hosted HTML to its `/en/isos` and `/cn/isos` static routes so URL fragments remain intact.

The manual release workflow accepts an existing `v<package version>` tag. It builds both targets and publishes `isosui-local-<tag>.tar.gz`, `isosui-hosted-<tag>.tar.gz`, and `SHA256SUMS`. A release is not required to develop or build from a pinned source commit. After publishing, it dispatches an `isosui-release` event to Island-web. Configure a fine-grained token for `Island-Team/Island-web` with Contents and Pull requests write access as `ISLAND_WEB_DISPATCH_TOKEN` in IsosUI and `ISOSUI_MIRROR_TOKEN` in Island-web. Island-web verifies the hosted archive, builds the pinned website, and opens a PR; squash merge that PR after checks pass to trigger the normal website deployment.

Licensed under [Apache-2.0](LICENSE).
