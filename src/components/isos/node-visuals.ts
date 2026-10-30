import type { NodeInstance, NodeTypeDefinition, PortDefinition } from '@/services/isos/node-graph';

export type PortFamily = 'camera' | 'observation' | 'movement' | 'request' | 'outcome' | 'health' | 'status' | 'context' | 'plan' | 'other';

/** Stable layer hue with a bounded group shade for both editor themes. */
export function nodeVisualStyle(definition?: NodeTypeDefinition): Record<string, string> {
  if (!definition) return { '--node-layer': '#64748b', '--node-group-light': '#475569', '--node-group-dark': '#94a3b8' };
  const hues: Record<string, number> = { process: 215, hardware: 194, dispatcher: 224, control: 265, common: 145, data: 145 };
  const hash = [...definition.layer].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0);
  const hue = hues[definition.layer] ?? hash % 360;
  const groupHash = [...definition.group].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0);
  const step = groupHash % 5;
  return {
    '--node-layer': `hsl(${hue} 65% 46%)`,
    '--node-group-light': `hsl(${hue} ${58 + step * 3}% ${34 + step * 3}%)`,
    '--node-group-dark': `hsl(${hue} ${62 + step * 3}% ${65 + step * 3}%)`,
  };
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

/** Independent visual channels: hue is rate, border is community, pattern is payload class. */
export function interfaceVisual(port?: PortDefinition): { className: string; style: Record<string, string>; label: string } {
  const rate = port?.expected_rate_hz;
  const known = typeof rate === 'number' && Number.isFinite(rate) && rate > 0;
  const unit = known ? Math.max(0, Math.min(1, (Math.log10(rate) + 1) / (Math.log10(60) + 1))) : 0;
  const hue = Math.round(280 * (1 - unit));
  const dataClass = (port?.data_class || portFamily(port?.data_type || '')).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const transport = (port?.transport || 'in_process').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return { className: `node-graph-edge--${dataClass} node-graph-edge-transport--${transport}`, style: { '--wire': known ? `hsl(${hue} 82% 52%)` : '#64748b' }, label: `${known ? `${rate} Hz` : 'Rate unknown'} · ${transport} · ${dataClass}` };
}

export function nodeSummary(definition: NodeTypeDefinition | undefined, node: NodeInstance): string[] {
  if (!definition) return [];
  if (definition.id === 'eos.process.mujoco@v1.0') {
    return ['scene', 'socket'].flatMap((key) => node.settings?.[key] === undefined ? [] : [`${key}: ${String(node.settings[key])}`]).slice(0, 3);
  }
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
