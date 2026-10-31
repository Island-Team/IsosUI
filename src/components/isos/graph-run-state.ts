import type { NodeGraph } from '@/services/isos/node-graph';

const PROCESS_IDS = ['eos', 'bridge', 'config'] as const;

function commands(graph: NodeGraph, id: string): unknown {
  return graph.cores.isos?.layers.process?.groups.component?.nodes[id]?.settings?.command;
}

/** Preserve graph edits while replacing only the selected executable commands. */
export function rebaseSelectedBuild(saved: NodeGraph, draft: NodeGraph, selected: NodeGraph): NodeGraph | null {
  if (PROCESS_IDS.some((id) => JSON.stringify(commands(saved, id)) !== JSON.stringify(commands(draft, id)))) return null;
  const next = structuredClone(draft);
  for (const id of PROCESS_IDS) {
    const node = next.cores.isos?.layers.process?.groups.component?.nodes[id];
    if (!node) return null;
    node.settings = { ...node.settings, command: commands(selected, id) };
  }
  return next;
}
