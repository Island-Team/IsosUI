# IsosUI

IsosUI is the public source of the IsOS configuration graph editor. It is maintained independently of [IsOS](https://github.com/Island-Team/isos) and Island-web. IsOS owns the local API; Island-web hosts a pinned UI build. Both UIs connect to the IsOS process running at `127.0.0.1:16000`.

## Develop

Use Node.js 22 and npm 10 or newer:

```bash
npm ci
npm run dev
npm start
npm test
npm run build
```

`npm run dev` starts the development frontend and `npm start` starts the production-mode frontend. Both bind to `127.0.0.1:16001` and call the IsOS API directly at `http://127.0.0.1:16000/api/isos/v2`. IsOS supervises `npm start` when launching the local workbench; Ctrl+C stops it with the IsOS service. To use different loopback ports, set `ISOSUI_PORT` and `ISOSUI_API_ORIGIN=http://127.0.0.1:<api-port>` before launching npm. The API origin is embedded when Webpack compiles the frontend, and only an HTTP loopback origin is accepted. IsOS must allow the frontend's exact origin in CORS. The editor uses no URL token or Authorization header.

## Workbench

The workbench has Home, Graph, EOS, and EGIA pages. Home shows available IsOS-managed backend packages, setup checks, saved and active revisions, process states, run/restart/stop actions, and bounded logs. EOS and EGIA are page shells for later runtime panels. Graph reads the one authored node graph from IsOS `/api/isos/v2/node-graph` and the registered type catalog from `/api/isos/v2/node-types`. A type fixes its core, layer, group, lifecycle, configuration fields, and typed ports. Adding a node creates an instance under that type's placement. The current type definitions use `@v1.0`; the graph format remains `2.0.0` and IsosUI keeps its independent app version.

Select an instance to edit its identity, label, description, capabilities, and typed settings. The backend package, version, scene, and device choices come from IsOS `/backends` when available. Hardware fields have an advanced JSON editor for adapter, frame, observation, and safety bounds. Search the type library, double-click the canvas to add a type, and drag an output port to a matching input port. Each input has one provider. Ctrl+Z/Ctrl+Y undo and redo graph edits; Delete removes the selected node. Validate shows server diagnostics by graph path; Apply validates and saves a revision. Home will not run or restart while the current editor has unapplied changes. Refresh asks before discarding local edits. Canvas positions are local browser preferences, not graph data. Standard desktop controls are about 30 px high; touch controls are at least 44×44 px.

The IsOS MuJoCo backend inspector has a **Show MuJoCo window** setting. It writes `MUJOCO_GUI=1` in that backend node's environment map. Apply the graph and start or restart the IsOS-managed backend to show the same simulation instance used by EOS. The simulator remains headless when the setting is off.

Node frame colors identify process, camera, base, manipulator, dispatcher, and EGIA families. Port and wire colors identify camera data, observations, movement, requests, outcomes, health, status, context, and plans. Labels and port shapes repeat these distinctions. The canvas shows brief configuration summaries and never renders live payloads as node settings.

The graph is configuration, not live camera or movement data. IsOS applies a saved revision to managed processes on restart. The editor does not invoke a second actuator route or write hardware payloads.

## Build contract

| Command | Output | Asset base | API base |
| --- | --- | --- | --- |
| `npm run build:local` | `dist/local/` | `/` | `http://127.0.0.1:16000/api/isos/v2` |
| `npm run build:hosted` | `dist/hosted/` | `/isosui/` | `http://127.0.0.1:16000/api/isos/v2` |

Each output has `index.html`, `assets/`, `IslandTeam.png`, and `manifest.json`. The manifest declares `schema_version: 1`, `version`, `source_commit`, `api_schema_version: 2`, and `build_target`. The npm server serves `/en/isos` and `/cn/isos` locally. Island-web places hosted assets under `/isosui/` and copies the hosted HTML to its `/en/isos` and `/cn/isos` static routes so URL fragments remain intact.

The manual release workflow accepts an existing `v<package version>` tag. It builds both targets and publishes `isosui-local-<tag>.tar.gz`, `isosui-hosted-<tag>.tar.gz`, and `SHA256SUMS`. A release is not required to develop or build from a pinned source commit. After publishing, it dispatches an `isosui-release` event to Island-web. Configure a fine-grained token for `Island-Team/Island-web` with Contents and Pull requests write access as `ISLAND_WEB_DISPATCH_TOKEN` in IsosUI and `ISOSUI_MIRROR_TOKEN` in Island-web. Island-web verifies the hosted archive, builds the pinned website, and opens a PR; squash merge that PR after checks pass to trigger the normal website deployment.

The standalone frontend was checked on Node.js 22 with `npm test`, `npm run build`, and `npm start`; `/en/isos` returned HTTP 200 at `127.0.0.1:16001`, and the local bundle contained the `127.0.0.1:16000` API address. Complete output is saved locally under `logs/test/20261030-npm-frontend/`.

Licensed under [Apache-2.0](LICENSE).
