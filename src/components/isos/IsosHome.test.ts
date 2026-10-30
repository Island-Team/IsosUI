import { describe, expect, it, vi } from 'vitest';
vi.mock('../../services/isos/config-manager', () => ({ request: vi.fn() }));
import { graphWithBackendScene, requiredBackend } from '../../services/isos/node-graph';
import type { NodeGraph } from '@/services/isos/node-graph';

describe('Home package requirement', () => {
  it('reads the exact package version and scene from the graph backend node', () => {
    const graph: NodeGraph = { version: '2.0.0', robot: { id: 'robot', name: 'Robot' }, cores: { eos: { layers: { process: { groups: { backend: { nodes: { simulator: { id: 'simulator', node_type: 'eos.process.backend@v1.0', label: 'MuJoCo', description: '', settings: { package: 'island/mujoco-sim', version: '2.0.0', scene: 'navigation' } } } } } } } } } };
    expect(requiredBackend(graph)).toEqual({ id: 'island/mujoco-sim', version: '2.0.0', scene: 'navigation' });
  });
  it('changes only the matching backend scene without mutating the loaded graph', () => {
    const backend = { id: 'simulator', node_type: 'eos.process.backend@v1.0', label: 'MuJoCo', description: '', settings: { package: 'island/mujoco-sim', version: '2.0.0', scene: 'default', socket: '/tmp/sim.sock' } };
    const graph: NodeGraph = { version: '2.0.0', robot: { id: 'robot', name: 'Robot' }, cores: { eos: { layers: { process: { groups: { backend: { nodes: { simulator: backend } } } } } } } };
    const updated = graphWithBackendScene(graph, 'island/mujoco-sim', '2.0.0', 'navigation');
    expect(requiredBackend(updated)?.scene).toBe('navigation');
    expect(updated.cores.eos.layers.process.groups.backend.nodes.simulator.settings?.socket).toBe('/tmp/sim.sock');
    expect(requiredBackend(graph)?.scene).toBe('default');
    expect(() => graphWithBackendScene(graph, 'island/mujoco-sim', '1.0.1', 'navigation')).toThrow('found 0');
  });
});
