# Implementation TODO for the 0.x UI target

This queue tracks [IsosUI 0.1.0 implementation](https://github.com/Island-Team/IsosUI/milestone/1) and the shared [M4 agent and workbench gate](https://github.com/Island-Team/Island-eos/milestone/4). Complete the numbered steps in dependency order; each first-use step must show status before the current run's causal logs.

[中文](../../docs_cn/isosui/todo_cn.md) · [Design](design.md)

1. Update the API adapter for version-aware graph reads and the IsOS node/type/option contracts. Preserve unknown compatible fields and legacy source references. Keep wire and catalog versions independent of the UI release version.
2. Generate instance forms from catalog field metadata. Add the searchable package option selector, stale-response handling, unavailable-value display and Apply blocking. Cover scenes and devices first; model-weight assets are an extension point, not EGIA tensor execution in this release.
3. Add per-edge priority/frequency editing and rendering. Test legacy defaults, invalid nice/rate values, preservation of unrelated edges, keyboard labels and design-only routes. Use configured edge cap, not port hint, as the wire's primary frequency.
4. Add the floating node info card on hover, focus and touch. Separate type and instance descriptions; include ports, units and owner-reported health. Test viewport clamping, stacking, keyboard access and drag/wire interaction.
5. Split the combined core window into independently dockable control, monitor, Vision and log panels. After R07's minimal typed binding sender/consumer, add one full primitive control per active binding, display the single active-graph target (change it through graph edit and Apply), and use `primitive_typed` through the existing EOS browser bridge. Display browser-local sending and exact correlated `Completed`/`Failed`/`Cancelled`/`Rejected`/`InProgress`/`OutcomeUnknown` results; follow `InProgress` only through the authorized result read. Do not imply that a graph edge executed. Persist and clamp layout; test focus, keyboard actions, narrow viewports, subscriptions, stale revision, command failure and visible Stop.
6. Upgrade logs and Home first-use flow to the shared JSONL event/cursor contract. Test rotation, current-run boundaries, source filtering and browser provenance; keep primitive command results and causal run logs distinguishable.
7. Verify English/Chinese copy and work/visual page styling in both themes and both local/hosted builds. Run `npm test`, `npm run build` and accessibility checks; store complete output in `logs/test/<run-id>/` and record reproducible commands and results before release.

Acceptance requires an IsOS → EOS → MuJoCo → EGIA run with a verified package, saved/active revision agreement, live monitor and control, failure and safe stop. Physical ROS/vendor devices and EGIA tensor nodes remain later work.
