#!/usr/bin/env python3
"""Validate the frozen IsosUI P07 design fixture and bilingual documentation."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FIXTURE = Path(__file__).parent
DOCS = (
    "docs/isosui/interfaces/log-cursors.md",
    "docs_cn/isosui/interfaces/log-cursors_cn.md",
    "docs/isosui/design-log-cursors.md",
    "docs_cn/isosui/design-log-cursors_cn.md",
    "docs/isosui/usage.md",
    "docs_cn/isosui/usage_cn.md",
    "docs/isosui/README.md",
    "docs_cn/isosui/README_cn.md",
    "tests/fixtures/log_cursors/README.md",
    "tests/fixtures/log_cursors/README_cn.md",
)


def check_links(path: Path) -> None:
    for target in re.findall(r"\[[^]]+\]\(([^)]+)\)", path.read_text()):
        if target.startswith(("http://", "https://", "#")):
            continue
        assert (path.parent / target.split("#", 1)[0]).exists(), (path, target)


def main() -> None:
    data = json.loads((FIXTURE / "cases.json").read_text())
    assert data["schema_version"] == 1 and data["slice"] == "P07-isosui"
    assert data["request"] == {
        "route": "/api/isos/v1/logs", "view": "current",
        "default_source": "all", "default_level": "info",
        "default_limit": 100, "max_limit": 200, "max_scan_bytes": 65536,
    }
    assert data["response_fields"] == ["scope", "anchor", "lines", "next_cursor", "rotated", "diagnostics"]
    assert data["scope_kinds"] == ["manager_session", "deployment_run"]
    assert data["anchor_kinds"] == ["first_prelaunch_failure", "first_ready_or_failure"]
    assert data["diagnostic_codes"] == ["log_run_changed", "log_cursor_expired", "log_collector_gap", "log_anchor_unavailable"]
    cases = data["cases"]
    ids = [case["id"] for case in cases]
    assert len(cases) == 24 and len(ids) == len(set(ids))
    assert {case["boundary"] for case in cases} == {"anchor", "filter", "cursor", "scope", "connection", "privacy", "compat", "bounds"}
    by_id = {case["id"]: case["expected"] for case in cases}
    for name in ("manager_anchor_pending", "run_anchor_pending"):
        assert by_id[name]["anchor_state"] == "pending"
        assert by_id[name]["anchor_event"] is None and by_id[name]["lines"] == []
    assert by_id["anchor_unavailable"]["anchor_state"] == "unavailable"
    assert by_id["anchor_unavailable"]["diagnostic_code"] == "log_anchor_unavailable"
    assert by_id["validate_only_not_anchor"]["validate_only_eligible"] is False
    assert by_id["filtered_details_keep_anchor"]["filters_apply_to"] == "lines_only"
    assert by_id["filter_change_resets_cursor"]["old_cursor_error"] == "log_cursor_filter_mismatch"
    assert by_id["filter_change_resets_cursor"]["diagnostic_path"] == "/query/cursor"
    assert by_id["tampered_cursor_rejected"]["diagnostic_code"] == "log_cursor_invalid"
    assert by_id["tampered_cursor_rejected"]["diagnostic_path"] == "/query/cursor"
    assert by_id["tampered_cursor_rejected"]["token_echo"] is False
    assert by_id["run_first_ready"]["details_strictly_after_anchor"] is True
    assert by_id["run_first_failure"]["no_fabricated_ready"] is True
    assert all(by_id[name]["same_run_rebase"] for name in ("cursor_expired",))
    assert by_id["new_run_boundary"]["ignore_old_response"] is True
    assert by_id["stopped_run_persists"]["last_run_retained"] is True
    assert by_id["manager_restart_persists"]["last_run_retained"] is True
    assert by_id["manager_preflight_with_last_run"]["manager_event_not_relabelled"] is True
    assert by_id["collector_outage"]["keep_cursor"] is True
    assert by_id["collector_recovery"]["resume_same_cursor"] is True
    assert by_id["browser_source_isolation"]["server_run_claim"] is False
    assert by_id["legacy_server_fallback"]["first_event_claim"] is False
    assert by_id["bounded_poll_and_accessibility"]["max_rows"] == 1000
    assert by_id["bounded_poll_and_accessibility"]["max_request_rows"] == 200
    for name in DOCS:
        check_links(ROOT / name)
    english = (ROOT / DOCS[0]).read_text()
    chinese = (ROOT / DOCS[1]).read_text()
    for token in ("view=current", "manager_session", "deployment_run", "first_prelaunch_failure", "first_ready_or_failure", "log_run_changed", "log_cursor_expired", "log_collector_gap", "log_anchor_unavailable", "log_cursor_invalid", "log_cursor_filter_mismatch", "node_path", "correlation_id"):
        assert token in english and token in chinese, token
    print(f"P07 IsosUI fixtures valid: {len(cases)} unique cases, {len(DOCS)} linked bilingual documents")


if __name__ == "__main__":
    main()
