# IsosUI

IsosUI is the public source of the IsOS configuration graph editor. It is maintained independently of [IsOS](https://github.com/Island-Team/isos) and Island-web. IsOS owns the local API; Island-web hosts a pinned UI build. Both UIs connect to the IsOS process running at `127.0.0.1:16000`.

## Develop

Use Node.js 22 and npm 10 or newer:

```bash
npm ci
npm run dev
npm run build
```

The development server serves the local build on port 3000. A production local build uses same-origin `/api/isos/v2`; to exercise it, serve `dist/local` from the IsOS process. The hosted build uses `http://127.0.0.1:16000/api/isos/v2` and requires the local IsOS server to allow the exact hosted origin. Open the editor through `isos open` or enter its temporary token. Tokens stay in memory and URL fragments are removed after loading.

## Build contract

| Command | Output | Asset base | API base |
| --- | --- | --- | --- |
| `npm run build:local` | `dist/local/` | `/` | `/api/isos/v2` |
| `npm run build:hosted` | `dist/hosted/` | `/isosui/` | `http://127.0.0.1:16000/api/isos/v2` |

Each output has `index.html`, `assets/`, `IslandTeam.png`, and `manifest.json`. The manifest declares `schema_version: 1`, `version`, `source_commit`, `api_schema_version: 2`, and `build_target`. IsOS serves `dist/local/index.html` as the fallback for `/en/isos` and `/cn/isos`. Island-web places hosted assets under `/isosui/` and copies the hosted HTML to its `/en/isos` and `/cn/isos` static routes so URL fragments remain intact.

The manual release workflow accepts an existing `v<package version>` tag. It builds both targets and publishes `isosui-local-<tag>.tar.gz`, `isosui-hosted-<tag>.tar.gz`, and `SHA256SUMS`. A release is not required to develop or build from a pinned source commit.

Licensed under [Apache-2.0](LICENSE).
