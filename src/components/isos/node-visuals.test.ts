import { describe, expect, it } from 'vitest';
import { nodeFamily, portFamily, nodeSummary } from './node-visuals';
import type { NodeTypeDefinition } from '@/services/isos/node-graph';

const definition = (core: string, layer: string, group: string): NodeTypeDefinition => ({ id: `${core}.${layer}.${group}@v1.0`, core, layer, group, kind: 'software', lifecycle: 'internal', capabilities: [], settings: [], inputs: [], outputs: [] });
describe('node visual semantics', () => {
  it('separates node ownership from payload types', () => {
    expect(nodeFamily(definition('isos', 'process', 'backend'))).toBe('process');
    expect(nodeFamily(definition('egia', 'common', 'data'))).toBe('egia-data');
    expect(nodeFamily(definition('eos', 'dispatcher', 'route'))).toBe('dispatcher');
    expect(portFamily('CameraFrame')).toBe('camera');
    expect(portFamily('BaseMovementCommand')).toBe('movement');
    expect(portFamily('HealthSample')).toBe('health');
  });
  it('only shows relevant configuration, not payloads', () => {
    expect(nodeSummary(definition('isos', 'process', 'backend'), { id: 'sim', node_type: 'isos.process.backend@v1.0', label: 'sim', description: '', settings: { package: 'island/mujoco-sim', scene: 'default', payload: 'hidden' } })).toEqual(['package: island/mujoco-sim', 'scene: default']);
  });
  it('summarizes hardware adapter settings and modes', () => {
    const camera = { ...definition('eos', 'hardware', 'camera'), kind: 'camera' as const, lifecycle: 'adapter' as const };
    const node = { id: 'front', node_type: camera.id, label: 'Front', description: '', capabilities: ['rgb8'], adapter: { type: 'mujoco-v2', settings: { device_id: 'cam-0', socket_path: '/run/isos/mujoco.sock' } } };
    expect(nodeSummary(camera, node)).toEqual(['device_id: cam-0', 'socket_path: /run/isos/mujoco.sock', 'modes: rgb8']);
  });
});
