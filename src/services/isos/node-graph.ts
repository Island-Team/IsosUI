import { request } from './config-manager';

/** One registered node type. Placement belongs to this definition, not an instance setting. */
export interface NodeTypeDefinition {
  id: string;
  core: string;
  layer: string;
  group: string;
  kind: 'camera' | 'base' | 'manipulator' | 'software';
  lifecycle: 'internal' | 'process' | 'adapter';
  capabilities: string[];
  settings: { name: string; data_type: 'string' | 'positive_integer' | 'nonnegative_integer' | 'string_array' | 'string_table'; required: boolean; description?: string; unit?: string; min?: number; max?: number; choices?: string[] }[];
  inputs: { name: string; data_type: string; required: boolean }[];
  outputs: { name: string; data_type: string; required: boolean }[];
  safety_adapter_type?: string | null;
}

export interface NodeSource { node: string; output: string }
export interface NodeInstance {
  id: string;
  node_type: string;
  label: string;
  description: string;
  capabilities?: string[];
  settings?: Record<string, unknown>;
  inputs?: Record<string, NodeSource>;
  references?: string[];
  frame_id?: string;
  joint_names?: string[];
  adapter?: { type: string; settings?: Record<string, unknown> };
  health_timing?: { poll_interval_ms: number; stale_after_ms: number };
  observation?: { max_rate_hz: number; max_payload_bytes: number };
  movement?: { modes: string[]; limits: Record<string, number> };
}
export interface NodeGraph {
  version: '2.0.0';
  robot: { id: string; name: string };
  cores: Record<string, { layers: Record<string, { groups: Record<string, { nodes: Record<string, NodeInstance> }> }> }>;
}
export interface NodeGraphDocument { revision: string; graph: NodeGraph }
export interface NodeGraphDiagnostic { path: string; code?: string; message: string }
export interface NodeGraphValidation { valid: boolean; diagnostics: NodeGraphDiagnostic[] }
export interface ProcessStatus {
  schema_version: '2.0.0';
  saved_revision?: string;
  active_revision?: string | null;
  state?: 'stopped' | 'running' | 'degraded';
  last_error?: string | null;
  processes: { id: string; pid?: number; restarts: number; state?: string; last_error?: string | null }[];
}
export interface BackendPackage { id: string; version: string; linked: boolean; scenes: string[]; devices: string[]; ready: boolean; issues: string[] }
export interface SetupStatus { ready?: boolean; issues?: string[]; [key: string]: unknown }
export interface ProcessLog { node?: string; lines?: string[]; text?: string; [key: string]: unknown }

export function getNodeGraph(): Promise<NodeGraphDocument> { return request('/node-graph'); }
export function getNodeTypes(): Promise<{ types: NodeTypeDefinition[] }> { return request('/node-types'); }
export function getProcessStatus(): Promise<ProcessStatus> { return request('/process-status'); }
export function getBackends(): Promise<{ backends: BackendPackage[] }> { return request('/backends'); }
export function getSetupStatus(): Promise<SetupStatus> { return request('/setup-status'); }
export function controlProcesses(operation: 'run' | 'stop' | 'restart', revision?: string): Promise<ProcessStatus> {
  return request('/process-control', 'POST', { schema_version: 2, operation, ...(revision ? { revision } : {}) });
}
export function getProcessLogs(node: string, lines = 100): Promise<ProcessLog> {
  return request(`/process-logs/${encodeURIComponent(node)}?lines=${Math.max(1, Math.min(500, Math.floor(lines)))}`);
}
export function validateNodeGraph(graph: NodeGraph): Promise<NodeGraphValidation> {
  return request('/node-graph/validate', 'POST', { schema_version: 2, graph });
}
export function applyNodeGraph(revision: string, graph: NodeGraph): Promise<NodeGraphDocument> {
  return request('/node-graph', 'PUT', { schema_version: 2, revision, graph });
}
