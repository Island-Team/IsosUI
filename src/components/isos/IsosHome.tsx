import React, { useCallback, useEffect, useState } from 'react';
import { controlProcesses, getBackends, getNodeGraph, getProcessLogs, getProcessStatus, getSetupStatus, type BackendPackage, type ProcessStatus, type SetupStatus } from '@/services/isos/node-graph';
import type { Language } from '@/types';
import './workbench.scss';

const COPY = {
  en: { title: 'Runtime overview', subtitle: 'Configure the graph, then start the admitted backend and EOS processes.', refresh: 'Refresh', packages: 'Backend packages', noPackages: 'No MuJoCo backend is installed or linked. Use isos pkg install or isos pkg link, then refresh.', scenes: 'Scenes', devices: 'Devices', ready: 'Ready', attention: 'Needs attention', setup: 'Setup checks', noIssues: 'All reported checks passed.', processes: 'Managed processes', noProcesses: 'No processes are running.', run: 'Run', stop: 'Stop', restart: 'Restart', logs: 'Logs', selectProcess: 'Select a process', saved: 'Saved revision', active: 'Active revision', state: 'State', lastError: 'Last error', graph: 'Edit graph', pending: 'A saved revision differs from the active deployment. Restart to activate it.', unsaved: 'Graph edits are not applied. Apply them on the Graph page before running.', unavailable: 'IsOS is unavailable. Start it locally and refresh.', loading: 'Loading…' },
  cn: { title: '运行概览', subtitle: '配置节点图后，启动已通过验证的后端与 EOS 进程。', refresh: '刷新', packages: '后端软件包', noPackages: '尚未安装或链接 MuJoCo 后端。使用 isos pkg install 或 isos pkg link 后刷新。', scenes: '场景', devices: '设备', ready: '就绪', attention: '需要处理', setup: '配置检查', noIssues: '已报告的检查均通过。', processes: '受管进程', noProcesses: '没有运行中的进程。', run: '运行', stop: '停止', restart: '重启', logs: '日志', selectProcess: '选择进程', saved: '已保存修订', active: '运行中修订', state: '状态', lastError: '最近错误', graph: '编辑节点图', pending: '已保存修订与运行中修订不同。重启后生效。', unsaved: '节点图有未应用的修改。请先在节点图页面应用，再运行。', unavailable: '无法连接 IsOS。请在本机启动后刷新。', loading: '加载中…' },
} as const;

interface Props { lang: Language; onOpenGraph: () => void; graphDirty: boolean }
export function IsosHome({ lang, onOpenGraph, graphDirty }: Props): React.ReactElement {
  const copy = COPY[lang];
  const [revision, setRevision] = useState('');
  const [status, setStatus] = useState<ProcessStatus | null>(null);
  const [packages, setPackages] = useState<BackendPackage[]>([]);
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [selected, setSelected] = useState('');
  const [logText, setLogText] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [graph, process, backends, checks] = await Promise.all([getNodeGraph(), getProcessStatus(), getBackends().catch(() => ({ backends: [] })), getSetupStatus().catch(() => null)]);
      setRevision(graph.revision); setStatus(process); setPackages(backends.backends); setSetup(checks); setMessage('');
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
  const savedRevision = status?.saved_revision || revision;
  return <main className="isos-home">
    <header className="isos-home__heading"><div><p className="isos-eyebrow">IsOS · Aether v2</p><h1>{copy.title}</h1><p>{copy.subtitle}</p></div><div className="isos-home__actions"><button type="button" onClick={() => void refresh()} disabled={busy}>{copy.refresh}</button><button type="button" onClick={onOpenGraph}>{copy.graph}</button></div></header>
    {message && <p role="alert" className="isos-home__message">{message}</p>}
    <section className="isos-home__overview" aria-label={copy.state}><div><span>{copy.state}</span><strong>{status?.state || (status ? (status.processes.length ? 'running' : 'stopped') : '—')}</strong></div><div><span>{copy.saved}</span><code>{savedRevision || '—'}</code></div><div><span>{copy.active}</span><code>{status?.active_revision || '—'}</code></div></section>
    {status?.active_revision && status.active_revision !== savedRevision && <p role="status" className="isos-home__notice">{copy.pending}</p>}
    {graphDirty && <p role="status" className="isos-home__notice">{copy.unsaved}</p>}
    <section className="isos-home__controls" aria-label={copy.processes}><button type="button" onClick={() => void control('run')} disabled={busy || !revision || graphDirty}>{copy.run}</button><button type="button" onClick={() => void control('restart')} disabled={busy || !revision || graphDirty}>{copy.restart}</button><button type="button" onClick={() => void control('stop')} disabled={busy}>{copy.stop}</button></section>
    <div className="isos-home__columns"><section><h2>{copy.packages}</h2>{packages.length ? <ul className="isos-home__cards">{packages.map((entry) => <li key={`${entry.id}@${entry.version}`}><strong>{entry.id}</strong><code>v{entry.version}{entry.linked ? ' · linked' : ''}</code><span className={entry.ready ? 'isos-ready' : 'isos-attention'}>{entry.ready ? copy.ready : copy.attention}</span><p>{copy.scenes}: {entry.scenes.join(', ') || '—'}</p><p>{copy.devices}: {entry.devices.join(', ') || '—'}</p>{entry.issues.length > 0 && <ul>{entry.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}</li>)}</ul> : <p>{copy.noPackages}</p>}</section>
    <section><h2>{copy.setup}</h2>{setup?.issues?.length ? <ul>{setup.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul> : <p>{setup ? copy.noIssues : '—'}</p>}{status?.last_error && <p role="alert">{copy.lastError}: {status.last_error}</p>}</section></div>
    <section className="isos-home__processes"><h2>{copy.processes}</h2>{status?.processes.length ? <ul>{status.processes.map((process) => <li key={process.id}><div><strong>{process.id}</strong><span>{process.state || (process.pid ? 'running' : 'stopped')} · PID {process.pid ?? '—'} · restarts {process.restarts}</span>{process.last_error && <small role="alert">{process.last_error}</small>}</div><button type="button" onClick={() => void showLogs(process.id)}>{copy.logs}</button></li>)}</ul> : <p>{copy.noProcesses}</p>}{selected && <div className="isos-home__logs"><h3>{copy.logs}: {selected}</h3><pre aria-live="polite">{logText}</pre></div>}</section>
  </main>;
}
