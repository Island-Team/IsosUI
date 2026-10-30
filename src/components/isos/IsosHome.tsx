import React, { useCallback, useEffect, useState } from 'react';
import { applyNodeGraph, controlProcesses, getBackends, getNodeGraph, getProcessLogs, getProcessStatus, getSetupStatus, graphWithBackendScene, installBackend, linkBackend, requiredBackend, validateNodeGraph, type BackendPackage, type NodeGraph, type ProcessStatus, type SetupStatus } from '@/services/isos/node-graph';
import type { Language } from '@/types';
import './workbench.scss';

const COPY = {
  en: { title: 'Runtime overview', subtitle: 'Configure the graph, then start EOS. EOS supervises the admitted backend.', refresh: 'Refresh', packages: 'Backend packages', noPackages: 'No backend package is installed or linked.', required: 'Required by graph', missing: 'This exact package version is missing. An older version does not satisfy the graph.', linked: 'The required version is available.', sceneMismatch: 'The graph scene is not provided by this package.', chooseScene: 'Choose package scene', applyScene: 'Validate and apply scene', sceneApplied: 'Scene saved to the graph. Restart to activate the new revision.', sceneInvalid: 'Graph validation failed. Open Graph for diagnostics.', localBundle: 'Local bundle directory', link: 'Link local bundle', catalog: 'Install from catalog', packageDone: 'Package added. Validate and apply the graph before running.', scenes: 'Scenes', devices: 'Devices', ready: 'Ready', attention: 'Needs attention', setup: 'Setup checks', noIssues: 'All reported checks passed.', processes: 'Managed processes', noProcesses: 'No processes are running.', run: 'Run', stop: 'Stop', restart: 'Restart', logs: 'Logs', selectProcess: 'Select a process', saved: 'Saved revision', active: 'Active revision', state: 'State', lastError: 'Last error', graph: 'Edit graph', pending: 'A saved revision differs from the active deployment. Restart to activate it.', unsaved: 'Graph edits are not applied. Apply them on the Graph page before running.', unavailable: 'IsOS is unavailable. Start it locally and refresh.', loading: 'Loading…' },
  cn: { title: '运行概览', subtitle: '配置节点图后启动 EOS，由 EOS 监管已准入的后端。', refresh: '刷新', packages: '后端软件包', noPackages: '尚未安装或链接后端软件包。', required: '节点图所需', missing: '缺少此精确版本。旧版本不能满足节点图要求。', linked: '所需版本已就绪。', sceneMismatch: '节点图中的场景不属于此软件包。', chooseScene: '选择软件包场景', applyScene: '验证并应用场景', sceneApplied: '场景已保存到节点图。重启后启用新修订。', sceneInvalid: '节点图验证失败。请前往节点图页面查看诊断。', localBundle: '本地软件包目录', link: '链接本地软件包', catalog: '从目录安装', packageDone: '软件包已添加。运行前请验证并应用节点图。', scenes: '场景', devices: '设备', ready: '就绪', attention: '需要处理', setup: '配置检查', noIssues: '已报告的检查均通过。', processes: '受管进程', noProcesses: '没有运行中的进程。', run: '运行', stop: '停止', restart: '重启', logs: '日志', selectProcess: '选择进程', saved: '已保存修订', active: '运行中修订', state: '状态', lastError: '最近错误', graph: '编辑节点图', pending: '已保存修订与运行中修订不同。重启后生效。', unsaved: '节点图有未应用的修改。请先在节点图页面应用，再运行。', unavailable: '无法连接 IsOS。请在本机启动后刷新。', loading: '加载中…' },
} as const;

interface Props { lang: Language; onOpenGraph: () => void; graphDirty: boolean }
export function IsosHome({ lang, onOpenGraph, graphDirty }: Props): React.ReactElement {
  const copy = COPY[lang];
  const [revision, setRevision] = useState('');
  const [status, setStatus] = useState<ProcessStatus | null>(null);
  const [packages, setPackages] = useState<BackendPackage[]>([]);
  const [required, setRequired] = useState<{ id: string; version: string; scene?: string } | null>(null);
  const [graph, setGraph] = useState<NodeGraph | null>(null);
  const [selectedScene, setSelectedScene] = useState('');
  const [bundlePath, setBundlePath] = useState('');
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [selected, setSelected] = useState('');
  const [logText, setLogText] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [graph, process, backends, checks] = await Promise.all([getNodeGraph(), getProcessStatus(), getBackends().catch(() => ({ backends: [] })), getSetupStatus().catch(() => null)]);
      setRevision(graph.revision); setGraph(graph.graph); setRequired(requiredBackend(graph.graph)); setStatus(process); setPackages(backends.backends); setSetup(checks);
    } catch (error) { setMessage(error instanceof Error ? error.message : copy.unavailable); }
  }, [copy.unavailable]);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5000); return () => window.clearInterval(timer); }, [refresh]);
  const control = async (operation: 'run' | 'stop' | 'restart'): Promise<void> => {
    setBusy(true);
    try { await controlProcesses(operation, operation === 'stop' ? undefined : revision); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const showLogs = async (node: string): Promise<void> => {
    setSelected(node); setLogText(copy.loading);
    try { const result = await getProcessLogs(node); setLogText(result.text ?? result.lines?.join('\n') ?? ''); }
    catch (error) { setLogText(error instanceof Error ? error.message : String(error)); }
  };
  const addPackage = async (source: 'link' | 'catalog'): Promise<void> => {
    if (!required) return;
    setBusy(true); setMessage('');
    try {
      if (source === 'link') await linkBackend(required.id, required.version, bundlePath.trim());
      else await installBackend(required.id, required.version);
      await refresh(); setMessage(copy.packageDone);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const applyScene = async (): Promise<void> => {
    if (!graph || !required || !requiredPackage || graphDirty || busy || !requiredPackage.scenes.includes(selectedScene)) return;
    setBusy(true); setMessage('');
    try {
      const updated = graphWithBackendScene(graph, required.id, required.version, selectedScene);
      const validation = await validateNodeGraph(updated);
      if (!validation.valid) { setMessage(`${copy.sceneInvalid} ${validation.diagnostics.map((item) => item.message).join('; ')}`); return; }
      await applyNodeGraph(revision, updated);
      await refresh(); setMessage(copy.sceneApplied);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const savedRevision = status?.saved_revision || revision;
  const requiredInstalled = required && packages.some((entry) => entry.id === required.id && entry.version === required.version);
  const requiredPackage = required && packages.find((entry) => entry.id === required.id && entry.version === required.version);
  const sceneMismatch = requiredPackage && required?.scene && !requiredPackage.scenes.includes(required.scene);
  useEffect(() => { if (requiredPackage && !requiredPackage.scenes.includes(selectedScene)) setSelectedScene(requiredPackage.scenes[0] || ''); }, [requiredPackage, selectedScene]);
  return <main className="isos-home">
    <header className="isos-home__heading"><div><p className="isos-eyebrow">IsOS · Aether v2</p><h1>{copy.title}</h1><p>{copy.subtitle}</p></div><div className="isos-home__actions"><button type="button" onClick={() => void refresh()} disabled={busy}>{copy.refresh}</button><button type="button" onClick={onOpenGraph}>{copy.graph}</button></div></header>
    {message && <p role="alert" className="isos-home__message">{message}</p>}
    <section className="isos-home__overview" aria-label={copy.state}><div><span>{copy.state}</span><strong>{status?.state || (status ? (status.processes.length ? 'running' : 'stopped') : '—')}</strong></div><div><span>{copy.saved}</span><code>{savedRevision || '—'}</code></div><div><span>{copy.active}</span><code>{status?.active_revision || '—'}</code></div></section>
    {status?.active_revision && status.active_revision !== savedRevision && <p role="status" className="isos-home__notice">{copy.pending}</p>}
    {graphDirty && <p role="status" className="isos-home__notice">{copy.unsaved}</p>}
    {sceneMismatch && <div role="alert" className="isos-home__notice"><p>{copy.sceneMismatch} <code>{required.scene}</code> → {requiredPackage.scenes.join(', ')}</p><label htmlFor="isos-scene-choice">{copy.chooseScene}</label> <select id="isos-scene-choice" value={selectedScene} onChange={(event) => setSelectedScene(event.target.value)} disabled={busy || graphDirty}>{requiredPackage.scenes.map((scene) => <option key={scene} value={scene}>{scene}</option>)}</select> <button type="button" disabled={busy || graphDirty || !selectedScene} onClick={() => void applyScene()}>{copy.applyScene}</button> <button type="button" onClick={onOpenGraph}>{copy.graph}</button></div>}
    <section className="isos-home__controls" aria-label={copy.processes}><button type="button" onClick={() => void control('run')} disabled={busy || !revision || graphDirty}>{copy.run}</button><button type="button" onClick={() => void control('restart')} disabled={busy || !revision || graphDirty}>{copy.restart}</button><button type="button" onClick={() => void control('stop')} disabled={busy}>{copy.stop}</button></section>
    <div className="isos-home__columns"><section><h2>{copy.packages}</h2>{required && <div className="isos-home__package-required"><strong>{copy.required}: <code>{required.id}@{required.version}</code></strong><p role="status" className={requiredInstalled ? 'isos-ready' : 'isos-attention'}>{requiredInstalled ? copy.linked : copy.missing}</p>{!requiredInstalled && <div className="isos-home__package-install"><label htmlFor="isos-bundle-path">{copy.localBundle}</label><input id="isos-bundle-path" value={bundlePath} onChange={(event) => setBundlePath(event.target.value)} placeholder="/absolute/path/to/bundle" autoComplete="off" /><div><button type="button" disabled={busy || !bundlePath.trim().startsWith('/')} onClick={() => void addPackage('link')}>{copy.link}</button><button type="button" disabled={busy} onClick={() => void addPackage('catalog')}>{copy.catalog}</button></div></div>}</div>}{packages.length ? <ul className="isos-home__cards">{packages.map((entry) => <li key={`${entry.id}@${entry.version}`} tabIndex={0} aria-label={`${entry.id} v${entry.version}: ${entry.ready ? copy.ready : copy.attention}`}><strong>{entry.id}</strong><code>v{entry.version}{entry.linked ? ' · linked' : ''}</code><span className={entry.ready ? 'isos-ready' : 'isos-attention'}>{entry.ready ? copy.ready : copy.attention}</span><div className="isos-home__card-details"><p>{copy.scenes}: {entry.scenes.join(', ') || '—'}</p><p>{copy.devices}: {entry.devices.join(', ') || '—'}</p>{entry.issues.length > 0 && <ul>{entry.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}</div></li>)}</ul> : <p>{copy.noPackages}</p>}</section>
    <section><h2>{copy.setup}</h2>{setup?.issues?.length ? <ul>{setup.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul> : <p>{setup ? copy.noIssues : '—'}</p>}{status?.last_error && <p role="alert">{copy.lastError}: {status.last_error}</p>}</section></div>
    <section className="isos-home__processes"><h2>{copy.processes}</h2>{status?.processes.length ? <ul>{status.processes.map((process) => <li key={process.id}><div><strong>{process.id}</strong><span>{process.state || (process.pid ? 'running' : 'stopped')} · PID {process.pid ?? '—'} · restarts {process.restarts}</span>{process.last_error && <small role="alert">{process.last_error}</small>}</div><button type="button" onClick={() => void showLogs(process.id)}>{copy.logs}</button></li>)}</ul> : <p>{copy.noProcesses}</p>}{selected && <div className="isos-home__logs"><h3>{copy.logs}: {selected}</h3><pre aria-live="polite">{logText}</pre></div>}</section>
  </main>;
}
