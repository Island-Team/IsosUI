import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Handle, MiniMap, Position, ReactFlowProvider, type Connection, type Edge, type Node, type NodeChange, type NodeProps } from 'reactflow';
import 'reactflow/dist/style.css';
import { applyNodeGraph, getBackends, getNodeGraph, getNodeTypes, getProcessStatus, validateNodeGraph, type BackendPackage, type NodeGraph, type NodeGraphDiagnostic, type NodeInstance, type NodeTypeDefinition, type ProcessStatus } from '@/services/isos/node-graph';
import type { Language } from '@/types';
import { addNode, connectNodes, disconnectInput, graphNodes, nodePath, removeNode, renameNode, updateNode, type GraphNode } from './node-graph-edits';
import { nodeFamily, nodeSummary, portFamily } from './node-visuals';
import './node-graph-manager.scss';

interface Props { lang: Language; onDirtyChange?: (dirty: boolean) => void }
interface FlowData { entry: GraphNode; error: boolean }
const COPY = {
  en: { title: 'Node graph', connect: 'Connect to local IsOS', add: 'Add node', refresh: 'Refresh', validate: 'Validate', apply: 'Apply', saved: 'Graph saved. Restart managed processes to activate this revision.', valid: 'Graph is valid.', dirty: 'Unsaved changes', clean: 'Saved', catalog: 'Node library', inspector: 'Node configuration', diagnostics: 'Diagnostics', noSelection: 'Select a node to edit it.', noNodes: 'Add a registered node type to start.', id: 'Node ID', label: 'Label', description: 'Description', settings: 'Settings', gui: 'Show MuJoCo window when IsOS runs this backend', details: 'Hardware and advanced fields (JSON)', applyDetails: 'Apply fields', remove: 'Remove node', capabilities: 'Capabilities', source: 'Source', target: 'Target', invalid: 'Invalid JSON object.', duplicate: 'Node ID already exists or is invalid.', port: 'Connect matching typed ports by dragging from an output to an input.', robot: 'Robot', name: 'Name', lifecycle: 'Lifecycle', type: 'Type', disconnected: 'IsOS node graph API is unavailable.', stale: 'Graph changed on the server. Refresh and retry.', discard: 'Discard unsaved changes?', choose: 'Choose a type', process: 'Process status', noStatus: 'Process status is not available from this IsOS build.', search: 'Search types', undo: 'Undo', redo: 'Redo', hint: 'Double-click the canvas to add the selected type. Delete removes the selected node.', savedRevision: 'Saved', activeRevision: 'Active' },
  cn: { title: '节点图', connect: '连接本机 IsOS', add: '添加节点', refresh: '刷新', validate: '验证', apply: '应用', saved: '节点图已保存。重启受管进程以启用此修订。', valid: '节点图有效。', dirty: '未保存更改', clean: '已保存', catalog: '节点库', inspector: '节点配置', diagnostics: '诊断', noSelection: '选择节点后编辑配置。', noNodes: '添加已注册的节点类型以开始。', id: '节点 ID', label: '标签', description: '描述', settings: '设置', gui: 'IsOS 运行此后端时显示 MuJoCo 窗口', details: '硬件与高级字段（JSON）', applyDetails: '应用字段', remove: '删除节点', capabilities: '能力', source: '来源', target: '目标', invalid: 'JSON 对象无效。', duplicate: '节点 ID 已存在或无效。', port: '从输出端口拖到类型相同的输入端口以连接。', robot: '机器人', name: '名称', lifecycle: '生命周期', type: '类型', disconnected: 'IsOS 节点图 API 不可用。', stale: '服务器上的图已更改。刷新后重试。', discard: '放弃未保存的更改？', choose: '选择类型', process: '进程状态', noStatus: '当前 IsOS 版本未提供进程状态。', search: '搜索类型', undo: '撤销', redo: '重做', hint: '双击画布添加所选类型。Delete 可删除选中节点。', savedRevision: '已保存', activeRevision: '运行中' },
} as const;

function FlowNode({ data, selected }: NodeProps<FlowData>): React.ReactElement {
  const { entry } = data;
  return <div className={`node-graph-card node-graph-card--${nodeFamily(entry.definition)}${selected ? ' node-graph-card--selected' : ''}${data.error ? ' node-graph-card--error' : ''}`}>
    <div className="node-graph-card__heading"><small>{entry.definition ? `${entry.definition.core} / ${entry.definition.layer} / ${entry.definition.group}` : 'Unknown type'}</small><span>{entry.node.node_type.split('@').pop() || 'v1.0'}</span></div>
    <strong>{entry.node.label || entry.node.id}</strong><code>{entry.node.id}</code>
    {nodeSummary(entry.definition, entry.node).length > 0 && <ul className="node-graph-card__summary">{nodeSummary(entry.definition, entry.node).map((item) => <li key={item}>{item}</li>)}</ul>}
    <div className="node-graph-card__ports"><div>{entry.definition?.inputs.map((port) => <div className={`node-graph-card__port node-graph-port--${portFamily(port.data_type)}`} key={port.name}><Handle type="target" position={Position.Left} id={`in:${port.name}`} title={`${port.name}: ${port.data_type}`} /><span>{port.name}{port.required ? ' *' : ''}</span><small>{port.data_type}</small></div>)}</div><div>{entry.definition?.outputs.map((port) => <div className={`node-graph-card__port node-graph-card__port--output node-graph-port--${portFamily(port.data_type)}`} key={port.name}><span>{port.name}</span><small>{port.data_type}</small><Handle type="source" position={Position.Right} id={`out:${port.name}`} title={`${port.name}: ${port.data_type}`} /></div>)}</div></div>
  </div>;
}
const nodeTypes = { profile: FlowNode };
const DETAIL_FIELDS = ['frame_id', 'joint_names', 'adapter', 'health_timing', 'observation', 'movement', 'references'] as const;

function settingValue(value: unknown, dataType: string): string {
  if (dataType === 'string_array') return Array.isArray(value) ? value.join('\n') : '';
  if (dataType === 'string_table') return JSON.stringify(value || {}, null, 2);
  return value === undefined || value === null ? '' : String(value);
}
function parseSetting(raw: string, dataType: string): unknown {
  if (dataType === 'string_array') return raw.split('\n').map((part) => part.trim()).filter(Boolean);
  if (dataType === 'string_table') { const parsed: unknown = JSON.parse(raw); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object' || Object.values(parsed).some((value) => typeof value !== 'string')) throw new Error('Expected an object of strings.'); return parsed; }
  if (dataType === 'positive_integer' || dataType === 'nonnegative_integer') { const number = Number(raw); if (!Number.isInteger(number) || (dataType === 'positive_integer' ? number < 1 : number < 0)) throw new Error('Expected a valid integer.'); return number; }
  return raw;
}

function SettingEditor({ name, dataType, required, value, onChange, description, unit, min, max, choices }: { name: string; dataType: string; required: boolean; value: unknown; onChange: (value: unknown) => void; description?: string; unit?: string; min?: number; max?: number; choices?: string[] }): React.ReactElement {
  const [draft, setDraft] = useState(() => settingValue(value, dataType));
  const [error, setError] = useState('');
  useEffect(() => { setDraft(settingValue(value, dataType)); setError(''); }, [value, dataType]);
  const commit = (): void => { try { if (!draft.trim() && !required) { onChange(undefined); setError(''); return; } onChange(parseSetting(draft, dataType)); setError(''); } catch (issue) { setError(issue instanceof Error ? issue.message : String(issue)); } };
  return <label>{name}{required ? ' *' : ''}<small>{dataType}{unit ? ` · ${unit}` : ''}{description ? ` · ${description}` : ''}</small>{choices?.length ? <select value={draft} onChange={(event) => { setDraft(event.target.value); onChange(event.target.value); }}><option value="">—</option>{!choices.includes(draft) && draft && <option value={draft}>{draft}</option>}{choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select> : dataType === 'string_array' || dataType === 'string_table' ? <textarea rows={dataType === 'string_table' ? 4 : 3} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} /> : <input type={dataType.includes('integer') ? 'number' : 'text'} min={min} max={max} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />}{error && <small role="alert" className="node-graph-error">{error}</small>}</label>;
}

function HardwareFields({ node, definition, backends, onChange }: { node: NodeInstance; definition: NodeTypeDefinition; backends: BackendPackage[]; onChange: (change: Partial<NodeInstance>) => void }): React.ReactElement {
  const adapter = node.adapter || { type: 'mujoco-v2', settings: {} };
  const adapterSettings = adapter.settings || {};
  const setAdapter = (key: string, value: unknown): void => onChange({ adapter: { ...adapter, settings: { ...adapterSettings, [key]: value } } });
  const timing = node.health_timing || { poll_interval_ms: 100, stale_after_ms: 500 };
  const observation = node.observation || { max_rate_hz: 30, max_payload_bytes: 4096 };
  const movement = node.movement || { modes: [], limits: {} };
  const limits = definition.kind === 'base' ? ['max_linear_m_s', 'max_angular_rad_s', 'max_velocity_lease_ms'] : definition.kind === 'manipulator' ? ['max_joint_position_rad', 'max_joint_speed_rad_s'] : [];
  return <div className="node-graph-hardware-fields">
    <h3>Adapter</h3>
    {(['backend', 'socket_path', 'device_id', 'simulator_node'] as const).map((key) => <SettingEditor key={`${node.id}:${key}`} name={key} dataType="string" required value={adapterSettings[key]} choices={key === 'device_id' || key === 'simulator_node' ? backends.flatMap((backend) => backend.devices) : undefined} onChange={(value) => setAdapter(key, value)} />)}
    <SettingEditor name="frame_id" dataType="string" required value={node.frame_id} onChange={(value) => onChange({ frame_id: String(value) })} />
    {definition.kind === 'manipulator' && <SettingEditor name="joint_names" dataType="string_array" required value={node.joint_names} onChange={(value) => onChange({ joint_names: value as string[] })} />}
    <h3>Health timing</h3>
    {(['poll_interval_ms', 'stale_after_ms'] as const).map((key) => <SettingEditor key={`${node.id}:${key}`} name={key} dataType="positive_integer" required unit="ms" value={timing[key]} onChange={(value) => onChange({ health_timing: { ...timing, [key]: value as number } })} />)}
    <h3>Observation</h3>
    <label>max_rate_hz<small>number · Hz</small><input type="number" min={0.1} step="0.1" value={observation.max_rate_hz} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value) && value > 0) onChange({ observation: { ...observation, max_rate_hz: value } }); }} /></label>
    <SettingEditor name="max_payload_bytes" dataType="positive_integer" required unit="bytes" value={observation.max_payload_bytes} onChange={(value) => onChange({ observation: { ...observation, max_payload_bytes: value as number } })} />
    {limits.length > 0 && <><h3>Movement limits</h3><SettingEditor name="modes" dataType="string_array" required value={movement.modes} onChange={(value) => onChange({ movement: { ...movement, modes: value as string[] } })} />{limits.map((key) => <label key={key}>{key}<small>number · {key.endsWith('_ms') ? 'ms' : key.includes('rad') ? 'rad or rad/s' : 'm/s'}</small><input type="number" min={0} step="any" value={movement.limits[key] ?? ''} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= 0) onChange({ movement: { ...movement, limits: { ...movement.limits, [key]: value } } }); }} /></label>)}</>}
  </div>;
}

function NodeInspector({ entry, lang, onChange, onRename, onRemove }: { entry: GraphNode; lang: Language; onChange: (change: Partial<NodeInstance>) => void; onRename: (id: string) => void; onRemove: () => void }): React.ReactElement {
  const copy = COPY[lang];
  const [id, setId] = useState(entry.node.id);
  const [raw, setRaw] = useState('');
  const [error, setError] = useState('');
  const [backends, setBackends] = useState<BackendPackage[]>([]);
  useEffect(() => { void getBackends().then((result) => setBackends(result.backends)).catch(() => undefined); }, []);
  useEffect(() => { setId(entry.node.id); setRaw(JSON.stringify(Object.fromEntries(Object.entries(entry.node).filter(([key]) => (DETAIL_FIELDS as readonly string[]).includes(key))), null, 2)); setError(''); }, [entry.path, entry.node]);
  const commitDetails = (): void => { try { const parsed: unknown = JSON.parse(raw); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object' || Object.keys(parsed).some((key) => !(DETAIL_FIELDS as readonly string[]).includes(key))) throw new Error(copy.invalid); const details = parsed as Partial<NodeInstance>; for (const field of DETAIL_FIELDS) if (!(field in details) && field in entry.node) Object.assign(details, { [field]: undefined }); onChange(details); setError(''); } catch { setError(copy.invalid); } };
  return <section className="node-graph-inspector">
    <h2>{copy.inspector}</h2><p><strong>{copy.type}:</strong> {entry.node.node_type}</p><p><strong>{copy.lifecycle}:</strong> {entry.definition?.lifecycle || '—'}</p>
    <label>{copy.id}<input value={id} onChange={(event) => setId(event.target.value.toLowerCase())} onBlur={() => { if (id !== entry.node.id) onRename(id.trim()); }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
    <label>{copy.label}<input value={entry.node.label} onChange={(event) => onChange({ label: event.target.value })} /></label>
    <label>{copy.description}<textarea rows={2} value={entry.node.description} onChange={(event) => onChange({ description: event.target.value })} /></label>
    <h3>{copy.capabilities}</h3><div className="node-graph-capabilities">{entry.definition?.capabilities.map((capability) => <label key={capability}><input type="checkbox" checked={entry.node.capabilities?.includes(capability) || false} onChange={(event) => onChange({ capabilities: event.target.checked ? [...(entry.node.capabilities || []), capability] : (entry.node.capabilities || []).filter((item) => item !== capability) })} />{capability}</label>)}</div>
    {entry.definition?.settings.length ? <><h3>{copy.settings}</h3>{entry.node.node_type === 'isos.process.backend@v1.0' && <label><input type="checkbox" checked={String((entry.node.settings?.env as Record<string, string> | undefined)?.MUJOCO_GUI || '').toLowerCase() === '1' || String((entry.node.settings?.env as Record<string, string> | undefined)?.MUJOCO_GUI || '').toLowerCase() === 'true'} onChange={(event) => { const env = { ...((entry.node.settings?.env as Record<string, string> | undefined) || {}) }; if (event.target.checked) env.MUJOCO_GUI = '1'; else delete env.MUJOCO_GUI; onChange({ settings: { ...entry.node.settings, env } }); }} />{copy.gui}</label>}{entry.definition.settings.map((field) => <SettingEditor key={`${entry.path}:${field.name}`} name={field.name} dataType={field.data_type} required={field.required} description={field.description} unit={field.unit} min={field.min} max={field.max} choices={field.choices || (field.name === 'package' ? backends.map((backend) => backend.id) : field.name === 'version' ? backends.filter((backend) => backend.id === entry.node.settings?.package).map((backend) => backend.version) : field.name === 'scene' ? backends.filter((backend) => backend.id === entry.node.settings?.package && backend.version === entry.node.settings?.version).flatMap((backend) => backend.scenes) : field.name === 'device_id' ? backends.flatMap((backend) => backend.devices) : undefined)} value={entry.node.settings?.[field.name]} onChange={(value) => { const settings = { ...entry.node.settings }; if (value === undefined) delete settings[field.name]; else settings[field.name] = value; onChange({ settings }); }} />)}</> : null}
    {entry.definition?.lifecycle === 'adapter' && <HardwareFields node={entry.node} definition={entry.definition} backends={backends} onChange={onChange} />}
    {entry.definition?.lifecycle === 'adapter' && <><h3>{copy.details}</h3><textarea rows={12} value={raw} onChange={(event) => setRaw(event.target.value)} /><button type="button" onClick={commitDetails}>{copy.applyDetails}</button></>}
    {error && <p role="alert" className="node-graph-error">{error}</p>}<button type="button" className="node-graph-remove" onClick={onRemove}>{copy.remove}</button>
  </section>;
}

export function NodeGraphManager({ lang, onDirtyChange }: Props): React.ReactElement {
  const copy = COPY[lang];
  const [graph, setGraph] = useState<NodeGraph | null>(null);
  const [saved, setSaved] = useState('');
  const [revision, setRevision] = useState('');
  const [types, setTypes] = useState<NodeTypeDefinition[]>([]);
  const [processStatus, setProcessStatus] = useState<ProcessStatus | null>(null);
  const [selected, setSelected] = useState('');
  const [typeId, setTypeId] = useState('');
  const [newId, setNewId] = useState('');
  const [search, setSearch] = useState('');
  const [undoStack, setUndoStack] = useState<NodeGraph[]>([]);
  const [redoStack, setRedoStack] = useState<NodeGraph[]>([]);
  const [diagnostics, setDiagnostics] = useState<NodeGraphDiagnostic[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => { try { return JSON.parse(localStorage.getItem('isosui-v2-layout') || '{}') as Record<string, { x: number; y: number }>; } catch { return {}; } });
  const dirty = Boolean(graph && JSON.stringify(graph) !== saved);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  const entries = useMemo(() => graph ? graphNodes(graph, types) : [], [graph, types]);
  const visibleTypes = useMemo(() => types.filter((type) => `${type.id} ${type.core} ${type.layer} ${type.group} ${type.kind}`.toLowerCase().includes(search.toLowerCase())), [types, search]);
  const chosen = entries.find((entry) => entry.path === selected);
  const refresh = useCallback(async (confirm = false): Promise<void> => {
    if (confirm && dirty && !window.confirm(copy.discard)) return;
    setBusy(true);
    try { const [document, catalog, status] = await Promise.all([getNodeGraph(), getNodeTypes(), getProcessStatus().catch(() => null)]); setGraph(document.graph); setSaved(JSON.stringify(document.graph)); setRevision(document.revision); setTypes(catalog.types); setProcessStatus(status); setTypeId(catalog.types[0]?.id || ''); setSelected(''); setDiagnostics([]); setUndoStack([]); setRedoStack([]); setMessage(''); }
    catch (error) { setMessage(error instanceof Error ? error.message : copy.disconnected); }
    finally { setBusy(false); }
  }, [dirty, copy.discard, copy.disconnected]);
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { localStorage.setItem('isosui-v2-layout', JSON.stringify(positions)); }, [positions]);
  useEffect(() => { const beforeUnload = (event: BeforeUnloadEvent): void => { if (dirty) event.preventDefault(); }; window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload); }, [dirty]);
  const edit = (change: (current: NodeGraph) => NodeGraph): void => {
    if (!graph) return;
    const next = change(graph);
    if (next === graph || JSON.stringify(next) === JSON.stringify(graph)) return;
    setUndoStack((stack) => [...stack.slice(-49), graph]); setRedoStack([]); setGraph(next); setDiagnostics([]);
  };
  const undo = (): void => { if (!graph || !undoStack.length) return; setRedoStack((stack) => [...stack, graph]); setGraph(undoStack[undoStack.length - 1]); setUndoStack(undoStack.slice(0, -1)); };
  const redo = (): void => { if (!graph || !redoStack.length) return; setUndoStack((stack) => [...stack, graph]); setGraph(redoStack[redoStack.length - 1]); setRedoStack(redoStack.slice(0, -1)); };
  const add = (automatic = false): void => { const definition = types.find((type) => type.id === typeId); if (!definition || !graph) return; const id = automatic || !newId.trim() ? `${definition.group.replace(/[^a-z0-9-]/g, '') || 'node'}-${Math.random().toString(36).slice(2, 6)}` : newId.trim(); try { edit((current) => addNode(current, definition, id)); setSelected(nodePath(definition, id)); setNewId(''); setMessage(''); } catch (error) { setMessage(error instanceof Error ? error.message : copy.duplicate); } };
  const connect = (connection: Connection): void => { if (!graph || !connection.source || !connection.target) return; try { edit((current) => connectNodes(current, types, connection.source!, connection.sourceHandle?.replace(/^out:/, '') || '', connection.target!, connection.targetHandle?.replace(/^in:/, '') || '')); setMessage(''); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } };
  useEffect(() => { const onKey = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    else if ((event.key === 'Delete' || event.key === 'Backspace') && selected) { event.preventDefault(); edit((current) => removeNode(current, selected)); setSelected(''); }
  }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [graph, undoStack, redoStack, selected]);
  const validate = async (): Promise<boolean> => { if (!graph) return false; setBusy(true); try { const result = await validateNodeGraph(graph); setDiagnostics(result.diagnostics); setMessage(result.valid ? copy.valid : `${result.diagnostics.length} ${copy.diagnostics.toLowerCase()}`); return result.valid; } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); return false; } finally { setBusy(false); } };
  const apply = async (): Promise<void> => { if (!graph) return; setBusy(true); try { const checked = await validateNodeGraph(graph); setDiagnostics(checked.diagnostics); if (!checked.valid) { setMessage(`${checked.diagnostics.length} ${copy.diagnostics.toLowerCase()}`); return; } const document = await applyNodeGraph(revision, graph); setGraph(document.graph); setSaved(JSON.stringify(document.graph)); setRevision(document.revision); setMessage(copy.saved); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } };
  const nodes = useMemo<Node<FlowData>[]>(() => entries.map((entry, index) => ({ id: entry.path, type: 'profile', position: positions[entry.path] || { x: 50 + (index % 3) * 330, y: 50 + Math.floor(index / 3) * 220 }, data: { entry, error: diagnostics.some((item) => item.path.includes(entry.path)) }, selected: entry.path === selected })), [entries, positions, selected, diagnostics]);
  const edges = useMemo<Edge[]>(() => entries.flatMap((entry) => Object.entries(entry.node.inputs || {}).map(([input, source]) => { const outputType = entries.find((candidate) => candidate.path === source.node)?.definition?.outputs.find((port) => port.name === source.output)?.data_type || ''; const family = portFamily(outputType); return { id: `${entry.path}:${input}`, source: source.node, sourceHandle: `out:${source.output}`, target: entry.path, targetHandle: `in:${input}`, label: outputType || `${source.output} → ${input}`, className: `node-graph-edge--${family}`, animated: family === 'movement' || family === 'request' }; })), [entries]);
  const onNodesChange = (changes: NodeChange[]): void => setPositions((current) => {
    const moved = changes.filter((change): change is Extract<NodeChange, { type: 'position' }> => change.type === 'position' && Boolean(change.position));
    if (!moved.length) return current;
    const next = { ...current };
    for (const change of moved) if (change.position) next[change.id] = change.position;
    return next;
  });
  return <ReactFlowProvider><main className="node-graph-manager">
    <header><h1>{copy.title}</h1><div><button type="button" onClick={undo} disabled={!undoStack.length} title="Ctrl+Z">{copy.undo}</button><button type="button" onClick={redo} disabled={!redoStack.length} title="Ctrl+Shift+Z">{copy.redo}</button><button type="button" onClick={() => void refresh(true)} disabled={busy}>{copy.refresh}</button><button type="button" onClick={() => void validate()} disabled={busy || !graph}>{copy.validate}</button><button type="button" onClick={() => void apply()} disabled={busy || !dirty}>{copy.apply}</button><span role="status">{dirty ? copy.dirty : copy.clean} · {copy.savedRevision}: {revision.slice(0, 8) || '—'} · {copy.activeRevision}: {processStatus?.active_revision?.slice(0, 8) || '—'}</span></div></header>
    {message && <p className="node-graph-message" role="status">{message}</p>}
    <div className="node-graph-body"><aside className="node-graph-library"><h2>{copy.catalog}</h2><label>{copy.search}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.search} /></label><label>{copy.type}<select value={typeId} onChange={(event) => setTypeId(event.target.value)}>{visibleTypes.map((type) => <option key={type.id} value={type.id}>{type.core} / {type.layer} / {type.group} · {type.id}</option>)}</select></label><label>{copy.id}<input value={newId} onChange={(event) => setNewId(event.target.value.toLowerCase())} /></label><button type="button" onClick={() => add()} disabled={!graph || !typeId}>{copy.add}</button><p>{copy.port}</p><p>{copy.hint}</p><div className="node-graph-legend" aria-label="Port types"><h3>{lang === 'cn' ? '数据类型' : 'Data types'}</h3>{(['camera', 'observation', 'movement', 'request', 'outcome', 'health', 'status', 'context', 'plan'] as const).map((name) => <span className={`node-graph-port--${name}`} key={name}><i aria-hidden="true" />{name}</span>)}</div>{graph && <><h2>{copy.robot}</h2><label>{copy.id}<input value={graph.robot.id} onChange={(event) => edit((current) => ({ ...current, robot: { ...current.robot, id: event.target.value } }))} /></label><label>{copy.name}<input value={graph.robot.name} onChange={(event) => edit((current) => ({ ...current, robot: { ...current.robot, name: event.target.value } }))} /></label></>}</aside>
      <div className="node-graph-canvas">{graph ? <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onConnect={connect} onNodeClick={(_, node) => setSelected(node.id)} onPaneClick={() => setSelected('')} onDoubleClick={(event) => { if ((event.target as HTMLElement).classList.contains('react-flow__pane')) add(true); }} fitView minZoom={0.2} maxZoom={2}><Background color="var(--border)" /><MiniMap pannable zoomable /></ReactFlow> : <div className="node-graph-empty"><p>{copy.disconnected}</p><button type="button" onClick={() => void refresh()}>{copy.connect}</button></div>}{graph && !entries.length && <p className="node-graph-empty">{copy.noNodes}</p>}</div>
      <aside className="node-graph-side">{chosen ? <><NodeInspector key={chosen.path} entry={chosen} lang={lang} onChange={(change) => edit((current) => updateNode(current, chosen.path, change))} onRename={(id) => { try { edit((current) => renameNode(current, chosen.path, id)); setSelected(`${chosen.path.slice(0, chosen.path.lastIndexOf('/') + 1)}${id}`); setMessage(''); } catch { setMessage(copy.duplicate); } }} onRemove={() => { edit((current) => removeNode(current, chosen.path)); setSelected(''); }} /><h3>{copy.target}</h3><ul>{Object.entries(chosen.node.inputs || {}).map(([input, source]) => <li key={input}>{input} ← {source.node}.{source.output}<button type="button" aria-label={`${copy.remove} ${input}`} onClick={() => edit((current) => disconnectInput(current, chosen.path, input))}>×</button></li>)}</ul></> : <p>{copy.noSelection}</p>}
        <section><h2>{copy.diagnostics}</h2>{diagnostics.length ? <ul>{diagnostics.map((item, index) => <li key={index}><button className="node-graph-diagnostic" type="button" onClick={() => setSelected(entries.find((entry) => item.path.includes(entry.path))?.path || '')}><code>{item.path}</code><span>{item.message}</span></button></li>)}</ul> : <p>{copy.valid}</p>}</section><section><h2>{copy.process}</h2>{processStatus ? <ul>{processStatus.processes.map((process) => <li key={process.id}>{process.id}: {process.state || 'running'}, PID {process.pid ?? '—'}, restarts {process.restarts}</li>)}</ul> : <p>{copy.noStatus}</p>}</section></aside></div>
  </main></ReactFlowProvider>;
}
