# Graph catalog projection

[中文](../../../docs_cn/isosui/catalog/README_cn.md) · [First use](../usage.md) · [Design](../design.md)

**Target design, not current behavior.** IsosUI displays the IsOS catalog; it does not register runtime node types or own their payload fields. Read the hierarchy in the same order as first use: choose a **core**, narrow to a **layer**, choose a **group**, then inspect and add a **node type**. The selected type's description explains what it does; the instance description remains editable and explains this placement. The exact type ID, settings, ports, capabilities, defaults, units, validation and compatibility are defined in the owner's `interfaces/` contract, not copied into UI data.

| Level | UI behavior | Owner and example |
| --- | --- | --- |
| Core | Show readiness, package pin and broad status; a disabled core remains visible with reason. | EOS, EGIA and IsOS own their own live state. |
| Layer | Filter major domains without changing the graph. | EOS hardware, process, control; EGIA agent stages; IsOS management. |
| Group | Show related registered types and whether the package contributes them. | EOS camera/base/manipulator, MuJoCo process, EGIA perception/context/decision. |
| Node type | Show nonblank type description, placement, settings and typed ports from registry; offer Add only if compatible. | EOS, IsOS, EGIA and package-owned catalogs define their respective types. |
| Node instance | Show editable label and description, saved settings, errors, runtime health and source edges separately. | IsOS owns saved graph; EOS/EGIA own runtime status. |

The UI looks up an exact `(core, layer, group, type_id)` registry record. It never derives identity from translated labels or folder names. On an old sidecar missing `NodeType.description`, show the server's compatibility description with a fallback marker. If a type is unavailable because a pinned package is missing or invalid, retain the graph's ID and show the reason; block Apply. Unknown future fields remain preserved in the draft until the owner rejects them, and unknown future graph versions open read-only.

The node inspector order is **identity and description → package/version and availability → settings and selectors → ports and wires → validation → live status/log link**. A selector option keeps its stable value; its label and description are presentation. Each wire inspector shows nice priority and frequency cap, including legacy defaults, before the operator applies. The log link opens the current run at its first ready/failure event, then filters by node path and correlation ID. See [workspace algorithms](../design.md) for stale revision, selector refresh and panel persistence.
