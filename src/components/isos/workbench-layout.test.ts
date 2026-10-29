import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultLayout, loadLayout, saveLayout } from './workbench-layout';

const values = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } });
afterEach(() => values.clear());

describe('workbench layout', () => {
  it('restores a saved floating position and dock location', () => {
    const layout = defaultLayout();
    layout.library.x = 93;
    layout.config.mode = 'left';
    layout.config.open = true;
    layout.config.collapsed = true;
    saveLayout(layout);
    expect(loadLayout()).toEqual(layout);
  });

  it('resets malformed persisted layout', () => {
    values.set('isos-workbench-layout-v1', '{"library":{"mode":"remote"}}');
    expect(loadLayout()).toEqual(defaultLayout());
  });
});
