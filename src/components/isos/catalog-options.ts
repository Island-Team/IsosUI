import type { NodeOptions } from '@/services/isos/node-graph';
import type { GraphNode } from './node-graph-edits';
import { settingOptionGroup, unavailableSelections } from './CatalogSelector';

export interface OptionSnapshot { draft: string; options: NodeOptions }

export function optionResponseIsCurrent(requestId: number, latestRequestId: number, requestedDraft: string, currentDraft: string): boolean {
  return requestId === latestRequestId && requestedDraft === currentDraft;
}

export function pairedDeviceSettings(settings: Record<string, unknown>, value: string): Record<string, unknown> {
  return { ...settings, device_id: value, simulator_node: value };
}

export function catalogSelectionBlocks(graphVersion: string | undefined, entries: GraphNode[], options: NodeOptions | null): boolean {
  if (graphVersion !== '0.1.0') return false;
  const selectors = entries.some((entry) => entry.definition?.settings.some((field) => field.selector) || (entry.definition?.lifecycle === 'adapter' && entry.node.adapter?.type === 'mujoco-v2'));
  if (!selectors && !unavailableSelections(options).length) return false;
  if (!options || unavailableSelections(options).length) return true;
  return entries.some((entry) => {
    if (entry.definition?.settings.some((field) => field.selector && (!settingOptionGroup(options, entry.path, field.name) || (field.required && !String(entry.node.settings?.[field.name] || '').trim())))) return true;
    if (entry.definition?.lifecycle !== 'adapter' || entry.node.adapter?.type !== 'mujoco-v2') return false;
    const settings = entry.node.adapter.settings;
    return !String(settings?.device_id || '').trim()
      || !String(settings?.simulator_node || '').trim()
      || !settingOptionGroup(options, entry.path, 'adapter.settings.device_id')
      || !settingOptionGroup(options, entry.path, 'adapter.settings.simulator_node')
      || settings?.device_id !== settings?.simulator_node;
  });
}
