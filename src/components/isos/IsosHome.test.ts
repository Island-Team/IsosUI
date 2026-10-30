import { describe, expect, it, vi } from 'vitest';
vi.mock('../../services/isos/config-manager', () => ({ request: vi.fn() }));
import { requiredBackend } from '../../services/isos/node-graph';
import type { NodeGraph } from '@/services/isos/node-graph';

describe('Home package requirement', () => {
  it('reads the exact package version and scene from the graph backend node', () => {
    const graph: NodeGraph = { version: '2.0.0', robot: { id: 'robot', name: 'Robot' }, cores: { isos: { layers: { process: { groups: { backend: { nodes: { simulator: { id: 'simulator', node_type: 'isos.process.backend@v1.0', label: 'MuJoCo', description: '', settings: { package: 'island/mujoco-sim', version: '2.0.0', scene: 'navigation' } } } } } } } } } };
    expect(requiredBackend(graph)).toEqual({ id: 'island/mujoco-sim', version: '2.0.0', scene: 'navigation' });
  });
});
