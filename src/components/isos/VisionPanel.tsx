import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeGraph } from '@/services/isos/node-graph';
import { decodeVisionFrame, getVisionGates, visionSocketUrl, type VisionGate, type VisionGates, type VisionFrameMetadata, type VisionSubscription } from '@/services/eos/vision';
import { graphNodes } from './node-graph-edits';
import type { Language } from '@/types';

export function VisionPanel({ lang, graph, active }: { lang: Language; graph: NodeGraph | null; active: boolean }): React.ReactElement {
  const copy = lang === 'cn' ? { title: '视觉', source: '画面来源', empty: '没有活动的兼容网关。添加并运行相机网关节点。', connect: '连接', disconnect: '断开', refresh: '刷新来源', status: '连接状态', off: '请先构建并运行节点图。', waiting: '等待画面…', fps: '实际帧率', error: '连接失败' } : { title: 'Vision', source: 'Frame source', empty: 'No active compatible gate. Add and run a camera gate node.', connect: 'Connect', disconnect: 'Disconnect', refresh: 'Refresh sources', status: 'Connection', off: 'Build and run the graph first.', waiting: 'Waiting for a frame…', fps: 'Delivered FPS', error: 'Connection failed' };
  const [catalog, setCatalog] = useState<VisionGates | null>(null);
  const [selected, setSelected] = useState('');
  const [state, setState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [metadata, setMetadata] = useState<VisionFrameMetadata | null>(null);
  const [fps, setFps] = useState(0);
  const socket = useRef<WebSocket | null>(null);
  const times = useRef<number[]>([]);
  const imageRef = useRef('');
  const vision = useMemo(() => graphNodes(graph || { version: '2.0.0', robot: { id: '', name: '' }, cores: {} }, []).find((entry) => entry.node.node_type === 'isosui.system.vision@v1.0'), [graph]);
  const initialGate = vision?.node.inputs?.preview?.node || '';
  const refresh = useCallback(async (): Promise<void> => {
    if (!active) return;
    try { const next = await getVisionGates(); setCatalog(next); setError(''); setSelected((current) => next.gates.some((gate) => gate.path === current) ? current : next.gates.some((gate) => gate.path === initialGate) ? initialGate : ''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setCatalog(null); }
  }, [active, initialGate]);
  useEffect(() => { void refresh(); }, [refresh]);
  const disconnect = useCallback((): void => { socket.current?.close(); socket.current = null; setState('disconnected'); setFps(0); times.current = []; }, []);
  useEffect(() => () => { socket.current?.close(); if (imageRef.current) URL.revokeObjectURL(imageRef.current); }, []);
  useEffect(() => { if (!active) disconnect(); }, [active, disconnect]);
  const connect = (): void => {
    if (!catalog || !selected) return;
    disconnect(); setError(''); setState('connecting'); setMetadata(null);
    const ws = new WebSocket(visionSocketUrl()); socket.current = ws; ws.binaryType = 'arraybuffer';
    ws.onopen = () => { const settings = vision?.node.settings || {}; const request: VisionSubscription = { op: 'subscribe', gate_path: selected, revision: catalog.revision };
      for (const key of ['target_fps', 'max_width_px', 'jpeg_quality'] as const) if (typeof settings[key] === 'number') request[key] = settings[key] as number;
      ws.send(JSON.stringify(request)); };
    ws.onmessage = async (event) => { if (ws !== socket.current) return; try {
      if (typeof event.data === 'string') { const reply = JSON.parse(event.data) as { type?: string; message?: string }; if (reply.type === 'error') throw new Error(reply.message || copy.error); if (reply.type === 'subscribed') setState('connected'); return; }
      const frame = decodeVisionFrame(event.data instanceof ArrayBuffer ? event.data : await (event.data as Blob).arrayBuffer());
      if (frame.metadata.gate_path !== selected) return;
      const next = URL.createObjectURL(frame.jpeg); if (imageRef.current) URL.revokeObjectURL(imageRef.current); imageRef.current = next; setImageUrl(next); setMetadata(frame.metadata); setState('connected');
      const now = performance.now(); times.current = [...times.current.filter((time) => now - time < 2000), now]; setFps(times.current.length > 1 ? Math.round((times.current.length - 1) * 1000 / (now - times.current[0]) * 10) / 10 : 0);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setState('error'); ws.close(); } };
    ws.onerror = () => { if (socket.current === ws) { setError(copy.error); setState('error'); } };
    ws.onclose = () => { if (socket.current === ws) { socket.current = null; setState((current) => current === 'error' ? current : 'disconnected'); } };
  };
  const gates: VisionGate[] = catalog?.gates || [];
  return <section id="eos-vision" className="eos-workbench__section eos-vision" aria-label={copy.title}><h2>{copy.title}</h2>{!active && <p>{copy.off}</p>}<div className="eos-vision__controls"><label>{copy.source}<select value={selected} disabled={!active || !gates.length} onChange={(event) => { disconnect(); setSelected(event.target.value); }}><option value="">—</option>{gates.map((gate) => <option key={gate.path} value={gate.path}>{gate.label || gate.path}{gate.source_rate_hz ? ` · ${gate.source_rate_hz} Hz` : ''}</option>)}</select></label><button type="button" onClick={() => void refresh()} disabled={!active}>{copy.refresh}</button>{state === 'connecting' || state === 'connected' ? <button type="button" onClick={disconnect}>{copy.disconnect}</button> : <button type="button" onClick={connect} disabled={!active || !selected}>{copy.connect}</button>}</div>{!gates.length && active && <p>{copy.empty}</p>}<p role="status">{copy.status}: {state} · {copy.fps}: {fps.toFixed(1)} Hz{metadata ? ` · ${metadata.width_px} × ${metadata.height_px}` : ''}</p>{error && <p role="alert" className="eos-control__warning">{error}</p>}<div className="eos-vision__image">{imageUrl && state === 'connected' ? <img src={imageUrl} alt={`${copy.title}: ${selected}`} /> : <p>{copy.waiting}</p>}</div></section>;
}
