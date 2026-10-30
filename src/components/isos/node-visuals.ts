import type { NodeInstance, NodeTypeDefinition } from '@/services/isos/node-graph';

export type NodeFamily = 'process' | 'camera' | 'base' | 'manipulator' | 'dispatcher' | 'manual' | 'primitive' | 'skill' | 'egia-data' | 'egia-process' | 'software' | 'unknown';
export type PortFamily = 'camera' | 'observation' | 'movement' | 'request' | 'outcome' | 'health' | 'status' | 'context' | 'plan' | 'other';

export function nodeFamily(definition?: NodeTypeDefinition): NodeFamily {
  if (!definition) return 'unknown';
  if (definition.core === 'isos') return 'process';
  if (definition.core === 'egia') return definition.group.includes('data') || /source|context/.test(definition.id) ? 'egia-data' : 'egia-process';
  if (definition.id === 'eos.control.manual@v1.0') return 'manual';
  if (definition.id === 'eos.control.primitive@v1.0') return 'primitive';
  if (definition.id === 'eos.control.skill@v1.0') return 'skill';
  if (definition.group === 'camera' || definition.kind === 'camera') return 'camera';
  if (definition.group === 'base' || definition.kind === 'base') return 'base';
  if (definition.group === 'manipulator' || definition.kind === 'manipulator') return 'manipulator';
  if (definition.layer === 'dispatcher' || definition.group === 'dispatcher') return 'dispatcher';
  return definition.lifecycle === 'process' ? 'process' : 'software';
}

export function portFamily(dataType: string): PortFamily {
  const value = dataType.toLowerCase();
  if (/camera|frame|depth|image/.test(value)) return 'camera';
  if (/movement|command/.test(value)) return 'movement';
  if (/observation|pose|state/.test(value)) return 'observation';
  if (/control.request|request/.test(value)) return 'request';
  if (/outcome|result/.test(value)) return 'outcome';
  if (/health/.test(value)) return 'health';
  if (/status/.test(value)) return 'status';
  if (/context|snapshot/.test(value)) return 'context';
  if (/plan|proposal/.test(value)) return 'plan';
  return 'other';
}

export function nodeSummary(definition: NodeTypeDefinition | undefined, node: NodeInstance): string[] {
  if (!definition) return [];
  if (definition.id === 'eos.process.backend@v1.0') {
    return ['package', 'version', 'scene', 'socket'].flatMap((key) => node.settings?.[key] === undefined ? [] : [`${key}: ${String(node.settings[key])}`]).slice(0, 3);
  }
  if (definition.id === 'eos.control.manual@v1.0' || definition.id === 'eos.control.primitive@v1.0') {
    const target = String(node.settings?.target || '').split('/').pop();
    return [target ? `target: ${target}` : '', node.settings?.movement_type ? `mode: ${node.settings.movement_type}` : '', `connections: ${Object.keys(node.inputs || {}).length}`].filter(Boolean);
  }
  if (definition.id === 'eos.control.skill@v1.0') return [`steps: ${Array.isArray(node.settings?.steps) ? node.settings.steps.length : 0}`, `connections: ${Object.keys(node.inputs || {}).length}`];
  if (definition.core === 'isos' && definition.group === 'component') {
    const command = node.settings?.command;
    const executable = Array.isArray(command) && typeof command[0] === 'string' ? command[0].split('/').pop() : undefined;
    return [executable ? `exec: ${executable}` : '', node.settings?.ready_unix ? `ready: ${node.settings.ready_unix}` : node.settings?.ready_tcp ? `ready: ${node.settings.ready_tcp}` : '', `depends on: ${Array.isArray(node.settings?.depends_on) ? node.settings.depends_on.length : 0}`].filter(Boolean);
  }
  const settings = definition.lifecycle === 'adapter' ? node.adapter?.settings : node.settings;
  const keys = definition.core === 'isos' ? ['package', 'version', 'scene', 'socket']
    : definition.kind === 'camera' ? ['device_id', 'socket_path']
      : definition.kind === 'base' || definition.kind === 'manipulator' ? ['device_id', 'socket_path']
        : ['mode', 'backend'];
  const summary = keys.flatMap((key) => settings?.[key] === undefined ? [] : [`${key}: ${String(settings[key])}`]).slice(0, 3);
  if (definition.kind === 'camera' && node.capabilities?.length) summary.push(`modes: ${node.capabilities.join(', ')}`);
  if ((definition.kind === 'base' || definition.kind === 'manipulator') && node.movement?.modes?.length) summary.push(`modes: ${node.movement.modes.join(', ')}`);
  if (definition.layer === 'dispatcher' || definition.core === 'egia') summary.push(`connections: ${Object.keys(node.inputs || {}).length}`);
  return summary.slice(0, 3);
}
