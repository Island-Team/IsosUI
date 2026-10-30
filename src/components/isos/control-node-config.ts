import type { NodeInstance } from '@/services/isos/node-graph';

export const DISPATCHER_PATH = 'cores/eos/layers/dispatcher/groups/control/nodes/command';

/** Keep the visible picker, typed data edge, and registry references in sync. */
export function withControlTarget(node: NodeInstance, targetPath: string, target: NodeInstance): Partial<NodeInstance> {
  const mode = String(node.settings?.movement_type || '');
  const modes = target.movement?.modes || [];
  const isPrimitive = node.node_type === 'eos.control.primitive@v1.0';
  const observationInput = target.node_type === 'eos.hardware.base@v1.0' ? 'base_observation' : 'manipulator_observation';
  return {
    settings: { ...node.settings, target: targetPath, ...(isPrimitive ? { movement_type: modes.includes(mode) ? mode : modes[0] || '' } : {}) },
    references: [targetPath, DISPATCHER_PATH],
    inputs: {
      status: { node: DISPATCHER_PATH, output: 'status' },
      [observationInput]: { node: targetPath, output: 'observation' },
    },
  };
}

/** Skill step order is meaningful; references are a de-duplicated dependency set. */
export function withSkillSteps(node: NodeInstance, steps: string[]): Partial<NodeInstance> {
  return {
    settings: { ...node.settings, steps },
    references: [DISPATCHER_PATH, ...new Set(steps)],
    inputs: { status: { node: DISPATCHER_PATH, output: 'status' } },
  };
}
