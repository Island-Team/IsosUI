import type { CurrentLogPage, LogAnchor, LogDiagnostic, LogLine, LogScope } from '../../services/isos/node-graph';

export interface CurrentLogState {
  scope: LogScope | null;
  anchor: LogAnchor | null;
  lines: LogLine[];
  cursor?: string;
  diagnostics: LogDiagnostic[];
  boundary: { previous: string; current: string } | null;
}

export const emptyCurrentLogState: CurrentLogState = {
  scope: null, anchor: null, lines: [], diagnostics: [], boundary: null,
};

function sameScope(a: LogScope | null, b: LogScope): boolean {
  return a?.kind === b.kind && a.run_id === b.run_id;
}

/** Rotation preserves retained rows; only an owner-reported scope change clears them. */
export function acceptCurrentLogPage(state: CurrentLogState, page: CurrentLogPage): CurrentLogState {
  const changed = state.scope !== null && !sameScope(state.scope, page.scope);
  const lines = page.anchor.state === 'found'
    ? [...(changed ? [] : state.lines), ...page.lines].slice(-1000)
    : [];
  const diagnosticKey = (item: LogDiagnostic): string => `${item.code}:${item.count ?? 'unknown'}`;
  const previousDiagnostics = changed ? [] : state.diagnostics;
  const seen = new Set(previousDiagnostics.map(diagnosticKey));
  const diagnostics = [...previousDiagnostics];
  for (const item of page.diagnostics) {
    if (!seen.has(diagnosticKey(item))) {
      diagnostics.push(item);
      seen.add(diagnosticKey(item));
    }
  }
  return {
    scope: page.scope,
    anchor: page.anchor,
    lines,
    cursor: page.next_cursor,
    diagnostics,
    boundary: changed ? { previous: state.scope!.run_id, current: page.scope.run_id } : state.boundary,
  };
}

/** Filters affect details and cursor only; the owner-pinned first event stays visible. */
export function resetCurrentLogDetails(state: CurrentLogState): CurrentLogState {
  return { ...state, lines: [], cursor: undefined };
}

export function validNodeFilter(value: string): boolean {
  return value.length <= 512 && /^\/cores\/[A-Za-z0-9_-]+\/layers\/[A-Za-z0-9_-]+\/groups\/[A-Za-z0-9_-]+\/nodes\/[A-Za-z0-9_-]+$/.test(value);
}

export function validCorrelationFilter(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value);
}
