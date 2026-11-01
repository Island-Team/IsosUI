import { describe, expect, it, vi } from 'vitest';
import { applyNodeGraph, controlProcesses, getCoreReadiness, previewBackendLink, getInstalledPackages, getLogPage, getNodeOptions, getNodeSets, installBackend, linkBackend, nodeGraphReadOnlyReason, previewNodeSet, validateNodeGraph, type NodeGraph, type NodeSetDefinition, type NodeTypeDefinition } from './node-graph';
import { request } from './api-client';

vi.mock('./api-client', () => ({ request: vi.fn() }));

describe('graph reader compatibility', () => {
  const knownType: NodeTypeDefinition = { id: 'eos.dispatcher.control@v1.0', core: 'eos', layer: 'dispatcher', group: 'control', kind: 'software', lifecycle: 'internal', capabilities: [], settings: [], inputs: [], outputs: [] };
  const graph: NodeGraph = { version: '1.0.0', robot: { id: 'test', name: 'Test' }, cores: { eos: { layers: { dispatcher: { groups: { control: { nodes: { command: { id: 'command', node_type: knownType.id, label: 'Command', description: 'Admission', future_metadata: { retained: true } } } } } } } } }, future_graph_field: 'retained' };

  it('uses the server read-only state and preserves additive fields', () => {
    const document = { revision: 'saved', graph, read_only: true, diagnostics: [{ path: '/version', code: 'migration_required', message: 'Migrate this graph.' }] };
    expect(nodeGraphReadOnlyReason(document, [knownType])).toBe('Migrate this graph.');
    expect(JSON.parse(JSON.stringify(document.graph)).cores.eos.layers.dispatcher.groups.control.nodes.command.future_metadata).toEqual({ retained: true });
  });

  it('blocks unknown versions, unknown types, and missing catalog without server guidance', () => {
    expect(nodeGraphReadOnlyReason({ revision: 'saved', graph: { ...graph, version: '2.0.0' } }, [knownType])).toContain('Unsupported graph version');
    expect(nodeGraphReadOnlyReason({ revision: 'saved', graph: { ...graph, cores: { eos: { layers: { dispatcher: { groups: { control: { nodes: { command: { ...graph.cores.eos.layers.dispatcher.groups.control.nodes.command, node_type: 'eos.dispatcher.control@v2.0' } } } } } } } } } }, [knownType])).toContain('Unsupported node type');
    expect(nodeGraphReadOnlyReason({ revision: 'saved', graph }, null)).toContain('catalog is unavailable');
    expect(nodeGraphReadOnlyReason({ revision: 'saved', graph }, [knownType])).toBeNull();
  });

  it('keeps a future graph tree in raw inspection when its shape is unknown', () => {
    const future = { version: '0.2.0', robot: { id: 'test', name: 'Test' }, domains: {} } as unknown as NodeGraph;
    expect(nodeGraphReadOnlyReason({ revision: 'saved', graph: future }, [knownType])).toContain('structure cannot be edited');
  });

  it('blocks malformed inputs on a known graph before the UI renders a wire', () => {
    const malformed = structuredClone(graph);
    malformed.cores.eos.layers.dispatcher.groups.control.nodes.command.inputs = { command: null } as unknown as NonNullable<typeof malformed.cores.eos.layers.dispatcher.groups.control.nodes.command.inputs>;
    expect(nodeGraphReadOnlyReason({ revision: 'saved', graph: malformed }, [knownType])).toContain('structure cannot be edited');
  });

  it('blocks malformed hardware metadata before the inspector or controls use it', () => {
    const malformed = structuredClone(graph);
    const node = malformed.cores.eos.layers.dispatcher.groups.control.nodes.command;
    node.movement = { modes: [], limits: null } as unknown as NonNullable<typeof node.movement>;
    expect(nodeGraphReadOnlyReason({ revision: 'saved', graph: malformed }, [knownType])).toContain('structure cannot be edited');
    delete node.movement;
    node.capabilities = {} as unknown as string[];
    expect(nodeGraphReadOnlyReason({ revision: 'saved', graph: malformed }, [knownType])).toContain('structure cannot be edited');
  });

  it('blocks object-valued labels before React renders node cards', () => {
    const malformed = structuredClone(graph);
    malformed.cores.eos.layers.dispatcher.groups.control.nodes.command.label = { text: 'Command' } as unknown as string;
    expect(nodeGraphReadOnlyReason({ revision: 'saved', graph: malformed }, [knownType])).toContain('structure cannot be edited');
  });
});

describe('unified log API', () => {
  it('requests a specific source, minimum severity, and cursor', async () => {
    vi.mocked(request).mockClear().mockResolvedValue({ lines: [], next_cursor: null, rotated: false });
    await getLogPage('eos/core', 'warn', 'page 1', 500);
    expect(vi.mocked(request).mock.calls).toEqual([
      ['/logs?source=eos%2Fcore&level=warn&limit=200&cursor=page+1'],
    ]);
  });
});

describe('IsOS v1 graph and process API', () => {
  it('sends v1 request bodies for validate, apply, and run', async () => {
    const graph: NodeGraph = { version: '1.0.0', robot: { id: 'test', name: 'Test' }, cores: {} };
    vi.mocked(request).mockClear().mockResolvedValue({});
    await validateNodeGraph(graph);
    await applyNodeGraph('saved-revision', graph);
    await controlProcesses('run', 'saved-revision');
    expect(vi.mocked(request).mock.calls).toEqual([
      ['/node-graph/validate', 'POST', { schema_version: 1, graph }],
      ['/node-graph', 'PUT', { schema_version: 1, revision: 'saved-revision', graph }],
      ['/process-control', 'POST', { schema_version: 1, operation: 'run', revision: 'saved-revision' }],
    ]);
  });
});

describe('package node set API', () => {
  it('lists installed contributions and previews composition without applying a graph revision', async () => {
    vi.mocked(request).mockClear();
    const graph: NodeGraph = { version: '1.0.0', robot: { id: 'test', name: 'Test' }, cores: {} };
    const set: NodeSetDefinition = { package: { id: 'island/mujoco-sim', version: '0.1.1' }, id: 'hardware', parameters: { scene: { type: 'string', default: 'demo' } }, nodes: [] };
    vi.mocked(request).mockResolvedValueOnce({ sets: [set] }).mockResolvedValueOnce({ graph, added_paths: [] });
    expect(await getNodeSets()).toEqual({ sets: [set] });
    expect(await previewNodeSet(set, graph, { scene: 'demo' })).toEqual({ graph, added_paths: [] });
    expect(vi.mocked(request).mock.calls).toEqual([
      ['/node-sets'],
      ['/node-sets/preview', 'POST', { package: set.package, set_id: set.id, graph, values: { scene: 'demo' } }],
    ]);
  });
});

describe('generic package acquisition API', () => {
  it('reads installed receipts for every package kind', async () => {
    vi.mocked(request).mockClear();
    const installed = [{ schema_version: 1, id: 'island/mujoco-sim', version: '0.1.1', source_commit: null, asset_sha256: null, local_link: '/opt/mujoco' }];
    vi.mocked(request).mockResolvedValueOnce({ installed });
    expect(await getInstalledPackages()).toEqual({ installed });
    expect(vi.mocked(request).mock.calls).toEqual([['/packages']]);
  });
  it('accepts explicit package identity and optional local manifest path', async () => {
    vi.mocked(request).mockClear();
    vi.mocked(request).mockResolvedValue(undefined);
    await installBackend('island/mujoco-sim', '0.1.1');
    await linkBackend('island/mujoco-sim', '0.1.1', '/opt/mujoco', '/opt/mujoco/release.json');
    await linkBackend('island/mujoco-sim', '0.1.1', '/opt/mujoco');
    expect(vi.mocked(request).mock.calls).toEqual([
      ['/packages/install', 'POST', { id: 'island/mujoco-sim', version: '0.1.1' }],
      ['/packages/link', 'POST', { id: 'island/mujoco-sim', version: '0.1.1', path: '/opt/mujoco', manifest: '/opt/mujoco/release.json' }],
      ['/packages/link', 'POST', { id: 'island/mujoco-sim', version: '0.1.1', path: '/opt/mujoco' }],
    ]);
  });
});

describe('readiness and local bundle preview API', () => {
  it('reads configured core readiness and previews bundle identity before linking', async () => {
    const graph: NodeGraph = { version: '1.0.0', robot: { id: 'test', name: 'Test' }, cores: {} };
    vi.mocked(request).mockClear().mockResolvedValueOnce({ cores: [] }).mockResolvedValueOnce({ id: 'island/mujoco-sim', version: '0.1.1', ready: true, issues: [] }).mockResolvedValueOnce({ adapter_families: [], primitive_bindings: [], targets: [] });
    await getCoreReadiness();
    await previewBackendLink('/opt/mujoco', '/opt/mujoco/release.json');
    await getNodeOptions(graph);
    expect(vi.mocked(request).mock.calls).toEqual([
      ['/core-readiness'],
      ['/packages/preview-link', 'POST', { path: '/opt/mujoco', manifest: '/opt/mujoco/release.json' }],
      ['/node-options', 'POST', { schema_version: 1, graph }],
    ]);
  });
});
