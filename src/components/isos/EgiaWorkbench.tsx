import React, { useCallback, useEffect, useState } from 'react';
import { getProcessStatus, type ProcessStatus } from '../../services/isos/node-graph';
import type { Language } from '@/types';
import { IsosLogsPanel } from './IsosLogsPanel';
import './egia-workbench.scss';

export type EgiaTab = 'overview' | 'logs';
export const egiaTabs = (lang: Language): Record<EgiaTab, string> => lang === 'cn' ? { overview: '概览', logs: '日志' } : { overview: 'Overview', logs: 'Logs' };

/** EGIA uses IsOS-owned status and logs until EGIA exposes its own runtime API. */
export function EgiaWorkbench({ lang, onOpenGraph }: { lang: Language; onOpenGraph: () => void }): React.ReactElement {
  const [tab, setTab] = useState<EgiaTab>('overview');
  const [status, setStatus] = useState<ProcessStatus | null>(null);
  const [error, setError] = useState('');
  const labels = egiaTabs(lang);
  const copy = lang === 'cn' ? { title: 'EGIA 工作台', graph: '节点图', refresh: '刷新', active: '运行中修订', saved: '已保存修订', state: '状态', unavailable: '当前没有可用的 EGIA 进程状态。请在节点图中配置并运行 EGIA。', api: 'IsOS 无法提供进程状态。', processes: 'EGIA 进程' } : { title: 'EGIA workbench', graph: 'Graph', refresh: 'Refresh', active: 'Active revision', saved: 'Saved revision', state: 'State', unavailable: 'No EGIA process status is available. Configure and run EGIA from the graph.', api: 'IsOS process status is unavailable.', processes: 'EGIA processes' };
  const refresh = useCallback(async (): Promise<void> => { try { setStatus(await getProcessStatus()); setError(''); } catch (reason) { setStatus(null); setError(reason instanceof Error ? reason.message : copy.api); } }, [copy.api]);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5000); return () => window.clearInterval(timer); }, [refresh]);
  const egia = status?.processes.filter((process) => /(^|[^a-z])egia([^a-z]|$)/i.test(process.id)) || [];
  return <main className="egia-workbench"><header><p className="isos-eyebrow">EGIA · Aether v2</p><h1>{copy.title}</h1><div><button type="button" onClick={() => void refresh()}>{copy.refresh}</button><button type="button" onClick={onOpenGraph}>{copy.graph}</button></div></header><nav aria-label={copy.title}><button type="button" aria-current={tab === 'overview' ? 'page' : undefined} onClick={() => setTab('overview')}>{labels.overview}</button><button type="button" aria-current={tab === 'logs' ? 'page' : undefined} onClick={() => setTab('logs')}>{labels.logs}</button></nav>{error && <p role="alert" className="egia-workbench__notice">{error}</p>}{tab === 'overview' ? <section><h2>{labels.overview}</h2><dl><dt>{copy.state}</dt><dd>{status?.state || '—'}</dd><dt>{copy.saved}</dt><dd><code>{status?.saved_revision || '—'}</code></dd><dt>{copy.active}</dt><dd><code>{status?.active_revision || '—'}</code></dd></dl><h2>{copy.processes}</h2>{egia.length ? <ul>{egia.map((process) => <li key={process.id}><strong>{process.id}</strong> · {process.state || (process.pid ? 'running' : 'stopped')} · PID {process.pid ?? '—'}{process.last_error && <p role="alert">{process.last_error}</p>}</li>)}</ul> : <p>{copy.unavailable}</p>}</section> : <IsosLogsPanel lang={lang} initialSource="egia" onClose={() => setTab('overview')} />}</main>;
}
