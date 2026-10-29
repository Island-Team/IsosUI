import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Handle, MiniMap, Position, ReactFlowProvider, SelectionMode, useNodesState, type Connection, type Edge, type Node, type NodeChange, type ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';
import { CustomSelect } from '@/components/CustomSelect/CustomSelect';
import { NodeConfiguration } from './NodeConfiguration';
import { WorkbenchWindow } from './WorkbenchWindow';
import { editGraphNode } from './graph-edits';
import { defaultLayout, loadLayout, saveLayout, WINDOW_IDS, type WindowId, type WindowPlacement, type WorkbenchLayout } from './workbench-layout';
import {
  applyIsosGraph, consumeIsosToken, getIsosGraph, getIsosProfiles, getIsosVersion, hasIsosToken, setIsosToken, validateIsosGraph,
  type IsosDiagnostic, type IsosEdge, type IsosGraph, type IsosNode, type IsosProfile,
} from '@/services/isos/config-manager';
import type { Language } from '@/types';
import './isos-manager.scss';

interface IsosManagerProps { lang: Language; onLanguageChange: (lang: Language) => void }
interface ProfileNodeData { node: IsosNode; profile?: IsosProfile }
const COPY = {
  en: {
    title: 'IsOS Workbench', intro: 'Connect typed nodes to configure EOS and EGIA. Applying saves a revision; running processes use their active revision until restarted.',
    open: 'Open with isos open', token: 'Temporary token', connect: 'Connect', refresh: 'Refresh', validate: 'Validate', apply: 'Apply', saved: 'Configuration saved.', valid: 'Configuration is valid.',
    profiles: 'Node profiles', add: 'Add node', nodeId: 'Node ID', selected: 'Selected node', none: 'Select a node to edit its configuration.', remove: 'Remove',
    settings: 'Settings JSON', invalidSettings: 'Settings must be a JSON object.', enabled: 'Enabled', packageId: 'Package ID', packageVersion: 'Package version',
    connections: 'Connections', consumer: 'Consumer', input: 'Input', provider: 'Provider', output: 'Output', connectNodes: 'Connect', noPorts: 'No ports',
    guidance: 'Left click to select. Drag a blank area to select several nodes. Middle drag to pan, scroll to zoom, and right click for quick actions.',
    eos: 'EOS monitor', egia: 'EGIA monitor', later: 'Monitor is reserved for a later release.', config: 'Configuration', diagnostics: 'Diagnostics',
    duplicate: 'Node ID must be unique and use lowercase letters, numbers, or hyphens.', incompatible: 'These ports have different types.', missing: 'Choose a consumer, provider, input, and output.',
    empty: 'No nodes yet. Open the Node Library to add one.', removeEdge: 'Remove connection', contextAdd: 'Add node', contextRemove: 'Remove selected',
    library: 'Node Library', minimap: 'Mini Map', fit: 'Fit graph', zoomIn: 'Zoom in', zoomOut: 'Zoom out', resetLayout: 'Reset layout', collapseTools: 'Collapse tools', expandTools: 'Expand tools', unsaved: 'Unsaved changes', clean: 'Saved', search: 'Search nodes', service: 'Service', backend: 'Backend', skill: 'Skill', discard: 'Discard unsaved changes and refresh?',
  },
  cn: {
    title: 'IsOS 工作台', intro: '连接带类型的节点以配置 EOS 和 EGIA。应用操作保存一个修订版本；运行中的进程在重启前继续使用原有版本。',
    open: '使用 isos open 打开', token: '临时令牌', connect: '连接', refresh: '刷新', validate: '验证', apply: '应用', saved: '配置已保存。', valid: '配置有效。',
    profiles: '节点配置档案', add: '添加节点', nodeId: '节点 ID', selected: '选中节点', none: '选择节点后可编辑配置。', remove: '删除',
    settings: '设置 JSON', invalidSettings: '设置必须是 JSON 对象。', enabled: '启用', packageId: '软件包 ID', packageVersion: '软件包版本',
    connections: '连接', consumer: '消费者', input: '输入', provider: '提供者', output: '输出', connectNodes: '连接', noPorts: '无端口',
    guidance: '左键选择；在空白处拖动可框选多个节点；中键拖动平移；滚轮缩放；右键打开快捷菜单。',
    eos: 'EOS 监视器', egia: 'EGIA 监视器', later: '监视器将在后续版本提供。', config: '配置', diagnostics: '诊断',
    duplicate: '节点 ID 必须唯一，仅可使用小写字母、数字和连字符。', incompatible: '端口类型不兼容。', missing: '请选择消费者、提供者、输入和输出。',
    empty: '尚无节点。打开节点库即可添加。', removeEdge: '删除连接', contextAdd: '添加节点', contextRemove: '删除选中节点',
    library: '节点库', minimap: '缩略图', fit: '适应画布', zoomIn: '放大', zoomOut: '缩小', resetLayout: '重置布局', collapseTools: '收起工具栏', expandTools: '展开工具栏', unsaved: '未保存更改', clean: '已保存', search: '搜索节点', service: '服务', backend: '后端', skill: '技能', discard: '放弃未保存的更改并刷新？',
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
  const kind = data.node.role || data.node.kind;
  return <div className={`isos-flow-node isos-flow-node--${kind}${selected ? ' isos-flow-node--selected' : ''}${data.node.enabled === false ? ' isos-flow-node--disabled' : ''}`}>
    <div className="isos-flow-node__head"><span>{kind}</span><span className={`isos-flow-node__state${data.node.enabled === false ? ' isos-flow-node__state--disabled' : ''}`} title={data.node.enabled === false ? 'Disabled' : 'Enabled'} /></div>
    <strong>{data.node.id}</strong><small>{data.profile?.label || data.node.profile?.id || data.node.kind}</small>{data.node.profile && <em>v{data.node.profile.version}</em>}
    <div className="isos-flow-node__ports"><div>{inputs.length === 0 && <div className="isos-flow-node__port"><Handle type="target" position={Position.Left} id="in:" title="Dependency input" /></div>}{inputs.map((port) => <div className="isos-flow-node__port" key={`in-${port.name}`}>
      <Handle type="target" position={Position.Left} id={`in:${port.name}`} title={`${port.name}: ${port.type}`} /><span>{port.name}</span>
    </div>)}</div><div>{outputs.length === 0 && <div className="isos-flow-node__port isos-flow-node__port--out"><Handle type="source" position={Position.Right} id="out:" title="Dependency output" /></div>}{outputs.map((port) => <div className="isos-flow-node__port isos-flow-node__port--out" key={`out-${port.name}`}>
      <span>{port.name}</span><Handle type="source" position={Position.Right} id={`out:${port.name}`} title={`${port.name}: ${port.type}`} />
    </div>)}</div></div>
  </div>;
}
const nodeTypes = { profile: ProfileNode };
const WINDOW_ICONS: Record<WindowId, string> = { library: '＋', config: '⚙', connections: '◇', diagnostics: '!', eos: 'E', egia: 'G', minimap: '▧' };

/** Configuration-only editor for the versioned IsOS graph API. */
export const IsosManager: React.FC<IsosManagerProps> = ({ lang, onLanguageChange }) => {
  const copy = COPY[lang];
  const [connected, setConnected] = useState(false);
  const [tokenReady, setTokenReady] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [graph, setGraph] = useState<IsosGraph>(emptyGraph);
  const graphRef = useRef(graph);
  const [savedGraph, setSavedGraph] = useState('');
  const undoStack = useRef<IsosGraph[]>([]);
  const redoStack = useRef<IsosGraph[]>([]);
  const [historyTick, setHistoryTick] = useState(0);
  const [revision, setRevision] = useState('');
  const [profiles, setProfiles] = useState<IsosProfile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [layout, setLayout] = useState<WorkbenchLayout>(loadLayout);
  const [toolsCollapsed, setToolsCollapsed] = useState(() => localStorage.getItem('isos-workbench-tools-collapsed') === 'true');
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const [search, setSearch] = useState('');
  const [newProfile, setNewProfile] = useState('');
  const [newId, setNewId] = useState('');
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
  const dirty = connected && savedGraph !== JSON.stringify(graph);
  useEffect(() => { graphRef.current = graph; }, [graph]);
  useEffect(() => { saveLayout(layout); }, [layout]);
  useEffect(() => { localStorage.setItem('isos-workbench-tools-collapsed', String(toolsCollapsed)); }, [toolsCollapsed]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent): void => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  const updateWindow = (id: WindowId, change: Partial<WindowPlacement>): void => setLayout((current) => ({ ...current, [id]: { ...current[id], ...change } }));
  const focusWindow = (id: WindowId): void => setLayout((current) => ({ ...current, [id]: { ...current[id], z: Math.max(...WINDOW_IDS.map((key) => current[key].z)) + 1 } }));
  const openWindow = (id: WindowId): void => { updateWindow(id, { open: true, collapsed: false }); focusWindow(id); };
  const toggleWindow = (id: WindowId): void => setLayout((current) => ({ ...current, [id]: { ...current[id], open: !current[id].open, collapsed: current[id].open ? current[id].collapsed : false, z: Math.max(...WINDOW_IDS.map((key) => current[key].z)) + 1 } }));
  const commitGraph = (change: (current: IsosGraph) => IsosGraph): void => {
    const previous = graphRef.current;
    const next = change(previous);
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    undoStack.current.push(previous); if (undoStack.current.length > 80) undoStack.current.shift();
    redoStack.current = []; graphRef.current = next; setGraph(next); setHistoryTick((value) => value + 1);
  };
  const undo = (): void => { const previous = undoStack.current.pop(); if (!previous) return; redoStack.current.push(graphRef.current); graphRef.current = previous; setGraph(previous); setHistoryTick((value) => value + 1); };
  const redo = (): void => { const next = redoStack.current.pop(); if (!next) return; undoStack.current.push(graphRef.current); graphRef.current = next; setGraph(next); setHistoryTick((value) => value + 1); };
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || (event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [historyTick]);

  const refresh = useCallback(async (confirmDiscard = false): Promise<void> => {
    if (confirmDiscard && dirty && !window.confirm(copy.discard)) return;
    setBusy(true);
    try {
      const version = await getIsosVersion();
      if (version.api_schema_version !== 2) throw new Error('This IsosUI build requires the IsOS v2 API. Update IsOS or use a compatible UI release.');
      const [document, catalog] = await Promise.all([getIsosGraph(), getIsosProfiles()]);
      graphRef.current = document.graph; setGraph(document.graph); setSavedGraph(JSON.stringify(document.graph)); setRevision(document.revision); setProfiles(catalog.profiles);
      undoStack.current = []; redoStack.current = []; setHistoryTick((value) => value + 1);
      setNewProfile((current) => current || catalog.profiles[0]?.id || '');
      setDiagnostics([]); setMessage(''); setConnected(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }, [dirty, copy.discard]);
  useEffect(() => {
    if (!consumeIsosToken()) return;
    if (ISOSUI_TARGET === 'local') void refresh();
    else setTokenReady(true);
  }, []);

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
  useEffect(() => {
    if (!flow || !connected || !graph.nodes.length) return;
    let adjustFrame = 0;
    const frame = requestAnimationFrame(() => {
      flow.fitView({ padding: 0.2, maxZoom: 1.25 });
      if (window.innerWidth < 1000 || !layout.library.open || layout.library.mode !== 'float') return;
      adjustFrame = requestAnimationFrame(() => {
        const viewport = flow.getViewport();
        void flow.setViewport({ ...viewport, x: viewport.x + Math.min(260, (window.innerWidth - 900) / 2) }, { duration: 250 });
      });
    });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(adjustFrame); };
  }, [flow, connected, graph.nodes.length]);
  const visualEdges = useMemo<Edge[]>(() => graph.edges.map((edge, index) => ({
    id: `e-${index}`, source: edge.to, target: edge.from, sourceHandle: edge.output ? `out:${edge.output}` : undefined,
    targetHandle: edge.input ? `in:${edge.input}` : undefined, label: edge.input && edge.output ? `${edge.output} / ${edge.input}` : undefined,
  })), [graph.edges]);
  const mutateNode = (id: string, change: Partial<IsosNode>): void => commitGraph((current) => editGraphNode(current, id, change));
  const renameNode = (oldId: string, id: string): string | null => {
    if (!slug.test(id) || graphRef.current.nodes.some((node) => node.id === id && node.id !== oldId)) return copy.duplicate;
    if (id === oldId) return null;
    commitGraph((current) => {
      const nextLayout = { ...current.layout }; if (nextLayout[oldId]) { nextLayout[id] = nextLayout[oldId]; delete nextLayout[oldId]; }
      return { ...current, nodes: current.nodes.map((node) => node.id === oldId ? { ...node, id } : node), edges: current.edges.map((edge) => ({ ...edge, from: edge.from === oldId ? id : edge.from, to: edge.to === oldId ? id : edge.to })), layout: nextLayout };
    });
    setSelected([id]); return null;
  };
  const removeSelected = (): void => {
    const ids = new Set(selected);
    commitGraph((current) => ({ ...current, nodes: current.nodes.filter((node) => !ids.has(node.id)), edges: current.edges.filter((edge) => !ids.has(edge.from) && !ids.has(edge.to)), layout: Object.fromEntries(Object.entries(current.layout || {}).filter(([id]) => !ids.has(id))) }));
    setSelected([]); setContext(null);
  };
  const addNode = (profileOverride?: IsosProfile, kindOverride?: 'service' | 'backend' | 'skill'): void => {
    const id = newId.trim();
    if (!slug.test(id) || graph.nodes.some((node) => node.id === id)) { setMessage(copy.duplicate); return; }
    const profile = profileOverride || profiles.find((item) => item.id === newProfile);
    if (!profile && !kindOverride) return;
    const role = profile?.id === 'eos.uds' ? undefined : profile?.id.startsWith('eos.') ? 'eos' : profile?.id.startsWith('egia.') ? 'egia' : undefined;
    const kind = profile?.id === 'eos.uds' ? 'endpoint' : profile ? 'component' : kindOverride || 'service';
    const node: IsosNode = { id, kind, ...(role ? { role } : {}), ...(profile ? { profile: { id: profile.id, version: profile.version } } : {}), enabled: false, owned: kind !== 'endpoint', settings: profile?.defaults || {}, ...(kind === 'service' || kind === 'backend' ? { launch: { command: [], timeout_ms: 30000 } } : {}) };
    commitGraph((current) => ({ ...current, nodes: [...current.nodes, node], layout: { ...current.layout, [id]: { x: 80 + current.nodes.length * 35, y: 90 + current.nodes.length * 35 } } }));
    setNewId(''); setSelected([id]); openWindow('config'); setMessage(''); setContext(null);
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
    commitGraph((current) => ({ ...current, edges: [...current.edges, { from, to, kind: 'depends_on', ...(inputName ? { input: inputName, output: outputName } : {}) }] }));
    setMessage(''); setContext(null);
  };
  const onConnect = (connection: Connection): void => {
    if (!connection.source || !connection.target) return;
    addEdge(connection.target, connection.source, connection.targetHandle?.replace(/^in:/, '') || '', connection.sourceHandle?.replace(/^out:/, '') || '');
  };
  const onNodesChange = (changes: NodeChange[]): void => {
    flowNodesChanged(changes);
  };
  const validate = async (): Promise<boolean> => {
    setBusy(true);
    try {
      const result = await validateIsosGraph(graph);
      setDiagnostics(result.diagnostics); setMessage(result.valid ? copy.valid : `${result.diagnostics.length} ${copy.diagnostics.toLowerCase()}`); if (result.diagnostics.length) openWindow('diagnostics');
      return result.valid;
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); return false; }
    finally { setBusy(false); }
  };
  const apply = async (): Promise<void> => {
    setBusy(true);
    try {
      const result = await validateIsosGraph(graph);
      setDiagnostics(result.diagnostics);
      if (!result.valid) { setMessage(`${result.diagnostics.length} ${copy.diagnostics.toLowerCase()}`); openWindow('diagnostics'); return; }
      const document = await applyIsosGraph(revision, graph);
      graphRef.current = document.graph; setGraph(document.graph); setSavedGraph(JSON.stringify(document.graph)); setRevision(document.revision); setMessage(copy.saved);
      undoStack.current = []; redoStack.current = []; setHistoryTick((value) => value + 1);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const connect = (): void => {
    if (tokenInput.trim()) setIsosToken(tokenInput);
    setTokenInput('');
    if (hasIsosToken()) void refresh();
  };

  const windowContent = (id: WindowId): React.ReactNode => {
    if (id === 'library') return <div className="isos-library">
      <label>{copy.search}<input value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label>{copy.nodeId}<input value={newId} onChange={(event) => setNewId(event.target.value.toLowerCase())} /></label>
      <div className="isos-library__items">
        {profiles.filter((profile) => `${profile.id} ${profile.label || ''} ${profile.description || ''}`.toLowerCase().includes(search.toLowerCase())).map((profile) => <button type="button" key={profile.id} disabled={!connected} onClick={() => addNode(profile)}><strong>{profile.label || profile.id}</strong><small>{profile.description || `${profile.id} · ${profile.version}`}</small><span>{copy.add}</span></button>)}
        {(['service', 'backend', 'skill'] as const).filter((kind) => kind.includes(search.toLowerCase())).map((kind) => <button type="button" key={kind} disabled={!connected} onClick={() => addNode(undefined, kind)}><strong>{copy[kind]}</strong><small>{kind}</small><span>{copy.add}</span></button>)}
      </div>
    </div>;
    if (id === 'config') return selectedNode ? <NodeConfiguration key={selectedNode.id} node={selectedNode} profile={selectedProfile} lang={lang} onUpdate={(change) => mutateNode(selectedNode.id, change)} onRename={(next) => renameNode(selectedNode.id, next)} onRemove={removeSelected} diagnostics={diagnostics.filter((item) => item.path.startsWith(`/nodes/${graph.nodes.indexOf(selectedNode)}/`))} /> : <p className="isos-window__hint">{copy.none}</p>;
    if (id === 'connections') return <div className="isos-connections">
      <label>{copy.consumer}<CustomSelect value={consumer} options={[{ value: '', label: '—' }, ...graph.nodes.map((node) => ({ value: node.id, label: node.id }))]} onChange={(value) => { setConsumer(value); setInput(''); }} ariaLabel={copy.consumer} /></label>
      <label>{copy.input}<CustomSelect value={input} options={[{ value: '', label: '—' }, ...inputs.map((port) => ({ value: port.name, label: `${port.name}: ${port.type}` }))]} onChange={setInput} ariaLabel={copy.input} /></label>
      <label>{copy.provider}<CustomSelect value={provider} options={[{ value: '', label: '—' }, ...graph.nodes.map((node) => ({ value: node.id, label: node.id }))]} onChange={(value) => { setProvider(value); setOutput(''); }} ariaLabel={copy.provider} /></label>
      <label>{copy.output}<CustomSelect value={output} options={[{ value: '', label: '—' }, ...outputs.map((port) => ({ value: port.name, label: `${port.name}: ${port.type}` }))]} onChange={setOutput} ariaLabel={copy.output} /></label>
      <button type="button" onClick={() => addEdge(consumer, provider, input, output)}>{copy.connectNodes}</button>
      <ul>{graph.edges.map((edge, index) => <li key={`${edge.from}-${edge.to}-${index}`}><span>{edge.from}.{edge.input || '*'} / {edge.to}.{edge.output || '*'}</span><button type="button" aria-label={`${copy.removeEdge}: ${edge.from} ${edge.to}`} onClick={() => commitGraph((current) => ({ ...current, edges: current.edges.filter((_, item) => item !== index) }))}>×</button></li>)}</ul>
    </div>;
    if (id === 'diagnostics') return diagnostics.length ? <ul className="isos-diagnostics">{diagnostics.map((item, index) => <li key={index}><button type="button" onClick={() => { const match = /^\/nodes\/(\d+)/.exec(item.path); if (match && graph.nodes[Number(match[1])]) { setSelected([graph.nodes[Number(match[1])].id]); openWindow('config'); } }}><code>{item.path}</code><span>{item.message}</span></button></li>)}</ul> : <p className="isos-window__hint">{copy.valid}</p>;
    if (id === 'minimap') return <MiniMap pannable zoomable />;
    return <p className="isos-window__hint">{copy.later}</p>;
  };
  const windowTitle = (id: WindowId): string => id === 'library' ? copy.library : id === 'minimap' ? copy.minimap : copy[id];
  const renderWindow = (id: WindowId): React.ReactElement => <WorkbenchWindow key={id} id={id} title={windowTitle(id)} placement={layout[id]} onChange={(change) => updateWindow(id, change)} onFocus={() => focusWindow(id)} onClose={() => updateWindow(id, { open: false })}>{windowContent(id)}</WorkbenchWindow>;

  return <ReactFlowProvider><main className={`isos-manager${toolsCollapsed ? ' isos-manager--tools-collapsed' : ''}`}>
    <header className="isos-manager__topbar" aria-label={copy.title}>
      <a className="isos-manager__home" href="https://www.os-island.com" aria-label="Island home" title="Island home">⌂</a>
      <button type="button" aria-label={copy.library} title={copy.library} aria-pressed={layout.library.open} onClick={() => toggleWindow('library')}>{WINDOW_ICONS.library}</button>
      <button type="button" className="isos-manager__collapse-tools" aria-label={toolsCollapsed ? copy.expandTools : copy.collapseTools} title={toolsCollapsed ? copy.expandTools : copy.collapseTools} aria-expanded={!toolsCollapsed} onClick={() => setToolsCollapsed((value) => !value)}>{toolsCollapsed ? '▸' : '▾'}</button>
      <nav className="isos-manager__window-toggles" aria-label={copy.title}>{(['config', 'connections', 'diagnostics', 'eos', 'egia', 'minimap'] as WindowId[]).map((id) => <button type="button" key={id} aria-label={windowTitle(id)} title={windowTitle(id)} aria-pressed={layout[id].open} onClick={() => toggleWindow(id)}>{WINDOW_ICONS[id]}</button>)}</nav>
      <div className="isos-manager__graph-actions"><button type="button" aria-label={copy.zoomOut} title={copy.zoomOut} onClick={() => void flow?.zoomOut()}>−</button><button type="button" aria-label={copy.fit} title={copy.fit} onClick={() => void flow?.fitView()}>⊡</button><button type="button" aria-label={copy.zoomIn} title={copy.zoomIn} onClick={() => void flow?.zoomIn()}>+</button><button type="button" aria-label="Undo" title="Undo" onClick={undo} disabled={!undoStack.current.length}>↶</button><button type="button" aria-label="Redo" title="Redo" onClick={redo} disabled={!redoStack.current.length}>↷</button></div>
      <span className={`isos-manager__save-state${dirty ? ' isos-manager__save-state--dirty' : ''}`} role="status">{dirty ? copy.unsaved : copy.clean}</span>
      <div className="isos-manager__save-actions"><button type="button" aria-label={copy.refresh} title={copy.refresh} disabled={busy || !connected} onClick={() => void refresh(true)}>↻</button><button type="button" aria-label={copy.validate} title={copy.validate} disabled={busy || !connected} onClick={() => void validate()}>✓</button><button type="button" disabled={busy || !connected || !dirty} onClick={() => void apply()}>{copy.apply}</button></div>
      <div className="isos-manager__prefs"><button type="button" onClick={() => onLanguageChange(lang === 'en' ? 'cn' : 'en')}>{lang === 'en' ? '中文' : 'EN'}</button><button type="button" onClick={() => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('island-theme', document.documentElement.dataset.theme); }} aria-label="Toggle theme" title="Toggle theme">◐</button><button type="button" onClick={() => setLayout(defaultLayout())} title={copy.resetLayout} aria-label={copy.resetLayout}>▦</button></div>
      <details className="isos-manager__menu"><summary aria-label="Workbench menu">☰</summary><div>
        {(['config', 'connections', 'diagnostics', 'eos', 'egia', 'minimap'] as WindowId[]).map((id) => <button type="button" key={id} onClick={() => toggleWindow(id)}>{windowTitle(id)}</button>)}
        <button type="button" onClick={() => void flow?.fitView()}>{copy.fit}</button><button type="button" onClick={undo} disabled={!undoStack.current.length}>Undo</button><button type="button" onClick={redo} disabled={!redoStack.current.length}>Redo</button>
        <button type="button" disabled={busy || !connected} onClick={() => void refresh(true)}>{copy.refresh}</button><button type="button" disabled={busy || !connected} onClick={() => void validate()}>{copy.validate}</button>
        <button type="button" onClick={() => onLanguageChange(lang === 'en' ? 'cn' : 'en')}>{lang === 'en' ? '中文' : 'EN'}</button>
        <button type="button" onClick={() => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('island-theme', document.documentElement.dataset.theme); }}>◐</button>
        <button type="button" onClick={() => setLayout(defaultLayout())}>{copy.resetLayout}</button>
      </div></details>
    </header>
    {message && <div className="isos-manager__message" role="status"><span>{message}</span><button type="button" onClick={() => setMessage('')} aria-label="Dismiss">×</button></div>}
    <div className="isos-manager__workspace" onClick={() => setContext(null)}>
      <ReactFlow nodes={flowNodes} edges={visualEdges} nodeTypes={nodeTypes} onInit={setFlow} onNodesChange={onNodesChange} onConnect={onConnect}
        onNodeDragStop={(_, node) => commitGraph((current) => ({ ...current, layout: { ...current.layout, [node.id]: node.position } }))}
        onSelectionChange={({ nodes }) => { const ids = nodes.map((node) => node.id); setSelected(ids); if (ids.length) openWindow('config'); }} selectionOnDrag selectionMode={SelectionMode.Partial}
        panOnDrag={[1]} zoomOnScroll zoomOnPinch onPaneContextMenu={(event) => { event.preventDefault(); setContext({ x: event.clientX, y: event.clientY }); }}
        onNodeContextMenu={(event, node) => { event.preventDefault(); setSelected([node.id]); openWindow('config'); setContext({ x: event.clientX, y: event.clientY }); }} fitView minZoom={0.2} maxZoom={2}>
        <Background color="var(--border)" />
      </ReactFlow>
      {!graph.nodes.length && <p className="isos-manager__empty">{copy.empty}</p>}
      {(['left', 'right', 'bottom'] as const).map((mode) => {
        const ids = WINDOW_IDS.filter((id) => layout[id].open && layout[id].mode === mode);
        if (!ids.length) return null;
        const size = Math.max(...ids.map((id) => mode === 'bottom' ? (layout[id].collapsed ? 36 : layout[id].height) : layout[id].width));
        return <div key={mode} className={`isos-manager__dock isos-manager__dock--${mode}${ids.every((id) => layout[id].collapsed) ? ' isos-manager__dock--collapsed' : ''}`} style={mode === 'bottom' ? { height: size } : { width: size }}>{ids.map(renderWindow)}</div>;
      })}
      {WINDOW_IDS.filter((id) => layout[id].mode === 'float').map(renderWindow)}
      {context && <div className="isos-manager__context" role="menu" style={{ left: Math.min(context.x, window.innerWidth - 190), top: Math.min(context.y - 42, window.innerHeight - 110) }}><button type="button" role="menuitem" onClick={() => { openWindow('library'); setContext(null); }}>{copy.contextAdd}</button><button type="button" role="menuitem" disabled={!selected.length} onClick={removeSelected}>{copy.contextRemove}</button></div>}
    </div>
    {!connected && <div className="isos-manager__pair-scrim"><form className="isos-manager__pair" onSubmit={(event) => { event.preventDefault(); connect(); }}><h1>{copy.title}</h1><p>{copy.open}</p><label>{copy.token}<input type="password" autoComplete="off" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} /></label><button type="submit" disabled={!tokenInput.trim() && !tokenReady}>{copy.connect}</button></form></div>}
  </main></ReactFlowProvider>;
};
