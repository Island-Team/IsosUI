# R07 UI browser result design cases

[中文](README_cn.md) · [UI contract](../../../docs/isosui/interfaces/browser-results.md) · [Design](../../../docs/isosui/design-browser-results.md)

`cases.json` freezes 32 design cases for the IsosUI projection of EOS's R07 authorized browser result route. `request` cases assert the public body has exactly `op`, `command_id` and `active_revision`; `owner_result` cases cover the six exact EOS statuses; `fence` cases separate an old run or revision from a current command; `owner_error`, `transport` and `protocol` cases keep missing evidence visibly unavailable. The Stop cases require the independent IsOS deployment Stop during an EOS outage and an unknown result. This fixture is design evidence, not an implementation test.

Run `python3 tests/fixtures/browser_results/check.py` from the repository root. Implementation tests must exercise the same cases with stub IsOS/EOS services, the two UI bundles and a real cross-owner first-use replay before R07 or U04 is closed.
