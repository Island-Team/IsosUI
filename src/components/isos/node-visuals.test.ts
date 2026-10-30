import { describe, expect, it } from 'vitest';
import { nodeVisualStyle, portFamily, nodeSummary } from './node-visuals';
import type { NodeTypeDefinition } from '@/services/isos/node-graph';

const definition = (core: string, layer: string, group: string): NodeTypeDefinition => ({ id: `${core}.${layer}.${group}@v1.0`, core, layer, group, kind: 'software', lifecycle: 'internal', capabilities: [], settings: [], inputs: [], outputs: [] });
describe('node visual semantics', () => {
  it('keeps port colors tied to typed payloads', () => {
    expect(portFamily('CameraFrame')).toBe('camera');
    expect(portFamily('BaseMovementCommand')).toBe('movement');
    expect(portFamily('HealthSample')).toBe('health');
  });
  it('uses a stable layer hue and group shade without changing port semantics', () => {
    const camera = nodeVisualStyle(definition('eos', 'hardware', 'camera'));
    const mujoco = nodeVisualStyle(definition('eos', 'hardware', 'mujoco'));
    expect(camera['--node-layer']).toBe(mujoco['--node-layer']);
    expect(camera['--node-group-light']).not.toBe(mujoco['--node-group-light']);
    expect(nodeVisualStyle(definition('eos', 'hardware', 'mujoco'))).toEqual(mujoco);
    expect(nodeVisualStyle(definition('egia', 'common', 'mujoco'))['--node-layer']).not.toBe(mujoco['--node-layer']);
    expect(mujoco['--node-group-dark']).toMatch(/^hsl\(194 /);
    expect(portFamily('CameraFrame')).toBe('camera');
  });
  it('only shows relevant configuration, not payloads', () => {
    expect(nodeSummary({ ...definition('eos', 'process', 'backend'), lifecycle: 'process' }, { id: 'sim', node_type: 'eos.process.backend@v1.0', label: 'sim', description: '', settings: { package: 'island/mujoco-sim', scene: 'default', payload: 'hidden' } })).toEqual(['package: island/mujoco-sim', 'scene: default']);
    expect(nodeSummary({ ...definition('eos', 'process', 'mujoco'), lifecycle: 'process' }, { id: 'sim', node_type: 'eos.process.mujoco@v1.0', label: 'sim', description: '', package: { id: 'island/mujoco-sim', version: '2.0.0' }, settings: { scene: 'default', socket: '/tmp/mujoco.sock', payload: 'hidden' } })).toEqual(['scene: default', 'socket: /tmp/mujoco.sock']);
  });
  it('summarizes hardware adapter settings and modes', () => {
    const camera = { ...definition('eos', 'hardware', 'camera'), kind: 'camera' as const, lifecycle: 'adapter' as const };
    const node = { id: 'front', node_type: camera.id, label: 'Front', description: '', capabilities: ['rgb8'], adapter: { type: 'mujoco-v2', settings: { device_id: 'cam-0', socket_path: '/run/isos/mujoco.sock' } } };
    expect(nodeSummary(camera, node)).toEqual(['device_id: cam-0', 'socket_path: /run/isos/mujoco.sock', 'modes: rgb8']);
  });
});
