import React, { useEffect, useRef, useState } from 'react';
import type { Language } from '../../types';
import { controlProcesses, getNodeGraph, getProcessStatus, type NodeGraphDocument, type ProcessStatus } from '../../services/isos/node-graph';
import { eosMonotonicTime, resolveBaseBindings, sendFence, validBodyVelocity, sendPrimitiveBase, type BodyVelocity } from '../../services/eos/primitive-command';
import { readPrimitiveResult, ResultClientError } from '../../services/eos/primitive-result';
import { acceptPrimitiveResult, newPrimitiveRecord, pollAllowed, primitiveError, resultFence, type PrimitiveRecord } from './primitive-result-state';
import { monitorBadge, type AdapterStatus } from './eos-control-model';

interface Reading { status?: AdapterStatus; statusAt?: number; health?: { state: string }; healthAt?: number }
interface Props { lang: Language; graph: NodeGraphDocument | null; status: ProcessStatus | null; dirty: boolean; readOnly: boolean;
  readings: Record<string, Reading>; clock: number; onStop: (status: ProcessStatus) => void; onOpenLogs: () => void }
const copy = {
  en: { title: 'Active base primitive', missing: 'No supported active base.velocity binding has one base target.', gated: 'Invoke requires a current managed run, ready mock target and valid limits. MuJoCo movement awaits R06.', invoke: 'Invoke', stop: 'Stop deployment', stopping: 'Stopping…', logs: 'Current run logs', refresh: 'Refresh result', command: 'Command ID', revision: 'Active revision', binding: 'Binding', target: 'Target', result: 'Owner status', sending: 'Sending (browser)', following: 'In progress', unavailable: 'Unavailable', paused: 'In progress; automatic reads paused', updated: 'Last update', stopStatus: 'IsOS stop status', lease: 'Lease', invalid: 'Enter values within the hardware limits.' },
  cn: { title: '活动底盘原语', missing: '没有单一底盘目标的受支持活动 base.velocity 绑定。', gated: '调用需要当前受管运行、就绪的模拟目标和有效限值。MuJoCo 运动等待 R06。', invoke: '调用', stop: '停止部署', stopping: '正在停止…', logs: '当前运行日志', refresh: '刷新结果', command: '命令 ID', revision: '活动修订', binding: '绑定', target: '目标', result: '所有者状态', sending: '发送中（浏览器）', following: '执行中', unavailable: '不可用', paused: '仍在执行；自动读取已暂停', updated: '最近更新', stopStatus: 'IsOS 停止状态', lease: '有效期', invalid: '参数超出硬件限值。' },
};
function errorText(error: unknown): { kind: 'transport' | 'owner' | 'protocol' | 'validation'; message: string } {
  return error instanceof ResultClientError ? { kind: error.kind, message: error.message } : { kind: 'transport', message: 'Service unavailable.' };
}
export function PrimitiveBaseCard({ lang, graph, status, dirty, readOnly, readings, clock, onStop, onOpenLogs }: Props): React.ReactElement {
  const c = copy[lang];
  const binding = graph ? resolveBaseBindings(graph.graph)[0] : undefined;
  const [value, setValue] = useState<BodyVelocity>({ type: 'body_velocity', x_m_s: 0, y_m_s: 0, yaw_rad_s: 0, valid_for_ms: 100 });
  const [record, setRecord] = useState<PrimitiveRecord | null>(null);
  const [stopResult, setStopResult] = useState('');
  const [stopping, setStopping] = useState(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const sequence = useRef(0);
  const recordRef = useRef<PrimitiveRecord | null>(null);
  const update = (next: PrimitiveRecord): void => { recordRef.current = next; setRecord(next); };
  const cancel = (): void => { generation.current += 1; controller.current?.abort(); controller.current = null; };
  useEffect(() => () => cancel(), []);
  useEffect(() => { cancel(); if (recordRef.current && recordRef.current.bindingPath !== binding?.path) update(primitiveError(recordRef.current, 'old_run', 'Binding selection changed.')); }, [binding?.path]);
  useEffect(() => { const current = recordRef.current; if (current && status && resultFence(current, status) === 'old_run') { cancel(); update(primitiveError(current, 'old_run', 'Old deployment run or revision.')); } }, [status?.run_id, status?.active_revision, status?.state]);
  const targetLive = binding && monitorBadge(readings[binding.targetPath], clock) === 'live';
  const qualified = binding?.target.adapter?.type === 'mock-cxx';
  const canInvoke = Boolean(binding && qualified && targetLive && graph && sendFence(graph.revision, status, dirty, readOnly) && validBodyVelocity(value, binding.target) && record?.phase !== 'sending' && !stopping);
  const follow = async (manual = false): Promise<void> => {
    const current = recordRef.current;
    if (!current || busy.current || current.phase === 'terminal' || (!manual && !pollAllowed(current, Date.now(), document.visibilityState === 'visible', false))) return;
    busy.current = true;
    const token = generation.current;
    const abort = new AbortController(); controller.current = abort;
    try {
      const fresh = await getProcessStatus(abort.signal);
      if (token !== generation.current || abort.signal.aborted) return;
      const fence = resultFence(current, fresh);
      if (fence !== 'current') { update(primitiveError(current, fence === 'old_run' ? 'old_run' : 'transport', fence === 'old_run' ? 'Old deployment run or revision.' : 'IsOS run identity unavailable.')); return; }
      const result = await readPrimitiveResult(current.commandId, current.activeRevision, abort.signal);
      if (token === generation.current && !abort.signal.aborted && recordRef.current?.commandId === current.commandId) update(acceptPrimitiveResult({ ...recordRef.current, attempts: recordRef.current.attempts + 1 }, result));
    } catch (error) {
      if (token === generation.current && !abort.signal.aborted && recordRef.current?.commandId === current.commandId) { const safe = errorText(error); update(primitiveError({ ...recordRef.current, attempts: recordRef.current.attempts + 1 }, safe.kind, safe.message)); }
    } finally { busy.current = false; if (controller.current === abort) controller.current = null; }
  };
  useEffect(() => {
    if (!record || record.phase === 'terminal' || record.phase === 'paused') return;
    if (record.attempts >= 12 || Date.now() - record.startedAt >= 60_000) { update({ ...record, phase: 'paused' }); return; }
    const delay = record.phase === 'unavailable' ? Math.min(10_000, 1000 * 2 ** Math.min(record.attempts, 4)) : 1000;
    const timer = window.setTimeout(() => { if (document.visibilityState === 'visible') void follow(); }, delay);
    const visible = (): void => { if (document.visibilityState === 'visible') { if (Date.now() - record.startedAt >= 60_000) update({ ...record, phase: 'paused' }); else void follow(); } };
    document.addEventListener('visibilitychange', visible);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
  }, [record]);
  const invoke = async (): Promise<void> => {
    if (!canInvoke || !binding || !graph) return;
    cancel(); const token = generation.current; const abort = new AbortController(); controller.current = abort;
    const commandId = `ui-${crypto.randomUUID()}`;
    const fresh = newPrimitiveRecord(status!.run_id!, graph.revision, binding.path, commandId, token);
    update(fresh);
    try {
      const [saved, process] = await Promise.all([getNodeGraph(), getProcessStatus(abort.signal)]);
      if (token !== generation.current || !sendFence(saved.revision, process, dirty, readOnly) || saved.revision !== fresh.activeRevision || !resolveBaseBindings(saved.graph).some((candidate) => candidate.path === binding.path && candidate.targetPath === binding.targetPath)) throw new ResultClientError('validation', 'Active graph or run changed.');
      const eosTime = await eosMonotonicTime(abort.signal);
      const beforeSend = await getProcessStatus(abort.signal);
      if (token !== generation.current || resultFence(fresh, beforeSend) !== 'current') throw new ResultClientError('validation', 'Active run changed before send.');
      sequence.current += 1;
      const result = await sendPrimitiveBase(binding, fresh.activeRevision, commandId, sequence.current, eosTime, value, abort.signal);
      if (token === generation.current && !abort.signal.aborted) update(acceptPrimitiveResult(fresh, result));
    } catch (error) { if (token === generation.current && !abort.signal.aborted) { const safe = errorText(error); update(primitiveError(fresh, safe.kind, safe.message)); } }
    finally { if (controller.current === abort) controller.current = null; }
  };
  const stop = async (): Promise<void> => {
    cancel(); if (recordRef.current && recordRef.current.phase !== 'terminal') update({ ...recordRef.current, phase: 'paused' });
    setStopping(true); setStopResult(c.stopping);
    try { const result = await controlProcesses('stop'); onStop(result); setStopResult(`${result.state || 'unknown'}${result.last_error ? `: ${result.last_error}` : ''}`); }
    catch (error) { setStopResult(error instanceof Error ? error.message : String(error)); }
    finally { setStopping(false); }
  };
  const field = (name: keyof Omit<BodyVelocity, 'type'>, label: string, unit: string, max: number): React.ReactElement => <label className="eos-control__field"><span>{label} <small>{unit} (±{max})</small></span><input type="number" step={name === 'valid_for_ms' ? 1 : 'any'} min={name === 'valid_for_ms' ? 1 : -max} max={max} value={Number.isNaN(value[name]) ? '' : value[name]} onChange={(event) => setValue((before) => ({ ...before, [name]: event.target.value.trim() ? Number(event.target.value) : Number.NaN }))} /></label>;
  const limits = binding?.target.movement?.limits;
  return <article className="eos-control__card eos-control__card--typed"><h3>{c.title}</h3>
    {binding ? <><p>{c.binding}: <code>{binding.path}</code></p><p>{c.target}: <code>{binding.targetPath}</code></p>
      <div className="eos-control__fields">{field('x_m_s', 'X', 'm/s', limits?.max_linear_m_s ?? 0)}{field('y_m_s', 'Y', 'm/s', limits?.max_linear_m_s ?? 0)}{field('yaw_rad_s', 'Yaw', 'rad/s', limits?.max_angular_rad_s ?? 0)}{field('valid_for_ms', c.lease, 'ms', limits?.max_velocity_lease_ms ?? 0)}</div>
      {!validBodyVelocity(value, binding.target) && <p role="alert">{c.invalid}</p>}</> : <p>{c.missing}</p>}
    {!canInvoke && <p role="status" className="eos-control__warning">{c.gated}</p>}
    <div className="eos-control__actions"><button type="button" className="eos-control__primary" disabled={!canInvoke} onClick={() => void invoke()}>{c.invoke}</button><button type="button" disabled={stopping} onClick={() => void stop()}>{stopping ? c.stopping : c.stop}</button><button type="button" onClick={onOpenLogs}>{c.logs}</button></div>
    {stopResult && <p role="status">{c.stopStatus}: {stopResult}</p>}
    {record && <div className="eos-control__result" role={record.result?.status === 'Failed' || record.result?.status === 'Rejected' || record.phase === 'unavailable' ? 'alert' : 'status'}><p>{c.command}: <code>{record.commandId}</code></p><p>{c.revision}: <code>{record.activeRevision}</code></p><p>{c.result}: <strong>{record.result?.status || (record.phase === 'sending' ? c.sending : record.phase === 'paused' ? c.paused : c.unavailable)}</strong>{record.result?.reason ? ` — ${record.result.reason}` : ''}</p>{record.error && <p>{record.error.message}</p>}<p>{c.updated}: {new Date(record.updatedAt).toLocaleTimeString()}</p>{['following', 'paused', 'unavailable'].includes(record.phase) && <button type="button" onClick={() => void follow(true)}>{c.refresh}</button>}</div>}
  </article>;
}
