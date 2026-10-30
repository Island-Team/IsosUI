import { describe, expect, it, vi } from 'vitest';
import { getNodeSets, previewNodeSet, type NodeGraph, type NodeSetDefinition } from './node-graph';
import { request } from './config-manager';

vi.mock('./config-manager', () => ({ request: vi.fn() }));

describe('package node set API', () => {
  it('lists installed contributions and previews composition without applying a graph revision', async () => {
    const graph: NodeGraph = { version: '2.0.0', robot: { id: 'test', name: 'Test' }, cores: {} };
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
