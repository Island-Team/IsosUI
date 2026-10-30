import type { DataTypeDefinition } from '@/services/isos/node-graph';
import type { GraphNode } from './node-graph-edits';

export interface EdgePorts { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }
export interface EdgeContracts { sourceType: string; targetType: string; sourceIdl?: DataTypeDefinition; targetIdl?: DataTypeDefinition }

/** Resolve both catalog ends; mismatched graph declarations stay visible for diagnosis. */
export function edgeContracts(entries: GraphNode[], edge: EdgePorts, types: DataTypeDefinition[]): EdgeContracts {
  const sourceName = edge.sourceHandle?.replace(/^out:/, '') || '';
  const targetName = edge.targetHandle?.replace(/^in:/, '') || '';
  const sourceType = entries.find((entry) => entry.path === edge.source)?.definition?.outputs.find((port) => port.name === sourceName)?.data_type || '';
  const targetType = entries.find((entry) => entry.path === edge.target)?.definition?.inputs.find((port) => port.name === targetName)?.data_type || '';
  const find = (name: string): DataTypeDefinition | undefined => types.find((item) => item.id === name || item.id.split('@')[0] === name);
  return { sourceType, targetType, sourceIdl: find(sourceType), targetIdl: find(targetType) };
}
