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

The development server serves the local build on port 3000. A production local build uses same-origin `/api/isos/v2`; IsOS serves `dist/local` through its own loopback server when `ISOSUI_REPO_PATH` or `ISOS_WEB_DIST` is set. The hosted build uses `http://127.0.0.1:16000/api/isos/v2` and requires the local IsOS server to allow the exact hosted origin. The editor connects by address and port without a URL token or Authorization header.

## Workbench

The workbench has Home, Graph, EOS, and EGIA pages. Home shows available IsOS-managed backend packages, setup checks, saved and active revisions, process states, run/restart/stop actions, and bounded logs. EOS and EGIA are page shells for later runtime panels. Graph reads the one authored node graph from IsOS `/api/isos/v2/node-graph` and the registered type catalog from `/api/isos/v2/node-types`. A type fixes its core, layer, group, lifecycle, configuration fields, and typed ports. Adding a node creates an instance under that type's placement. The current type definitions use `@v1.0`; the graph format remains `2.0.0` and IsosUI keeps its independent app version.

Select an instance to edit its identity, label, description, capabilities, and typed settings. The backend package, version, scene, and device choices come from IsOS `/backends` when available. Hardware fields have an advanced JSON editor for adapter, frame, observation, and safety bounds. Search the type library, double-click the canvas to add a type, and drag an output port to a matching input port. Each input has one provider. Ctrl+Z/Ctrl+Y undo and redo graph edits; Delete removes the selected node. Validate shows server diagnostics by graph path; Apply validates and saves a revision. Home will not run or restart while the current editor has unapplied changes. Refresh asks before discarding local edits. Canvas positions are local browser preferences, not graph data. Standard desktop controls are about 30 px high; touch controls are at least 44×44 px.

Node frame colors identify process, camera, base, manipulator, dispatcher, and EGIA families. Port and wire colors identify camera data, observations, movement, requests, outcomes, health, status, context, and plans. Labels and port shapes repeat these distinctions. The canvas shows brief configuration summaries and never renders live payloads as node settings.

The graph is configuration, not live camera or movement data. IsOS applies a saved revision to managed processes on restart. The editor does not invoke a second actuator route or write hardware payloads.

## Build contract

| Command | Output | Asset base | API base |
| --- | --- | --- | --- |
| `npm run build:local` | `dist/local/` | `/` | `/api/isos/v2` |
| `npm run build:hosted` | `dist/hosted/` | `/isosui/` | `http://127.0.0.1:16000/api/isos/v2` |

Each output has `index.html`, `assets/`, `IslandTeam.png`, and `manifest.json`. The manifest declares `schema_version: 1`, `version`, `source_commit`, `api_schema_version: 2`, and `build_target`. IsOS serves `dist/local/index.html` as the fallback for `/en/isos` and `/cn/isos`. Island-web places hosted assets under `/isosui/` and copies the hosted HTML to its `/en/isos` and `/cn/isos` static routes so URL fragments remain intact.

The manual release workflow accepts an existing `v<package version>` tag. It builds both targets and publishes `isosui-local-<tag>.tar.gz`, `isosui-hosted-<tag>.tar.gz`, and `SHA256SUMS`. A release is not required to develop or build from a pinned source commit. After publishing, it dispatches an `isosui-release` event to Island-web. Configure a fine-grained token for `Island-Team/Island-web` with Contents and Pull requests write access as `ISLAND_WEB_DISPATCH_TOKEN` in IsosUI and `ISOSUI_MIRROR_TOKEN` in Island-web. Island-web verifies the hosted archive, builds the pinned website, and opens a PR; squash merge that PR after checks pass to trigger the normal website deployment.

Licensed under [Apache-2.0](LICENSE).
