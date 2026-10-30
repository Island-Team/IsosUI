# IsosUI repository guide

IsosUI is the public, Apache-2.0 source of the IsOS configuration editor. Maintain the editor here. Island-web hosts a pinned build; IsOS supervises the npm frontend and owns the loopback API. Do not copy site pages, authentication, package-center code, or server logic into this repo.

Follow the shared [Island conventions v1.2.0](../Island-eos/docs/island/conventions.v1.2.0.md), adapted to this frontend. Keep desktop controls near 30 px high and touch targets at least 44×44 px.

- Use npm, React 18, strict TypeScript, SCSS, and Webpack. Keep network calls in `src/services/`; components must not fetch directly.
- Preserve `/en/isos` and `/cn/isos` as editor URLs. Keep both languages in the editor copy. Use the existing theme token names and accessible controls.
- The supported server contracts are IsOS `/api/isos/v2` and EOS `/api/eos/v2`. Both local and hosted builds call the loopback APIs directly, defaulting to `http://127.0.0.1:16000` for IsOS and `http://127.0.0.1:16020` for EOS. The npm frontend defaults to `127.0.0.1:16001`. Use only validated HTTP loopback addresses and ports; do not add a URL token or Authorization header.
- `npm run build` must produce `dist/local` and `dist/hosted`, each with `index.html` and `manifest.json`. Hosted asset URLs start `/isosui/`; local URLs start `/`.
- `dist/` and `node_modules/` are generated and must not be committed. Releases are deliberate manual workflow runs from a version tag. The release workflow creates checksummed archives; do not publish from feature branches.
- Use Conventional Commits and small reviewable commits. Before pushing, run `npm test`, `npm run build`, and `git diff --check`.

The v2 workbench has Home, Graph, EOS, and EGIA pages. Graph edits the single IsOS/EOS/EGIA `2.0.0` graph with registered `v1.0` node types. IsOS owns package installation, graph authority, the process manager, and the npm frontend. EOS owns its MuJoCo direct child, hardware adapters, dispatcher, and control admission. EGIA common nodes remain design-only until their runtime exists. Use type-specific configuration forms and summaries; live camera frames and movement commands are data on typed ports, not node settings. Persist canvas layout separately from graph configuration. Preserve typed wire labels, shapes, and line styles alongside color. Home reads package readiness and process state from IsOS APIs; the EOS page exposes only controls declared by the active graph and reads live data from EOS. Update English and Chinese UI copy together, and test both local and hosted bundles.
