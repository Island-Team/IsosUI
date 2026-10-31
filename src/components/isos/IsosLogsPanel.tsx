import React, { useEffect, useRef, useState } from 'react';
import { getLogPage, type LogLevel, type LogLine, type LogPage } from '../../services/isos/node-graph';
import type { Language } from '@/types';
import { getBrowserLogs, subscribeBrowserLogs } from '../../services/isos/browser-logs';
import './isos-logs-panel.scss';

const SOURCES = ['all', 'isos', 'packages', 'graph', 'browser', 'ui', 'services', 'eos', 'egia', 'mujoco', 'bridge', 'config'];
export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const;

/** Unknown child levels are shown as warnings rather than silently hidden. */
export function visibleLogLines(lines: LogLine[], threshold: LogLevel): LogLine[] {
  const minimum = LOG_LEVELS.indexOf(threshold);
  return lines.filter((line) => {
    const level = line.level.toLowerCase() === 'warning' ? 'warn' : line.level.toLowerCase();
    const rank = LOG_LEVELS.indexOf(level as LogLevel);
    return (rank < 0 ? LOG_LEVELS.indexOf('warn') : rank) >= minimum;
  });
}

/** A rotation starts a new stream; an empty poll keeps the last usable cursor. */
export function appendLogPage(current: LogLine[], page: LogPage): LogLine[] {
  return [...(page.rotated ? [] : current), ...page.lines].slice(-1000);
}

export function IsosLogsPanel({ lang, onClose, initialSource = 'all' }: { lang: Language; onClose: () => void; initialSource?: string }): React.ReactElement {
  const [source, setSource] = useState(initialSource);
  const [level, setLevel] = useState<LogLevel>('warn');
  const [lines, setLines] = useState<LogLine[]>([]);
  const [error, setError] = useState('');
  const [browserLines, setBrowserLines] = useState(getBrowserLogs);
  const [following, setFollowing] = useState(true);
  const cursor = useRef<string | undefined>(undefined);
  useEffect(() => subscribeBrowserLogs(() => setBrowserLines(getBrowserLogs())), []);
  useEffect(() => {
    cursor.current = undefined;
    setLines([]);
    setError('');
  }, [source, level]);
  useEffect(() => {
    if (!following || source === 'browser') return;
    let stopped = false;
    let pending = false;
    const poll = async (): Promise<void> => {
      if (stopped || pending || document.visibilityState !== 'visible') return;
      pending = true;
      try {
        const page = await getLogPage(source, level, cursor.current);
        if (!stopped) {
          cursor.current = page.next_cursor ?? (page.rotated ? undefined : cursor.current);
          setLines((current) => appendLogPage(current, page));
          setError('');
        }
      } catch (reason) {
        if (!stopped) setError(reason instanceof Error ? reason.message : String(reason));
      } finally { pending = false; }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 1200);
    const onVisible = (): void => { if (document.visibilityState === 'visible') void poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [source, level, following]);

  const copy = lang === 'cn'
    ? { title: 'IsOS 与浏览器日志', source: '来源', all: '所有来源', level: '最低级别', follow: '实时跟踪', close: '关闭', empty: '此级别没有日志', trace: '跟踪及以上', debug: '调试及以上', info: '信息及以上', warn: '警告及以上', error: '仅错误' }
    : { title: 'IsOS and browser logs', source: 'Source', all: 'All sources', level: 'Minimum level', follow: 'Follow', close: 'Close', empty: 'No entries at this level', trace: 'Trace and above', debug: 'Debug and above', info: 'Info and above', warn: 'Warnings and errors', error: 'Errors only' };
  const combined = source === 'browser' ? browserLines : source === 'all' ? [...lines, ...browserLines].sort((a, b) => a.timestamp.localeCompare(b.timestamp)) : lines;
  const visible = visibleLogLines(combined, level);
  return <section className="node-graph-logs" aria-label={copy.title}>
    <header>
      <strong>{copy.title}</strong>
      <label>{copy.source}<select value={source} onChange={(event) => setSource(event.target.value)}>{(SOURCES.includes(source) ? SOURCES : [source, ...SOURCES]).map((name) => <option key={name} value={name}>{name === 'all' ? copy.all : name === 'browser' ? (lang === 'cn' ? '浏览器' : 'Browser') : name}</option>)}</select></label>
      <label>{copy.level}<select value={level} onChange={(event) => setLevel(event.target.value as LogLevel)}>{LOG_LEVELS.map((name) => <option key={name} value={name}>{copy[name]}</option>)}</select></label>
      <label className="node-graph-logs__follow"><input type="checkbox" checked={following} onChange={(event) => setFollowing(event.target.checked)} />{copy.follow}</label>
      <button type="button" onClick={onClose} aria-label={`${copy.close} ${copy.title}`}>×</button>
    </header>
    {error && <p role="alert">{error}</p>}
    <pre role="log" aria-live="off">{visible.length ? visible.map((line) => `${line.timestamp} ${line.level.toUpperCase()} [${line.source}] ${line.message}`).join('\n') : copy.empty}</pre>
  </section>;
}
