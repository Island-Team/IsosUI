// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import type { NodeGraphDocument, ProcessStatus } from '../../services/isos/node-graph';

const stopMock = vi.fn(async () => ({ schema_version: '1.0.0', state: 'stopped', run_id: 'run-a', run_id_state: 'known', processes: [] }));
vi.mock('../../services/isos/node-graph', async (importOriginal) => {
  vi.stubGlobal('ISOSUI_API_ORIGIN', 'http://127.0.0.1:16000');
  return { ...(await importOriginal<typeof import('../../services/isos/node-graph')>()), controlProcesses: stopMock,
    getNodeGraph: async () => graph, getProcessStatus: async () => statusState };
});

const revision = 'a'.repeat(64);
const graph: NodeGraphDocument = { revision, graph: { version: '0.1.0', robot: { id: 'r', name: 'R' }, cores: { eos: { layers: {
  dispatcher: { groups: { base: { nodes: { velocity: { id: 'velocity', node_type: 'eos.dispatcher.primitive_base@v0.1', label: '', description: '', settings: { primitive_name: 'base.velocity', primitive_version: '1.0.0', movement_type: 'body_velocity' } } } } } },
  hardware: { groups: { base: { nodes: { drive: { id: 'drive', node_type: 'eos.hardware.base@v0.1', label: '', description: '', adapter: { type: 'mock-cxx' }, inputs: { command: [{ node: 'eos/dispatcher/base/velocity', output: 'command' }] }, movement: { modes: ['body_velocity'], limits: { max_linear_m_s: 0.5, max_angular_rad_s: 0.5, max_velocity_lease_ms: 300 } } } } } } },
} } } } };
const process: ProcessStatus = { schema_version: '1.0.0', state: 'running', run_id: 'run-a', run_id_state: 'known', saved_revision: revision, active_revision: 'b'.repeat(64), processes: [] };
let statusState = process;

it('keeps IsOS Stop reachable through EOS outage and stale revision', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container); const onStop = vi.fn();
  const { PrimitiveBaseCard } = await import('./PrimitiveBaseCard');
  await act(async () => root.render(<PrimitiveBaseCard lang="en" graph={graph} status={process} dirty readOnly readings={{}} clock={Date.now()} onStop={onStop} onOpenLogs={() => undefined} />));
  const invoke = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Invoke')!;
  const stop = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Stop deployment')!;
  expect(invoke.disabled).toBe(true);
  expect(stop.disabled).toBe(false);
  await act(async () => stop.click());
  expect(stopMock).toHaveBeenCalledWith('stop');
  expect(onStop).toHaveBeenCalled();
  expect(container.textContent).toContain('IsOS stop status: stopped');
  await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
});

it('sends once after a click and follows InProgress with the guarded public read', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  statusState = { ...process, active_revision: revision };
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as Record<string, unknown>; bodies.push(body);
    const result = body.op === 'time' ? { ok: true, monotonic_ns: 1_000_000_000 } :
      { ok: true, result: { command_id: body.op === 'primitive_typed' ? (body.header as { command_id: string }).command_id : body.command_id,
        status: body.op === 'primitive_typed' ? 'InProgress' : 'Completed', reason: null } };
    return { ok: true, status: 200, text: async () => JSON.stringify(result) };
  }));
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container);
  const { PrimitiveBaseCard } = await import('./PrimitiveBaseCard');
  await act(async () => root.render(<PrimitiveBaseCard lang="en" graph={graph} status={statusState} dirty={false} readOnly={false}
    readings={{ 'eos/hardware/base/drive': { status: { state: 'ready' }, statusAt: Date.now(), health: { state: 'healthy' }, healthAt: Date.now() } }}
    clock={Date.now()} onStop={() => undefined} onOpenLogs={() => undefined} />));
  const invoke = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Invoke')!;
  expect(invoke.disabled).toBe(false);
  await act(async () => invoke.click());
  expect(bodies.filter((body) => body.op === 'primitive_typed')).toHaveLength(1);
  expect(container.textContent).toContain('InProgress');
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1100)); });
  expect(bodies.filter((body) => body.op === 'result')).toHaveLength(1);
  expect(container.textContent).toContain('Completed');
  expect((bodies.find((body) => body.op === 'result'))).toEqual({ op: 'result', command_id: (bodies.find((body) => body.op === 'primitive_typed')!.header as { command_id: string }).command_id, active_revision: revision });
  await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
});
