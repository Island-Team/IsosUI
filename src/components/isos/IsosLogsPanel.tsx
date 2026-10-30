import React, { useEffect, useRef, useState } from 'react';
import { getLogPage, type LogLine, type LogPage } from '../../services/isos/node-graph';
import type { Language } from '@/types';
import './isos-logs-panel.scss';

const SOURCES = ['all', 'isos', 'packages', 'graph', 'ui', 'services', 'eos', 'egia', 'mujoco', 'bridge', 'config'];
export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const;
export type LogLevel = typeof LOG_LEVELS[number];

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
  const [following, setFollowing] = useState(true);
  const cursor = useRef<string | undefined>(undefined);
  useEffect(() => {
    cursor.current = undefined;
    setLines([]);
    setError('');
  }, [source]);
  useEffect(() => {
    if (!following) return;
    let stopped = false;
    let pending = false;
    const poll = async (): Promise<void> => {
      if (stopped || pending || document.visibilityState !== 'visible') return;
      pending = true;
      try {
        const page = await getLogPage(source, cursor.current);
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
  }, [source, following]);

  const copy = lang === 'cn'
    ? { title: 'IsOS 日志', source: '来源', all: '所有来源', level: '显示级别', follow: '实时跟踪', close: '关闭', empty: '此级别没有日志', trace: '跟踪及以上', debug: '调试及以上', info: '信息及以上', warn: '警告及以上', error: '仅错误' }
    : { title: 'IsOS logs', source: 'Source', all: 'All sources', level: 'Display level', follow: 'Follow', close: 'Close', empty: 'No entries at this level', trace: 'Trace and above', debug: 'Debug and above', info: 'Info and above', warn: 'Warnings and errors', error: 'Errors only' };
  const visible = visibleLogLines(lines, level);
  return <section className="node-graph-logs" aria-label={copy.title}>
    <header>
      <strong>{copy.title}</strong>
      <label>{copy.source}<select value={source} onChange={(event) => setSource(event.target.value)}>{SOURCES.map((name) => <option key={name} value={name}>{name === 'all' ? copy.all : name}</option>)}</select></label>
      <label>{copy.level}<select value={level} onChange={(event) => setLevel(event.target.value as LogLevel)}>{LOG_LEVELS.map((name) => <option key={name} value={name}>{copy[name]}</option>)}</select></label>
      <label className="node-graph-logs__follow"><input type="checkbox" checked={following} onChange={(event) => setFollowing(event.target.checked)} />{copy.follow}</label>
      <button type="button" onClick={onClose} aria-label={`${copy.close} ${copy.title}`}>×</button>
    </header>
    {error && <p role="alert">{error}</p>}
    <pre role="log" aria-live="off">{visible.length ? visible.map((line) => `${line.timestamp} ${line.level.toUpperCase()} [${line.source}] ${line.message}`).join('\n') : copy.empty}</pre>
  </section>;
}
