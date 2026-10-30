/** Versioned configuration API hosted by the local IsOS process. */
const BASE = ISOSUI_TARGET === 'hosted' ? 'http://127.0.0.1:16000/api/isos/v2' : '/api/isos/v2';

export interface IsosProfilePort { name: string; type: string; required?: boolean; contract?: string }
export interface IsosSettingField { path: string; type: 'string' | 'absolute_path' | 'integer' | 'number' | 'boolean' | 'enum'; label?: string; description?: string; required?: boolean; default?: unknown; min?: number; max?: number; options?: string[]; read_only?: boolean }
export interface IsosProfile {
  id: string;
  version: string;
  label?: string;
  description?: string;
  inputs?: IsosProfilePort[];
  outputs?: IsosProfilePort[];
  defaults?: Record<string, unknown>;
  settings_fields?: IsosSettingField[];
}
export interface IsosNode {
  id: string;
  kind: 'component' | 'endpoint' | 'service' | 'backend' | 'skill';
  role?: 'eos' | 'egia';
  profile?: { id: string; version: string };
  enabled?: boolean;
  owned?: boolean;
  package?: { id: string; version: string };
  launch?: { command: string[]; ready_tcp?: string; timeout_ms?: number; env?: Record<string, string> };
  contract?: string;
  settings?: Record<string, unknown>;
}
export interface IsosEdge {
  from: string;
  to: string;
  kind: 'depends_on' | 'model_binding' | 'backend_attachment' | 'skill_load';
  input?: string;
  output?: string;
}
export interface IsosGraph {
  schema_version: 2;
  name: string;
  nodes: IsosNode[];
  edges: IsosEdge[];
  layout?: Record<string, { x: number; y: number }>;
}
export interface IsosDiagnostic { path: string; message: string; code?: string }
export interface IsosGraphDocument { revision: string; graph: IsosGraph }
export interface IsosValidation { valid: boolean; diagnostics: IsosDiagnostic[] }
interface Envelope<T> { schema_version: 2; ok: boolean; data: T | null; error: string | null }
type LoopbackRequestInit = RequestInit & { targetAddressSpace?: 'loopback' };

export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    const options: LoopbackRequestInit = {
      method,
      credentials: 'omit',
      cache: 'no-store',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      // Chrome uses this hint for HTTPS-to-HTTP loopback permission and address verification.
      ...(ISOSUI_TARGET === 'hosted' ? { mode: 'cors' as const, targetAddressSpace: 'loopback' as const } : {}),
    };
    response = await fetch(`${BASE}${path}`, options);
  } catch {
    throw new Error(ISOSUI_TARGET === 'hosted'
      ? 'Cannot reach local IsOS at 127.0.0.1:16000. Start IsOS and allow browser access to the local network.'
      : 'Cannot reach the local IsOS API. Start IsOS and try again.');
  }
  let envelope: Envelope<T> | null = null;
  try { envelope = await response.json() as Envelope<T>; } catch { /* HTTP failures can be plain text. */ }
  if (response.ok && !envelope) {
    throw new Error('IsOS returned a page instead of API data. Stop the older IsOS server and run isos init again.');
  }
  if (envelope && envelope.schema_version !== 2) {
    throw new Error('This IsosUI build needs the IsOS v2 API. Update IsOS or use a compatible UI release.');
  }
  if (!response.ok || !envelope?.ok || envelope.data === null) {
    if (response.status === 409) throw new Error('This graph changed in another editor. Refresh before applying.');
    throw new Error(envelope?.error || `IsOS request failed (${response.status}).`);
  }
  return envelope.data;
}

export function getIsosGraph(): Promise<IsosGraphDocument> { return request('/graph'); }
export function getIsosVersion(): Promise<{ api_schema_version: number; isos_version: string }> { return request('/version'); }
export function getIsosProfiles(): Promise<{ profiles: IsosProfile[] }> { return request('/profiles'); }
export function validateIsosGraph(graph: IsosGraph): Promise<IsosValidation> {
  return request('/graph/validate', 'POST', { schema_version: 2, graph });
}
export function applyIsosGraph(revision: string, graph: IsosGraph): Promise<IsosGraphDocument> {
  return request('/graph', 'PUT', { schema_version: 2, revision, graph });
}
