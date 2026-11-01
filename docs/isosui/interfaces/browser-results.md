# Browser primitive result client — R07 UI contract

[中文](../../../docs_cn/isosui/interfaces/browser-results_cn.md) · [Design](../design-browser-results.md) · [First use](../usage.md) · EOS owner contract: `Island-eos/docs/eos/interfaces/control.md#r07-authorized-browser-result`

**Target UI contract; no IsosUI R07 client is implemented on this design commit.** IsOS owns the saved graph, active revision, deployment run identity and Stop. EOS owns the active binding, admission, journal result and live status. IsosUI may display a browser-local send state, but only a correlated EOS `DispatchResult` establishes a command outcome. A graph edge declares one binding target; it never executes a browser command. R06 physical stop qualification gates exposure of MuJoCo movement controls.

## Typed boundary

The `src/services/eos/` client sends only `POST http://127.0.0.1:16020/api/eos/v2/control` through the validated loopback origin configured for local or hosted builds. It uses `credentials: omit`, JSON, no Authorization header, and the existing four-second client timeout. The browser sends no `authority_grant`, private `primitive_result`, raw Dispatcher operation or hardware target in a result read. The bridge applies Host and approved-Origin checks and supplies its own run-scoped operator grant. A browser `op: "result"` is read-only; the bridge rewrites it to its private operation. The existing `primitive_typed` command is the only planned movement send for a U04 active binding.

| Client field | JSON type / unit | Purpose, default and validation |
| --- | --- | --- |
| `op` | literal `result` / — | Required exact operation; no default. |
| `command_id` | string / command identity | Required exact ID from the submitted `primitive_typed` header and correlated initial EOS reply, 1–128 UTF-8 bytes; no default. |
| `active_revision` | string / saved graph SHA-256 | Required 64 lowercase hexadecimal digits copied from the current IsOS active revision; it must equal the saved graph revision at each read; no default. |
| `result.command_id` | string / command identity | Must equal the locally tracked command ID; a mismatch is a protocol error, not an outcome. |
| `result.status` | enum / — | Required exact `Completed`, `Failed`, `Cancelled`, `Rejected`, `InProgress` or `OutcomeUnknown`; unknown status is a protocol error. |
| `result.reason` | string or null / UTF-8 text | EOS-reported explanation, at most 512 UTF-8 bytes; render as text, never HTML or a control decision. |

```json
{"op":"result","command_id":"move-1","active_revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
```

The service validates the request before fetch and accepts only `{"ok":true,"result":{"command_id":...,"status":...,"reason":...}}` with the matching ID and bounded fields. EOS bounds the whole success response to 4 KiB. A malformed success, unknown status, ID mismatch or oversized response is shown as a protocol error and never as `Completed`. Fixed owner errors remain errors: malformed request (`400 invalid result request`), invalid origin or Host (`403`), unavailable operator grant (`503 operator control unavailable`), private grant rejection (`operator control grant required`), stale revision (`stale active revision`), opaque other-run/role/ingress/kind/absent ID (`unknown command ID`), bounded result unavailable (`result unavailable`) and IPC outage (`502 runtime unavailable`). The UI does not infer which hidden cause produced `unknown command ID`.

## Run and revision fence

Before the initial typed send, read IsOS graph and `process-status` and require all of: supported editable graph, no unsaved draft, `state:running`, a known current `run_id`, a 64-hex saved revision equal to the graph document revision and active revision, an exact active binding with one compatible target, EOS readiness and healthy target. Before each result read, obtain fresh IsOS process status and require the same known run ID and active revision captured at send, `state:running`, and the same saved revision; a binding or health change does not erase the already admitted command. If IsOS cannot prove run identity, its status is unavailable, or a new run or active revision appears, stop automatic follow-up and mark the old command **unavailable for this run**. Preserve its last owner status and command ID for explanation, but never carry it into the new run or relabel it `Completed`. A draft edit or graph read-only transition disables a new send; it cannot manufacture a terminal outcome for an existing command.

The command record key is `(run_id, active_revision, binding_path, command_id)`, where `run_id` is IsOS's exact current deployment-run ID, `active_revision` is the 64-hex digest, `binding_path` is the active graph node path and `command_id` is generated once per invocation. Only the current selected record can update its visible status. On tab/page unmount, binding selection change, run/revision change or Stop, cancel its pending browser read and ignore late replies by generation token. A late reply from another generation cannot overwrite a newer command. Do not persist command IDs or results as authority in browser storage; current-run logs use their own IsOS cursor and correlation ID.

## Visible states and Stop

`sending` is browser-local and must not pulse as success. An EOS reply with matching ID changes it to the exact owner status. `InProgress` is nonterminal; `Completed`, `Failed`, `Cancelled`, `Rejected` and `OutcomeUnknown` are terminal display states. `Failed` receives an explicit failure label and reason. `OutcomeUnknown` receives an explicit uncertainty label; it never triggers a retry of the movement command. If send times out or the bridge disconnects before a correlated reply, display **submission outcome unavailable** and retain the generated ID for investigation; retry only a guarded read after status/revision/run recovery, never the command. An opaque ID or outage during follow-up displays **result unavailable**, retaining the last known `InProgress` state without converting it to a terminal outcome.

The result reader permits at most one in-flight request per command, begins after a one-second interval, backs off repeated follow-up errors to at most 10 seconds, and stops automatic polling after 60 seconds or 12 attempts, whichever comes first. It pauses when the document is hidden and resumes only after rechecking IsOS run/revision; manual Refresh uses the same checks. The UI shows a paused `InProgress` record and a Refresh action rather than implying completion. Page navigation and Stop abort the read. These bounds apply only to read-only result calls, never to another movement submission.

The deployment **Stop** action stays visible and enabled through IsOS `/api/isos/v1/process-control` even when EOS is offline, the graph is read-only, the active revision differs, a result is unknown or the result client has paused. A local stop click is a pending intent until IsOS reports its governed terminal or unknown outcome; the UI does not equate a `Cancelled` command result with physical stop. The EOS panel must expose a route to that IsOS action; U03/U04 will place the persistent control. This R07 slice defines the client/state boundary and does not add the full U04 primitive form or graph info card.
