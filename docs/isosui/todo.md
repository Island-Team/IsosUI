# Implementation TODO for the 0.x UI target

[中文](../../docs_cn/isosui/todo_cn.md) · [Design](design.md)

1. Update the API adapter for version-aware graph reads and the IsOS node/type/option contracts. Preserve unknown compatible fields and legacy source references. Keep wire and catalog versions independent of the UI release version.
2. Generate instance forms from catalog field metadata. Add the searchable package option selector, stale-response handling, unavailable-value display and Apply blocking. Cover scenes and devices first; model-weight assets are an extension point, not EGIA tensor execution in this release.
3. Add per-edge priority/frequency editing and rendering. Test legacy defaults, invalid nice/rate values, preservation of unrelated edges, keyboard labels and design-only routes. Use configured edge cap, not port hint, as the wire's primary frequency.
4. Split the combined core window into independently dockable control, monitor, Vision and log panels. Persist and clamp layout; test focus, keyboard actions, narrow viewports, subscriptions, stale revision and visible Stop.
5. Upgrade logs and Home first-use flow to the shared JSONL event/cursor contract. Test rotation, current-run boundaries, source filtering and browser provenance.
6. Verify English/Chinese copy and work/visual page styling in both themes and both local/hosted builds. Run `npm test`, `npm run build` and accessibility checks; store complete output in `logs/test/<run-id>/` and record reproducible commands and results before release.

Acceptance requires an IsOS → EOS → MuJoCo → EGIA run with a verified package, saved/active revision agreement, live monitor and control, failure and safe stop. Physical ROS/vendor devices and EGIA tensor nodes remain later work.
