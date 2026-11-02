# U04 implementation design and evidence

[中文](../../docs_cn/isosui/design-primitive-control_cn.md) · [Owner interface](interfaces/primitive-control.md)

The R07 result client remains the only browser command path. U04 generalizes its one mock base card to a card per exact active `@v0.1` base/manipulator binding. The pure binding resolver verifies one target and its declared mode before rendering. The component rechecks IsOS graph/run identity around EOS time and submission and uses the existing correlated result state machine. `Failed` is an owner terminal result, while browser transport loss is unavailable. Stop still calls IsOS independently. No legacy graph-authored skill sequence is exposed.

Graph nodes render their information card in a portal, keeping the card above overlapping React Flow nodes. Hover/focus/touch info opens it; Escape and close dismiss. The card is nonmodal, clamped on opening and resize, and does not claim live health when owner reads are unavailable. Port units come from the node catalog data schema. The portal's info controls use `nodrag` and `nowheel`.

Verification: `npm ci --no-audit --no-fund`; `npm test` (141 passing tests, including exact base/arm binding, ambiguity, stale run, result follow-up, Stop failure and viewport clamp); `npm run typecheck`; `npm run build`; `git diff --check`. Complete logs are local in `logs/test/20261102-u04-primitive-control/`. The Node 22.23.4/npm 10.9.9 environment is the supported toolchain. Browser visual QA and M5 clean-home replay remain separate qualification gates.
