import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeGraph } from '../../services/isos/node-graph';
import { chooseVisionGate, decodeVisionFrame, getVisionGates, visionSocketUrl, type VisionGate, type VisionGates, type VisionFrameMetadata, type VisionSubscription } from '../../services/eos/vision';
import { canonicalNodePath, graphNodes, inputSources } from './node-graph-edits';
import type { Language } from '../../types';

export function VisionPanel({ lang, graph, active, revision }: { lang: Language; graph: NodeGraph | null; active: boolean; revision: string }): React.ReactElement {
  const copy = lang === 'cn' ? { title: '视觉', source: '画面来源', empty: '没有活动的兼容相机网关。请检查节点图和 EOS 相机状态。', unlinked: '视觉输入尚未连接。请选择活动网关查看画面。', stale: '已保存节点图与运行中节点图不同。请重启节点图后查看相机。', mismatch: 'EOS 视觉报告的节点图修订不一致。请重启 EOS 并刷新来源。', connect: '连接', retry: '重试', disconnect: '断开', refresh: '刷新来源', status: '连接状态', off: '运行已保存的节点图后查看相机画面。', waiting: '等待画面…', fps: '实际帧率', error: '连接失败', disconnected: '已断开', connecting: '正在连接', retrying: '正在重新连接', connected: '正在接收画面', failed: '连接失败' } : { title: 'Vision', source: 'Frame source', empty: 'No active compatible camera gate. Check the graph and EOS camera status.', unlinked: 'No Vision input is linked. Select an active gate to view it.', stale: 'The saved graph differs from the running graph. Restart the graph before viewing its camera.', mismatch: 'EOS Vision reports a different graph revision. Restart EOS and refresh sources.', connect: 'Connect', retry: 'Retry', disconnect: 'Disconnect', refresh: 'Refresh sources', status: 'Connection', off: 'Run the saved graph to view camera frames.', waiting: 'Waiting for a frame…', fps: 'Delivered FPS', error: 'Connection failed', disconnected: 'Disconnected', connecting: 'Connecting', retrying: 'Reconnecting', connected: 'Receiving frames', failed: 'Connection failed' };
  const [catalog, setCatalog] = useState<VisionGates | null>(null);
  const [selected, setSelected] = useState('');
  const [state, setState] = useState<'disconnected' | 'connecting' | 'retrying' | 'connected' | 'error'>('disconnected');
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [metadata, setMetadata] = useState<VisionFrameMetadata | null>(null);
  const [fps, setFps] = useState(0);
  const [paused, setPaused] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retryTimer = useRef<number | null>(null);
  const retryCount = useRef(0);
  const socket = useRef<WebSocket | null>(null);
  const times = useRef<number[]>([]);
  const imageRef = useRef('');
  const vision = useMemo(() => graphNodes(graph || { version: '2.0.0', robot: { id: '', name: '' }, cores: {} }, []).find((entry) => entry.node.node_type === 'isos.ui.vision@v1.0') || graphNodes(graph || { version: '2.0.0', robot: { id: '', name: '' }, cores: {} }, []).find((entry) => entry.node.node_type === 'isosui.system.vision@v1.0'), [graph]);
  const initialGate = canonicalNodePath(vision?.node.inputs?.preview ? inputSources(vision.node.inputs.preview)[0]?.node || '' : '');
  const catalogRevision = catalog?.revision || '';
  const refresh = useCallback(async (): Promise<void> => {
    if (!active || !graph) return;
    try { const next = await getVisionGates(); setCatalog(next); setError(''); setSelected((current) => chooseVisionGate(next.gates, current, initialGate)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setCatalog(null); }
  }, [active, graph, initialGate]);
  const disconnect = useCallback((): void => { if (retryTimer.current !== null) window.clearTimeout(retryTimer.current); retryTimer.current = null; retryCount.current = 0; socket.current?.close(); socket.current = null; setState('disconnected'); setFps(0); times.current = []; }, []);
  useEffect(() => { disconnect(); setPaused(false); setAttempt(0); setCatalog(null); setSelected(''); }, [revision, disconnect]);
  useEffect(() => { void refresh(); if (!active || !graph) return; const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5000); return () => window.clearInterval(timer); }, [active, graph, refresh]);
  useEffect(() => () => { if (retryTimer.current !== null) window.clearTimeout(retryTimer.current); const ws = socket.current; socket.current = null; ws?.close(); if (imageRef.current) URL.revokeObjectURL(imageRef.current); }, []);
  useEffect(() => { if (!active) disconnect(); }, [active, disconnect]);
  useEffect(() => { if (catalog && catalog.revision !== revision) disconnect(); }, [catalog?.revision, revision, disconnect]);
  const connect = useCallback((): void => {
    if (!catalogRevision || !selected || !active || !graph || catalogRevision !== revision || paused || socket.current) return;
    setState(attempt ? 'retrying' : 'connecting'); setMetadata(null);
    const ws = new WebSocket(visionSocketUrl()); socket.current = ws; ws.binaryType = 'arraybuffer';
    ws.onopen = () => { const settings = vision?.node.settings || {}; const request: VisionSubscription = { op: 'subscribe', gate_path: selected, revision: catalogRevision };
      for (const key of ['target_fps', 'max_width_px', 'jpeg_quality'] as const) if (typeof settings[key] === 'number') request[key] = settings[key] as number;
      ws.send(JSON.stringify(request)); };
    ws.onmessage = async (event) => { if (ws !== socket.current) return; try {
      if (typeof event.data === 'string') { const reply = JSON.parse(event.data) as { type?: string; message?: string }; if (reply.type === 'error') throw new Error(reply.message || copy.error); if (reply.type === 'subscribed') setError(''); return; }
      const frame = decodeVisionFrame(event.data instanceof ArrayBuffer ? event.data : await (event.data as Blob).arrayBuffer());
      if (frame.metadata.gate_path !== selected) return;
      const next = URL.createObjectURL(frame.jpeg); if (imageRef.current) URL.revokeObjectURL(imageRef.current); imageRef.current = next; setImageUrl(next); setMetadata(frame.metadata); setState('connected'); retryCount.current = 0; setAttempt(0); setError('');
      const now = performance.now(); times.current = [...times.current.filter((time) => now - time < 2000), now]; setFps(times.current.length > 1 ? Math.round((times.current.length - 1) * 1000 / (now - times.current[0]) * 10) / 10 : 0);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setState('error'); ws.close(); } };
    ws.onerror = () => { if (socket.current === ws) { setError(copy.error); setState('error'); } };
    ws.onclose = () => { if (socket.current === ws) { socket.current = null; setFps(0); times.current = []; setError((current) => current || copy.error); const failures = retryCount.current; if (failures < 5) { retryCount.current += 1; setState('retrying'); retryTimer.current = window.setTimeout(() => { retryTimer.current = null; setAttempt((current) => current + 1); }, Math.min(1000 * 2 ** failures, 8000)); } else setState('error'); } };
  }, [active, graph, catalogRevision, selected, revision, paused, attempt, copy.error]);
  useEffect(() => { connect(); }, [connect]);
  const gates: VisionGate[] = catalog?.gates || [];
  const mismatch = Boolean(catalog && catalog.revision !== revision);
  const status = { disconnected: copy.disconnected, connecting: copy.connecting, retrying: copy.retrying, connected: copy.connected, error: copy.failed }[state];
  return <section id="eos-vision" className="eos-workbench__section eos-vision" aria-label={copy.title}><h2>{copy.title}</h2>{!active && <p>{copy.off}</p>}{active && !graph && <p role="alert">{copy.stale}</p>}<div className="eos-vision__controls"><label>{copy.source}<select value={selected} disabled={!active || !graph || !gates.length} onChange={(event) => { disconnect(); setSelected(event.target.value); setPaused(false); setAttempt(0); setError(''); }}><option value="">—</option>{gates.map((gate) => <option key={gate.path} value={gate.path}>{gate.label || gate.path}{gate.source_rate_hz ? ` · ${gate.source_rate_hz} Hz` : ''}</option>)}</select></label><button type="button" onClick={() => void refresh()} disabled={!active || !graph}>{copy.refresh}</button>{state === 'connecting' || state === 'retrying' || state === 'connected' ? <button type="button" onClick={() => { disconnect(); setPaused(true); }}>{copy.disconnect}</button> : <button type="button" onClick={() => { retryCount.current = 0; setError(''); setAttempt(0); setPaused(false); void refresh(); }} disabled={!active || !graph || !selected || mismatch}>{state === 'error' ? copy.retry : copy.connect}</button>}</div>{!gates.length && active && graph && <p>{copy.empty}</p>}{gates.length > 0 && !selected && <p>{copy.unlinked}</p>}<p role="status">{copy.status}: {status} · {copy.fps}: {fps.toFixed(1)} Hz{metadata ? ` · ${metadata.width_px} × ${metadata.height_px}` : ''}</p>{mismatch && <p role="alert" className="eos-control__warning">{copy.mismatch}</p>}{error && <p role="alert" className="eos-control__warning">{error}</p>}<div className="eos-vision__image">{imageUrl && state === 'connected' ? <img src={imageUrl} alt={`${copy.title}: ${selected}`} /> : <p>{copy.waiting}</p>}</div></section>;
}
