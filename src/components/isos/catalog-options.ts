import type { NodeOptions } from '@/services/isos/node-graph';

export interface OptionSnapshot { draft: string; options: NodeOptions }

export function optionResponseIsCurrent(requestId: number, latestRequestId: number, requestedDraft: string, currentDraft: string): boolean {
  return requestId === latestRequestId && requestedDraft === currentDraft;
}

export function pairedDeviceSettings(settings: Record<string, unknown>, value: string): Record<string, unknown> {
  return { ...settings, device_id: value, simulator_node: value };
}
