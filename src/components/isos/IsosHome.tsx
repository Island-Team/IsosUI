import React, { useCallback, useEffect, useState } from 'react';
import { applyNodeGraph, controlProcesses, getBackends, getInstalledPackages, getNodeGraph, getNodeTypes, getProcessStatus, getSetupStatus, getCoreReadiness, previewBackendLink, graphWithBackendScene, installBackend, linkBackend, nodeGraphHasEditableShape, nodeGraphReadOnlyReason, requiredBackend, validateNodeGraph, type BackendPackage, type InstalledPackage, type NodeGraph, type ProcessStatus, type SetupStatus, type CoreReadiness, type LinkPreview } from '@/services/isos/node-graph';
import { IsosLogsPanel } from './IsosLogsPanel';
import { IsosApiError } from '@/services/isos/api-client';
import type { Language } from '@/types';
import './workbench.scss';

const COPY = {
  en: { title: 'Runtime overview', subtitle: 'Configure the graph, then start EOS. EOS supervises the admitted backend.', refresh: 'Refresh', packages: 'Backend packages', installed: 'Installed packages', noInstalled: 'No packages installed or linked yet.', linkedSource: 'Local link', archiveSource: 'Installed archive', packageId: 'Package ID', packageVersion: 'Version', manifestPath: 'Release manifest path (optional)', preview: 'Check local bundle', previewReady: 'Bundle verified', previewMissing: 'Enter an absolute bundle directory to check its manifest.', coreReadiness: 'Core build and launch readiness', notConfigured: 'Binary path not configured', filesChanged: 'Configured files changed', configured: 'Configured path', compatible: 'Compatible', graphConfigured: 'Graph configured', running: 'Running', noPackages: 'No backend package is installed or linked.', required: 'Required by graph', missing: 'This exact package version is missing. An older version does not satisfy the graph.', linked: 'The required version is available.', sceneMismatch: 'The graph scene is not provided by this package.', chooseScene: 'Choose package scene', applyScene: 'Validate and apply scene', sceneApplied: 'Scene saved to the graph. Restart to activate the new revision.', sceneInvalid: 'Graph validation failed. Open Graph for diagnostics.', localBundle: 'Local bundle directory', link: 'Link local bundle', catalog: 'Install from catalog', packageDone: 'Package added. Open Graph to preview and add its node set.', scenes: 'Scenes', devices: 'Devices', ready: 'Ready', attention: 'Needs attention', setup: 'Setup checks', noIssues: 'All reported checks passed.', processes: 'Managed processes', noProcesses: 'No processes are running.', run: 'Run', stop: 'Stop', restart: 'Restart', logs: 'Logs', saved: 'Saved revision', active: 'Active revision', state: 'State', lastError: 'Last error', graph: 'Edit graph', pending: 'A saved revision differs from the active deployment. Restart to activate it.', unsaved: 'Graph edits are not applied. Apply them on the Graph page before running.', unavailable: 'IsOS is unavailable. Start it locally and refresh.', scopePublish: 'Log scope publication failed before child launch. Status and current logs are being rechecked.', loading: 'Loading…' },
  cn: { title: '运行概览', subtitle: '配置节点图后启动 EOS，由 EOS 监管已准入的后端。', refresh: '刷新', packages: '后端软件包', installed: '已安装的软件包', noInstalled: '尚未安装或链接软件包。', linkedSource: '本地链接', archiveSource: '已安装归档', packageId: '软件包 ID', packageVersion: '版本', manifestPath: '发布清单路径（可选）', preview: '检查本地软件包', previewReady: '软件包已验证', previewMissing: '输入绝对路径以检查软件包清单。', coreReadiness: '核心构建与启动就绪状态', notConfigured: '未配置程序路径', filesChanged: '已配置文件发生变化', configured: '已配置路径', compatible: '兼容', graphConfigured: '节点图配置已生成', running: '运行中', noPackages: '尚未安装或链接后端软件包。', required: '节点图所需', missing: '缺少此精确版本。旧版本不能满足节点图要求。', linked: '所需版本已就绪。', sceneMismatch: '节点图中的场景不属于此软件包。', chooseScene: '选择软件包场景', applyScene: '验证并应用场景', sceneApplied: '场景已保存到节点图。重启后启用新修订。', sceneInvalid: '节点图验证失败。请前往节点图页面查看诊断。', localBundle: '本地软件包目录', link: '链接本地软件包', catalog: '从目录安装', packageDone: '软件包已添加。请打开节点图预览并添加其节点集。', scenes: '场景', devices: '设备', ready: '就绪', attention: '需要处理', setup: '配置检查', noIssues: '已报告的检查均通过。', processes: '受管进程', noProcesses: '没有运行中的进程。', run: '运行', stop: '停止', restart: '重启', logs: '日志', saved: '已保存修订', active: '运行中修订', state: '状态', lastError: '最近错误', graph: '编辑节点图', pending: '已保存修订与运行中修订不同。重启后生效。', unsaved: '节点图有未应用的修改。请先在节点图页面应用，再运行。', unavailable: '无法连接 IsOS。请在本机启动后刷新。', scopePublish: '子进程启动前日志范围发布失败，正在重新检查状态与当前日志。', loading: '加载中…' },
} as const;

interface Props { lang: Language; onOpenGraph: () => void; graphDirty: boolean }
export function IsosHome({ lang, onOpenGraph, graphDirty }: Props): React.ReactElement {
  const copy = COPY[lang];
  const [revision, setRevision] = useState('');
  const [status, setStatus] = useState<ProcessStatus | null>(null);
  const [packages, setPackages] = useState<BackendPackage[]>([]);
  const [installed, setInstalled] = useState<InstalledPackage[]>([]);
  const [required, setRequired] = useState<{ id: string; version: string; scene?: string } | null>(null);
  const [graph, setGraph] = useState<NodeGraph | null>(null);
  const [readOnlyReason, setReadOnlyReason] = useState<string | null>(null);
  const [selectedScene, setSelectedScene] = useState('');
  const [bundlePath, setBundlePath] = useState('');
  const [manifestPath, setManifestPath] = useState('');
  const [packageId, setPackageId] = useState('');
  const [packageVersion, setPackageVersion] = useState('');
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [readiness, setReadiness] = useState<CoreReadiness | null>(null);
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [previewIssue, setPreviewIssue] = useState('');
  const [logsOpen, setLogsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [graph, catalog, process, backends, receipts, checks, cores] = await Promise.all([getNodeGraph(), getNodeTypes().catch(() => null), getProcessStatus(), getBackends().catch(() => ({ backends: [] })), getInstalledPackages().catch(() => ({ installed: [] })), getSetupStatus().catch(() => null), getCoreReadiness().catch(() => null)]);
      const shaped = nodeGraphHasEditableShape(graph.graph);
      setRevision(graph.revision); setGraph(shaped ? graph.graph : null); setReadOnlyReason(nodeGraphReadOnlyReason(graph, catalog?.types || null)); setRequired(shaped ? requiredBackend(graph.graph) : null); setStatus(process); setPackages(backends.backends); setInstalled(receipts.installed); setSetup(checks); setReadiness(cores);
    } catch (error) { setReadOnlyReason('Graph compatibility could not be checked.'); setMessage(error instanceof Error ? error.message : copy.unavailable); }
  }, [copy.unavailable]);
  useEffect(() => { if (required) { setPackageId((current) => current || required.id); setPackageVersion((current) => current || required.version); } }, [required?.id, required?.version]);
  useEffect(() => {
    setLinkPreview(null);
    setPreviewIssue('');
    if (!bundlePath.trim().startsWith('/') || (manifestPath.trim() && !manifestPath.trim().startsWith('/'))) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void previewBackendLink(bundlePath.trim(), manifestPath.trim() || undefined).then((preview) => {
        if (cancelled) return;
        setLinkPreview(preview);
        setPackageId(preview.id);
        setPackageVersion(preview.version);
      }).catch((error: unknown) => { if (!cancelled) setPreviewIssue(error instanceof Error ? error.message : String(error)); });
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [bundlePath, manifestPath]);

  useEffect(() => { void refresh(); const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5000); return () => window.clearInterval(timer); }, [refresh]);
  const control = async (operation: 'run' | 'stop' | 'restart'): Promise<void> => {
    if (operation !== 'stop' && readOnlyReason) return;
    setBusy(true);
    try { await controlProcesses(operation, operation === 'stop' ? undefined : revision); await refresh(); }
    catch (error) {
      if (error instanceof IsosApiError && error.code === 'log_scope_publish_failed') {
        await refresh();
        window.dispatchEvent(new Event('isosui:log-scope-recheck'));
        setMessage(copy.scopePublish);
      } else setMessage(error instanceof Error ? error.message : String(error));
    }
    finally { setBusy(false); }
  };
  const addPackage = async (source: 'link' | 'catalog'): Promise<void> => {
    const id = packageId.trim(); const version = packageVersion.trim();
    const invalidLink = source === 'link' && (!linkPreview?.ready || linkPreview.id !== id || linkPreview.version !== version);
    if (!id || !version || invalidLink) return;
    setBusy(true); setMessage('');
    try {
      if (source === 'link') await linkBackend(id, version, bundlePath.trim(), manifestPath.trim() || undefined);
      else await installBackend(id, version);
      await refresh(); window.dispatchEvent(new Event('isosui:packages-changed')); setMessage(copy.packageDone);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const applyScene = async (): Promise<void> => {
    if (!graph || readOnlyReason || !required || !requiredPackage || graphDirty || busy || !requiredPackage.scenes.includes(selectedScene)) return;
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
    <header className="isos-home__heading"><div><p className="isos-eyebrow">IsOS · Aether v2</p><h1>{copy.title}</h1><p>{copy.subtitle}</p></div><div className="isos-home__actions"><button type="button" onClick={() => void refresh()} disabled={busy}>{copy.refresh}</button><button type="button" onClick={onOpenGraph}>{copy.graph}</button><button type="button" aria-expanded={logsOpen} onClick={() => setLogsOpen((open) => !open)}>{copy.logs}</button></div></header>
    {message && <p role="alert" className="isos-home__message">{message}</p>}
    {readOnlyReason && <p role="alert" className="isos-home__notice">{lang === 'cn' ? '只读节点图：' : 'Read-only graph: '}{readOnlyReason}</p>}
    <section className="isos-home__overview" aria-label={copy.state}><div><span>{copy.state}</span><strong>{status?.state || (status ? (status.processes.length ? 'running' : 'stopped') : '—')}</strong></div><div><span>{copy.saved}</span><code>{savedRevision || '—'}</code></div><div><span>{copy.active}</span><code>{status?.active_revision || '—'}</code></div></section>
    {status?.active_revision && status.active_revision !== savedRevision && <p role="status" className="isos-home__notice">{copy.pending}</p>}
    {graphDirty && <p role="status" className="isos-home__notice">{copy.unsaved}</p>}
    {sceneMismatch && <div role="alert" className="isos-home__notice"><p>{copy.sceneMismatch} <code>{required.scene}</code> → {requiredPackage.scenes.join(', ')}</p><label htmlFor="isos-scene-choice">{copy.chooseScene}</label> <select id="isos-scene-choice" value={selectedScene} onChange={(event) => setSelectedScene(event.target.value)} disabled={!!readOnlyReason || busy || graphDirty}>{requiredPackage.scenes.map((scene) => <option key={scene} value={scene}>{scene}</option>)}</select> <button type="button" disabled={!!readOnlyReason || busy || graphDirty || !selectedScene} onClick={() => void applyScene()}>{copy.applyScene}</button> <button type="button" onClick={onOpenGraph}>{copy.graph}</button></div>}
    <section className="isos-home__controls" aria-label={copy.processes}><button type="button" onClick={() => void control('run')} disabled={!!readOnlyReason || busy || !revision || graphDirty}>{copy.run}</button><button type="button" onClick={() => void control('restart')} disabled={!!readOnlyReason || busy || !revision || graphDirty}>{copy.restart}</button><button type="button" onClick={() => void control('stop')} disabled={busy}>{copy.stop}</button></section>
    <div className="isos-home__columns"><section><h2>{copy.installed}</h2>{installed.length ? <ul className="isos-home__installed">{installed.map((entry) => <li key={`${entry.id}@${entry.version}`}><strong>{entry.id}</strong><code>{entry.version}</code><span>{entry.local_link ? copy.linkedSource : copy.archiveSource}</span></li>)}</ul> : <p>{copy.noInstalled}</p>}<h2>{copy.packages}</h2>{required && <div className="isos-home__package-required"><strong>{copy.required}: <code>{required.id}@{required.version}</code></strong><p role="status" className={requiredInstalled ? 'isos-ready' : 'isos-attention'}>{requiredInstalled ? copy.linked : copy.missing}</p></div>}<div className="isos-home__package-install"><label htmlFor="isos-package-id">{copy.packageId}</label><input id="isos-package-id" value={packageId} onChange={(event) => setPackageId(event.target.value)} placeholder="island/mujoco-sim" autoComplete="off" /><label htmlFor="isos-package-version">{copy.packageVersion}</label><input id="isos-package-version" value={packageVersion} onChange={(event) => setPackageVersion(event.target.value)} placeholder="2.0.0" autoComplete="off" /><label htmlFor="isos-bundle-path">{copy.localBundle}</label><input id="isos-bundle-path" value={bundlePath} onChange={(event) => setBundlePath(event.target.value)} placeholder="/absolute/path/to/bundle" autoComplete="off" /><label htmlFor="isos-manifest-path">{copy.manifestPath}</label><input id="isos-manifest-path" value={manifestPath} onChange={(event) => setManifestPath(event.target.value)} placeholder="/absolute/path/to/release.json" autoComplete="off" />{bundlePath.trim() && <div className="isos-home__link-preview" role={previewIssue || linkPreview && !linkPreview.ready ? 'alert' : 'status'}><strong>{copy.preview}</strong>{previewIssue ? <p>{previewIssue}</p> : linkPreview ? <><p>{linkPreview.id}@{linkPreview.version} · {linkPreview.ready ? copy.previewReady : copy.attention}</p>{linkPreview.issues.length > 0 && <ul>{linkPreview.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}</> : <p>{copy.loading}</p>}</div>}<div><button type="button" disabled={busy || !linkPreview?.ready || linkPreview.id !== packageId.trim() || linkPreview.version !== packageVersion.trim()} onClick={() => void addPackage('link')}>{copy.link}</button><button type="button" disabled={busy || !packageId.trim() || !packageVersion.trim()} onClick={() => void addPackage('catalog')}>{copy.catalog}</button></div></div>{packages.length ? <ul className="isos-home__cards">{packages.map((entry) => <li key={`${entry.id}@${entry.version}`} tabIndex={0} aria-label={`${entry.id} v${entry.version}: ${entry.ready ? copy.ready : copy.attention}`}><strong>{entry.id}</strong><code>v{entry.version}{entry.linked ? ' · linked' : ''}</code><span className={entry.ready ? 'isos-ready' : 'isos-attention'}>{entry.ready ? copy.ready : copy.attention}</span><div className="isos-home__card-details"><p>{copy.scenes}: {entry.scenes.join(', ') || '—'}</p><p>{copy.devices}: {entry.devices.join(', ') || '—'}</p>{entry.issues.length > 0 && <ul>{entry.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}</div></li>)}</ul> : <p>{copy.noPackages}</p>}</section>
    <section><h2>{copy.coreReadiness}</h2>{readiness?.cores.length ? <ul className="isos-home__readiness">{readiness.cores.map((core) => <li key={core.core}><strong>{core.core.toUpperCase()} · {core.version || '—'}</strong><p>{copy.configured}: <code>{core.path || copy.notConfigured}</code></p><p>{copy.compatible}: {core.compatible ? copy.ready : copy.attention} · {copy.graphConfigured}: {core.graph_configured ? copy.ready : copy.attention} · {copy.running}: {core.running ? copy.ready : '—'}</p>{core.reason && <p role={core.ready ? 'status' : 'alert'}>{core.reason}</p>}{core.action && <p>{core.action}</p>}</li>)}</ul> : <p>{readiness ? copy.noIssues : '—'}</p>}<h2>{copy.setup}</h2>{setup?.issues?.length ? <ul>{setup.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul> : <p>{setup ? copy.noIssues : '—'}</p>}{status?.last_error && <p role="alert">{copy.lastError}: {status.last_error}</p>}</section></div>
    <section className="isos-home__processes"><h2>{copy.processes}</h2>{status?.processes.length ? <ul>{status.processes.map((process) => <li key={process.id}><div><strong>{process.id}</strong><span>{process.state || (process.pid ? 'running' : 'stopped')} · PID {process.pid ?? '—'} · restarts {process.restarts}</span>{process.last_error && <small role="alert">{process.last_error}</small>}</div></li>)}</ul> : <p>{copy.noProcesses}</p>}</section>
    {logsOpen && <div className="isos-home__logs"><IsosLogsPanel lang={lang} sources={status?.processes.map((process) => process.id)} onClose={() => setLogsOpen(false)} /></div>}
  </main>;
}
