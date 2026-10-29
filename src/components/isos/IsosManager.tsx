import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, Handle, MiniMap, Position, SelectionMode, useNodesState, type Connection, type Edge, type Node, type NodeChange } from 'reactflow';
import 'reactflow/dist/style.css';
import { CustomSelect } from '@/components/CustomSelect/CustomSelect';
import {
  applyIsosGraph, consumeIsosToken, getIsosGraph, getIsosProfiles, hasIsosToken, setIsosToken, validateIsosGraph,
  type IsosDiagnostic, type IsosEdge, type IsosGraph, type IsosNode, type IsosProfile,
} from '@/services/isos/config-manager';
import type { Language } from '@/types';
import './isos-manager.scss';

interface IsosManagerProps { lang: Language; onLanguageChange: (lang: Language) => void }
interface ProfileNodeData { node: IsosNode; profile?: IsosProfile }
const COPY = {
  en: {
    title: 'Configuration graph', intro: 'Connect typed nodes to configure EOS and EGIA. Applying saves a revision; running processes use their active revision until restarted.',
    open: 'Open with isos open', token: 'Temporary token', connect: 'Connect', refresh: 'Refresh', validate: 'Validate', apply: 'Apply', saved: 'Configuration saved.', valid: 'Configuration is valid.',
    profiles: 'Node profiles', add: 'Add node', nodeId: 'Node ID', selected: 'Selected node', none: 'Select a node to edit its configuration.', remove: 'Remove',
    settings: 'Settings JSON', invalidSettings: 'Settings must be a JSON object.', enabled: 'Enabled', packageId: 'Package ID', packageVersion: 'Package version',
    connections: 'Connections', consumer: 'Consumer', input: 'Input', provider: 'Provider', output: 'Output', connectNodes: 'Connect', noPorts: 'No ports',
    guidance: 'Left click to select. Drag a blank area to select several nodes. Middle drag to pan, scroll to zoom, and right click for quick actions.',
    eos: 'EOS monitor', egia: 'EGIA monitor', later: 'Monitor is reserved for a later release.', config: 'Configuration', diagnostics: 'Diagnostics',
    duplicate: 'Node ID must be unique and use lowercase letters, numbers, or hyphens.', incompatible: 'These ports have different types.', missing: 'Choose a consumer, provider, input, and output.',
    empty: 'No nodes yet. Add a profile in the side panel.', removeEdge: 'Remove connection', contextAdd: 'Add node', contextRemove: 'Remove selected',
  },
  cn: {
    title: '配置图', intro: '连接带类型的节点以配置 EOS 和 EGIA。应用操作保存一个修订版本；运行中的进程在重启前继续使用原有版本。',
    open: '使用 isos open 打开', token: '临时令牌', connect: '连接', refresh: '刷新', validate: '验证', apply: '应用', saved: '配置已保存。', valid: '配置有效。',
    profiles: '节点配置档案', add: '添加节点', nodeId: '节点 ID', selected: '选中节点', none: '选择节点后可编辑配置。', remove: '删除',
    settings: '设置 JSON', invalidSettings: '设置必须是 JSON 对象。', enabled: '启用', packageId: '软件包 ID', packageVersion: '软件包版本',
    connections: '连接', consumer: '消费者', input: '输入', provider: '提供者', output: '输出', connectNodes: '连接', noPorts: '无端口',
    guidance: '左键选择；在空白处拖动可框选多个节点；中键拖动平移；滚轮缩放；右键打开快捷菜单。',
    eos: 'EOS 监视器', egia: 'EGIA 监视器', later: '监视器将在后续版本提供。', config: '配置', diagnostics: '诊断',
    duplicate: '节点 ID 必须唯一，仅可使用小写字母、数字和连字符。', incompatible: '端口类型不兼容。', missing: '请选择消费者、提供者、输入和输出。',
    empty: '尚无节点。请在侧边栏添加配置档案。', removeEdge: '删除连接', contextAdd: '添加节点', contextRemove: '删除选中节点',
  },
} as const;
const emptyGraph = (): IsosGraph => ({ schema_version: 2, name: 'default', nodes: [], edges: [], layout: {} });
const slug = /^[a-z][a-z0-9-]{0,47}$/;

function profileFor(node: IsosNode, profiles: IsosProfile[]): IsosProfile | undefined {
  return profiles.find((profile) => profile.id === node.profile?.id && profile.version === node.profile.version);
}
function graphPosition(graph: IsosGraph, id: string, index: number): { x: number; y: number } {
  const point = graph.layout?.[id];
  return point && Number.isFinite(point.x) && Number.isFinite(point.y) ? point : { x: 50 + (index % 3) * 270, y: 50 + Math.floor(index / 3) * 180 };
}
function ProfileNode({ data, selected }: { data: ProfileNodeData; selected: boolean }): React.ReactElement {
  const inputs = data.profile?.inputs || [];
  const outputs = data.profile?.outputs || [];
  return <div className={`isos-flow-node${selected ? ' isos-flow-node--selected' : ''}`}>
    <strong>{data.node.id}</strong><small>{data.profile?.label || data.node.profile?.id || data.node.kind}</small>
    <div className="isos-flow-node__ports"><div>{inputs.length === 0 && <div className="isos-flow-node__port"><Handle type="target" position={Position.Left} id="in:" title="Dependency input" /></div>}{inputs.map((port) => <div className="isos-flow-node__port" key={`in-${port.name}`}>
      <Handle type="target" position={Position.Left} id={`in:${port.name}`} title={`${port.name}: ${port.type}`} /><span>{port.name}</span>
    </div>)}</div><div>{outputs.length === 0 && <div className="isos-flow-node__port isos-flow-node__port--out"><Handle type="source" position={Position.Right} id="out:" title="Dependency output" /></div>}{outputs.map((port) => <div className="isos-flow-node__port isos-flow-node__port--out" key={`out-${port.name}`}>
      <span>{port.name}</span><Handle type="source" position={Position.Right} id={`out:${port.name}`} title={`${port.name}: ${port.type}`} />
    </div>)}</div></div>
  </div>;
}
const nodeTypes = { profile: ProfileNode };

/** Configuration-only editor for the versioned IsOS graph API. */
export const IsosManager: React.FC<IsosManagerProps> = ({ lang, onLanguageChange }) => {
  const copy = COPY[lang];
  const [connected, setConnected] = useState(false);
  const [tokenReady, setTokenReady] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [graph, setGraph] = useState<IsosGraph>(emptyGraph);
  const [revision, setRevision] = useState('');
  const [profiles, setProfiles] = useState<IsosProfile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [panel, setPanel] = useState<'config' | 'eos' | 'egia'>('config');
  const [newProfile, setNewProfile] = useState('');
  const [newId, setNewId] = useState('');
  const [settingsInput, setSettingsInput] = useState('{}');
  const [consumer, setConsumer] = useState('');
  const [provider, setProvider] = useState('');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [diagnostics, setDiagnostics] = useState<IsosDiagnostic[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [context, setContext] = useState<{ x: number; y: number } | null>(null);
  const selectedNode = graph.nodes.find((node) => node.id === selected[0]);
  const selectedProfile = selectedNode ? profileFor(selectedNode, profiles) : undefined;
  const consumerProfile = profileFor(graph.nodes.find((node) => node.id === consumer) || { id: '', kind: 'component' }, profiles);
  const providerProfile = profileFor(graph.nodes.find((node) => node.id === provider) || { id: '', kind: 'component' }, profiles);
  const inputs = consumerProfile?.inputs || [];
  const outputs = providerProfile?.outputs || [];

  const refresh = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const [document, catalog] = await Promise.all([getIsosGraph(), getIsosProfiles()]);
      setGraph(document.graph); setRevision(document.revision); setProfiles(catalog.profiles);
      setNewProfile((current) => current || catalog.profiles[0]?.id || '');
      setDiagnostics([]); setMessage(''); setConnected(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => {
    if (!consumeIsosToken()) return;
    if (ISOSUI_TARGET === 'local') void refresh();
    else setTokenReady(true);
  }, [refresh]);
  useEffect(() => { setSettingsInput(JSON.stringify(selectedNode?.settings || {}, null, 2)); }, [selectedNode?.id]);

  const visualNodes = useMemo<Node<ProfileNodeData>[]>(() => graph.nodes.map((node, index) => ({
    id: node.id, type: 'profile', position: graphPosition(graph, node.id, index), data: { node, profile: profileFor(node, profiles) }, selected: selected.includes(node.id),
  })), [graph, profiles, selected]);
  const [flowNodes, setFlowNodes, flowNodesChanged] = useNodesState<ProfileNodeData>([]);
  useEffect(() => {
    setFlowNodes((current) => visualNodes.map((node) => {
      const measured = current.find((item) => item.id === node.id);
      return { ...node, width: measured?.width, height: measured?.height };
    }));
  }, [visualNodes, setFlowNodes]);
  const visualEdges = useMemo<Edge[]>(() => graph.edges.map((edge, index) => ({
    id: `e-${index}`, source: edge.to, target: edge.from, sourceHandle: edge.output ? `out:${edge.output}` : undefined,
    targetHandle: edge.input ? `in:${edge.input}` : undefined, label: edge.input && edge.output ? `${edge.output} / ${edge.input}` : undefined,
  })), [graph.edges]);
  const mutateNode = (id: string, change: Partial<IsosNode>): void => setGraph((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, ...change } : node) }));
  const removeSelected = (): void => {
    const ids = new Set(selected);
    setGraph((current) => ({ ...current, nodes: current.nodes.filter((node) => !ids.has(node.id)), edges: current.edges.filter((edge) => !ids.has(edge.from) && !ids.has(edge.to)) }));
    setSelected([]); setContext(null);
  };
  const addNode = (): void => {
    const id = newId.trim();
    if (!slug.test(id) || graph.nodes.some((node) => node.id === id)) { setMessage(copy.duplicate); return; }
    const profile = profiles.find((item) => item.id === newProfile);
    if (!profile) return;
    const role = profile.id === 'eos.uds' ? undefined : profile.id.startsWith('eos.') ? 'eos' : profile.id.startsWith('egia.') ? 'egia' : undefined;
    const node: IsosNode = { id, kind: profile.id === 'eos.uds' ? 'endpoint' : 'component', role, profile: { id: profile.id, version: profile.version }, enabled: false, owned: profile.id !== 'eos.uds', settings: profile.defaults || {} };
    setGraph((current) => ({ ...current, nodes: [...current.nodes, node], layout: { ...current.layout, [id]: { x: 80 + current.nodes.length * 35, y: 90 + current.nodes.length * 35 } } }));
    setNewId(''); setSelected([id]); setMessage(''); setContext(null);
  };
  const addEdge = (from: string, to: string, inputName: string, outputName: string): void => {
    const consumerNode = graph.nodes.find((node) => node.id === from);
    const providerNode = graph.nodes.find((node) => node.id === to);
    const inPort = profileFor(consumerNode || { id: '', kind: 'component' }, profiles)?.inputs?.find((port) => port.name === inputName);
    const outPort = profileFor(providerNode || { id: '', kind: 'component' }, profiles)?.outputs?.find((port) => port.name === outputName);
    if (!consumerNode || !providerNode || from === to || Boolean(inputName) !== Boolean(outputName)) { setMessage(copy.missing); return; }
    if (inputName && (!inPort || !outPort)) { setMessage(copy.missing); return; }
    if (inPort && outPort && (inPort.type !== outPort.type || (inPort.contract && outPort.contract && inPort.contract !== outPort.contract))) { setMessage(copy.incompatible); return; }
    if (graph.edges.some((edge) => edge.from === from && edge.input === inputName)) { setMessage(copy.duplicate); return; }
    setGraph((current) => ({ ...current, edges: [...current.edges, { from, to, kind: 'depends_on', ...(inputName ? { input: inputName, output: outputName } : {}) }] }));
    setMessage(''); setContext(null);
  };
  const onConnect = (connection: Connection): void => {
    if (!connection.source || !connection.target) return;
    addEdge(connection.target, connection.source, connection.targetHandle?.replace(/^in:/, '') || '', connection.sourceHandle?.replace(/^out:/, '') || '');
  };
  const onNodesChange = (changes: NodeChange[]): void => {
    flowNodesChanged(changes);
    const positions = changes.filter((change) => change.type === 'position' && Boolean(change.position));
    if (positions.length) setGraph((current) => ({ ...current, layout: { ...current.layout, ...Object.fromEntries(positions.map((change) => [(change as { id: string }).id, (change as { position: { x: number; y: number } }).position])) } }));
  };
  const validate = async (): Promise<boolean> => {
    setBusy(true);
    try {
      const result = await validateIsosGraph(graph);
      setDiagnostics(result.diagnostics); setMessage(result.valid ? copy.valid : `${result.diagnostics.length} ${copy.diagnostics.toLowerCase()}`);
      return result.valid;
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); return false; }
    finally { setBusy(false); }
  };
  const apply = async (): Promise<void> => {
    setBusy(true);
    try {
      const result = await validateIsosGraph(graph);
      setDiagnostics(result.diagnostics);
      if (!result.valid) { setMessage(`${result.diagnostics.length} ${copy.diagnostics.toLowerCase()}`); return; }
      const document = await applyIsosGraph(revision, graph);
      setGraph(document.graph); setRevision(document.revision); setMessage(copy.saved);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const connect = (): void => {
    if (tokenInput.trim()) setIsosToken(tokenInput);
    setTokenInput('');
    if (hasIsosToken()) void refresh();
  };

  const content = <main className="isos-manager">
    <header className="isos-manager__header"><div><h1>{copy.title}</h1><p>{copy.intro}</p></div>
      {<nav aria-label="Language"><button type="button" onClick={() => onLanguageChange?.('en')} aria-current={lang === 'en' ? 'page' : undefined}>English</button><button type="button" onClick={() => onLanguageChange?.('cn')} aria-current={lang === 'cn' ? 'page' : undefined}>中文</button></nav>}
    </header>
    {!connected && <form className="isos-manager__pair" onSubmit={(event) => { event.preventDefault(); connect(); }}><p>{copy.open}</p><label>{copy.token}<input type="password" autoComplete="off" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} /></label><button type="submit" disabled={!tokenInput.trim() && !tokenReady}>{copy.connect}</button></form>}
    <nav className="isos-manager__tabs" aria-label={copy.title}><button type="button" aria-current={panel === 'config' ? 'page' : undefined} onClick={() => setPanel('config')}>{copy.config}</button><button type="button" aria-current={panel === 'eos' ? 'page' : undefined} onClick={() => setPanel('eos')}>{copy.eos}</button><button type="button" aria-current={panel === 'egia' ? 'page' : undefined} onClick={() => setPanel('egia')}>{copy.egia}</button></nav>
    {message && <p className="isos-manager__message" role="status">{message}</p>}
    {panel !== 'config' ? <section className="isos-manager__placeholder" aria-label={panel === 'eos' ? copy.eos : copy.egia}><h2>{panel === 'eos' ? copy.eos : copy.egia}</h2><p>{copy.later}</p></section> : <>
      <div className="isos-manager__toolbar"><p>{copy.guidance}</p><div><button type="button" disabled={busy || !connected} onClick={() => void refresh()}>{copy.refresh}</button><button type="button" disabled={busy || !connected} onClick={() => void validate()}>{copy.validate}</button><button type="button" disabled={busy || !connected} onClick={() => void apply()}>{copy.apply}</button></div></div>
      <div className="isos-manager__workspace"><div className="isos-manager__canvas" onClick={() => setContext(null)}>
        <ReactFlow nodes={flowNodes} edges={visualEdges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onConnect={onConnect}
          onSelectionChange={({ nodes }) => setSelected(nodes.map((node) => node.id))} selectionOnDrag selectionMode={SelectionMode.Partial}
          panOnDrag={[1]} zoomOnScroll zoomOnPinch onPaneContextMenu={(event) => { event.preventDefault(); setContext({ x: event.clientX, y: event.clientY }); }}
          onNodeContextMenu={(event, node) => { event.preventDefault(); setSelected([node.id]); setContext({ x: event.clientX, y: event.clientY }); }} fitView minZoom={0.2} maxZoom={2}>
          <Background color="var(--border)" /><Controls showInteractive={false} /><MiniMap pannable zoomable />
        </ReactFlow>
        {!graph.nodes.length && <p className="isos-manager__empty">{copy.empty}</p>}
        {context && <div className="isos-manager__context" role="menu" style={{ left: Math.min(context.x, window.innerWidth - 180), top: Math.min(context.y, window.innerHeight - 110) }}><button type="button" role="menuitem" onClick={() => { setContext(null); document.getElementById('isos-new-id')?.focus(); }}>{copy.contextAdd}</button><button type="button" role="menuitem" disabled={!selected.length} onClick={removeSelected}>{copy.contextRemove}</button></div>}
      </div><aside className="isos-manager__inspector">
        <h2>{copy.profiles}</h2><label>{copy.profiles}<CustomSelect value={newProfile} options={profiles.map((item) => ({ value: item.id, label: `${item.label || item.id} (${item.version})` }))} onChange={setNewProfile} ariaLabel={copy.profiles} /></label>
        <label>{copy.nodeId}<input id="isos-new-id" value={newId} onChange={(event) => setNewId(event.target.value.toLowerCase())} /></label><button type="button" onClick={addNode} disabled={!connected || !newProfile}>{copy.add}</button>
        <h2>{copy.selected}</h2>{selectedNode ? <><strong>{selectedNode.id}</strong><p>{selectedProfile?.description || selectedNode.profile?.id}</p><label className="isos-manager__check"><input type="checkbox" checked={selectedNode.enabled !== false} onChange={(event) => mutateNode(selectedNode.id, { enabled: event.target.checked })} />{copy.enabled}</label>
          <label>{copy.packageId}<input value={selectedNode.package?.id || ''} onChange={(event) => mutateNode(selectedNode.id, { package: { id: event.target.value, version: selectedNode.package?.version || '' } })} /></label>
          <label>{copy.packageVersion}<input value={selectedNode.package?.version || ''} onChange={(event) => mutateNode(selectedNode.id, { package: { id: selectedNode.package?.id || '', version: event.target.value } })} /></label>
          <label>{copy.settings}<textarea rows={6} value={settingsInput} onChange={(event) => setSettingsInput(event.target.value)} onBlur={() => { try { const parsed: unknown = JSON.parse(settingsInput); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(); mutateNode(selectedNode.id, { settings: parsed as Record<string, unknown> }); setMessage(''); } catch { setMessage(copy.invalidSettings); } }} /></label>
          <button type="button" onClick={removeSelected}>{copy.remove}</button></> : <p>{copy.none}</p>}
        <h2>{copy.connections}</h2><label>{copy.consumer}<CustomSelect value={consumer} options={[{ value: '', label: '—' }, ...graph.nodes.map((node) => ({ value: node.id, label: node.id }))]} onChange={(value) => { setConsumer(value); setInput(''); }} ariaLabel={copy.consumer} /></label>
        <label>{copy.input}<CustomSelect value={input} options={[{ value: '', label: '—' }, ...inputs.map((port) => ({ value: port.name, label: `${port.name}: ${port.type}` }))]} onChange={setInput} ariaLabel={copy.input} /></label>
        <label>{copy.provider}<CustomSelect value={provider} options={[{ value: '', label: '—' }, ...graph.nodes.map((node) => ({ value: node.id, label: node.id }))]} onChange={(value) => { setProvider(value); setOutput(''); }} ariaLabel={copy.provider} /></label>
        <label>{copy.output}<CustomSelect value={output} options={[{ value: '', label: '—' }, ...outputs.map((port) => ({ value: port.name, label: `${port.name}: ${port.type}` }))]} onChange={setOutput} ariaLabel={copy.output} /></label>
        <button type="button" onClick={() => addEdge(consumer, provider, input, output)}>{copy.connectNodes}</button>
        <ul className="isos-manager__connections">{graph.edges.map((edge, index) => <li key={`${edge.from}-${edge.to}-${index}`}><span>{edge.from}.{edge.input || '*'} / {edge.to}.{edge.output || '*'}</span><button type="button" aria-label={`${copy.removeEdge}: ${edge.from} ${edge.to}`} onClick={() => setGraph((current) => ({ ...current, edges: current.edges.filter((_, item) => item !== index) }))}>×</button></li>)}</ul>
      </aside></div>
      {diagnostics.length > 0 && <section className="isos-manager__diagnostics"><h2>{copy.diagnostics}</h2><ul>{diagnostics.map((item, index) => <li key={index}><code>{item.path}</code> {item.message}</li>)}</ul></section>}
    </>}
  </main>;
  return content;
};
