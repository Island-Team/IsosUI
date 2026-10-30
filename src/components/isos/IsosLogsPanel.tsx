import React, { useEffect, useRef, useState } from 'react';
import { getLogPage, type LogLine } from '../../services/isos/node-graph';
import type { Language } from '@/types';
import './isos-logs-panel.scss';

const SOURCES = ['isos', 'packages', 'graph', 'ui', 'eos', 'egia', 'mujoco', 'bridge', 'config'];
export function IsosLogsPanel({ lang, onClose, initialSource = 'isos' }: { lang: Language; onClose: () => void; initialSource?: string }): React.ReactElement {
  const [source, setSource] = useState(initialSource);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [error, setError] = useState('');
  const [following, setFollowing] = useState(true);
  const cursor = useRef<string | undefined>(undefined);
  const currentSource = useRef(source);
  const pending = useRef(false);
  useEffect(() => { currentSource.current = source; cursor.current = undefined; setLines([]); setError(''); }, [source]);
  useEffect(() => {
    if (!following) return;
    let stopped = false;
    const poll = async (): Promise<void> => {
      if (stopped || pending.current || document.visibilityState !== 'visible') return;
      pending.current = true; const requestedSource = source;
      try {
        const page = await getLogPage(requestedSource, cursor.current);
        if (!stopped && currentSource.current === requestedSource) { cursor.current = page.next_cursor || undefined; setLines((current) => [...(page.rotated ? [] : current), ...page.lines].slice(-1000)); setError(''); }
      } catch (reason) { if (!stopped) setError(reason instanceof Error ? reason.message : String(reason)); }
      finally { pending.current = false; }
    };
    void poll(); const timer = window.setInterval(() => { void poll(); }, 1200);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [source, following]);
  const copy = lang === 'cn' ? { title: 'IsOS 日志', source: '来源', follow: '实时跟踪', close: '关闭', empty: '没有日志' } : { title: 'IsOS logs', source: 'Source', follow: 'Follow', close: 'Close', empty: 'No log entries' };
  return <section className="node-graph-logs" aria-label={copy.title}><header><strong>{copy.title}</strong><label>{copy.source}<select value={source} onChange={(event) => setSource(event.target.value)}>{SOURCES.map((name) => <option key={name} value={name}>{name}</option>)}</select></label><label className="node-graph-logs__follow"><input type="checkbox" checked={following} onChange={(event) => setFollowing(event.target.checked)} />{copy.follow}</label><button type="button" onClick={onClose} aria-label={`${copy.close} ${copy.title}`}>×</button></header>{error && <p role="alert">{error}</p>}<pre role="log" aria-live="off">{lines.length ? lines.map((line) => `${line.timestamp} ${line.level.toUpperCase()} [${line.source}] ${line.message}`).join('\n') : copy.empty}</pre></section>;
}
