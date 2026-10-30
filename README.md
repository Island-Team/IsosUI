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

`npm run dev` starts the development frontend and `npm start` starts the production-mode frontend. Both bind to `127.0.0.1:16001` and call IsOS at `http://127.0.0.1:16000/api/isos/v2` and EOS at `http://127.0.0.1:16020/api/eos/v2`. IsOS supervises `npm start` when launching the local workbench; Ctrl+C stops it with the IsOS service. To use different loopback ports, set `ISOSUI_PORT`, `ISOSUI_API_ORIGIN=http://127.0.0.1:<api-port>`, and `ISOSUI_EOS_API_ORIGIN=http://127.0.0.1:<eos-port>` before launching npm. API origins are embedded when Webpack compiles the frontend; only HTTP loopback origins are accepted. IsOS and EOS allow the frontend's exact origin in CORS. The editor uses no URL token or Authorization header.

## Workbench

The workbench has Home, Graph, EOS, and EGIA pages. Home shows available IsOS-managed backend packages, setup checks, saved and active revisions, process states, run/restart/stop actions, and bounded logs. EOS presents controls only for manual, primitive, and skill nodes declared in the active graph; EGIA remains a page shell. Graph reads the one authored node graph from IsOS `/api/isos/v2/node-graph` and the registered type catalog from `/api/isos/v2/node-types`. A type fixes its core, layer, group, lifecycle, configuration fields, and typed ports. Adding a node creates an instance under that type's placement. The current type definitions use `@v1.0`; the graph format remains `2.0.0` and IsosUI keeps its independent app version.

Select an instance to edit its identity, label, description, capabilities, and typed settings. The backend package, version, scene, and device choices come from IsOS `/backends` when available. Hardware fields have an advanced JSON editor for adapter, frame, observation, and safety bounds. Manual and primitive nodes have a target hardware picker; a primitive also selects one supported movement mode. Skill nodes have an ordered primitive picker. These controls keep the dispatcher reference and typed observation/status inputs synchronized with the selected hardware and steps. Search the type library, double-click the canvas to add a type, and drag an output port to a matching input port. Each input has one provider. Left-drag a blank canvas area to select multiple nodes, middle-drag to pan, and right-click to open quick add or disconnect a wire. Ctrl+Z/Ctrl+Y undo and redo graph edits; Delete removes all selected nodes. Validate shows server diagnostics by graph path; Apply validates and saves a revision. Home will not run or restart while the current editor has unapplied changes. Refresh asks before discarding local edits. Canvas positions are saved per robot graph in local browser storage and remain separate from graph data. Standard desktop controls are about 30 px high; touch controls are at least 44×44 px.

The EOS MuJoCo backend inspector has a **Show MuJoCo window** setting. It writes `MUJOCO_GUI=1` in that backend node's environment map. Apply the graph and start or restart EOS to show the simulation instance EOS supervises. The simulator remains headless when the setting is off.

Node frame colors identify process, camera, base, manipulator, dispatcher, manual, primitive, skill, and EGIA families. Port and wire colors identify camera data, observations, movement, requests, outcomes, health, status, context, and plans. Labels and port shapes repeat these distinctions. The canvas shows brief configuration summaries and never renders live payloads as node settings.

The graph is configuration, not live camera or movement data. IsOS applies a saved revision to managed processes on restart. EOS forms use the saved revision only when it matches the active revision. Manual and primitive calls supply typed movement data for the graph-declared target; skill calls supply typed step data for the graph-declared primitive sequence. EOS validates the node identity, mode, limits, and dispatcher route. Manual Stop and skill Cancel resolve through those graph nodes. The monitor shows only declared hardware discovered by EOS, polls adapter status, health, and observations every 2 seconds, and captures one selected RGB8 camera at no more than 1 Hz or the camera profile's declared maximum rate, whichever is lower. The adapter status drives Live, Stopped, Starting, Fault, and Stale badges; health remains a separate reading. A failed poll retains the last observation with an error and its update time. Camera cards omit observation fields. Frames are decoded into a canvas with 2048×1536, 2 million pixel, 8 MB decoded payload, and camera profile payload caps; stale telemetry is marked after 5 seconds. No polling runs when the tab is hidden or the graph is inactive.

## Build contract

| Command | Output | Asset base | API base |
| --- | --- | --- | --- |
| `npm run build:local` | `dist/local/` | `/` | IsOS `http://127.0.0.1:16000/api/isos/v2`, EOS `http://127.0.0.1:16020/api/eos/v2` |
| `npm run build:hosted` | `dist/hosted/` | `/isosui/` | IsOS `http://127.0.0.1:16000/api/isos/v2`, EOS `http://127.0.0.1:16020/api/eos/v2` |

Each output has `index.html`, `assets/`, `IslandTeam.png`, and `manifest.json`. The manifest declares `schema_version: 1`, `version`, `source_commit`, `api_schema_version: 2`, and `build_target`. The npm server serves `/en/isos` and `/cn/isos` locally. Island-web places hosted assets under `/isosui/` and copies the hosted HTML to its `/en/isos` and `/cn/isos` static routes so URL fragments remain intact.

The manual release workflow accepts an existing `v<package version>` tag. It builds both targets and publishes `isosui-local-<tag>.tar.gz`, `isosui-hosted-<tag>.tar.gz`, and `SHA256SUMS`. A release is not required to develop or build from a pinned source commit. After publishing, it dispatches an `isosui-release` event to Island-web. Configure a fine-grained token for `Island-Team/Island-web` with Contents and Pull requests write access as `ISLAND_WEB_DISPATCH_TOKEN` in IsosUI and `ISOSUI_MIRROR_TOKEN` in Island-web. Island-web verifies the hosted archive, builds the pinned website, and opens a PR; squash merge that PR after checks pass to trigger the normal website deployment.

The standalone frontend was checked on Node.js 22 with `npm test`, `npm run build`, and `npm start`; `/en/isos` returned HTTP 200 at `127.0.0.1:16001`, and the local bundle contained the `127.0.0.1:16000` API address. Complete output is saved locally under `logs/test/20261030-npm-frontend/`.

Licensed under [Apache-2.0](LICENSE).

Graph selection and layout checks: `npm test`, `npm run build`, and `npm start` (`ISOSUI_PORT=16041`); the dev server returned HTTP 200 and warning overlays are disabled while compile error overlays remain enabled. Logs: `logs/test/20261030-graph-selection/`.

The Graph module loads as a separate JavaScript chunk, and webpack emits a small independent runtime chunk. The self-hosted Chinese font files remain optional browser requests; webpack's JavaScript size warning excludes those font assets but still checks JavaScript chunks and the startup entrypoint. The build log under `logs/test/20261030-webpack-size/` records the measured output.

The EOS control workbench was checked on Node.js 22 with `npm test` (25 tests), `npm run build` (typecheck plus both bundles), `git diff --check`, and `ISOSUI_PORT=16041 npm start` followed by `curl -fsSI http://127.0.0.1:16041/en/isos` (HTTP 200). The build emitted no warnings. Full output is under `logs/test/20261030-eos-control/`. Runtime control calls require an applied, active graph and a running EOS bridge; the mock and simulator command tests live with EOS.

The adapter status monitor update was checked with `npm test` (26 tests), `npm run build` (typecheck plus local and hosted bundles), and `git diff --check`. Both bundles compiled without warnings; output is under `logs/test/20261030-eos-monitor-status/`. The EOS bridge supplies `status` with `state` and `active_command_id`; a stopped actuator can remain healthy and continue to expose its last observation.
