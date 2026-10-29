# IsosUI repository guide

IsosUI is the public, Apache-2.0 source of the IsOS configuration editor. Maintain the editor here. Island-web hosts a pinned build; IsOS serves a pinned local build and owns the loopback API. Do not copy site pages, authentication, package-center code, or server logic into this repo.

Follow the shared [Island conventions v1.2.0](../Island-eos/docs/island/conventions.v1.2.0.md), adapted to this frontend. Keep desktop controls near 30 px high and touch targets at least 44×44 px.

- Use npm, React 18, strict TypeScript, SCSS, and Webpack. Keep network calls in `src/services/`; components must not fetch directly.
- Preserve `/en/isos` and `/cn/isos` as editor URLs. Keep both languages in the editor copy. Use the existing theme token names and accessible controls.
- The supported server contract is IsOS `/api/isos/v2`. The local build uses same-origin requests. The hosted build uses `http://127.0.0.1:16000` only. Connect to the loopback port directly; keep any legacy bearer token in memory, consume URL fragments immediately, and never send it to another host.
- `npm run build` must produce `dist/local` and `dist/hosted`, each with `index.html` and `manifest.json`. Hosted asset URLs start `/isosui/`; local URLs start `/`.
- `dist/` and `node_modules/` are generated and must not be committed. Releases are deliberate manual workflow runs from a version tag. The release workflow creates checksummed archives; do not publish from feature branches.
- Use Conventional Commits and small reviewable commits. Before pushing, run `npm test`, `npm run build`, and `git diff --check`.
