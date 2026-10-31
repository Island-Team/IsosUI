import { request } from './api-client';

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
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  safety_adapter_type?: string | null;
}
export interface PortDefinition { name: string; data_type: string; required: boolean; cardinality?: 'one' | 'many'; description?: string; expected_rate_hz?: number | null; transport?: 'in_process' | 'unix_socket' | 'websocket' | 'ros2' | string; data_class?: string }
export interface DataSchema { title?: string; description?: string; type?: string; properties?: Record<string, { type?: string; description?: string; 'x-unit'?: string; minimum?: number; maximum?: number }>; required?: string[]; [key: string]: unknown }
export interface DataTypeDefinition { id: string; version: string; purpose: string; media_type: string; codec: string; schema: DataSchema; max_payload_bytes: number }

export interface NodeSource { node: string; output: string }
export interface NodeInstance {
  id: string;
  node_type: string;
  label: string;
  description: string;
  package?: { id: string; version: string };
  capabilities?: string[];
  settings?: Record<string, unknown>;
  inputs?: Record<string, NodeSource | NodeSource[]>;
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
export interface InstalledPackage { schema_version: 1; id: string; version: string; source_commit: string | null; asset_sha256: string | null; local_link: string | null }
export interface NodeSetDefinition {
  package: { id: string; version: string };
  id: string;
  parameters: Record<string, { type: 'string'; default?: string }>;
  nodes: { ref: string; core: string; layer: string; group?: string; profile: NodeInstance }[];
}
export interface NodeSetPreview { graph: NodeGraph; added_paths: string[] }
export interface SetupStatus { ready?: boolean; issues?: string[]; [key: string]: unknown }
export interface LogLine { timestamp: string; level: string; source: string; message: string }
export interface LogPage { lines: LogLine[]; next_cursor: string | null; rotated: boolean }
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
export interface CoreReadinessEntry { core: string; path: string | null; version: string | null; compatible: boolean; configured: boolean; enabled?: boolean; graph_configured: boolean; running: boolean; ready: boolean; reason?: string | null; action?: string | null }
export interface CoreReadiness { cores: CoreReadinessEntry[] }
export interface LinkPreview { id: string; version: string; ready: boolean; issues: string[] }
export interface AdapterFamilyOption { id: string; device_kinds: string[]; package?: { id: string; version: string }; compiled: boolean; transport: string; description: string; available: boolean; reason?: string }
export interface PrimitiveBindingOption { node_type: string; device_kind: string; movement_types: string[]; available: boolean; reason?: string }
export interface HardwareTargetOption { path: string; node_type: string; device_kind: string; adapter_type: string; movement_types: string[]; available: boolean; reason?: string }
export interface NodeOptions { adapter_families: AdapterFamilyOption[]; primitive_bindings: PrimitiveBindingOption[]; targets: HardwareTargetOption[] }
export interface PrimitiveSpec { name: string; version: string; device_class: string; movement_type: string; description: string }

export function backendPackagePin(node: NodeInstance): { id: string; version: string } | null {
  if (node.node_type === 'eos.process.mujoco@v1.0' && node.package) return node.package;
  if (node.node_type === 'eos.process.backend@v1.0' && typeof node.settings?.package === 'string' && typeof node.settings?.version === 'string') {
    return { id: node.settings.package, version: node.settings.version };
  }
  return null;
}

export function backendSceneChoices(node: NodeInstance, backends: BackendPackage[]): string[] {
  const pin = backendPackagePin(node);
  return pin ? backends.filter((backend) => backend.id === pin.id && backend.version === pin.version).flatMap((backend) => backend.scenes) : [];
}

export function requiredBackend(graph: NodeGraph): { id: string; version: string; scene?: string } | null {
  for (const core of Object.values(graph.cores)) for (const layer of Object.values(core.layers)) for (const group of Object.values(layer.groups)) for (const node of Object.values(group.nodes)) {
    const pin = backendPackagePin(node);
    if (pin) return { ...pin, scene: typeof node.settings?.scene === 'string' ? node.settings.scene : undefined };
  }
  return null;
}

/** Change only the declared backend scene; keep all other graph settings and nodes intact. */
export function graphWithBackendScene(graph: NodeGraph, id: string, version: string, scene: string): NodeGraph {
  let matches = 0;
  const cores = Object.fromEntries(Object.entries(graph.cores).map(([coreName, core]) => [coreName, {
    ...core, layers: Object.fromEntries(Object.entries(core.layers).map(([layerName, layer]) => [layerName, {
      ...layer, groups: Object.fromEntries(Object.entries(layer.groups).map(([groupName, group]) => [groupName, {
        ...group, nodes: Object.fromEntries(Object.entries(group.nodes).map(([nodeName, node]) => {
          const pin = backendPackagePin(node);
          if (!pin || pin.id !== id || pin.version !== version) return [nodeName, node];
          matches += 1;
          return [nodeName, { ...node, settings: { ...node.settings, scene } }];
        })),
      }])),
    }])),
  }]));
  if (matches !== 1) throw new Error(`Expected one ${id}@${version} backend node; found ${matches}.`);
  return { ...graph, cores };
}

export function getNodeGraph(): Promise<NodeGraphDocument> { return request('/node-graph'); }
export function getNodeTypes(): Promise<{ types: NodeTypeDefinition[]; data_types?: DataTypeDefinition[]; primitive_specs?: PrimitiveSpec[] }> { return request('/node-types'); }
export function getNodeSets(): Promise<{ sets: NodeSetDefinition[] }> { return request('/node-sets'); }
export function getInstalledPackages(): Promise<{ installed: InstalledPackage[] }> { return request('/packages'); }
export function previewNodeSet(set: NodeSetDefinition, graph: NodeGraph, values: Record<string, string>, replaceLegacyMujoco = false): Promise<NodeSetPreview> {
  return request('/node-sets/preview', 'POST', { package: set.package, set_id: set.id, graph, values, ...(replaceLegacyMujoco ? { replace_legacy_mujoco: true } : {}) });
}
export function getProcessStatus(): Promise<ProcessStatus> { return request('/process-status'); }
export function getBackends(): Promise<{ backends: BackendPackage[] }> { return request('/backends'); }
export function installBackend(id: string, version: string): Promise<unknown> {
  return request('/packages/install', 'POST', { id, version });
}
export function linkBackend(id: string, version: string, path: string, manifest?: string): Promise<unknown> {
  return request('/packages/link', 'POST', { id, version, path, ...(manifest ? { manifest } : {}) });
}
export function getSetupStatus(): Promise<SetupStatus> { return request('/setup-status'); }
export function controlProcesses(operation: 'run' | 'stop' | 'restart', revision?: string): Promise<ProcessStatus> {
  return request('/process-control', 'POST', { schema_version: 2, operation, ...(revision ? { revision } : {}) });
}
export function getCoreReadiness(): Promise<CoreReadiness> { return request('/core-readiness'); }
export function previewBackendLink(path: string, manifest?: string): Promise<LinkPreview> {
  return request('/packages/preview-link', 'POST', { path, ...(manifest ? { manifest } : {}) });
}
export function getNodeOptions(graph: NodeGraph): Promise<NodeOptions> { return request('/node-options', 'POST', { schema_version: 2, graph }); }
export function getLogPage(source: string, level: LogLevel, cursor?: string, limit = 200): Promise<LogPage> {
  const params = new URLSearchParams({ source, level, limit: String(Math.max(1, Math.min(200, Math.floor(limit)))) });
  if (cursor) params.set('cursor', cursor);
  return request(`/logs?${params.toString()}`);
}
export function validateNodeGraph(graph: NodeGraph): Promise<NodeGraphValidation> {
  return request('/node-graph/validate', 'POST', { schema_version: 2, graph });
}
export function applyNodeGraph(revision: string, graph: NodeGraph): Promise<NodeGraphDocument> {
  return request('/node-graph', 'PUT', { schema_version: 2, revision, graph });
}
