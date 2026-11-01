// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import type { NodeGraphDocument, ProcessStatus } from '../../services/isos/node-graph';

const stopMock = vi.fn(async () => ({ schema_version: '1.0.0', state: 'stopped', run_id: 'run-a', run_id_state: 'known', processes: [] }));
vi.mock('../../services/isos/node-graph', async (importOriginal) => {
  vi.stubGlobal('ISOSUI_API_ORIGIN', 'http://127.0.0.1:16000');
  return { ...(await importOriginal<typeof import('../../services/isos/node-graph')>()), controlProcesses: stopMock,
    getNodeGraph: async () => graph, getProcessStatus: async () => statusRead() };
});

const revision = 'a'.repeat(64);
const graph: NodeGraphDocument = { revision, graph: { version: '0.1.0', robot: { id: 'r', name: 'R' }, cores: { eos: { layers: {
  dispatcher: { groups: { base: { nodes: { velocity: { id: 'velocity', node_type: 'eos.dispatcher.primitive_base@v0.1', label: '', description: '', settings: { primitive_name: 'base.velocity', primitive_version: '1.0.0', movement_type: 'body_velocity' } } } } } },
  hardware: { groups: { base: { nodes: { drive: { id: 'drive', node_type: 'eos.hardware.base@v0.1', label: '', description: '', adapter: { type: 'mock-cxx' }, inputs: { command: [{ node: 'eos/dispatcher/base/velocity', output: 'command' }] }, movement: { modes: ['body_velocity'], limits: { max_linear_m_s: 0.5, max_angular_rad_s: 0.5, max_velocity_lease_ms: 300 } } } } } } },
} } } } };
const process: ProcessStatus = { schema_version: '1.0.0', state: 'running', run_id: 'run-a', run_id_state: 'known', saved_revision: revision, active_revision: 'b'.repeat(64), processes: [] };
let statusState = process;
let statusRead = async (): Promise<ProcessStatus> => statusState;
const ready = () => ({ 'eos/hardware/base/drive': { status: { state: 'ready' }, statusAt: Date.now(), health: { state: 'healthy' }, healthAt: Date.now() } });
const response = (value: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(value) });

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
  statusRead = async () => statusState;
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
    readings={ready()}
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

it('does not poll during sending or let a late send reply overwrite an old-run seal', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  statusState = { ...process, active_revision: revision }; statusRead = async () => statusState;
  let resolveSend!: (value: ReturnType<typeof response>) => void;
  const pendingSend = new Promise<ReturnType<typeof response>>((resolve) => { resolveSend = resolve; });
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as Record<string, unknown>; bodies.push(body);
    if (body.op === 'time') return response({ ok: true, monotonic_ns: 1_000_000_000 });
    if (body.op === 'primitive_typed') return pendingSend;
    return response({ ok: true, result: { command_id: body.command_id, status: 'Completed', reason: null } });
  }));
  const container = document.createElement('div'); document.body.appendChild(container); const root = createRoot(container);
  const { PrimitiveBaseCard } = await import('./PrimitiveBaseCard');
  const render = (status: ProcessStatus) => <PrimitiveBaseCard lang="en" graph={graph} status={status} dirty={false} readOnly={false} readings={ready()} clock={Date.now()} onStop={() => undefined} onOpenLogs={() => undefined} />;
  await act(async () => root.render(render(statusState)));
  await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Invoke')!.click());
  expect(container.textContent).toContain('Sending (browser)');
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1100)); });
  expect(bodies.filter((body) => body.op === 'result')).toHaveLength(0);
  statusState = { ...statusState, saved_revision: 'b'.repeat(64) };
  await act(async () => root.render(render(statusState)));
  expect(container.textContent).toContain('Old deployment run or revision.');
  await act(async () => resolveSend(response({ ok: true, result: { command_id: (bodies.find((body) => body.op === 'primitive_typed')!.header as { command_id: string }).command_id, status: 'Completed', reason: null } })));
  expect(container.textContent).not.toContain('Owner status: Completed');
  expect(container.textContent).toContain('Binding: eos/dispatcher/base/velocity');
  await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
});

it('marks a terminal owner result unavailable after run rotation and permits a fresh command', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  statusState = { ...process, active_revision: revision }; statusRead = async () => statusState;
  const sent: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { op: string; header?: { command_id: string } };
    if (body.op === 'time') return response({ ok: true, monotonic_ns: 1_000_000_000 });
    if (body.op !== 'primitive_typed') throw new Error('terminal results must not be polled');
    sent.push(body.header!.command_id);
    return response({ ok: true, result: { command_id: body.header!.command_id, status: 'OutcomeUnknown', reason: 'journal uncertain' } });
  }));
  const container = document.createElement('div'); document.body.appendChild(container); const root = createRoot(container);
  const { PrimitiveBaseCard } = await import('./PrimitiveBaseCard');
  const render = (status: ProcessStatus | null = statusState) => <PrimitiveBaseCard lang="en" graph={graph} status={status} dirty={false} readOnly={false} readings={ready()} clock={Date.now()} onStop={() => undefined} onOpenLogs={() => undefined} />;
  await act(async () => root.render(render()));
  await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Invoke')!.click());
  expect(container.textContent).toContain('Owner status: OutcomeUnknown');
  expect(container.textContent).toContain(sent[0]);
  await act(async () => root.render(render(null)));
  expect(container.textContent).toContain('IsOS run identity unavailable.');
  expect([...container.querySelectorAll('button')].find((button) => button.textContent === 'Refresh result')).toBeUndefined();
  statusState = { ...statusState, run_id: 'run-b' };
  await act(async () => root.render(render()));
  expect(container.textContent).toContain('Owner status: OutcomeUnknown');
  expect(container.textContent).toContain('Unavailable for this run');
  expect(container.textContent).toContain(sent[0]);
  expect([...container.querySelectorAll('button')].find((button) => button.textContent === 'Refresh result')).toBeUndefined();
  await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Invoke')!.click());
  expect(sent).toHaveLength(2);
  expect(sent[1]).not.toBe(sent[0]);
  expect(container.textContent).toContain(sent[1]);
  expect(container.textContent).not.toContain(sent[0]);
  await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
});

it('seals an InProgress record on Stop and ignores its late result read', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  statusState = { ...process, active_revision: revision }; statusRead = async () => statusState;
  let resolveRead!: (value: ReturnType<typeof response>) => void;
  const pendingRead = new Promise<ReturnType<typeof response>>((resolve) => { resolveRead = resolve; });
  const sent: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { op: string; header?: { command_id: string } };
    if (body.op === 'time') return response({ ok: true, monotonic_ns: 1_000_000_000 });
    if (body.op === 'primitive_typed') { sent.push(body.header!.command_id); return response({ ok: true, result: { command_id: body.header!.command_id, status: 'InProgress', reason: null } }); }
    return pendingRead;
  }));
  const container = document.createElement('div'); document.body.appendChild(container); const root = createRoot(container);
  const { PrimitiveBaseCard } = await import('./PrimitiveBaseCard');
  const render = () => <PrimitiveBaseCard lang="en" graph={graph} status={statusState} dirty={false} readOnly={false} readings={ready()} clock={Date.now()} onStop={() => undefined} onOpenLogs={() => undefined} />;
  await act(async () => root.render(render()));
  await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Invoke')!.click());
  expect(container.textContent).toContain('Owner status: InProgress');
  await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Refresh result')!.click());
  await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Stop deployment')!.click());
  expect(container.textContent).toContain('Owner status: InProgress');
  expect(container.textContent).toContain('Unavailable for this run');
  expect(container.textContent).toContain(sent[0]);
  await act(async () => resolveRead(response({ ok: true, result: { command_id: sent[0], status: 'Completed', reason: null } })));
  expect(container.textContent).not.toContain('Owner status: Completed');
  statusState = { ...statusState, run_id: 'run-b' };
  await act(async () => root.render(render()));
  expect(container.textContent).toContain('Unavailable for this run');
  expect([...container.querySelectorAll('button')].find((button) => button.textContent === 'Invoke')!.disabled).toBe(false);
  await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
});

it('reads after a lost send once at a time and rechecks IsOS after the read', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  statusState = { ...process, active_revision: revision }; statusRead = async () => statusState;
  const bodies: Record<string, unknown>[] = [];
  let resolveRead!: (value: ReturnType<typeof response>) => void;
  const pendingRead = new Promise<ReturnType<typeof response>>((resolve) => { resolveRead = resolve; });
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as Record<string, unknown>; bodies.push(body);
    if (body.op === 'time') return response({ ok: true, monotonic_ns: 1_000_000_000 });
    if (body.op === 'primitive_typed') throw new Error('lost send response');
    return pendingRead;
  }));
  const container = document.createElement('div'); document.body.appendChild(container); const root = createRoot(container);
  const { PrimitiveBaseCard } = await import('./PrimitiveBaseCard');
  await act(async () => root.render(<PrimitiveBaseCard lang="en" graph={graph} status={statusState} dirty={false} readOnly={false} readings={ready()} clock={Date.now()} onStop={() => undefined} onOpenLogs={() => undefined} />));
  await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Invoke')!.click());
  expect(container.textContent).toContain('EOS bridge unavailable.');
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1100)); });
  expect(bodies.filter((body) => body.op === 'result')).toHaveLength(1);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 2200)); });
  expect(bodies.filter((body) => body.op === 'result')).toHaveLength(1);
  statusState = { ...statusState, run_id: 'run-b' };
  await act(async () => resolveRead(response({ ok: true, result: { command_id: (bodies.find((body) => body.op === 'result')!.command_id), status: 'Completed', reason: null } })));
  expect(container.textContent).toContain('Old deployment run or revision.');
  expect(container.textContent).not.toContain('Owner status: Completed');
  expect(bodies.filter((body) => body.op === 'primitive_typed')).toHaveLength(1);
  await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
});

it('pauses a hidden InProgress command at the 60-second bound', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-02T00:00:00Z'));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  statusState = { ...process, active_revision: revision }; statusRead = async () => statusState;
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as Record<string, unknown>; bodies.push(body);
    return response(body.op === 'time' ? { ok: true, monotonic_ns: 1_000_000_000 } :
      { ok: true, result: { command_id: body.op === 'primitive_typed' ? (body.header as { command_id: string }).command_id : body.command_id, status: 'InProgress', reason: null } });
  }));
  const container = document.createElement('div'); document.body.appendChild(container); const root = createRoot(container);
  const { PrimitiveBaseCard } = await import('./PrimitiveBaseCard');
  await act(async () => root.render(<PrimitiveBaseCard lang="en" graph={graph} status={statusState} dirty={false} readOnly={false} readings={ready()} clock={Date.now()} onStop={() => undefined} onOpenLogs={() => undefined} />));
  await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Invoke')!.click());
  expect(container.textContent).toContain('InProgress');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
  expect(bodies.filter((body) => body.op === 'result')).toHaveLength(0);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(container.textContent).toContain('automatic reads paused');
  expect(bodies.filter((body) => body.op === 'result')).toHaveLength(0);
  await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals();
});

it('selects an eligible mock binding after an unqualified MuJoCo binding', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  statusState = { ...process, active_revision: revision };
  const mixed = JSON.parse(JSON.stringify(graph)) as NodeGraphDocument;
  const eos = mixed.graph.cores.eos.layers;
  eos.dispatcher.groups.base.nodes = { a_sim: { id: 'a_sim', node_type: 'eos.dispatcher.primitive_base@v0.1', label: '', description: '', settings: { primitive_name: 'base.velocity', primitive_version: '1.0.0', movement_type: 'body_velocity' } }, ...eos.dispatcher.groups.base.nodes };
  eos.hardware.groups.base.nodes.sim = { ...eos.hardware.groups.base.nodes.drive, id: 'sim', adapter: { type: 'mujoco-v2' }, inputs: { command: [{ node: 'eos/dispatcher/base/a_sim', output: 'command' }] } };
  const container = document.createElement('div'); document.body.appendChild(container); const root = createRoot(container);
  const { PrimitiveBaseCard } = await import('./PrimitiveBaseCard');
  await act(async () => root.render(<PrimitiveBaseCard lang="en" graph={mixed} status={statusState} dirty={false} readOnly={false} readings={ready()} clock={Date.now()} onStop={() => undefined} onOpenLogs={() => undefined} />));
  expect(container.textContent).toContain('Binding: eos/dispatcher/base/velocity');
  expect(container.textContent).not.toContain('eos/dispatcher/base/a_sim');
  expect([...container.querySelectorAll('button')].find((button) => button.textContent === 'Invoke')!.disabled).toBe(false);
  await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
});

it('keeps an admitted legacy v1.0 mock binding eligible through the same typed card', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  statusState = { ...process, active_revision: revision };
  const legacy = JSON.parse(JSON.stringify(graph)) as NodeGraphDocument;
  legacy.graph.cores.eos.layers.dispatcher.groups.base.nodes.velocity.node_type = 'eos.dispatcher.primitive_base@v1.0';
  legacy.graph.cores.eos.layers.hardware.groups.base.nodes.drive.node_type = 'eos.hardware.base@v1.0';
  const container = document.createElement('div'); document.body.appendChild(container); const root = createRoot(container);
  const { PrimitiveBaseCard } = await import('./PrimitiveBaseCard');
  await act(async () => root.render(<PrimitiveBaseCard lang="cn" graph={legacy} status={statusState} dirty={false} readOnly={false} readings={ready()} clock={Date.now()} onStop={() => undefined} onOpenLogs={() => undefined} />));
  expect([...container.querySelectorAll('button')].find((button) => button.textContent === '调用')!.disabled).toBe(false);
  expect(container.textContent).toContain('eos/dispatcher/base/velocity');
  await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
});
