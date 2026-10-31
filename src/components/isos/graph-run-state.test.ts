import { describe, expect, it } from 'vitest';
import type { NodeGraph } from '@/services/isos/node-graph';
import { rebaseSelectedBuild } from './graph-run-state';

const graph = (command: string): NodeGraph => ({ version: '2.0.0', robot: { id: 'robot', name: 'Robot' }, cores: { isos: { layers: { process: { groups: { component: { nodes: Object.fromEntries(['eos', 'bridge', 'config'].map((id) => [id, { id, node_type: 'isos.process.component@v1.0', label: id, description: '', settings: { command: [command, id] } }])) } } } } } } });

describe('selected EOS build rebase', () => {
  it('keeps ordinary draft edits and uses the newly selected commands', () => {
    const saved = graph('/old');
    const draft = structuredClone(saved); draft.robot.name = 'Edited';
    const selected = graph('/new');
    const result = rebaseSelectedBuild(saved, draft, selected);
    expect(result?.robot.name).toBe('Edited');
    expect(result?.cores.isos.layers.process.groups.component.nodes.eos.settings?.command).toEqual(['/new', 'eos']);
  });
  it('does not overwrite a draft command edit', () => {
    const saved = graph('/old'); const draft = graph('/custom');
    expect(rebaseSelectedBuild(saved, draft, graph('/new'))).toBeNull();
  });
});
