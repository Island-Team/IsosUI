#!/usr/bin/env python3
"""Static design-matrix checks for R07 UI client and state boundaries."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[3]
fixture = json.loads(Path(__file__).with_name("cases.json").read_text())
cases = fixture["cases"]
ids = [case["id"] for case in cases]
assert len(ids) == len(set(ids)), "duplicate case ID"
assert len(cases) >= 30, "missing boundary cases"
assert {case["category"] for case in cases} >= {"request", "owner_result", "transition", "protocol", "fence", "owner_error", "transport", "poll", "stop"}
assert {case["response"]["result"]["status"] for case in cases if case["category"] == "owner_result"} == {"Completed", "Failed", "Cancelled", "Rejected", "InProgress", "OutcomeUnknown"}
exact = next(case for case in cases if case["id"] == "public_read_exact")
assert exact["request"] == {"op": "result", "command_id": fixture["command_id"], "active_revision": fixture["revision_a"]}
assert "authority_grant" not in exact["request"] and "target_path" not in exact["request"]
assert next(case for case in cases if case["id"] == "stop_during_outage")["expect"] == "isos_stop_visible_enabled"
for path in [
    root / "docs/isosui/interfaces/browser-results.md",
    root / "docs_cn/isosui/interfaces/browser-results_cn.md",
    root / "docs/isosui/design-browser-results.md",
    root / "docs_cn/isosui/design-browser-results_cn.md",
]:
    assert path.is_file(), path
    source = path.read_text()
    for status in ["Completed", "Failed", "Cancelled", "Rejected", "InProgress", "OutcomeUnknown"]:
        assert status in source, f"{path}: missing {status}"
    assert "Stop" in source and "active_revision" in source, path
print(f"R07 UI design matrix: {len(cases)} unique cases, six owner statuses, EN/CN contracts and designs")
