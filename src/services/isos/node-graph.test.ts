import { describe, expect, it, vi } from 'vitest';
import { applyNodeGraph, controlProcesses, getCoreReadiness, previewBackendLink, getInstalledPackages, getLogPage, getNodeOptions, getNodeSets, installBackend, linkBackend, previewNodeSet, validateNodeGraph, type NodeGraph, type NodeSetDefinition } from './node-graph';
import { request } from './api-client';

vi.mock('./api-client', () => ({ request: vi.fn() }));

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
    const set: NodeSetDefinition = { package: { id: 'island/mujoco-sim', version: '2.0.0' }, id: 'hardware', parameters: { scene: { type: 'string', default: 'demo' } }, nodes: [] };
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
    const installed = [{ schema_version: 1, id: 'island/mujoco-sim', version: '2.0.0', source_commit: null, asset_sha256: null, local_link: '/opt/mujoco' }];
    vi.mocked(request).mockResolvedValueOnce({ installed });
    expect(await getInstalledPackages()).toEqual({ installed });
    expect(vi.mocked(request).mock.calls).toEqual([['/packages']]);
  });
  it('accepts explicit package identity and optional local manifest path', async () => {
    vi.mocked(request).mockClear();
    vi.mocked(request).mockResolvedValue(undefined);
    await installBackend('island/mujoco-sim', '2.0.0');
    await linkBackend('island/mujoco-sim', '2.0.0', '/opt/mujoco', '/opt/mujoco/release.json');
    await linkBackend('island/mujoco-sim', '2.0.0', '/opt/mujoco');
    expect(vi.mocked(request).mock.calls).toEqual([
      ['/packages/install', 'POST', { id: 'island/mujoco-sim', version: '2.0.0' }],
      ['/packages/link', 'POST', { id: 'island/mujoco-sim', version: '2.0.0', path: '/opt/mujoco', manifest: '/opt/mujoco/release.json' }],
      ['/packages/link', 'POST', { id: 'island/mujoco-sim', version: '2.0.0', path: '/opt/mujoco' }],
    ]);
  });
});

describe('readiness and local bundle preview API', () => {
  it('reads configured core readiness and previews bundle identity before linking', async () => {
    const graph: NodeGraph = { version: '1.0.0', robot: { id: 'test', name: 'Test' }, cores: {} };
    vi.mocked(request).mockClear().mockResolvedValueOnce({ cores: [] }).mockResolvedValueOnce({ id: 'island/mujoco-sim', version: '2.0.0', ready: true, issues: [] }).mockResolvedValueOnce({ adapter_families: [], primitive_bindings: [], targets: [] });
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
