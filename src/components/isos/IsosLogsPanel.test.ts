import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../services/isos/config-manager', () => ({ request: vi.fn() }));
import { appendLogPage, IsosLogsPanel, visibleLogLines } from './IsosLogsPanel';
import type { LogLine } from '../../services/isos/node-graph';

const line = (level: string): LogLine => ({ timestamp: '2026-10-31T00:00:00Z', source: 'isos', level, message: level });

describe('IsOS log panel', () => {
  it('offers all sources and a warning display threshold in both languages', () => {
    const en = renderToStaticMarkup(React.createElement(IsosLogsPanel, { lang: 'en', onClose: () => undefined }));
    const cn = renderToStaticMarkup(React.createElement(IsosLogsPanel, { lang: 'cn', onClose: () => undefined }));
    expect(en).toContain('<option value="all" selected="">All sources</option>');
    expect(en).toContain('<option value="warn" selected="">Warnings and errors</option>');
    expect(cn).toContain('所有来源');
    expect(cn).toContain('警告及以上');
  });

  it('filters displayed severity without discarding the buffered stream', () => {
    const lines = ['trace', 'debug', 'info', 'warn', 'warning', 'error', 'unrecognized'].map(line);
    expect(visibleLogLines(lines, 'warn').map((entry) => entry.level)).toEqual(['warn', 'warning', 'error', 'unrecognized']);
    expect(visibleLogLines(lines, 'error').map((entry) => entry.level)).toEqual(['error']);
    expect(visibleLogLines(lines, 'info')).toHaveLength(5);
    expect(lines).toHaveLength(7);
  });

  it('clears the previous stream on rotation and bounds retained entries', () => {
    expect(appendLogPage([line('info')], { lines: [line('error')], next_cursor: 'next', rotated: true })).toEqual([line('error')]);
    expect(appendLogPage(Array.from({ length: 1000 }, () => line('info')), { lines: [line('error')], next_cursor: 'next', rotated: false })).toHaveLength(1000);
  });
});
